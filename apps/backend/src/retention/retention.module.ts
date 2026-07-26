import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RetentionService } from './retention.service';

/**
 * PROC-304 삭제 로직 핵심 모듈. 스케줄(C1)·CLI(C2) 두 진입 경로가 공유하는 `RetentionService`
 * 하나만 제공한다(BR-015). 스케줄 배선(`@Cron`)은 이 모듈에 두지 않는다 — CLI 는
 * `RetentionCliModule`(cli/retention-cli.module.ts)로 이 모듈만 가져오고
 * `RetentionScheduleModule` 은 가져오지 않는다(1회성 실행 컨텍스트에 일 단위 스케줄러를 띄울
 * 이유가 없다). `InterlockConfigService` 는 `@Global()` 모듈(`InterlockConfigModule`)에서 오므로
 * 여기서 다시 imports 하지 않는다 — 호출측(AppModule·RetentionCliModule)이 이미 등록해 둔다.
 */
@Module({
  imports: [DatabaseModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
