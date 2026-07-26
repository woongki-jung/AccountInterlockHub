import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { InterlockConfigService } from '../config/interlock-config.service';
import { CONSENT_PROOF_TABLE, INTERLOCK_TRACKING_TABLE } from '../entities';
import { RecordWriteError } from '../records/records.errors';
import { RetentionBatchSummary } from './retention.types';
import { subtractMonths } from './retention-datetime';

/**
 * `LIMIT :batchSize` 의 애플리케이션 내부 기본값(process_PROC-304.md §실행 제약사항 — "실행
 * 인자·옵션으로 노출하지 않는다 … 구체 값은 build 가 확정한다 … 삭제 대상 산정 기준과 멱등성은
 * 값과 무관하며, 상한에 걸려 남은 대상은 다음 실행에서 다시 산정된다"). 값을 크게 잡을수록 1회
 * 실행이 더 많이 지우고, 작게 잡을수록 잠금·트랜잭션 시간이 짧아진다 — 500 은 두 성질의
 * 무난한 절충값이다(빌드 결정 — 완료 보고에 기록. 확정 요구사항 없음).
 */
const RETENTION_BATCH_SIZE = 500;

/**
 * PROC-304 보관정책 배치 — B2~B7 실제 삭제 로직. 스케줄(C1)·CLI(C2) 두 진입 경로가 이 서비스의
 * `run()` 하나만 부른다(BR-015 "두 진입 경로가 같은 삭제 로직 함수를 부른다"). 로직을 두 벌 두지
 * 않는다 — 진입 경로별 코드는 트리거링만 하고 그 이상을 알지 못한다(retention-scheduler.service.ts·
 * cli/retention.ts 참고).
 *
 * **예외를 던지지 않는다.** 삭제 수행 실패는 `run()` 내부에서 흡수해 `failureReason` 이 채워진
 * summary 로 항상 정상 반환한다(§실행 결과 "실패 결과: 같은 형상의 요약 JSON"). 이 계약이 없으면
 * CLI·스케줄러 양쪽이 각자 예외 처리를 다시 구현해야 하고, 그 둘이 다르게 처리하면 "같은 결과"
 * 요건(DATA-002-04)이 진입 경로 코드 수준에서 갈라질 위험이 생긴다.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger('RetentionService');

  constructor(
    private readonly db: DatabaseService,
    private readonly config: InterlockConfigService,
  ) {}

  /**
   * `now` 를 생략하면 실행 시각을 쓴다(정상 경로). 인자로 노출하는 것이 아니라 검증 편의를 위한
   * 선택적 주입이다 — CLI·스케줄러는 항상 인자 없이 부른다(§실행 규약 1 "기준 일시를 인자로 받지
   * 않는다" — 이 함수 자체가 아니라 두 진입점 코드가 그 규약을 지킨다. 검증은 시드 데이터의 일시를
   * 조정해 수행하라는 사양 지시를 이 선택적 매개변수로 가능하게 한다).
   */
  async run(now: Date = new Date()): Promise<RetentionBatchSummary> {
    // B2. 기준 일시 산정 — POL OPS-001-04. 상수 주입 값으로 실행 시점에 계산한다(값을 복제하지 않는다).
    const baseAt = now;
    const trackingConfirmBefore = subtractMonths(now, this.config.retentionMonths);
    const trackingCreatedBefore = subtractMonths(now, this.config.retentionMaxMonths);
    const consentBefore = subtractMonths(now, this.config.consentProofRetentionMonths);

    // B5 코멘트 "두 삭제는 서로 독립이다"를 그대로 따른다 — 한쪽이 실패해도 다른 쪽 시도를 막지
    // 않는다(대상별 독립 트랜잭션의 취지 — 하나로 묶었다면 독립 트랜잭션 둘을 쓸 이유가 없다).
    const failureReasons: string[] = [];

    // B3(대상 산정)·B5 전반(추적 레코드 삭제) — POL DATA-002-01·BR-016
    let trackingDeletedCount = 0;
    try {
      const targets = await this.selectTrackingTargets(trackingConfirmBefore, trackingCreatedBefore);
      trackingDeletedCount = await this.deleteTrackingTargets(targets);
    } catch (error) {
      const reason = describeError(error);
      failureReasons.push(`TRACKING_DELETE_FAILED:${reason}`);
      this.logger.error(`PROC-304 추적 레코드 삭제 실패 — ${reason}`);
    }

    // B4(대상 산정)·B5 후반(동의 증적 삭제) — POL DATA-002-02
    let consentProofDeletedCount = 0;
    try {
      const targets = await this.selectConsentTargets(consentBefore);
      consentProofDeletedCount = await this.deleteConsentTargets(targets);
    } catch (error) {
      const reason = describeError(error);
      failureReasons.push(`CONSENT_PROOF_DELETE_FAILED:${reason}`);
      this.logger.error(`PROC-304 동의 증적 삭제 실패 — ${reason}`);
    }

    // B6. 결과 요약 — 지표 집계 삭제 건수 항목을 두지 않는다(DATA-002-03). 대상 목록·추적
    // 키·증적 식별자는 애초에 이 반환값에 담기지 않는다(FN-015 마스킹 요구를 만족할 값 자체가 없다).
    return {
      baseAt,
      trackingDeletedCount,
      consentProofDeletedCount,
      failureReason: failureReasons.length > 0 ? failureReasons.join('; ') : null,
    };
  }

  /**
   * B3 — 두 기준을 **각각의 인덱스로 분리 산정**한다(단일 `OR` 조건절 금지 — 인덱스를 못 타고
   * 계획이 흔들린다). 기준 ①은 부분 인덱스 `idx_interlock_tracking_result_confirmed_at`(미확인
   * 행은 대상에서 자연히 제외된다), 기준 ②는 `idx_interlock_tracking_created_at` 을 각각 탄다.
   * 합집합은 두 SELECT 를 각자 실행한 **뒤** 이 함수 안에서만 만든다(BR-016 — 먼저 도달한 쪽).
   */
  private async selectTrackingTargets(confirmBefore: Date, createdBefore: Date): Promise<string[]> {
    const byConfirmed = await this.db.query<{ tracking_key: string }>(
      `SELECT tracking_key FROM ${INTERLOCK_TRACKING_TABLE}
       WHERE result_confirmed_at IS NOT NULL
         AND result_confirmed_at < $1
       ORDER BY result_confirmed_at
       LIMIT $2`,
      [confirmBefore, RETENTION_BATCH_SIZE],
    );
    const byCreated = await this.db.query<{ tracking_key: string }>(
      `SELECT tracking_key FROM ${INTERLOCK_TRACKING_TABLE}
       WHERE created_at < $1
       ORDER BY created_at
       LIMIT $2`,
      [createdBefore, RETENTION_BATCH_SIZE],
    );

    // 합집합 — 두 기준을 동시에 만족하는 행(BAT-02_006 ③)이 중복 삭제·중복 계수되지 않게
    // Set 으로 키를 모은다. 최종 건수는 이 배열의 길이가 아니라 실제 DELETE 의 rowCount 로
    // 센다(deleteTrackingTargets) — IN/ANY 목록에 중복이 있어도 그 값 자체로는 과다계수가
    // 나지 않지만, Set 을 거치면 그 여지 자체를 없앤다.
    const union = new Set<string>();
    for (const row of byConfirmed.rows) union.add(row.tracking_key);
    for (const row of byCreated.rows) union.add(row.tracking_key);
    return [...union];
  }

  /** B5 전반 — 대상별 독립 트랜잭션(자기 커넥션을 새로 연다. 호출측 트랜잭션에 참여하지 않는다). */
  private async deleteTrackingTargets(trackingKeys: readonly string[]): Promise<number> {
    if (trackingKeys.length === 0) return 0;
    return this.db.withTransaction(async (client) => {
      const result = await client.query(
        `DELETE FROM ${INTERLOCK_TRACKING_TABLE} WHERE tracking_key = ANY($1::varchar[])`,
        [trackingKeys],
      );
      return result.rowCount ?? 0;
    });
  }

  /** B4 — 동의 일시 기산. `idx_consent_proof_consented_at` 을 탄다. 추적 레코드와 다른 기준. */
  private async selectConsentTargets(consentBefore: Date): Promise<string[]> {
    const result = await this.db.query<{ consent_proof_id: string }>(
      `SELECT consent_proof_id FROM ${CONSENT_PROOF_TABLE}
       WHERE consented_at < $1
       ORDER BY consented_at
       LIMIT $2`,
      [consentBefore, RETENTION_BATCH_SIZE],
    );
    return result.rows.map((row) => row.consent_proof_id);
  }

  /** B5 후반 — 대상별 독립 트랜잭션(추적 레코드 삭제와 별개의 커넥션·트랜잭션). */
  private async deleteConsentTargets(consentProofIds: readonly string[]): Promise<number> {
    if (consentProofIds.length === 0) return 0;
    return this.db.withTransaction(async (client) => {
      const result = await client.query(
        `DELETE FROM ${CONSENT_PROOF_TABLE} WHERE consent_proof_id = ANY($1::uuid[])`,
        [consentProofIds],
      );
      return result.rowCount ?? 0;
    });
  }
}

/**
 * 실패 사유를 진단 가능한 최소 정보로만 남긴다 — `error.message`·스택은 담지 않는다(추적 키가
 * 그 안에 실려 나갈 위험, FN-015·SEC-002-05·DATA-001-04 — `database.service.ts` 의
 * `describeError` 와 같은 원칙을 이 계층에서도 지킨다. 그 메서드는 `private` 라 재사용할 수 없어
 * 여기 독립적으로 다시 둔다). `RecordWriteError`(FN-007~013·`DatabaseService.withTransaction`
 * 이 던지는 통제된 사유 코드)는 `.reason` 이 이미 안전한 고정 어휘라 그대로 쓴다 — 그 밖은
 * `Error.name` 까지만 쓴다.
 */
function describeError(error: unknown): string {
  if (error instanceof RecordWriteError) return error.reason;
  return error instanceof Error ? error.name : typeof error;
}
