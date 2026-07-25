// FN-014 오류 응답 엔벨로프의 details 원소 — 입력 형식 위반의 필드별 사유
// (function_FN-014-015.md §FN-014 입력/출력 정의 · spec-functions-api.md §공통 응답 포맷).

/**
 * 허용되는 사유는 이 셋뿐이다. **값 자체(실제 입력값·길이 등)는 담지 않는다** — 어떤 값이 왜
 * 틀렸는지를 되돌려 주면 반복 시도의 판정 수단이 된다(`OPS-002-03`).
 */
export type FieldReasonCode = 'REQUIRED' | 'FORMAT' | 'LENGTH';

/** 입력 검증에 실패한 필드 하나 — `{ field, reason }` 외의 속성을 두지 않는다. */
export interface FieldReason {
  readonly field: string;
  readonly reason: FieldReasonCode;
}
