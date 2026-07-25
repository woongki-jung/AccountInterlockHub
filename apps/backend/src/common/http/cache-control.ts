// 캐시 금지 헤더 — 모든 응답에 적용한다(spec-functions-api.md §공통 응답 포맷 "캐시"). 진입
// 응답은 URL 에 암호값을 담고, 조회 응답은 상태를 바꾸는 부작용(결과 확인 표시)이 있어 중간
// 캐시가 개입하면 안 된다.
import type { NextFunction, Request, Response } from 'express';

/**
 * `no-store` 가 핵심 지시(어떤 캐시에도 저장 금지)다. `Pragma`·`Expires` 는 HTTP/1.0 프록시·
 * 오래된 클라이언트와의 호환을 위한 보강이며, `no-store` 하나만으로도 요구사항(캐시 금지)은
 * 충족된다.
 */
export const NO_STORE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
});

/** 응답 객체에 캐시 금지 헤더를 직접 건다 — 전역 예외 필터 등 미들웨어 체인 밖에서도 재사용한다. */
export function applyNoStoreHeaders(response: Response): void {
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.setHeader(name, value);
  }
}

/**
 * main.ts 가 `app.use()` 로 **가장 먼저** 등록하는 전역 미들웨어. Nest 라우팅·전역 예외 필터
 * 보다 앞서 걸어야, 그 뒤 어떤 코드 경로(성공 응답·404·405·오류 엔벨로프)가 응답을 보내도
 * 헤더가 이미 실려 있다(Express 의 `res.setHeader` 는 이후 `res.json/send/end` 가 호출돼도
 * 유지된다 — 순서를 바꾸지 않는 한 이 미들웨어 하나로 전 응답을 커버한다).
 */
export function cacheControlMiddleware(_req: Request, res: Response, next: NextFunction): void {
  applyNoStoreHeaders(res);
  next();
}
