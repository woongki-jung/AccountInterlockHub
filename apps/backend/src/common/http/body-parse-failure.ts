// 요청 본문 JSON 파싱 실패 접점별 재분류(회귀 1회차 I-3). Express 의 본문 파서(Nest 가
// NestFactory.create() 시점에 라우터보다 먼저 건다)는 파싱에 실패하면 next(err) 로 라우팅
// 자체를 건너뛴다 — 컨트롤러가 실제로 존재해도 실행되지 않는다(실측 확인: 이 실패는
// `@nestjs/core` `routes-resolver.js` `mapExternalException()` 이 `SyntaxError` 를 exCode
// 없는 `BadRequestException` 으로 바꿔 던지고, 그 예외는 컨트롤러를 거치지 않은 채 곧바로
// 전역 예외 필터에 도달한다). **컨트롤러 쪽에서 해결할 수 없는 구조적 위치라 이 횡단 계층이
// 접점(경로)별로 판정한다**(spec-functions-api.md §경로·메서드 규약 "요청 본문을 JSON 으로
// 해석할 수 없으면 그 접점의 입력 부재와 같이 다룬다").
import type { KnownRoute } from './known-routes';
import { buildMethodsByPath } from './known-routes';

export type BodyParseFailureClassification =
  | { readonly kind: 'EX_CODE'; readonly exCode: 'EX-DATA-002' | 'EX-SEC-003' | 'EX-AUTH-001' | 'EX-BIZ-001' }
  | { readonly kind: 'METHOD_NOT_ALLOWED'; readonly allowedMethods: readonly string[] }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNCLASSIFIED' };

/**
 * 추적 키 3종 접점 — spec-functions-api-server.md §공통 요청 형상. `known-routes.ts` 와 같은
 * 근거로 리터럴 그대로 둔다(사양이 직접 고정한 경로라 상수 주입 대상이 아니다).
 */
const TRACKING_KEY_INPUT_PATHS: ReadonlySet<string> = new Set([
  '/api/interlock/status',
  '/api/interlock/completion',
  '/api/interlock/callback',
]);

/**
 * 사용자 제출 표면 2종의 접미사 → EX 코드(회귀 2회차 I-A). `<INTERLOCK_ENTRY_PATH>` 뒤에 붙는
 * 리터럴 접미사이므로 `entryPath` 와 문자열로 합성한다(경로 자체는 사양이 고정한 리터럴이라
 * `known-routes.ts` 와 같은 근거로 상수 주입 대상이 아니다).
 *
 * **근거 — 회귀 1회차 때는 "접점마다 다른 값을 요구하는데 그 구체 값은 각 접점의 실제 입력
 * 검증 순서(컨트롤러 부재)에 달려 있어 단정할 수 없다"며 이 둘을 의도적으로 `UNCLASSIFIED` 로
 * 남겼으나, 그 판단은 두 근거 앞에서 성립하지 않는다.**
 * 1. `spec-functions-api.md` §경로·메서드 규약이 접점별 값을 **이미 명시로 확정**했다 —
 *    "본인확인 제출 → `EX-AUTH-001`, 동의·승인 제출 → `EX-BIZ-001`"(연동 요청 진입은 GET 이라
 *    요청 본문이 없어 해당하지 않는다고 같은 문장이 명시한다 — 그래서 진입 경로는 이 표에
 *    없다).
 * 2. `docs/specs/qa/USR/tc_USR-04.md` `USR-04_005` ④가 승인 접점의 거동을 검증 케이스로
 *    이미 못박고 있다 — "본문 자체를 해석할 수 없게 보낸다 → 400 `EX-BIZ-001`". 컨트롤러가
 *    없어 접점별 검증 순서를 알 수 없다는 사유로도 이 TC 앞에서는 불확실성이 없다 — 검증
 *    순서와 무관하게 **요청 본문 자체가 해석 불가능하면** 그 접점의 입력이 없는 것과 같이
 *    다루는 것이 사양 값이다.
 *
 * 남은 사용자 진입 표면(연동 요청 진입, GET)은 이 표에 없다 — 요청 본문이 없어 판정할 사양
 * 값 자체가 없다(위 1 과 같은 문장). 그 경로에서 본문 파싱이 실패하는 가상의 경우는 계속
 * `UNCLASSIFIED` 로 남아 기존 마지막 방어(`EX-OPS-002`/500)로 수렴한다 — 그 잔여를 200 으로
 * 바꾸는 것은 `#484`(P07) S-7 진입 접점 200 폴백의 몫이라 이 Phase 가 만들지 않는다.
 */
const USER_SUBMIT_EX_BY_SUFFIX: ReadonlyMap<string, 'EX-AUTH-001' | 'EX-BIZ-001'> = new Map([
  ['/verify', 'EX-AUTH-001'],
  ['/approve', 'EX-BIZ-001'],
]);

/**
 * `path`·`method` 로 판정한다(`path` 는 호출측이 `known-routes.ts` `normalizePath()` 로 이미
 * 정규화했다고 가정한다 — route-guard 와 같은 규칙).
 *
 * **판정 원칙 — "본문 파싱 실패가, 본문이 멀쩡했을 때보다 더 나쁜(더 많이 드러내는) 결과를
 * 만들지 않는다."** 즉 같은 경로·메서드로 **본문이 멀쩡했다면** 어떤 결과가 났을지를 먼저
 * 따지고, 그 결과가 404·405 였을 자리에는 본문 내용과 무관하게 같은 404·405 를 낸다 —
 * 특히 **자가진단 경로는 메서드가 틀리면 (본문이 깨졌든 멀쩡했든) 항상 일반 404** 여야 한다
 * (`SEC-003-02`, 경로 존재 은닉이 이 서비스의 유일한 완화 장치다 — `OPS-002`). 메서드까지
 * 맞아떨어지는 경우에만 "이 접점은 입력이 사실상 없는 것과 같다"는 사양 규칙을 적용해 EX
 * 코드를 낸다.
 *
 * 사용자 진입 표면 중 **연동 요청 진입(GET)만** `UNCLASSIFIED` 로 남는다 — 위
 * `USER_SUBMIT_EX_BY_SUFFIX` 문서 참고(회귀 2회차 I-A로 본인확인·동의·승인 제출은 값이
 * 확정됐다).
 */
export function classifyBodyParseFailure(
  path: string,
  method: string,
  knownRoutes: readonly KnownRoute[],
  selfcheckPath: string,
  entryPath: string,
): BodyParseFailureClassification {
  if (path === selfcheckPath) {
    return method === 'POST' ? { kind: 'EX_CODE', exCode: 'EX-SEC-003' } : { kind: 'NOT_FOUND' };
  }

  const methodsByPath = buildMethodsByPath(knownRoutes);
  const allowedMethods = methodsByPath.get(path);

  if (!allowedMethods) {
    return { kind: 'NOT_FOUND' };
  }
  if (!allowedMethods.has(method)) {
    return { kind: 'METHOD_NOT_ALLOWED', allowedMethods: [...allowedMethods] };
  }
  if (TRACKING_KEY_INPUT_PATHS.has(path)) {
    return { kind: 'EX_CODE', exCode: 'EX-DATA-002' };
  }
  for (const [suffix, exCode] of USER_SUBMIT_EX_BY_SUFFIX) {
    if (path === `${entryPath}${suffix}`) {
      return { kind: 'EX_CODE', exCode };
    }
  }
  return { kind: 'UNCLASSIFIED' }; // 연동 요청 진입(GET) — 요청 본문이 없어 해당하지 않는다.
}
