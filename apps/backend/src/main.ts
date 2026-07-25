import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { cacheControlMiddleware, buildKnownRoutes, createRouteGuardMiddleware } from './common/http';
import { loadInterlockConfig } from './config/interlock-config.loader';

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

  const app = await NestFactory.create(AppModule.register({ config, consent }));

  // FN-014/015 횡단 계층(P05) — 반드시 이 순서로, Nest 라우팅이 붙기 전에 건다(app.use() 는
  // Nest 라우팅·전역 예외 필터보다 먼저 실행되도록 문서화된 동작이다).
  // 1) 캐시 금지 헤더를 모든 응답에 먼저 건다 — 순서를 바꾸면 뒤 응답이 헤더 없이 나갈 수 있다.
  // 2) 알려진 경로(§인터페이스 카탈로그)의 메서드 불일치를 405(본문 없음)로 끝낸다. 그 밖은
  //    next() 로 흘려 Nest 라우팅·전역 예외 필터(GlobalExceptionFilter)의 일반 404로 넘긴다.
  app.use(cacheControlMiddleware);
  app.use(createRouteGuardMiddleware(buildKnownRoutes(config.interlockEntryPath)));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`[PROC-901] 기동 완료 — 포트 ${port} · 동의 항목 버전 ${consent.version}`);
}

void bootstrap();
