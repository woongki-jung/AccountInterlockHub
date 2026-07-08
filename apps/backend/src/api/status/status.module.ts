import { Module } from '@nestjs/common';
import { ApiCommonModule } from '../common/api-common.module';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';

/**
 * 처리상태 확인 API 모듈 — PROC-301 / SVC-006 / API-01(API-P2).
 *
 * 서비스 대면 API 공통 가드 인프라(ApiCommonModule)를 import 해 ServiceApiGuard(FN-004 인증·FN-014 요청제한)를
 * 주입 소비한다. 조회·갱신·응답 변환 도메인 로직은 StatusService, 진입점·형식 검증은 StatusController 가 담당한다.
 * DataSource(전역 TypeOrmModule)·AuditService(전역 AuditModule)는 주입으로 쓴다.
 */
@Module({
  imports: [ApiCommonModule],
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
