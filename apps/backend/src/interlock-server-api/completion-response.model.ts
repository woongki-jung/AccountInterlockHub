// MDL-013 연동 완료 확인 응답(model_MDL-011-015.md §MDL-013) — PROC-202 `B5`(연동 완료 확인)와
// PROC-203 `B5`(완료 콜백)가 **함께 쓴다**(spec-functions-api-server.md §완료 콜백 API §응답
// 형상 확정 — "통지 직후의 상태를 그대로 되돌려 주는 자리이므로 새 모델을 만들지 않는다"). 결과
// 구분을 담지 않는다 — 허브의 처리 결과는 MDL-012 가 답한다(두 응답을 합치면 발송처가 판단
// 대상을 혼동한다).

export interface CompletionResponseBody {
  /** 입력값을 변형 없이 그대로 되돌린다(DATA-004-01). */
  readonly trackingKey: string;
  /** 완료 콜백 API 응답에서는 기록 후이므로 항상 true 다. */
  readonly isCallbackReceived: boolean;
  /** 최초 수신 일시. 미수신이면 null(완료 콜백 API 응답에서는 항상 non-null). */
  readonly callbackReceivedAt: string | null;
}
