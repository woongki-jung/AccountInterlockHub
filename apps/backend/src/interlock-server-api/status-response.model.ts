// MDL-012 처리상태 확인 응답(model_MDL-011-015.md §MDL-012) — PROC-201 `B6` 이 송출하는 형상.
// 암호값·복호화 원문·생년월일을 담지 않는다(DATA-001-04) — 담을 속성이 애초에 없다.

export interface StatusResponseBody {
  /** 입력값을 변형 없이 그대로 되돌린다(DATA-004-01). */
  readonly trackingKey: string;
  /** 결과 미확정이면 null(BIZ-002-03 ②). */
  readonly isSuccess: boolean | null;
  /** 결과 구분 3종(BIZ-001-01) 중 하나 또는 null — 값 변환·별칭을 만들지 않는다(BIZ-001-03). */
  readonly resultCode: string | null;
  readonly isResultConfirmed: boolean;
  readonly resultAt: string | null;
  readonly resultConfirmedAt: string | null;
}
