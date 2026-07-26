import { Injectable } from '@nestjs/common';
import { INTERLOCK_METRIC_DAILY_TABLE, RESULT_CODE_VALUES, ResultCode } from '../entities';
import { DatabaseService } from '../database/database.service';
import { RecordWriteError } from './records.errors';
import { toMetricDate } from './metric-date';
import { METRIC_EVENT_KIND_VALUES, MetricEvent } from './metric-event.types';
import { QueryExecutor } from './query-executor';

type MetricColumn = 'request_count' | 'success_count' | 'decrypt_failed_count' | 'delivery_failed_count';

/**
 * 결과 구분 → 지표 컬럼 대응표(BIZ-001-03·data_ENT-003.md §구현 가이드 "대응표를 한 곳에만 둔다").
 * 거부 카운터를 두지 않는다(BIZ-005-01) — ResultCode 3종에 정확히 대응하는 3개 항목뿐이다.
 */
const RESULT_CODE_METRIC_COLUMN: Record<ResultCode, MetricColumn> = {
  SUCCESS: 'success_count',
  DECRYPT_FAILED: 'decrypt_failed_count',
  DELIVERY_FAILED: 'delivery_failed_count',
};

/**
 * FN-013 지표 카운터 갱신(function_FN-012-013.md §시그니처). **자기 트랜잭션을 열지 않는다** —
 * 호출부(FN-008·FN-009, 또는 후속 Phase 의 PROC-303 배선)가 이미 열어 둔 트랜잭션에 참여할 뿐이다.
 *
 * `executor` 는 **`REQUEST`·`RESULT` 계기에서는 반드시 넘겨야 한다** — 레코드 기록과 같은 커넥션·
 * 실행자 위에서 수행돼야 함께 커밋되거나 함께 되돌려진다(`SVC-014` F-008). **`UNIDENTIFIED_FAILURE`
 * 만 생략할 수 있다** — 그 계기의 호출 지점(PROC-101 B5·PROC-102 B4b·PROC-104 B2)은 호출측이
 * 트랜잭션을 열지 않는 자리라 넘길 실행 문맥이 없고, 단계 4 의 UPSERT 한 문장이 그 자체로
 * 원자적이다. 생략 시 커넥션 풀(`DatabaseService`)에서 단독 갱신한다 — `lookup()`(FN-007)과 같은
 * "생략하면 풀에서 단독 실행" 관례다.
 */
@Injectable()
export class MetricCounterService {
  constructor(private readonly db: DatabaseService) {}

  async recordEvent(event: MetricEvent, executor: QueryExecutor = this.db): Promise<void> {
    // 1. 계기 검증 — POL BIZ-005-02. TS 판별 유니온이 컴파일 타임에 이미 강제하지만, 이 서비스는
    //    향후 컨트롤러 계층 등 비TS 경계에서도 호출될 수 있어 런타임 방어를 유지한다.
    if (!METRIC_EVENT_KIND_VALUES.includes(event.kind)) {
      throw new RecordWriteError('METRIC_INVALID_EVENT_KIND');
    }
    if (event.kind === 'RESULT' && !RESULT_CODE_VALUES.includes(event.resultCode)) {
      throw new RecordWriteError('METRIC_INVALID_RESULT_CODE');
    }

    // 2. 일자 산출 — Asia/Seoul 고정(ENT-003 §일자 경계 기준)
    const metricDate = toMetricDate(event.at);

    // 3~4. 갱신 대상 컬럼 결정 + 원자적 UPSERT(삽입과 증가를 한 문장으로)
    const columns = this.resolveColumns(event);
    try {
      await this.upsert(executor, metricDate, columns);
    } catch (error) {
      throw new RecordWriteError('METRIC_UPSERT_FAILED', error);
    }
  }

  private resolveColumns(event: MetricEvent): readonly MetricColumn[] {
    switch (event.kind) {
      case 'REQUEST':
        return ['request_count'];
      case 'UNIDENTIFIED_FAILURE':
        return ['request_count', 'decrypt_failed_count'];
      case 'RESULT':
        return [RESULT_CODE_METRIC_COLUMN[event.resultCode]];
    }
  }

  /**
   * 삽입과 증가를 한 문장(ON CONFLICT ... DO UPDATE)으로 처리한다 — 일자 행을 조회한 뒤 없으면
   * 만들고 있으면 더하는 2단계로 나누면 동시 요청에서 계수가 유실된다(data_ENT-003.md §구현 가이드).
   * 컬럼명은 RESULT_CODE_METRIC_COLUMN·고정 리터럴에서만 오므로(외부 입력 무관) 문자열 조합에
   * 주입 위험이 없다.
   */
  private async upsert(executor: QueryExecutor, metricDate: string, columns: readonly MetricColumn[]): Promise<void> {
    const insertColumns = ['metric_date', ...columns].join(', ');
    const insertValues = ['$1', ...columns.map(() => '1')].join(', ');
    const updateSet = columns
      .map((column) => `${column} = ${INTERLOCK_METRIC_DAILY_TABLE}.${column} + 1`)
      .join(', ');

    await executor.query(
      `INSERT INTO ${INTERLOCK_METRIC_DAILY_TABLE} (${insertColumns})
       VALUES (${insertValues})
       ON CONFLICT (metric_date)
       DO UPDATE SET ${updateSet}`,
      [metricDate],
    );
  }
}
