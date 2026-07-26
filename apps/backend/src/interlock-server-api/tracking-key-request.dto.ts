// PROC-201·202·203 공통 B1 입력 DTO 형상 재검증 — spec-functions-api-server.md §공통 요청 형상
// (MDL-011, 세 접점 `/api/interlock/status`·`/completion`·`/callback` 이 같은 요청 본문을 쓴다).
// 요청 본문 자체를 JSON 으로 해석할 수 없는 경우는 이 파일이 다루지 않는다 — Express 본문
// 파서가 라우팅 자체를 건너뛰어 이 컨트롤러에 절대 도달하지 않고(구조적 제약 —
// verify-request.dto.ts·approve-request.dto.ts 와 같은 실측),
// common/http/body-parse-failure.ts 의 접점별 재분류(세 경로 → EX-DATA-002)가 전역 예외 필터
// 계층에서 이미 처리한다. 이 파일은 그 파서를 "통과한"(문법적으로는 유효한 JSON인) 본문의
// **형상**만 다룬다 — 값 판정(FN-006)은 서비스 계층의 몫이다.

/** B1 통과 후의 좁혀진 요청 값 — trackingKey 는 어떤 타입이든 그대로 넘긴다(FN-006 이 unknown 을 받아 자체 재검증한다 — 여기서 좁히지 않는다). */
export interface TrackingKeyRequestBody {
  readonly trackingKey: unknown;
}

/**
 * `B1` — 요청 본문의 형상만 좁힌다(값 판정은 서비스 계층의 FN-006). 객체가 아니거나 배열이면
 * 빈 객체로 취급해 `trackingKey` 가 `undefined` 로 떨어지게 한다(parseVerifyRequestBody·
 * parseApproveRequestBody 와 같은 관례) — `isTrackingKeyFormatValid` 가 `undefined` 도 그대로
 * `false` 로 판정하므로 이 지점에서 별도로 예외를 던지지 않는다.
 */
export function parseTrackingKeyRequestBody(raw: unknown): TrackingKeyRequestBody {
  const body: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  return { trackingKey: body.trackingKey };
}
