import 'dotenv/config';
import { resolve } from 'node:path';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  cacheControlMiddleware,
  buildKnownRoutes,
  createRouteGuardMiddleware,
  createStaticAssetsMiddleware,
} from './common/http';
import { RedactingConsoleLogger } from './common/logging/redacting-console-logger';
import { loadInterlockConfig } from './config/interlock-config.loader';

/**
 * React 빌드 산출물 폴더 — `apps/frontend/dist`(infra.md §애플리케이션 구성 "단일 배포
 * 단위"). `main.ts` 자신의 컴파일 위치 기준으로 계산한다: 이 파일은 항상
 * `apps/backend/<X>/main.{ts,js}`(X = `src`(`nest start` — ts-node 가 소스를 직접
 * 실행) 또는 `dist`(`node dist/main` — 컴파일 산출물))에 있으므로 두 실행 방식 모두
 * `__dirname` 에서 두 단계 위가 `apps/`, 그 아래 `frontend/dist`가 같은 상대 위치다.
 * `process.cwd()`(npm 스크립트의 실행 디렉터리)에 기대지 않는다 — root `package.json`
 * 이 `--prefix apps/backend` 로 cwd 를 옮기지만, 그 규칙이 배포 환경까지 보장하지 않는다.
 */
const FRONTEND_DIST_DIR = resolve(__dirname, '../../frontend/dist');

/**
 * PROC-901 애플리케이션 기동·상수 검증.
 * 필수 상수가 하나라도 누락·형식 위반이면 어떤 표면도 열지 않고 중단한다
 * (OPS-001-02 → EX-OPS-001, HTTP 응답 없음 — 부분 기동을 하지 않는다).
 * 검증은 Nest 애플리케이션 생성 이전에 수행한다 — 실패 시 NestFactory.create()/app.listen() 에 도달하지 않는다.
 */
async function bootstrap(): Promise<void> {
  const { missing, config, consent } = loadInterlockConfig(process.env);

  if (missing.length > 0 || !config || !consent) {
    // 표준 출력에 미충족 상수명만 남긴다 — 값은 남기지 않는다(FN-015 취지 · DATA-001-04 · OPS-001-02).
    // process.exit() 을 바로 부르지 않는다 — 파이프로 리다이렉트된 stdout 이 잘릴 수 있어(Windows 포함)
    // exitCode 만 설정하고 이벤트 루프가 자연스럽게 비워지며 종료되게 한다.
    console.log(`[PROC-901] 기동 중단 — 필수 연동 구성 상수 누락/형식 위반: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // 회귀 1회차 S-3 — Express(Nest 어댑터) 기본값은 라우팅이 대소문자를 구분하지 않는다.
  // route-guard(아래)·본문 파싱 실패 재분류(GlobalExceptionFilter)는 항상 대소문자를
  // 구분해 왔는데, Nest 라우팅 자신이 구분하지 않으면 대문자로 바꿔 보낸 요청이 route-guard
  // 는 통과("모르는 경로")하고도 Nest 쪽에서는 여전히 매치돼(실측 확인) 두 계층의 판정이
  // 어긋난다.
  //
  // **두 가지 함정을 모두 실측으로 확인하고 피했다.** ① `NestFactory.create()` 이후에
  // `app.set()` 을 호출하는 것으로는 고쳐지지 않는다 — Express 는 내부 라우터를 첫 라우트
  // 등록 시점에 `caseSensitive` 옵션을 고정해 딱 한 번만 생성하는 지연 게터이고
  // (`express/lib/application.js` `app.init()`), Nest 가 컨트롤러 라우트를
  // `NestFactory.create()` 안에서 이미 등록해 버려 그 뒤의 `.set()` 은 늦다. ② `new
  // ExpressAdapter()` 를 인자 없이 만든 뒤 `.getInstance().set(...)` 을 호출하는 것도
  // 늦다 — `ExpressAdapter` 생성자 자신이 내부적으로 `express()` 를 만들자마자
  // `this.instance.use(...)` 를 호출하는데(연결 종료 훅 배선), Express 의 `app.use()` 자체가
  // 내부에서 `this.router`(그 지연 게터)를 즉시 읽어 그 시점에 이미 `caseSensitive:false`
  // (기본값)로 라우터가 굳어 버린다 — `.set()` 을 그 다음 줄에 호출해도 이미 늦다(실측
  // 확인 — 이 경로로는 대문자 변형 요청이 여전히 매치됐다).
  //
  // 그래서 **Express 앱을 직접 만들어 먼저 설정한 뒤**, 그 인스턴스를 `ExpressAdapter` 의
  // 생성자 인자로 넘겨 Nest 가 자기 것을 새로 만들지 않게 한다 — 이 순서에서만 Nest 가 첫
  // 라우트를 등록하기 전에 설정이 확정된다(실측 확인 — 대문자 변형 요청이 404 로 정확히
  // 걸러짐).
  const expressInstance = express();
  expressInstance.set('case sensitive routing', true);

  // P12 회귀 1회차 C-1 — `<SELFCHECK_PATH>` 는 애플리케이션 코드가 로그로 남기지 않지만,
  // `@Post(selfcheckPath)` 로 라우트를 등록하는 것 자체가 Nest 내부 RouterExplorer 로 하여금
  // 기동 로그에 `Mapped {<경로>, POST} route` 를 그대로 찍게 만든다(실측 확인 — 프레임워크가
  // 라우트 등록을 관측해 스스로 남기는 로그라 애플리케이션 코드 어디에도 그 호출이 없고,
  // 정적 읽기로 검출할 수 없다). 커스텀 Logger 를 주입해 이 값이 실제로 등장하는 로그
  // 메시지만 값 기반으로 걸러낸다(FN-015 의 키 이름 기반 방어가 원리상 닿지 않는 자리를
  // 보완하는 2차 방어 — common/logging/redacting-console-logger.ts 참고). 🔴 전역
  // `logger:false` 를 쓰지 않는다 — 그러면 다른 기동 로그(다른 경로의 라우트 매핑·기동 완료
  // 등)까지 함께 사라진다.
  const bootstrapLogger = new RedactingConsoleLogger([config.selfcheckPath]);

  const app = await NestFactory.create(AppModule.register({ config, consent }), new ExpressAdapter(expressInstance), {
    logger: bootstrapLogger,
  });

  // FN-014/015 횡단 계층(P05) + 정적 서빙 배선(P16, `#493`) — 반드시 이 순서로, Nest 라우팅이
  // 붙기 전에 건다(app.use() 는 Nest 라우팅·전역 예외 필터보다 먼저 실행되도록 문서화된
  // 동작이다 — 위 case-sensitive routing 주석과 같은 근거).
  // 1) 캐시 금지 헤더를 모든 응답에 먼저 건다 — 순서를 바꾸면 뒤 응답이 헤더 없이 나갈 수 있다.
  // 2) 알려진 경로(§인터페이스 카탈로그)의 메서드 불일치를 405(본문 없음)로 끝낸다. 그 밖은
  //    next() 로 흘려보낸다.
  // 3) React 정적 빌드 산출물을 서빙한다 — <INTERLOCK_ENTRY_PATH>·/api/**·<SELFCHECK_PATH>
  //    는 정적 파일 탐색조차 하지 않고 무조건 next() 로 흘린다(static-assets.ts §파일 상단
  //    근거 — SPA 폴백 제외 경로, spec-functions-api-user.md §처리·응답 규약 1). route-guard
  //    보다 뒤에 두어 알려진 경로의 405 판정이 먼저 성립하게 한다.
  // 그 밖(정적 파일도 아니고 컨트롤러도 없는 경로)은 Nest 라우팅을 거쳐 전역 예외 필터
  // (GlobalExceptionFilter)의 본문 없는 일반 404(SEC-003-02)로 귀결된다.
  app.use(cacheControlMiddleware);
  app.use(createRouteGuardMiddleware(buildKnownRoutes(config.interlockEntryPath)));
  app.use(
    createStaticAssetsMiddleware(FRONTEND_DIST_DIR, {
      interlockEntryPath: config.interlockEntryPath,
      selfcheckPath: config.selfcheckPath,
    }),
  );

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`[PROC-901] 기동 완료 — 포트 ${port} · 동의 항목 버전 ${consent.version}`);
}

void bootstrap();
