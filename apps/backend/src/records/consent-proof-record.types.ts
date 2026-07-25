/**
 * MDL-007 동의·승인 제출의 최소 로컬 표현(model_MDL-007-010.md). 정식 모델 파일은 승인 제출
 * 접점(PROC-103, 후속 Phase)이 `apps/backend/src/models/` 에 둘 자리이지만 — 그 디렉터리는 본
 * Phase 의 작업 지시상 읽기 전용이라 이 Phase 에서 새로 만들지 않는다. FN-012 가 필요로 하는
 * 속성 하나(agreedItemCodes — MDL-007 의 유일한 속성)만 여기 국소로 둔다.
 */
export interface ConsentSubmissionInput {
  readonly agreedItemCodes: readonly string[];
}
