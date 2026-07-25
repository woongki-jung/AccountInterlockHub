import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
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

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`[PROC-901] 기동 완료 — 포트 ${port} · 동의 항목 버전 ${consent.version}`);
}

void bootstrap();
