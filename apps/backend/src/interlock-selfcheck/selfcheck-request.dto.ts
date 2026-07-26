// PROC-204 B2 입력 존재 검증 — process_PROC-204.md B2(SEC-003-04). 요청 본문 자체를 JSON 으로
// 해석할 수 없는 경우는 이 파일이 다루지 않는다 — Express 본문 파서가 라우팅 자체를 건너뛰어 이
// 컨트롤러에 절대 도달하지 않고(구조적 제약 — verify-request.dto.ts 와 같은 실측),
// common/http/body-parse-failure.ts 의 접점별 재분류(자가진단 경로 + POST → EX-SEC-003, 그 밖의
// 메서드는 NOT_FOUND)가 전역 예외 필터 계층에서 이미 처리한다(spec-functions-api.md §경로·메서드
// 규약). 이 파일은 그 파서를 "통과한"(문법적으로는 유효한 JSON 인) 본문의 **존재 검증(B2)** 을
// 겸한다 — 다른 세 접점의 B1 형상 재검증(verify-request.dto.ts 등)과 달리, 자가진단은
// `SEC-003-04` 가 "하나라도 없으면 판정을 수행하지 않는다"를 **이 접점 전용 400 EX-SEC-003
// 게이트**로 명시하므로 형상 좁히기와 존재 검증을 한 파일에서 함께 수행한다. **형식 검증은 하지
// 않는다** — MDL-014 §구현 가이드 "형식 위반은 다른 코드가 맡는다": 생년월일 형식은 FN-005·
// `EX-AUTH-001`(selfcheck.controller.ts → protocol-conformance.service.ts B3), 암호값 구조는
// FN-004 내부 판정 결과·200 부적합 `EX-SEC-001`(같은 서비스 B4) — 이 파일이 그 둘을 앞당겨
// 흉내 내지 않는다.
import { HttpMappedException } from '../common/errors/http-mapped.error';
import type { EncPair } from '../models/enc-pair.model';

/** B2 통과 후의 좁혀진 요청 값 — 셋 다 "존재하는(빈 문자열이 아닌) 문자열"임이 보장된다. */
export interface SelfcheckRequestBody {
  readonly encX: string;
  readonly encY: string;
  readonly birthDate: string;
}

/**
 * `SEC-003-04` 의 "부재" 판정 — 문자열이 아니거나(JSON 은 임의 타입이 올 수 있다) **빈
 * 문자열**이면 부재로 취급한다. 빈 문자열을 부재와 같이 다루는 것은 이 접점 전용 결정이다
 * (docs/specs/qa/API/tc_API-04.md `API-04_007` ② "셋 다 빈 문자열 → 400 EX-SEC-003" — 다른
 * 접점의 `asStringOrUndefined`(verify-request.dto.ts·approve-request.dto.ts)는 빈 문자열을
 * 그대로 통과시키지만, 그 접점들에는 `SEC-003-04` 같은 별도의 "부재" 게이트가 없어 빈 문자열이
 * FN-004 내부(`parseCipherPair` 의 `.trim() === ''` 검사, `EX-SEC-001`)로 흘러간다 — 자가진단은
 * 그 이전 단계에서 이미 걸러야 하므로 기준이 다르다).
 */
function isPresentString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * `B2` — 요청 본문에서 `encX`·`encY`·`birthDate` 셋의 **존재**를 검증한다(형식은 검증하지
 * 않는다 — `B3`·`B4` 의 몫). 하나라도 없으면(부재 정의는 위 `isPresentString` 참고) 판정을
 * 수행하지 않고 400 `EX-SEC-003` 을 던진다(`SEC-003-04`) — 메시지는 FN-014 카탈로그 기본값과
 * 같다(실제 응답 메시지는 항상 카탈로그에서 다시 계산되므로 이 값 자체가 응답에 실리지는
 * 않는다 — error-envelope.ts `buildErrorEnvelope` 참고).
 */
export function parseSelfcheckRequestBody(raw: unknown): SelfcheckRequestBody {
  const body: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const { encX, encY, birthDate } = body;
  if (!isPresentString(encX) || !isPresentString(encY) || !isPresentString(birthDate)) {
    throw new HttpMappedException('EX-SEC-003', '요청 값이 올바르지 않습니다.');
  }

  return { encX, encY, birthDate };
}

/** 존재 검증을 통과한 값을 FN-004 입력(`EncPair`)으로 좁힌다. */
export function toEncPair(request: SelfcheckRequestBody): EncPair {
  return { encX: request.encX, encY: request.encY };
}
