import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { DeliveryService } from '../delivery/delivery.service';
import { InterlockHistoryService } from '../history/interlock-history.service';
import { ProcessStatusService } from '../status/process-status.service';
import { EntryRateLimitMiddleware } from './entry-rate-limit.middleware';
import { EntryRateLimitStore } from './entry-rate-limit.store';
import { HubDecryptModule } from './hub-decrypt.module';
import { InterlockController } from './interlock.controller';
import { InterlockService } from './interlock.service';

/**
 * 사용자 연동 실행 모듈 — SVC-004(승인 게이팅)·SVC-005(복호화·이력·전달·상태) / PROC-202·PROC-203 /
 * USR-01·USR-02.
 *
 * ConsentModule(FN-008 게이팅)·HubDecryptModule(FN-020 복호화)을 주입받아 POST /api/interlock/approve 에서
 * 오케스트레이션한다(InterlockService). 이력 생성(InterlockHistoryService)·전달(DeliveryService)·상태 저장
 * (ProcessStatusService)은 계층 분리해 함께 등록한다.
 *
 * 요청 제한(FN-014, EntryRateLimitStore·Middleware)은 본 모듈이 GET /api/consent/:accessAddressId
 * (PROC-201)·POST /api/interlock/approve(PROC-202) 양쪽에 선적용한다(`#214`(P5) 로 구 POST /interlock/entry
 * 단일 진입점에서 재배치 — 경로는 ConsentController 가 다른 모듈(ConsentModule)에 있어도 Nest 미들웨어는
 * 애플리케이션 전역 라우팅 기준으로 매칭되므로 문제없다, AdminIpMiddleware 와 동일 패턴).
 *
 * AuditService(@Global AuditModule)·DataSource(전역 TypeOrmModule)는 주입으로 쓴다.
 */
@Module({
  imports: [ConsentModule, HubDecryptModule],
  controllers: [InterlockController],
  providers: [
    InterlockService,
    InterlockHistoryService,
    DeliveryService,
    ProcessStatusService,
    EntryRateLimitStore,
    EntryRateLimitMiddleware,
  ],
})
export class InterlockModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 사용자 진입 요청 제한(FN-014·OPS-001)을 동의 조회·승인 제출 양쪽에 선적용한다.
    consumer.apply(EntryRateLimitMiddleware).forRoutes('api/consent', 'api/interlock/approve');
  }
}
