// 405(메서드 불일치, 본문 없음) 판정 미들웨어(spec-functions-api.md §경로·메서드 규약).
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { buildMethodsByPath, normalizePath } from './known-routes';
import type { KnownRoute } from './known-routes';

/**
 * main.ts 가 `app.use()` 로 Nest 라우팅보다 먼저 건다. **책임을 405 판정 하나로 좁힌다** —
 * "알려진 경로인데 메서드가 다르면" 여기서 즉시 405(본문 없음)로 끝내고, 그 밖(경로 자체가
 * 표에 없음 · 경로도 메서드도 맞음)은 전부 `next()` 로 흘려보낸다. "경로 자체가 없다"는 이
 * 미들웨어가 응답하지 않는다 — Nest 라우팅이 못 찾으면 전역 예외 필터가 일반 404 로 마무리한다
 * (책임 분리, `GlobalExceptionFilter` 참고).
 *
 * 경로 비교는 정확히 일치하는 문자열만 인정한다(대소문자 구분 — spec-functions-api.md 의
 * `encX`·`encY` 대소문자 구분 관례와 같은 태도. 회귀 1회차 S-3 — 이 미들웨어는 원래부터
 * 대소문자를 구분했으나, Nest 라우팅 자신은 Express 기본값(대소문자 무시)이라 대문자로 바꿔
 * 보낸 요청은 이 미들웨어를 통과(`next()`)한 뒤 Nest 쪽에서 여전히 매치돼 혼선이 났다 —
 * `main.ts` 가 어댑터 설정으로 그 쪽도 대소문자를 구분하도록 맞췄다). 끝의 슬래시 하나는
 * `known-routes.ts` `normalizePath()` 로 관대하게 같은 경로로 본다.
 */
export function createRouteGuardMiddleware(knownRoutes: readonly KnownRoute[]): RequestHandler {
  const methodsByPath = buildMethodsByPath(knownRoutes);

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = normalizePath(req.path);
    const allowedMethods = methodsByPath.get(path);

    if (!allowedMethods || allowedMethods.has(req.method)) {
      next();
      return;
    }

    // 회귀 1회차 S-4 — RFC 9110 §15.5.6 은 405 응답에 Allow 헤더를 MUST 로 요구한다. 이
    // 경로는 이미 405 자체로 "경로가 존재한다"는 사실을 드러낸 상태라(자가진단 경로는 애초에
    // 이 표에 없어 이 분기에 도달하지 않는다) Allow 헤더가 추가 정보를 새로 누출하지 않는다.
    res.set('Allow', [...allowedMethods].join(', '));
    res.status(405).end(); // 본문 없음 — 캐시 금지 헤더는 앞선 cacheControlMiddleware 가 이미 걸었다.
  };
}
