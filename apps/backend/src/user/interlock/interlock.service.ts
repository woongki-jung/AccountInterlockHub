import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';
import { EntryContextStore } from '../entry-context/entry-context.store';
import { EntryDto } from './dto/entry.dto';

/**
 * 이용 동의 진입 서비스 — PROC-201 B1a / SVC-004 / FN-007(요청 키값 발급)·FN-016(연동이력 생성, 내부 PROC-403).
 *
 * 책임:
 *  - 활성 구성 참조 확인(EX-SEC-004)·지정 파라미터 정의(ENT-003) 로드.
 *  - FN-007: 요청 키값(UUID v4) 자체 발급 + 진입 컨텍스트(회원 키 포함) 비영속 메모리 저장(무저장, DATA-001-01).
 *  - FN-016: 지정 구성의 연동이력(ENT-007) 1건 INSERT(지정 사용자 키값 원문 무변형, DATA-005-03). 지정 값
 *    누락·공백은 진입 거부(400 EX-BIZ-007, 컨텍스트 폐기·이력 미생성·요청 키값 미반환). 미지정 구성은 미기록(BR-203).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 요청 제한(FN-014)은 진입점 미들웨어가 선적용한다.
 */

const USER_KEY_MAX_LEN = 512; // ENT-007 user_key varchar(512) — 초과는 진입 검증에서 거부(SEC-004)

// 활성 구성 조회 행(지정 여부 판정용).
interface ActiveConfigRow {
  id: string;
  user_key_param_id: string | null;
}

// 전달 파라미터 정의 행(지정 파라미터 해석용, ENT-003).
interface ParameterRow {
  id: string;
  param_name: string;
  source_key_a: string;
}

// 진입 응답(MDL-202). SuccessInterceptor 가 { success, data } 로 감싼다.
export interface EntryResponse {
  requestKey: string;
}

@Injectable()
export class InterlockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly entryContextStore: EntryContextStore,
    private readonly auditService: AuditService,
  ) {}

  /** POST /interlock/entry — 진입·요청 키값 발급·연동이력 기록 개시(PROC-201). */
  async processEntry(dto: EntryDto): Promise<EntryResponse> {
    const parameters: Record<string, string> = dto.parameters ?? {};

    // 1. 활성 구성 참조 확인(지정 여부·파라미터 정의 로드). 없으면 400 EX-SEC-004.
    const configRows: ActiveConfigRow[] = await this.dataSource.query(
      `SELECT id, user_key_param_id FROM "TBL_INTERLOCK_CONFIG"
       WHERE config_code = $1 AND is_active = true AND deleted_at IS NULL`, // UQ_CONFIG_CODE
      [dto.configCode],
    );
    const config = configRows[0];
    if (!config) {
      throw new AppException('EX-SEC-004'); // 유효하지 않은 구성 참조(진입 거부)
    }
    const paramDefs: ParameterRow[] = await this.dataSource.query(
      `SELECT id, param_name, source_key_a FROM "TBL_INTERLOCK_PARAMETER" WHERE config_id = $1`, // ENT-003
      [config.id],
    );

    // 2. FN-007 요청 키값 발급 + 진입 컨텍스트 비영속 저장(회원 키 무저장, DATA-002-02·DATA-001-01).
    const requestKey = randomUUID(); // UUID v4 — 역추적 불가
    this.entryContextStore.put(requestKey, {
      configCode: dto.configCode,
      memberKey: dto.memberKey,
      parameters,
      consentConfirmed: false,
    });

    // 3. FN-016 연동이력 기록 개시(내부 PROC-403). 지정 값 누락 등 throw 시 컨텍스트 폐기(부작용 없음).
    try {
      await this.createInterlockHistory(config, paramDefs, parameters, requestKey);
    } catch (err) {
      this.entryContextStore.remove(requestKey); // 진입 거부 — 컨텍스트 폐기·요청 키값 미반환
      throw err;
    }

    // 4. 진입 응답(요청 키값을 서비스 A 로 반환, DATA-002-03).
    return { requestKey };
  }

  /**
   * FN-016 연동이력 생성(내부 PROC-403, BIZ-004-01/02/05·DATA-005·BR-203).
   *  - 미지정 구성(user_key_param_id NULL): 미기록·정상 진입(방어적 — 지정 필수화 BIZ-001-07 이후 정상 미도달).
   *  - 지정 구성: 지정 파라미터 값 추출·완결성 검증 후 ENT-007 1건 INSERT(원문 무변형). 값 누락·공백 → 400 EX-BIZ-007.
   */
  private async createInterlockHistory(
    config: ActiveConfigRow,
    paramDefs: ParameterRow[],
    parameters: Record<string, string>,
    requestKey: string,
  ): Promise<void> {
    // 1) 지정 여부 확인(BIZ-004-05·BIZ-001-07). 미지정 구성은 이력 미기록(대상 밖).
    if (config.user_key_param_id == null) {
      return;
    }

    // 2) 지정 파라미터 값 추출·완결성 검증(BIZ-004-02).
    const designated = paramDefs.find((p) => p.id === config.user_key_param_id);
    if (!designated) {
      // 지정 참조가 가리키는 파라미터 행 부재 — 데이터 정합 위반(정상 등록 구성은 정확히 1개 실재). 내부 오류.
      throw new AppException('EX-FN-999');
    }
    // 지정 파라미터의 source_key_a 로 진입 값을 원문 추출(ENT-003 §구현 가이드 정합) — 진입 컨텍스트는 서비스 A 원천 키명으로 키잉된다.
    const userKey = parameters[designated.source_key_a];
    if (userKey == null || userKey.trim().length === 0) {
      throw new AppException('EX-BIZ-007'); // 진입 거부(이력 미생성, 부작용 없음)
    }
    if (userKey.length > USER_KEY_MAX_LEN) {
      // 초과 입력은 진입 검증에서 거부(ENT-007 구현 가이드·SEC-004) — 저장 시점 절단 방지.
      throw new AppException('EX-SEC-004');
    }

    // 3~4) 이력 레코드 구성·영속화(DATA-005-01/02/03/04). 원문 무변형(해석·해시·암복호화 금지, EXC-DATA-07 예외).
    const now = new Date();
    await this.dataSource.query(
      `INSERT INTO "TBL_INTERLOCK_HISTORY"
         (request_key, config_id, user_key, requested_at, callback_received, callback_received_at)
       VALUES ($1, $2, $3, $4, false, null)`, // PK(request_key) 로 연동 요청 1건당 최대 1건. created_at 은 DB 기본값 now()
      [requestKey, config.id, userKey, now],
    );

    // 5) 감사(OPS-002·SEC-005-01) — userKey 는 마스킹만, 원문 미기록.
    await this.auditService.write({
      eventType: AuditEventType.HISTORY_CREATE,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: requestKey,
      result: AuditResult.SUCCESS,
      detail: `userKey=${maskToken(userKey)}`,
    });
  }
}
