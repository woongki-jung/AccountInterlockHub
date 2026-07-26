import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RetentionModule } from './retention.module';
import { RetentionSchedulerService } from './retention-scheduler.service';

/**
 * 애플리케이션 프로세스 안의 일 단위 스케줄 배선(PROC-304 C1). `AppModule` 만 이 모듈을
 * imports 한다 — CLI 컨텍스트(`cli/retention-cli.module.ts`)는 `RetentionModule` 만 가져오고
 * 이 모듈은 가져오지 않는다(1회 실행 후 종료하는 컨텍스트에 스케줄러를 띄울 이유가 없다 —
 * `ScheduleModule.forRoot()` 가 그 컨텍스트에서도 기술적으로는 동작하지만, CLI 실행마다 스케줄
 * 레지스트리를 만들었다 바로 닫는 것은 §실행 규약 5(별도 실행 이력·부가 표면을 두지 않는다)의
 * 취지와 맞지 않는 불필요한 배선이다).
 */
@Module({
  imports: [ScheduleModule.forRoot(), RetentionModule],
  providers: [RetentionSchedulerService],
})
export class RetentionScheduleModule {}
