// MDL-007 동의·승인 제출 — 공통(COM) 요청 모델(model_MDL-007-010.md §MDL-007).
// 매핑 엔터티 없음(비저장) — agreedItemCodes 만 MDL-002 를 거쳐 ENT-002 로 간다.

/**
 * 사용자가 제출한 동의 항목 코드 목록. **속성은 이 하나뿐이다** — 승인 성립 조건이 필수 동의
 * 충족으로 일원화되어(`BIZ-003-01`·`BIZ-003-02`) 진행 의사(`decision`) 속성을 두지 않는다
 * (거부 제출 경로가 없어 값이 하나뿐이면 분기가 성립하지 않는다 — `BIZ-003-03`). 제출 자체가
 * 승인 의사다.
 *
 * P06(#483, FN-012 구현)이 `records/consent-proof-record.types.ts` 에 같은 모양의 임시 로컬
 * 타입(`ConsentSubmissionInput`)을 두며 "정식 모델 파일은 승인 제출 접점(PROC-103, 후속
 * Phase)이 여기 둘 자리"라고 명시했다 — P09(#486, PROC-103 구현)가 그 자리를 채운다. 그 파일의
 * `ConsentSubmissionInput` 은 이 모델의 별칭으로 남겨 이름은 유지하되 정의를 하나로 모은다.
 */
export interface ConsentSubmission {
  /**
   * 사용자가 동의한 항목 코드. 각 코드가 [`MDL-008`](../config/interlock-config.types.ts)
   * `ConsentConfig.items` 의 항목 코드에 존재해야 하고, 필수 항목이 모두 포함돼야 승인이
   * 성립한다(서버 재검증 — `BIZ-003-02`). 화면 게이팅(1차 방어)을 신뢰하지 않는다.
   */
  readonly agreedItemCodes: readonly string[];
}
