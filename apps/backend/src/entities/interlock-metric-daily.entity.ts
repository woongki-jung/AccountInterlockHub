// ENT-003 연동 지표 집계 — tbl_interlock_metric_daily 로우 셰이프(data_ENT-003.md §속성 정의).

export const INTERLOCK_METRIC_DAILY_TABLE = 'tbl_interlock_metric_daily';

/**
 * tbl_interlock_metric_daily 1행 — 정확히 5컬럼(BAT-06_006). 거부 카운터(user_denied_count)·
 * 파생 비율(성공률 등) 컬럼을 두지 않는다(BIZ-005-01) — 카운터는 요청 수 1 + 결과 구분 3종 = 4개뿐이다.
 *
 * request_count 등 BIGINT 컬럼은 pg 드라이버 기본 동작상 문자열로 반환된다(Number 안전 정수
 * 범위 초과를 막기 위한 pg 의 기본 정책). 도메인 모델 변환(interlock-metric-daily.model.ts)에서
 * Number() 로 바꾼다 — 삭제 없는 누적이라도 실무 규모에서 안전 정수 범위(2^53)를 벗어나지 않는다.
 */
export interface InterlockMetricDailyRow {
  /** 'YYYY-MM-DD'. Asia/Seoul 고정 경계로 이미 확정된 값이다(data_ENT-003.md §일자 경계 기준).
   *  pg-type-parsers.ts 가 DATE 컬럼을 Date 객체가 아닌 원문 문자열로 반환하도록 재정의해 뒀다 —
   *  타임존 재해석에 의한 하루 밀림 사고를 막는다. */
  metric_date: string;
  request_count: string;
  success_count: string;
  decrypt_failed_count: string;
  delivery_failed_count: string;
}
