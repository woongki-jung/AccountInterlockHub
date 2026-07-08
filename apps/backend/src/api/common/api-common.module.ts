import { Module } from '@nestjs/common';
import { ServiceApiAuthService } from './service-api-auth.service';
import { ServiceApiRateLimitStore } from './service-api-rate-limit.store';
import { ServiceApiGuard } from './service-api.guard';

/**
 * 서비스 대면 API 공통 인프라 모듈 — API-01(처리상태 확인)·API-02(연동 완료 확인)·API-03(완료 콜백) 횡단.
 *
 * 인증(FN-004 / ServiceApiAuthService)·요청제한 카운터(FN-014 / ServiceApiRateLimitStore)·진입 가드
 * (ServiceApiGuard)를 등록·export 한다. 후속 엔드포인트 모듈(P2/P3/P4)이 본 모듈을 import 하고,
 * 라우트에 @UseGuards(ServiceApiGuard) + @ServiceApi({ actor, scope }) 로 가드를 소비한다.
 *
 * AuditService(@Global AuditModule)·ConfigService(전역 ConfigModule)·Reflector(Nest core)는 주입으로 쓴다.
 */
@Module({
  providers: [ServiceApiAuthService, ServiceApiRateLimitStore, ServiceApiGuard],
  exports: [ServiceApiAuthService, ServiceApiRateLimitStore, ServiceApiGuard],
})
export class ApiCommonModule {}
