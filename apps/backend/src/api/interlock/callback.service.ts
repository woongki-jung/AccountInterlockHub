import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AuditService } from '../../common/audit/audit.service';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';
import { firstUpdatedRow } from '../../common/db/query-result.util';
import { CallbackDto } from './dto/callback.dto';
import { HistoryScopeService } from './history-scope.service';

/**
 * 완료 콜백 대상 특정·완료 기록 서비스 — PROC-303 B4 / PROC-403 H2 / FN-018 / SVC-009 / API-03.
 *
 * 서비스 B 가 정보연계 처리 완료를 허브에 통지하는 콜백의 도메인 계층이다. 인증(FN-004, 서비스 B 자격)·
 * 요청제한(FN-014)·입력 검증(FN-005)은 상위(가드·ValidationPipe)가 선행하고, 본 서비스는 {연동 구성 식별자
 * + 사용자 키값} 스코프의 완료 콜백 미수신 최신 이력 1건을 특정해 완료 콜백 수신 여부=수신·수신 일시를
 * 연동이력(ENT-007)에만 기록한다.
 *
 *  - 스코프 해석은 FN-019(HistoryScopeService)에 pendingOnly=true 로 위임한다(완료 확인 P3 과 공유하는
 *    단일 소스). 스코프 정의를 본 서비스에 중복 구현하지 않는다.
 *  - 재통지(스코프 내 미수신 이력 없음·완료 이력만 존재)·동시 콜백은 오류가 아니라 멱등 성공으로 처리한다
 *    (BR-303·EXC-BIZ-10). 대상 미특정(구성 미존재·미지정·스코프 내 이력 자체 없음)만 단일 404 EX-BIZ-006
 *    으로 응답한다(존재 여부 비노출).
 *  - 완료 기록 UPDATE 는 `WHERE ... AND callback_received = false` 조건절이 곧 동시성 가드다 — 영향 행 0건
 *    (UPDATE...RETURNING 튜플의 안쪽 행배열이 비어 있음, firstUpdatedRow 로 판별)이면 재통지·동시 콜백으로
 *    보고 멱등 성공한다.
 *
 * **처리상태 불변경(BIZ-004-06)** — 처리상태(ENT-004, TBL_INTERLOCK_PROCESS_STATUS) 4항목을 변경하는 어떤
 * SQL 도 두지 않는다. 본 서비스의 유일한 갱신 대상은 TBL_INTERLOCK_HISTORY(연동이력)뿐이다. 감사·오류 응답에
 * 전달받은 키값 원문을 남기지 않는다(FN-010 마스킹, SEC-005-01).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02).
 */

// 완료 기록 UPDATE 의 RETURNING 결과 행(영향 행 수 판정용).
interface UpdatedRow {
  request_key: string;
}

@Injectable()
export class CallbackService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly historyScopeService: HistoryScopeService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 완료 콜백 대상 특정·완료 기록(FN-018). 미수신 최신 1건에 완료 콜백 수신 여부·수신 일시를 기록한다.
   * @param callback 완료 콜백 요청(MDL-305, { configCode, userKey }) — 형식 검증(FN-005) 통과값.
   * @param now      완료 콜백 수신 일시(callback_received_at).
   * @throws AppException EX-BIZ-006(404) 구성 미존재·미지정·스코프 내 이력 없음(단일 응답, 존재 여부 비노출).
   */
  async recordCompletionCallback(callback: CallbackDto, now: Date): Promise<void> {
    const { configCode, userKey } = callback;

    // 1. 스코프 해석(FN-019, pendingOnly=true — 미수신 최신 1건 + 재통지 멱등 판정 anyInScope).
    const res = await this.historyScopeService.resolveHistoryScope(configCode, userKey, true);

    // 2. 구성 미존재·미지정 → 대상 미특정 404(존재 여부 비노출).
    if (!res.eligible) {
      await this.auditService.write({
        eventType: AuditEventType.CALLBACK_TARGET_MISS,
        actorType: ActorType.SERVICE,
        target: configCode,
        result: AuditResult.FAIL,
        detail: `userKey=${maskToken(userKey)}`,
      });
      throw new AppException('EX-BIZ-006');
    }

    // 3. 미수신 최신 이력 없음 — 완료 이력만 존재(재통지 멱등) / 스코프 내 이력 자체 없음(404) 분기.
    if (res.target == null) {
      if (res.anyInScope) {
        // 재통지: 상태 변경 없이 멱등 성공(EXC-BIZ-10).
        await this.auditService.write({
          eventType: AuditEventType.CALLBACK_IDEMPOTENT,
          actorType: ActorType.SERVICE,
          target: configCode,
          result: AuditResult.INFO,
          detail: `userKey=${maskToken(userKey)}`,
        });
        return;
      }
      // 스코프 내 이력 자체 없음(보관 만료 삭제·미기록 포함) → 대상 미특정 404.
      await this.auditService.write({
        eventType: AuditEventType.CALLBACK_TARGET_MISS,
        actorType: ActorType.SERVICE,
        target: configCode,
        result: AuditResult.FAIL,
        detail: `userKey=${maskToken(userKey)}`,
      });
      throw new AppException('EX-BIZ-006');
    }

    // 4. 완료 기록(내부 PROC-403 단건 UPDATE, 동시성 가드) — 연동이력만 대상(처리상태 ENT-004 불변경, BIZ-004-06).
    //    WHERE ... AND callback_received=false 가 곧 동시성 가드다. RETURNING 결과로 영향 행을 판정한다.
    //    ⚠ 형상 주의(회귀 #43): 이 TypeORM+node-postgres 조합에서 UPDATE...RETURNING 은 평탄 배열이 아니라
    //    `[행배열, affected]` 튜플을 반환한다(매칭 [[{...}], 1] / 미매칭 [[], 0]). firstUpdatedRow 로 안쪽
    //    행배열의 첫 행을 추출해 undefined(미갱신) / 존재(갱신)로 판정한다.
    const result = await this.dataSource.query(
      `UPDATE "TBL_INTERLOCK_HISTORY"
          SET callback_received = true, callback_received_at = $1
        WHERE request_key = $2 AND callback_received = false
        RETURNING request_key`, // 동시성 가드(callback_received=false) + 영향 행 판정
      [now, res.target.requestKey],
    );
    const updatedRow = firstUpdatedRow<UpdatedRow>(result);

    if (!updatedRow) {
      // 동시 콜백이 먼저 기록 — 멱등 성공(상태 변경 없음).
      await this.auditService.write({
        eventType: AuditEventType.CALLBACK_IDEMPOTENT,
        actorType: ActorType.SERVICE,
        target: configCode,
        result: AuditResult.INFO,
        detail: `userKey=${maskToken(userKey)}`,
      });
      return;
    }

    // 5. 콜백 수신 감사(CALLBACK_RECORDED) — userKey 는 FN-010 마스킹, 원문 미기록(SEC-005-01).
    await this.auditService.write({
      eventType: AuditEventType.CALLBACK_RECORDED,
      actorType: ActorType.SERVICE,
      target: configCode,
      result: AuditResult.SUCCESS,
      detail: `userKey=${maskToken(userKey)}, requestKey=${res.target.requestKey}`,
    });
  }
}
