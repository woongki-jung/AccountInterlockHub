import { Module } from '@nestjs/common';
import { ApiCommonModule } from '../common/api-common.module';
import { CallbackController } from './callback.controller';
import { CallbackService } from './callback.service';
import { CompletionController } from './completion.controller';
import { CompletionService } from './completion.service';
import { HistoryScopeService } from './history-scope.service';

/**
 * 연동 완료 확인·완료 콜백 API 모듈 — PROC-302/SVC-008/API-02(P3) + PROC-303·PROC-403/SVC-009/API-03(P4).
 *
 * 서비스 대면 API 공통 가드 인프라(ApiCommonModule)를 import 해 ServiceApiGuard(FN-004 인증·FN-014 요청제한)를
 * 주입 소비한다. 완료 판정 도메인 로직은 CompletionService(FN-017), 완료 콜백 대상 특정·완료 기록 로직은
 * CallbackService(FN-018)가 담당하고, 진입점·형식 검증 위임은 각 컨트롤러가 맡는다.
 *
 * HistoryScopeService(FN-019)는 완료 확인(P3)과 완료 콜백(P4/API-03)이 공유하는 스코프 조회 단일 소스로,
 * 두 서비스가 본 모듈 내 provider 로 주입 재사용한다(export 는 후속 소비 대비 유지).
 * DataSource(전역 TypeOrmModule)·AuditService(전역 AuditModule)는 주입으로 쓴다.
 */
@Module({
  imports: [ApiCommonModule],
  controllers: [CompletionController, CallbackController],
  providers: [HistoryScopeService, CompletionService, CallbackService],
  exports: [HistoryScopeService],
})
export class ApiInterlockModule {}
