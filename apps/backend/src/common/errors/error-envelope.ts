// FN-014 오류 응답 엔벨로프 구성(function_FN-014-015.md §FN-014). 모든 접점의 실패 응답 본문을
// 여기 한 곳에서 만든다 — 접점마다 형상을 다시 조립하지 않는다.
import { EX_CODE_CATALOG, FALLBACK_EX_CODE, isMappedExCode } from './ex-catalog';
import type { FieldReason, FieldReasonCode } from './field-reason';
import { sanitizeValue } from '../security/sanitize-value';

/** 응답 본문 — `{ code, message, details? }`. `details` 는 비어 있으면 속성을 생략한다. */
export interface ErrorResponseBody {
  readonly code: string;
  readonly message: string;
  readonly details?: FieldReason[];
}

/**
 * HTTP 계층에 필요한 두 조각을 함께 반환한다. `httpStatus` 는 응답 상태 코드를 정하는 데만
 * 쓰고 **JSON 본문에는 절대 포함하지 않는다** — 본문은 `body` 필드가 그대로 정본이다(공통
 * 응답 포맷은 `{ code, message, details? }` 세 필드로 닫혀 있다).
 */
export interface ErrorEnvelope {
  readonly httpStatus: number;
  readonly body: ErrorResponseBody;
}

const ALLOWED_REASON_CODES: ReadonlySet<FieldReasonCode> = new Set(['REQUIRED', 'FORMAT', 'LENGTH']);

/**
 * FN-014 — `code`·`details` 로 오류 응답 엔벨로프를 구성한다. 예외를 던지지 않는다(§처리 흐름
 * "오류 응답을 만드는 기능이 다시 실패하면 응답 자체가 없어지므로").
 *
 * 1. 코드 유효성 판정 — 카탈로그 밖 값은 `EX-OPS-002` 로 대체한다.
 * 2. 메시지 선택 — 카탈로그의 기본값을 그대로 쓴다.
 * 3. 상세 정제 — `field`·`reason` 두 속성만 남기는 화이트리스트로 재구성한 뒤(값·길이·내부
 *    사유를 버린다) FN-015(`sanitizeValue`)를 통과시킨다(FN-014 §의존 기능 — FN-015 동기 호출).
 * 4. 본문 구성 — `details` 가 빈 배열이면 속성 자체를 생략한다.
 * 5. HTTP 상태는 카탈로그가 정한 값을 그대로 쓴다(`httpStatus` 로 분리 반환 — 본문에는 안 싣는다).
 */
export function buildErrorEnvelope(code: string, details: readonly FieldReason[] = []): ErrorEnvelope {
  const resolvedCode: string = isMappedExCode(code) ? code : FALLBACK_EX_CODE;
  const entry = EX_CODE_CATALOG[resolvedCode as keyof typeof EX_CODE_CATALOG];

  // 회귀 1회차 S-2 — "throws 없음" 계약을 실제로 지킨다. details 가 배열이 아닌 값(예: 호출측
  // 실수로 단일 객체·null 을 넘김)으로 오면 `for...of` 가 TypeError 를 던지므로, 여기서 먼저
  // 방어해 항상 안전하게 빈 배열로 대체한다.
  const safeDetails = sanitizeDetails(Array.isArray(details) ? details : []);

  const body: ErrorResponseBody =
    safeDetails.length > 0
      ? { code: resolvedCode, message: entry.message, details: safeDetails }
      : { code: resolvedCode, message: entry.message };

  return { httpStatus: entry.httpStatus, body };
}

function sanitizeDetails(details: readonly FieldReason[]): FieldReason[] {
  const whitelisted: FieldReason[] = [];
  for (const d of details) {
    if (!d || typeof d.field !== 'string' || d.field.length === 0) continue;
    if (!ALLOWED_REASON_CODES.has(d.reason)) continue;
    whitelisted.push({ field: d.field, reason: d.reason }); // 값·길이·내부 사유는 버린다.
  }
  // FN-015 2차 방어 — 위 화이트리스트 재구성이 이미 field·reason 만 남기지만, 의존 기능표
  // (FN-014 §의존 기능 "FN-015 | 단계 3 | 동기")를 그대로 호출 관계로 반영한다. sanitizeValue
  // 가 T|undefined 를 반환하므로(회귀 1회차 S-6) 안전한 빈 배열로 대체한다.
  return sanitizeValue(whitelisted) ?? [];
}
