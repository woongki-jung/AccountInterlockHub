// PROC-103 B1 입력 DTO 재검증(형상만 — 값 판정은 뒤 단계) — process_PROC-103-logic.md B1.
// 요청 본문 자체를 JSON 으로 해석할 수 없는 경우는 이 파일이 다루지 않는다 — Express 본문
// 파서가 라우팅 자체를 건너뛰어 이 컨트롤러에 절대 도달하지 않고(구조적 제약 — 실측 확인),
// common/http/body-parse-failure.ts 의 접점별 재분류(`/approve` 접미사 → EX-BIZ-001)가 전역
// 예외 필터 계층에서 이미 처리한다(spec-functions-api.md §경로·메서드 규약). 이 파일은 그
// 파서를 "통과한"(문법적으로는 유효한 JSON인) 본문의 **형상** 위반만 다룬다.
import { ConsentValidationError } from './approve.errors';

/** B1 통과 후의 좁혀진 요청 값 — encX·encY 는 문자열이 아니면 undefined 로 좁혀 둔다(아래 참고). */
export interface ApproveRequestBody {
  readonly encX: string | undefined;
  readonly encY: string | undefined;
  /** FN-005(validateBirthDateFormat) 가 unknown 을 받아 자체적으로 재검증한다 — 여기서 좁히지 않는다. */
  readonly birthDate: unknown;
  readonly agreedItemCodes: readonly string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * `encX`·`encY` 를 `string | undefined` 로 좁힌다. 쿼리 파라미터(`entry-query.ts`
 * `readSingleQueryParam`)와 달리 JSON 본문은 임의의 타입(숫자·불리언·객체·배열)이 올 수 있어
 * 문자열이 아니면 전부 "부재"로 취급한다 — `crypto/cipher-pair.ts` `parseCipherPair()` 는
 * `encPair.encX == null` 로 부재만 방어하고 다른 타입은 가정하지 않으므로(그 함수는 GET 진입
 * 접점의 쿼리 파라미터만 상대해 왔다 — 항상 `string | undefined`), 여기서 미리 좁히지 않으면
 * `.trim()` 이 `TypeError` 를 던져 분류되지 않은 예외(500 `EX-OPS-002`)로 새 나간다.
 */
function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * `B1` — 요청 본문의 형상만 재검증한다(값 판정은 `B5b`). `agreedItemCodes` 가 문자열 배열이
 * 아니면(부재 포함) 400 `EX-BIZ-001` — process_PROC-103-logic.md B1 그대로:
 * `if (agreedItemCodes 가 문자열 배열이 아니다) → 400 FN-014('EX-BIZ-001') // 부재 포함`.
 * **`decision`(진행 의사) 필드를 읽지 않는다** — 계약에 없다(`MDL-007`·`BIZ-003-03`). 본문에
 * 실려 와도 이 함수가 추출하는 필드에 없으므로 조용히 무시된다(USR-04_005 ⑤).
 */
export function parseApproveRequestBody(raw: unknown): ApproveRequestBody {
  const body: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const agreedItemCodes = body.agreedItemCodes;
  if (!isStringArray(agreedItemCodes)) {
    throw new ConsentValidationError('AGREED_ITEM_CODES_NOT_STRING_ARRAY');
  }

  return {
    encX: asStringOrUndefined(body.encX),
    encY: asStringOrUndefined(body.encY),
    birthDate: body.birthDate,
    agreedItemCodes,
  };
}
