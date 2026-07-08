import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { SessionGuard } from './session.guard';

/**
 * 관리자 접근·로그인 모듈 — SVC-003 / ADM-03.
 * AuditService(전역 AuditModule)·DataSource(전역 TypeOrmModule)·ConfigService(전역)를 주입해 쓴다.
 * SessionGuard 는 후속 관리자 보호 라우트(PROC-101/102/105/106)에서 재사용하도록 export 한다.
 */
@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, SessionGuard],
  exports: [SessionGuard],
})
export class AdminAuthModule {}
