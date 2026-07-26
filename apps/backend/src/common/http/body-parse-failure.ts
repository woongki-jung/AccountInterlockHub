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
  | { readonly kind: 'EX_CODE'; readonly exCode: 'EX-DATA-002' | 'EX-SEC-003' }
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
 * 사용자 진입 표면(진입·본인확인 제출·동의·승인 제출)은 **의도적으로 `UNCLASSIFIED` 로
 * 둔다** — 사양 문구가 "사용자 표면 → 각 접점의 입력 검증 코드"로 접점마다 다른 값을
 * 요구하는데, 그 구체 값은 각 접점의 실제 입력 검증 순서(아직 컨트롤러가 없다)에 달려 있어
 * 이 횡단 계층이 대신 단정할 수 없다 — 지어내지 않고 호출측(`GlobalExceptionFilter`)이
 * `EX-OPS-002` 마지막 방어로 흘려보내게 한다(문서화된 확인 필요 — 완료 보고 참고).
 */
export function classifyBodyParseFailure(
  path: string,
  method: string,
  knownRoutes: readonly KnownRoute[],
  selfcheckPath: string,
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
  return { kind: 'UNCLASSIFIED' }; // 사용자 진입 표면(진입·verify·approve) — 위 §문서 참고.
}
