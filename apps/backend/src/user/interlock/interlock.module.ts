import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { EntryContextModule } from '../entry-context/entry-context.module';
import { EntryRateLimitMiddleware } from './entry-rate-limit.middleware';
import { EntryRateLimitStore } from './entry-rate-limit.store';
import { InterlockController } from './interlock.controller';
import { InterlockService } from './interlock.service';

/**
 * 서비스 A 진입 모듈 — SVC-004 / PROC-201 / USR-01·BAT-03.
 * 진입 컨텍스트 스토어(EntryContextModule)를 공유 주입받고, 요청 제한 카운터(EntryRateLimitStore)와
 * 그 미들웨어(FN-014)를 등록한다. AuditService(전역)·DataSource(전역 TypeOrmModule)는 주입으로 쓴다.
 */
@Module({
  imports: [EntryContextModule],
  controllers: [InterlockController],
  providers: [InterlockService, EntryRateLimitStore, EntryRateLimitMiddleware],
})
export class InterlockModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 진입 요청 제한(FN-014·OPS-001)을 POST /interlock/entry 진입점에 선적용한다.
    consumer.apply(EntryRateLimitMiddleware).forRoutes(InterlockController);
  }
}
