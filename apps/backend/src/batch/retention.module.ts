import { Module } from '@nestjs/common';
import { RetentionScheduler } from './retention.scheduler';
import { RetentionService } from './retention.service';

/**
 * 보관정책 배치 모듈 — SVC-007 / PROC-402(BAT-02). 삭제 로직(RetentionService, FN-011)과 스케줄 진입점
 * (RetentionScheduler)을 배선한다. DataSource(전역 TypeOrmModule)·AuditService(전역 AuditModule)는 주입으로 쓴다.
 *
 * 스케줄 등록은 AppModule 이 ScheduleModule.forRoot() 를 함께 import 할 때만 활성화된다. CLI 온디맨드 러너는
 * RetentionService 만 소비하므로 RetentionService 를 export 한다(스케줄러는 컨텍스트에 존재하되 등록되지 않음).
 */
@Module({
  providers: [RetentionService, RetentionScheduler],
  exports: [RetentionService],
})
export class RetentionModule {}
