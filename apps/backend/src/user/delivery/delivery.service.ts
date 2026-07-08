import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AppException } from '../../common/envelope/app.exception';
import { EntryContext } from '../entry-context/entry-context.store';
import { ProcessStatusService } from '../status/process-status.service';

/**
 * 서비스 B 전달·연동 실행 서비스 — PROC-203 / SVC-005 / FN-012_deliverToServiceB.
 *
 * PROC-202 동의(AGREE) 경로에서 내부 호출된다(독립 엔드포인트 아님). 동의가 완료된 연동 요청을 관리자 구성의
 * 서비스 B 전달 주소로 중개한다. 회원 키는 원본 무변형으로 전달 페이로드에만 실어 보내고 저장하지 않으며
 * (SEC-002·DATA-001), 전달 실패 시 최대 2회 재시도(최초 포함 3회) 후 실패로 확정한다(BR-202). 전달 결과
 * (성공·실패)는 처리 상태 1건으로 반드시 저장한다(EXC-BIZ-06). 외부 호출은 BE 를 경유한다(Node 전역 fetch).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 회원 키·요청 키값은 로그 노출 시에도 원문을 남기지 않는다.
 *
 * ⚠ 사양 미결(완료 보고 WARN): 서비스 B 전달의 인증·서명(HMAC 등) 계약이 참조 사양(FN-012·PROC-203·SEC-002·
 *   external-apis §미결)에 정의되어 있지 않다. 임의 서명을 발명하지 않고 평문 BE 경유 HTTP 전달로 구현한다.
 */

// processDecision 이 조회해 넘기는 전달 대상 구성(활성·동의 완료 확인됨). MDL-101 부분집합.
export interface DeliveryConfig {
  id: string; // 연동 구성 참조(ENT-001.id) — 상태 저장·파라미터 정의 조회 키
  serviceBDeliveryUrl: string; // 전달 대상 주소(구성 외 주소 금지, BIZ-003-02)
  serviceBHttpMethod: string; // 전달 방식(GET/POST/PUT/PATCH)
}

// 전달 파라미터 정의 행(ENT-003, deliver_to_b=true).
interface DeliverParamRow {
  param_name: string; // 허브·서비스 B 기준 키명(전달 페이로드 키)
  source_key_a: string; // 서비스 A 진입 원천 키명(진입 값 조회 키 — ctx.parameters 의 키)
}

// 외부 호출 단건 타임아웃(ms). build 기본안 — 확정 시 BIZ-003 리비전(FN-012 §구현 가이드).
// 최초 1 + 재시도 2회라 최악 3×타임아웃까지 동기 지연될 수 있다.
const DELIVERY_TIMEOUT_MS = 10_000;
// 재시도 상한(최초 포함 최대 3회 호출 — BR-202). attempt<=MAX_ATTEMPT_INDEX 동안 반복.
const MAX_ATTEMPT_INDEX = 2;

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly processStatusService: ProcessStatusService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * PROC-203 연동 실행·전달·상태 저장(FN-012). 동의 완료 컨텍스트를 받아 서비스 B 로 전달하고, 결과를 상태 1건으로 저장한다.
   * 성공: 반환. 실패(재시도 후): 상태 저장 후 DELIVERY_FAIL 감사 + 502 EX-BIZ-004 throw(상태는 저장됨).
   */
  async deliverAndSave(
    ctx: EntryContext,
    requestKey: string,
    config: DeliveryConfig,
    now: Date,
  ): Promise<void> {
    // B1. 사전 조건 — 미동의 전달 차단(BIZ-003-01). AGREE 경로는 항상 true 로 진입하므로 방어적 가드.
    if (!ctx.consentConfirmed) {
      await this.auditService.write({
        eventType: AuditEventType.DELIVERY_BLOCK,
        actorType: ActorType.SYSTEM,
        actorId: null,
        target: requestKey,
        result: AuditResult.BLOCKED,
      });
      return; // 내부 차단(EX 코드 없음, 사용자 미노출) — 전달·상태 저장 미수행
    }

    // B2. 전달 대상 결정(BIZ-003-02) — 구성의 서비스 B 주소·메서드로 한정.
    const targetUrl = config.serviceBDeliveryUrl;
    const method = config.serviceBHttpMethod;

    // B3. 페이로드 구성(SEC-002·DATA-001-01, 저장 안 함). deliver_to_b=true 파라미터만 source_key_a→param_name 리매핑.
    const paramDefs: DeliverParamRow[] = await this.dataSource.query(
      `SELECT param_name, source_key_a, deliver_to_b
         FROM "TBL_INTERLOCK_PARAMETER"
        WHERE config_id = $1 AND deliver_to_b = true
        ORDER BY display_order ASC`, // IX_PARAM_CONFIG
      [config.id],
    );
    const parameters: Record<string, string> = {};
    for (const pd of paramDefs) {
      // 진입 값은 서비스 A 원천 키(source_key_a)로 수신된다(ENT-003 §구현 가이드) → param_name 으로 리매핑.
      const value = ctx.parameters[pd.source_key_a];
      if (value !== undefined) {
        parameters[pd.param_name] = value; // 값 무변형(원문 그대로)
      }
    }
    const payload = {
      memberKey: ctx.memberKey, // 원본 무변형(SEC-002-02), 메모리 전용·무저장
      parameters,
      configCode: ctx.configCode, // 구성 식별자 동봉 — 완료 콜백(SVC-009) 회신 계약(MDL-204)
      requestKey, // 요청 키값 동봉 — 건 단위 연계 추적용 참조(MDL-204)
    };

    // B4. 전달·재시도(BIZ-003-03·BR-202) — 최초 1 + 재시도 2회, 2xx 응답이면 성공.
    const isSuccess = await this.sendWithRetry(targetUrl, method, payload, requestKey);

    // B5. 상태 저장(무조건 1건 — 성공·실패 모두, PROC-401·EXC-BIZ-06).
    await this.processStatusService.saveStatus({
      requestKey,
      configId: config.id,
      isSuccess,
      processedAt: now,
    });

    // B6. 결과 처리 — 실패면 감사 후 502 EX-BIZ-004 전파(상태는 이미 저장됨).
    if (!isSuccess) {
      await this.auditService.write({
        eventType: AuditEventType.DELIVERY_FAIL,
        actorType: ActorType.SERVICE,
        actorId: null,
        target: requestKey,
        result: AuditResult.FAIL,
      });
      throw new AppException('EX-BIZ-004');
    }
  }

  /**
   * 서비스 B 호출·재시도(BR-202). attempt=0 부터 시작해 attempt<=2 동안 반복(최대 3회 호출).
   * 2xx 응답이면 성공 즉시 종료, 비 2xx·타임아웃·네트워크 오류는 실패 시도로 집계(attempt+1)한다.
   * 외부 호출은 Node 전역 fetch + AbortController 타임아웃으로 수행한다(라이브러리 강제 없음).
   */
  private async sendWithRetry(
    targetUrl: string,
    method: string,
    payload: unknown,
    requestKey: string,
  ): Promise<boolean> {
    const upperMethod = method.toUpperCase();
    // GET/HEAD 는 본문을 가질 수 없다(fetch TypeError 방지). 그 외 메서드에만 JSON 본문을 싣는다.
    const hasBody = upperMethod !== 'GET' && upperMethod !== 'HEAD';

    let attempt = 0;
    let success = false;
    while (attempt <= MAX_ATTEMPT_INDEX && !success) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      try {
        const resp = await fetch(targetUrl, {
          method: upperMethod,
          headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
          body: hasBody ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
        if (resp.ok) {
          success = true; // 2xx — 성공 확정
        } else {
          attempt += 1; // 비 2xx 응답 — 실패 시도 집계
        }
      } catch {
        // 타임아웃(abort)·네트워크 오류 — 회원 키·요청 키값 원문 미노출(마스킹 대상). 실패 시도로 집계.
        this.logger.warn(`서비스 B 전달 시도 실패(attempt=${attempt}) — 재시도 판단`);
        attempt += 1;
      } finally {
        clearTimeout(timer);
      }
    }
    return success;
  }
}
