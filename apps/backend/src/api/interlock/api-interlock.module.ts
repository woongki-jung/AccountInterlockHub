import { Module } from '@nestjs/common';
import { ApiCommonModule } from '../common/api-common.module';
import { CompletionController } from './completion.controller';
import { CompletionService } from './completion.service';
import { HistoryScopeService } from './history-scope.service';

/**
 * 연동 완료 확인 API 모듈 — PROC-302 / SVC-008 / API-02(API-P3).
 *
 * 서비스 대면 API 공통 가드 인프라(ApiCommonModule)를 import 해 ServiceApiGuard(FN-004 인증·FN-014 요청제한)를
 * 주입 소비한다. 완료 판정 도메인 로직은 CompletionService(FN-017), 진입점·형식 검증 위임은 CompletionController 가 담당한다.
 *
 * HistoryScopeService(FN-019)는 완료 확인(P3)과 완료 콜백(P4/API-03)이 공유하는 스코프 조회 단일 소스라
 * export 한다 — 후속 P4 모듈이 본 모듈을 import 해 재사용한다.
 * DataSource(전역 TypeOrmModule)·AuditService(전역 AuditModule)는 주입으로 쓴다.
 */
@Module({
  imports: [ApiCommonModule],
  controllers: [CompletionController],
  providers: [HistoryScopeService, CompletionService],
  exports: [HistoryScopeService],
})
export class ApiInterlockModule {}
