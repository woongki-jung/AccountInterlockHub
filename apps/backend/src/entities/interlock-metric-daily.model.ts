import { InterlockMetricDailyRow } from './interlock-metric-daily.entity';

/**
 * MDL-003 연동 지표 집계 — 응용 계층 도메인 모델(model_MDL-003.md §속성 정의).
 * 거부 카운터·파생 비율 속성을 두지 않는다(BIZ-005-01). 카운터 합계 등식은 강제하지 않는다
 * (data_ENT-003.md §행 단위 합계에 제약을 두지 않는 이유 — 결과 미확정 종료·일자 경계를 걸친
 * 연동으로 합계가 어긋날 수 있는 것이 정상 상태다).
 */
export interface InterlockMetricDailyModel {
  /** 'YYYY-MM-DD', Asia/Seoul 고정 경계. */
  metricDate: string;
  requestCount: number;
  successCount: number;
  decryptFailedCount: number;
  deliveryFailedCount: number;
}

/** ENT→도메인(model_MDL-003.md §엔터티 매핑) — BIGINT 문자열을 Number 로 변환한다. */
export function toInterlockMetricDailyModel(row: InterlockMetricDailyRow): InterlockMetricDailyModel {
  return {
    metricDate: row.metric_date,
    requestCount: Number(row.request_count),
    successCount: Number(row.success_count),
    decryptFailedCount: Number(row.decrypt_failed_count),
    deliveryFailedCount: Number(row.delivery_failed_count),
  };
}

/**
 * 도메인→ENT(model_MDL-003.md §엔터티 매핑) — 직접 매핑.
 * 갱신을 "+1 증가만" 허용하는 규칙, 삽입·증가를 한 문장으로 묶는 원자적 UPSERT 는 이 함수의
 * 책임이 아니다 — PROC-303(P06)이 이 로우 셰이프를 참조해 구현한다.
 */
export function toInterlockMetricDailyRow(model: InterlockMetricDailyModel): InterlockMetricDailyRow {
  return {
    metric_date: model.metricDate,
    request_count: String(model.requestCount),
    success_count: String(model.successCount),
    decrypt_failed_count: String(model.decryptFailedCount),
    delivery_failed_count: String(model.deliveryFailedCount),
  };
}
