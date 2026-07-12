import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuditModule } from '../common/audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { resolveAbsoluteDays, resolveConfirmedDays, resolveNow } from './retention.env';
import { RetentionModule } from './retention.module';
import { RetentionService } from './retention.service';

/**
 * 보관정책 배치 CLI 온디맨드 러너 — `node --env-file=.env dist/batch/run-retention-batch.js`
 * (npm run batch:retention). 스케줄 도래를 기다리지 않고 배치를 1회 즉시 실행하고, MDL-402 결과 JSON 을
 * stdout 으로 출력한 뒤 성공 exit 0(실패 비0)으로 종료한다. tester 의 온디맨드 트리거·round-trip 검증에 쓴다.
 *
 * now·보관 기간(fallback two-pass)은 env 로 재정의할 수 있다(RETENTION_NOW ISO8601 = 경계 검증용,
 * RETENTION_CONFIRMED_DAYS 기본 90, RETENTION_ABSOLUTE_DAYS 기본 180, 청크 크기는 RETENTION_CHUNK_SIZE).
 * HTTP 서버·정적 서빙·API 가드·스케줄 등록 없이 배치에 필요한 최소 의존만 구성한다(ScheduleModule 미포함
 * — 온디맨드 1회 실행).
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuditModule, RetentionModule],
})
class RetentionBatchCliModule {}

async function main(): Promise<void> {
  const now = resolveNow();
  const confirmedDays = resolveConfirmedDays();
  const absoluteDays = resolveAbsoluteDays();

  const app = await NestFactory.createApplicationContext(RetentionBatchCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const service = app.get(RetentionService);
    const result = await service.runRetentionBatch(now, confirmedDays, absoluteDays);
    // MDL-402 결과 JSON 을 stdout 으로 출력(round-trip 검증용). 로그(stderr)와 분리한다.
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[batch:retention] 실패:', err);
  process.exit(1);
});
