// 405(메서드 불일치, 본문 없음) 판정 미들웨어(spec-functions-api.md §경로·메서드 규약).
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { KnownRoute } from './known-routes';

/**
 * main.ts 가 `app.use()` 로 Nest 라우팅보다 먼저 건다. **책임을 405 판정 하나로 좁힌다** —
 * "알려진 경로인데 메서드가 다르면" 여기서 즉시 405(본문 없음)로 끝내고, 그 밖(경로 자체가
 * 표에 없음 · 경로도 메서드도 맞음)은 전부 `next()` 로 흘려보낸다. "경로 자체가 없다"는 이
 * 미들웨어가 응답하지 않는다 — Nest 라우팅이 못 찾으면 전역 예외 필터가 일반 404 로 마무리한다
 * (책임 분리, `GlobalExceptionFilter` 참고).
 *
 * 경로 비교는 정확히 일치하는 문자열만 인정한다(대소문자 구분 — spec-functions-api.md 의
 * `encX`·`encY` 대소문자 구분 관례와 같은 태도). 끝의 슬래시 하나는 관대하게 같은 경로로
 * 본다(Express 라우팅 자체가 기본으로 느슨한 라우팅(`strict routing` 비활성)을 쓰므로, 이
 * 미들웨어도 같은 관용을 따르지 않으면 "Nest 는 매치하는데 이 미들웨어만 못 찾는" 불일치가
 * 생긴다) — 그 밖의 정규화(중복 슬래시 축약 등)는 하지 않는다.
 */
export function createRouteGuardMiddleware(knownRoutes: readonly KnownRoute[]): RequestHandler {
  const methodsByPath = new Map<string, Set<string>>();
  for (const route of knownRoutes) {
    if (!methodsByPath.has(route.path)) {
      methodsByPath.set(route.path, new Set());
    }
    methodsByPath.get(route.path)!.add(route.method);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = normalizeTrailingSlash(req.path);
    const allowedMethods = methodsByPath.get(path);

    if (!allowedMethods || allowedMethods.has(req.method)) {
      next();
      return;
    }

    res.status(405).end(); // 본문 없음 — 캐시 금지 헤더는 앞선 cacheControlMiddleware 가 이미 걸었다.
  };
}

function normalizeTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
