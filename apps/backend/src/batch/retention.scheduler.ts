import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { resolveCron, resolveRetentionDays } from './retention.env';
import { RetentionService } from './retention.service';

/**
 * 보관정책 배치 스케줄러 — PROC-402 진입점(앱 내부 스케줄, 일 1회 도래). 얇은 래퍼로, 실제 삭제 로직은
 * RetentionService(FN-011)에 위임한다. cron·보관 기간은 환경변수(RETENTION_CRON 기본 '0 3 * * *',
 * RETENTION_DAYS 기본 90)로 재정의한다.
 *
 * @Cron 데코레이터의 cron 표현식은 클래스 로드 시점(resolveCron())에 평가된다. 스케줄 등록은 AppModule 이
 * ScheduleModule.forRoot() 를 함께 import 할 때만 활성화된다(CLI 온디맨드 컨텍스트에서는 등록되지 않음).
 *
 * 실패 흡수: 배치 예외를 여기서 흡수해 프로세스를 중단시키지 않는다 — 잔여분은 다음 주기에 재시도된다
 * (OPS-003-03). 실패 감사(FAIL)는 RetentionService 가 이미 기록한다.
 */
@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(private readonly retentionService: RetentionService) {}

  @Cron(resolveCron(), { name: 'retention-batch' })
  async handleRetentionCron(): Promise<void> {
    const retentionDays = resolveRetentionDays();
    try {
      const result = await this.retentionService.runRetentionBatch(new Date(), retentionDays);
      this.logger.log(`보관정책 배치 완료 — ${JSON.stringify(result)}`);
    } catch (err) {
      // RetentionService 가 실패 감사를 남기고 예외를 재던진다. 여기서 흡수해 다음 주기 재시도로 넘긴다.
      this.logger.error(
        '보관정책 배치 실행 실패(다음 주기 재시도)',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
