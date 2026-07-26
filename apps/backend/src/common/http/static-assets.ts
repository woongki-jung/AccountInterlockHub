// React 정적 빌드 산출물 서빙 — infra.md §애플리케이션 구성("NestJS가 산출물을 정적 콘텐츠로
// 서빙"). main.ts 가 cacheControlMiddleware·routeGuardMiddleware 뒤, Nest 라우팅 앞에 건다.
//
// **SPA 폴백(못 찾으면 index.html 로 대신 응답하는 catch-all)을 두지 않는다.** 이 표면은
// 사용자가 브라우저로 다니는 경로가 <INTERLOCK_ENTRY_PATH> 하나뿐이고(design-system.md §표면
// 전제 3 "경로가 하나다"), 그 경로는 허브가 초기 상태를 주입해 직접 응답해야 한다
// (spec-functions-api-user.md §연동 요청 진입 §처리·응답 규약 1 "허브가 진입 경로 요청을
// 직접 처리한다(정적 자산 서빙보다 앞선다)" · §초기 상태 주입 형식 4 "정적 자산으로 미리
// 빌드된 문서가 값 없이 서빙되면… 정상 진입이 경로 ②로 끝난다") — 그 통제된 문서 조립(초기
// 상태 스크립트 주입)은 진입 접점 컨트롤러(PROC-101, 별도 Phase 소관 — #493 범위 밖. 그
// 컨트롤러가 아직 배선되지 않아 지금은 이 경로가 그대로 404 로 끝난다)의 몫이다. 이 계층이
// "못 찾으면 index.html 로 대신 응답"하는 catch-all 을 두면 그 실패 모드를 스스로 만드는
// 셈이라 두지 않는다. `index:false` 로 디렉터리 인덱스 자동 응답도 원천 차단한다 — 이
// 미들웨어는 오직 실재하는 정적 파일과 정확히 일치하는 요청에만 응답하고, 그 밖은 전부
// `next()` 로 흘려 Nest 라우팅 → 전역 예외 필터의 "본문 없는 일반 404"(SEC-003-02)로
// 귀결시킨다.
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

export interface StaticAssetsExclusions {
  /** `<INTERLOCK_ENTRY_PATH>` — 허브가 직접 처리하며 정적 자산 서빙보다 앞선다(위 파일 상단 근거). */
  readonly interlockEntryPath: string;
  /**
   * `<SELFCHECK_PATH>` — 자가진단 비공개 경로. `/api` 접두어 소속이라도 `known-routes.ts`·
   * `body-parse-failure.ts` 와 같은 태도로 **prefix 추론에 기대지 않고 독립 값으로 다시
   * 제외**한다(`SEC-003-02` — 경로 존재를 드러내지 않는다).
   */
  readonly selfcheckPath: string;
}

const API_PREFIX = '/api/';

/**
 * `frontendDistDir`(빌드 산출물 폴더, 예: `apps/frontend/dist`)를 정적 콘텐츠로 서빙하는
 * 미들웨어를 만든다. `exclusions` 에 실린 경로·`/api/**` 는 정적 파일 탐색조차 하지 않고
 * 무조건 `next()`(SPA 폴백 제외 경로, `#493`).
 */
export function createStaticAssetsMiddleware(
  frontendDistDir: string,
  exclusions: StaticAssetsExclusions,
): RequestHandler {
  const serveStatic = express.static(frontendDistDir, {
    index: false, // 디렉터리 인덱스(index.html) 자동 응답 차단 — 위 파일 상단 근거.
    redirect: false, // 디렉터리 요청을 슬래시 리다이렉트로 넌지시 알리지 않는다.
    fallthrough: true, // 못 찾으면 next() — express.static 기본값이나, 이 파일의 "SPA 폴백
    //   없음" 전제가 이 값에 의존하므로 명시적으로 못박는다.
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    if (
      req.path === exclusions.interlockEntryPath ||
      req.path === exclusions.selfcheckPath ||
      req.path.startsWith(API_PREFIX)
    ) {
      next();
      return;
    }
    serveStatic(req, res, next);
  };
}
