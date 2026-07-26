import { config as loadDotenv } from 'dotenv';
// `import 'dotenv/config'`(main.ts 가 쓰는 형태)는 옵션을 넘길 수 없어 기본값으로 동작한다 —
// dotenv 는 `.env` 를 찾으면 주입 결과를 **표준 출력**에 한 줄 알림으로 남긴다(dotenv/lib/main.js
// `_log` — `console.log`). 이 스크립트는 표준 출력에 요약 JSON 한 줄만 내야 하므로(§명령
// 진입점 §표준 출력) `{ quiet: true }` 로 그 알림을 명시적으로 끈다.
loadDotenv({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { loadInterlockConfig } from '../config/interlock-config.loader';
import { RetentionCliModule } from './retention-cli.module';
import { RetentionService } from '../retention/retention.service';
import { buildRetentionSummaryLine } from '../retention/retention-output';

/**
 * 명령 진입점 — 보관 배치 수동 실행(spec-functions-api-server.md §명령 진입점 · PROC-304 C2).
 * 실행: `node dist/cli/retention.js`(개발 편의 별칭 `npm run retention:run`, package.json).
 *
 * **인자·옵션을 읽지 않는다**(§실행 규약 1) — `process.argv` 를 어디에서도 참조하지 않는다.
 * 인자를 붙여 실행해도 무시된다 — tc_BAT-02.md BAT-02_011 이 허용하는 두 갈래("무시되거나
 * 실행이 거부된다") 중 **무시** 쪽을 택했다(빌드 결정 — 완료 보고에 기록).
 *
 * **표준 출력에는 마지막 줄의 요약 JSON 1줄만 낸다** — 그 앞에 아무것도 찍지 않는다(§표준
 * 출력·표준 오류 — 진단 문구는 전부 표준 오류로). `logger: ['error']` 로 Nest 프레임워크 자체의
 * `log`·`warn`(둘 다 기본이 표준 출력 — `@nestjs/common` `ConsoleLogger.printMessages` 실측
 * 확인) 잡음은 표준 출력에서 걷어내되, `error` 레벨은 Nest 가 이미 `stderr` 로 못박아 두므로
 * (같은 실측) `RetentionService` 내부의 진단 로그(삭제 실패 시 `this.logger.error(...)`)가
 * 표준 오류로 그대로 나온다 — `logger: false`(완전 차단)로는 이 진단까지 함께 사라진다.
 * `abortOnError: false` 는 애플리케이션 컨텍스트 부트스트랩 자체가 실패했을 때 Nest 가 직접
 * `process.exit()` 하지 않고 예외를 되던지게 한다 — 이 파일의 catch 가 항상 종료 코드·정리
 * (`app.close()`)를 스스로 통제하게 하기 위함이다.
 */
async function main(): Promise<void> {
  const { missing, config, consent } = loadInterlockConfig(process.env);

  if (missing.length > 0 || !config || !consent) {
    // 사전 검증 — 필수 상수 미충족은 기동 단계에서 중단한다(PROC-901 · OPS-001-02 → EX-OPS-001).
    // 요약을 낼 주체가 아직 없으므로 요약 JSON 을 내지 않는다 — C3 판독 규칙("요약 JSON 이
    // 없으면 기동 실패로 판독한다")이 성립하려면 이 경로에서 JSON 을 내면 안 된다. 값은 남기지
    // 않고 미충족 상수명만 남긴다(FN-015 취지).
    console.log(`[PROC-901] 기동 중단 — 필수 연동 구성 상수 누락/형식 위반: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // B1 "CLI 진입점이 애플리케이션 컨텍스트를 기동해" — HTTP 서버를 열지 않는 최소 컨텍스트.
  const app = await NestFactory.createApplicationContext(RetentionCliModule.register({ config, consent }), {
    logger: ['error'],
    abortOnError: false,
  });

  try {
    const retention = app.get(RetentionService);
    // B2~B7 전체가 이 한 호출이다 — 스케줄 경로(retention-scheduler.service.ts)와 정확히 같은
    // 함수를 부른다(BR-015).
    const summary = await retention.run(new Date());

    // B6 — 표준 출력 마지막 줄에 JSON 1줄. 이 프로세스에서 유일한 stdout 출력이다.
    console.log(buildRetentionSummaryLine(summary));

    // B7 — 0 = 성공 / 0 이외 = 실패.
    process.exitCode = summary.failureReason === null ? 0 : 1;
  } catch (error) {
    // RetentionService.run() 은 설계상 예외를 던지지 않는다(내부에서 전부 failureReason 으로
    // 흡수한다 — retention/retention.service.ts 문서 주석). 여기 도달한다면 그 설계 전제 밖의
    // 실패다(예: DI 구성 자체의 오류). 요약 JSON 을 낼 수 없으므로 진단 문구만 표준 오류로 남기고
    // 기동 실패와 같은 형태(요약 없음 · 0 이외 종료)로 끝낸다 — C3 판독 규칙과 일관된 유일한
    // 선택지다("요약 JSON 이 없으면 기동 실패로 판독한다").
    console.error(`[PROC-304] 예상치 못한 실행 실패 — ${error instanceof Error ? error.name : typeof error}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
