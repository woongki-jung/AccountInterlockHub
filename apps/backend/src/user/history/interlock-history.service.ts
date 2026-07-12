import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { maskToken } from '../../common/audit/masking.util';

/**
 * 연동이력 생성 서비스 — FN-016_createInterlockHistory / 내부 PROC-403(PROC-203 호출) / ENT-007
 * (TBL_INTERLOCK_HISTORY) / BIZ-004-07·DATA-005.
 *
 * 복호화 성공으로 연동 추적 키를 확보한 직후·수신처 B 전달에 앞서 1건 INSERT 한다(BIZ-004-07). 저장 항목은
 * 5항목 상한(연동 추적 키·구성 참조·연동 요청 일시·완료 콜백 수신 여부·수신 일시) + 비개인 운영 컬럼
 * (id·created_at)으로 한정한다 — 회원 키·복호화 원문(X 내용)·개인식별 컬럼은 두지 않는다(DATA-005-06).
 * 추적 키는 FN-020 이 추출한 원문을 해석·변형·해시 없이 그대로 저장한다(DATA-005-07).
 *
 * `#214` 로 생성 시점이 진입 시(구 SVC-004·PROC-201)에서 복호화 성공 후(SVC-005·PROC-203)로 이동했고,
 * 저장 키가 구 {요청 키값·지정 사용자 키값 원문}에서 연동 추적 키 단독으로 전환됐다(구 FN-016 구현·
 * interlock.service.ts createInterlockHistory 는 P5 로 전량 대체).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 단건 INSERT(자체 트랜잭션, surrogate uuid PK 로
 * 연동 요청 1건당 1행 — 추적 키 재사용 시 다건 공존 허용, EXC-BIZ-12).
 */
@Injectable()
export class InterlockHistoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 연동이력 1건 생성(FN-016, PROC-203 B3). completed_at·callback_received_at 은 미수신 초기값(false·NULL)
   * 으로 고정한다. created_at 은 DB 기본값 now() 가 채운다.
   */
  async createInterlockHistory(trackingKey: string, configId: string, now: Date): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "TBL_INTERLOCK_HISTORY"
         (id, tracking_key, config_id, requested_at, callback_received, callback_received_at)
       VALUES (gen_random_uuid(), $1, $2, $3, false, null)`,
      [trackingKey, configId, now],
    );

    // 감사(OPS-002·SEC-005-04) — 추적 키는 마스킹만, 원문 미기록.
    await this.auditService.write({
      eventType: AuditEventType.HISTORY_CREATE,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: maskToken(trackingKey),
      result: AuditResult.SUCCESS,
    });
  }
}
