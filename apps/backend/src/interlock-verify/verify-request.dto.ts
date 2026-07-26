// PROC-102 B1 입력 DTO 형상 재검증 — process_PROC-102-logic.md B1·B2. 요청 본문 자체를 JSON 으로
// 해석할 수 없는 경우는 이 파일이 다루지 않는다 — Express 본문 파서가 라우팅 자체를 건너뛰어 이
// 컨트롤러에 절대 도달하지 않고(구조적 제약 — approve-request.dto.ts 와 같은 실측),
// common/http/body-parse-failure.ts 의 접점별 재분류(`/verify` 접미사 → `EX-AUTH-001`)가 전역
// 예외 필터 계층에서 이미 처리한다(spec-functions-api.md §경로·메서드 규약). 이 파일은 그 파서를
// "통과한"(문법적으로는 유효한 JSON인) 본문의 **형상**만 다룬다 — 값 판정(FN-005·FN-004)은 서비스
// 계층(identity-verification.service.ts)의 몫이다.
import type { EncPair } from '../models/enc-pair.model';

/** B1 통과 후의 좁혀진 요청 값 — encX·encY 는 문자열이 아니면 undefined 로 좁혀 둔다(아래 참고). */
export interface VerifyRequestBody {
  readonly encX: string | undefined;
  readonly encY: string | undefined;
  /** FN-005(validateBirthDateFormat) 가 unknown 을 받아 자체적으로 재검증한다 — 여기서 좁히지 않는다. */
  readonly birthDate: unknown;
}

/**
 * `encX`·`encY` 를 `string | undefined` 로 좁힌다(approve-request.dto.ts `asStringOrUndefined` 와
 * 같은 이유·같은 구현 — JSON 본문은 임의의 타입이 올 수 있어 문자열이 아니면 전부 "부재"로
 * 취급한다. `crypto/cipher-pair.ts` `parseCipherPair()` 는 `encPair.encX == null` 로 부재만
 * 방어하고 다른 타입은 가정하지 않으므로, 여기서 미리 좁히지 않으면 `.trim()` 이 `TypeError` 를
 * 던져 분류되지 않은 예외(500 `EX-OPS-002`)로 새 나간다).
 */
function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * `B1` — 요청 본문의 형상만 좁힌다(값 판정은 `B2`·`B3`). `encPair.encX`(`EncPair` 캐스트 대상)의
 * 형상만 여기서 정리하고, `birthDate` 형식·복호화 판정은 서비스 계층이 FN-005·FN-004 를 그대로
 * 호출해 수행한다 — 이 파일이 그 판정을 앞당겨 흉내 내지 않는다.
 */
export function parseVerifyRequestBody(raw: unknown): VerifyRequestBody {
  const body: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  return {
    encX: asStringOrUndefined(body.encX),
    encY: asStringOrUndefined(body.encY),
    birthDate: body.birthDate,
  };
}

/** 형상 재검증을 통과한 값을 FN-004 입력(`EncPair`)으로 좁힌다 — 여전히 부재(`undefined`)일 수 있다. */
export function toEncPair(request: VerifyRequestBody): EncPair {
  return { encX: request.encX, encY: request.encY } as EncPair;
}
