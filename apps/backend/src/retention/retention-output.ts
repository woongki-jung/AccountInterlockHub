import { RetentionBatchSummary } from './retention.types';
import { formatBaseAtIso } from './retention-datetime';

/**
 * PROC-304 B6 결과 요약 직렬화 — MDL-021 을 표준 출력 계약(spec-functions-api-server.md §명령
 * 진입점 §출력 스키마)이 요구하는 정확한 형태로 만든다. **키 4개 고정·순서 불변**을 객체 리터럴의
 * 선언 순서로 보장한다(`JSON.stringify` 는 문자열 키를 삽입 순서대로 직렬화한다).
 * `trackingDeletedCount`·`consentProofDeletedCount`·`failureReason` 은 값을 그대로 옮긴다 —
 * 지표 집계 삭제 건수 항목을 추가하지 않는다(DATA-002-03). 추적 키·증적 식별자 등 삭제 대상
 * 목록은 애초에 `RetentionBatchSummary` 에 담기지 않으므로 여기서 마스킹할 값 자체가 없다(FN-015).
 */
export function buildRetentionSummaryLine(summary: RetentionBatchSummary): string {
  const payload = {
    baseAt: formatBaseAtIso(summary.baseAt),
    trackingDeletedCount: summary.trackingDeletedCount,
    consentProofDeletedCount: summary.consentProofDeletedCount,
    failureReason: summary.failureReason,
  };
  return JSON.stringify(payload);
}
