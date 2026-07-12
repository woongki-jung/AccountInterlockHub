import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorType, AuditEventType, AuditResult } from '../common/audit/audit.constants';
import { AuditService } from '../common/audit/audit.service';
import { affectedCount } from '../common/db/query-result.util';
import { resolveChunkSize } from './retention.env';
import { BatchRunResult } from './retention.types';

/**
 * 보관 만료 대상 선정·삭제 배치 서비스 — FN-011_runRetentionBatch / PROC-402 / SVC-007.
 *
 * 일 1회 스케줄(또는 CLI 온디맨드)로 보관 기간이 경과한 처리상태·연동이력을 하드 삭제해 무기한 누적을 막는다.
 * `#214`(P10) fallback two-pass — 처리상태(ENT-004)·연동이력(ENT-007) 각각 두 갈래를 한 실행 흐름에서
 * 처리한다: confirmedDays(기본 90일, 결과 확인/콜백 수신 일시 기산) 갈래와 absoluteDays(기본 180일,
 * created_at 기산 절대 상한) 갈래 — 확인/수신 건은 둘 중 먼저 도래하는 시점에, 미확인/미수신 건은 절대
 * 상한 갈래로만 정리된다(process_PROC-402.md B2·B3, BR-401·BR-402). 네 갈래(상태 확인·상태 절대·이력 수신·
 * 이력 절대) 모두 청크 DELETE(`ctid IN ... LIMIT`)로 삭제하며, 청크마다 독립 커밋한다.
 *
 * 트랜잭션 경계(PROC-402 실행 제약): dataSource.query 는 트랜잭션 밖 autocommit 이므로 각 청크 DELETE 가
 * 독립 커밋된다 — 루프 전체를 하나의 트랜잭션으로 감싸지 않는다. 조건절(경과 기준)이 곧 멱등 가드라
 * 중단·재실행 시 이미 커밋된 삭제분은 미해당하고 잔여 대상만 다시 삭제된다(OPS-003-02). 두 갈래의 중복
 * 대상(양 조건 동시 충족)은 먼저 실행된 갈래에서 삭제되고 다른 갈래 조회에서 자연 제외돼 이중 삭제가 없다.
 *
 * 감사(FN-013): 기동 시 BATCH_RUN(INFO 'retention start'), 정상 종료 시 BATCH_RUN(SUCCESS, detail=집계 JSON),
 * 실패 시 BATCH_RUN(FAIL) 후 예외 재던짐(잔여분 다음 주기 재시도). detail 에는 건수·소요만 담고 user_key·
 * 요청 키값·개인정보 원문을 넣지 않는다(SEC-005 — 건수만). 배치 결과는 상태·이력 테이블에 저장하지 않는다.
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 삭제 대상 선정은 확인/수신 부분 인덱스
 * (IX_STATUS_RETENTION_CONFIRMED·IX_HISTORY_RETENTION_RECEIVED)와 생성일시 인덱스(IX_STATUS_RETENTION_CREATED·
 * IX_HISTORY_RETENTION_CREATED, 절대 상한 갈래 — 확인/미확인·수신/미수신 공통)로 수행된다.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 보관 만료 대상 선정·삭제 배치(FN-011). 성공 시에만 MDL-402 결과를 반환한다.
   * @param now           배치 실행 기준 시각(스케줄 도래 또는 CLI 시각).
   * @param confirmedDays 결과 확인/콜백 수신 후 보관 기간(일, 기본안 90). threshold90 = now - confirmedDays.
   *                      처리상태·연동이력 공통(FN-011 confirmedRetentionDays).
   * @param absoluteDays  생성 일시(created_at) 기산 절대 상한(일, 기본안 180). threshold180 = now - absoluteDays.
   *                      확인/수신 갈래의 fallback 상한 + 미확인/미수신 건 정리 기준(FN-011 absoluteRetentionDays).
   * @throws 삭제 중 예외 발생 시 — 실패 감사(FAIL) 기록 후 원본 예외를 재던진다(커밋된 청크는 유지).
   */
  async runRetentionBatch(now: Date, confirmedDays = 90, absoluteDays = 180): Promise<BatchRunResult> {
    const startMs = Date.now();
    const chunkSize = resolveChunkSize();
    // threshold90/180 = now - N days. timestamptz 는 UTC 저장이므로 고정 ms 산술로 산출한다.
    const threshold90 = new Date(now.getTime() - confirmedDays * 24 * 60 * 60 * 1000);
    const threshold180 = new Date(now.getTime() - absoluteDays * 24 * 60 * 60 * 1000);

    // B1. 기동 감사(OPS-003-01) — best-effort(FN-013), 삭제 결과에 영향 없음.
    await this.auditService.write({
      eventType: AuditEventType.BATCH_RUN,
      actorType: ActorType.BATCH,
      result: AuditResult.INFO,
      detail: 'retention start',
    });

    try {
      // B2. 처리상태 삭제 — 확인 갈래(결과확인일시+90일)·절대 상한 갈래(생성일시+180일, BR-401 fallback).
      // 확인 갈래: 결과 확인 건 중 90일 경과분만(미확인 건은 is_result_confirmed=false 라 미해당).
      const statusDeletedConfirmed = await this.deleteExpiredInChunks(
        'TBL_INTERLOCK_PROCESS_STATUS',
        'is_result_confirmed = true AND result_confirmed_at < $1', // IX_STATUS_RETENTION_CONFIRMED
        threshold90,
        chunkSize,
      );
      // 절대 상한 갈래: 확인/미확인 공통 — 확인 후 90일 미도래 건 + 미확인 건 중 180일 경과분을 포괄.
      const statusDeletedAbsolute = await this.deleteExpiredInChunks(
        'TBL_INTERLOCK_PROCESS_STATUS',
        'created_at < $1', // IX_STATUS_RETENTION_CREATED
        threshold180,
        chunkSize,
      );
      const statusDeleted = statusDeletedConfirmed + statusDeletedAbsolute;

      // B3. 연동이력 삭제 — 수신 갈래(수신일시+90일)·절대 상한 갈래(생성일시+180일, BR-402 fallback). 처리상태와 동일 흐름.
      const historyDeletedReceived = await this.deleteExpiredInChunks(
        'TBL_INTERLOCK_HISTORY',
        'callback_received = true AND callback_received_at < $1', // IX_HISTORY_RETENTION_RECEIVED
        threshold90,
        chunkSize,
      );
      // 절대 상한 갈래: 수신/미수신 공통(콜백 미도래 건 정리 포함, EXC-BIZ-11).
      const historyDeletedAbsolute = await this.deleteExpiredInChunks(
        'TBL_INTERLOCK_HISTORY',
        'created_at < $1', // IX_HISTORY_RETENTION_CREATED
        threshold180,
        chunkSize,
      );
      const historyDeleted = historyDeletedReceived + historyDeletedAbsolute;

      // B4. 결과 집계(MDL-402) — target=deleted(선정 즉시 삭제). 처리상태·연동이력 각각 집계.
      const result: BatchRunResult = {
        statusTargetCount: statusDeleted,
        statusDeletedCount: statusDeleted,
        historyTargetCount: historyDeleted,
        historyDeletedCount: historyDeleted,
        elapsedMs: Date.now() - startMs,
        runAt: now.toISOString(),
      };

      // 종료 감사(OPS-003-03) — detail 은 집계 요약(건수·소요·시각)만. user_key·요청키값 등 원문 미포함(SEC-005).
      await this.auditService.write({
        eventType: AuditEventType.BATCH_RUN,
        actorType: ActorType.BATCH,
        result: AuditResult.SUCCESS,
        detail: JSON.stringify(result),
      });

      // B5. 반환(별도 저장 없음) — 상태·이력 테이블 미저장.
      return result;
    } catch (err) {
      // 실패 감사(FAIL) — 이미 커밋된 청크 삭제는 유지, 잔여분은 다음 주기 재시도(OPS-003-03).
      // detail 에 개인정보·민감값을 넣지 않도록 오류 유형(name)만 남긴다(진단용 상세는 앱 로그로).
      const errName = err instanceof Error ? err.name : 'UnknownError';
      await this.auditService.write({
        eventType: AuditEventType.BATCH_RUN,
        actorType: ActorType.BATCH,
        result: AuditResult.FAIL,
        detail: `retention failed: ${errName}`,
      });
      this.logger.error(
        '보관정책 배치 실패 — 잔여분은 다음 주기 재시도(OPS-003-03)',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  /**
   * 조건절에 해당하는 행을 청크 단위로 반복 삭제한다. 각 청크 DELETE 는 트랜잭션 밖 autocommit 으로
   * 독립 커밋되며, 삭제 행수 n 이 0 이 될 때까지 반복한다(조건절이 곧 멱등 가드).
   *
   * @param table       대상 테이블(내부 고정 식별자 — 사용자 입력 아님).
   * @param whereClause 경과 조건절($1 = threshold 바인딩). 부분 인덱스로 대상 선정.
   * @param threshold   보관 만료 경계 시각.
   * @param chunkSize   1회 삭제 상한 행수(LIMIT).
   * @returns 삭제한 총 행수.
   */
  private async deleteExpiredInChunks(
    table: string,
    whereClause: string,
    threshold: Date,
    chunkSize: number,
  ): Promise<number> {
    let deleted = 0;
    for (;;) {
      // ctid IN (SELECT ... LIMIT) 로 한 청크(chunkSize 행)만 삭제 — 단일 트랜잭션 크기·잠금을 상한한다.
      const res: unknown = await this.dataSource.query(
        `DELETE FROM "${table}"
          WHERE ctid IN (
            SELECT ctid FROM "${table}" WHERE ${whereClause} LIMIT $2
          )`,
        [threshold, chunkSize],
      );
      const n = affectedCount(res);
      deleted += n;
      if (n === 0) {
        break; // 잔여 대상 없음 — 종료.
      }
    }
    return deleted;
  }
}
