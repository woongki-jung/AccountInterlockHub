import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

/**
 * 연동 구성 관리 모듈 — SVC-001 / PROC-101 / ADM-01.
 * AdminAuthModule 에서 SessionGuard(FN-003)를 가져와 재사용하고(IP → 세션 순),
 * AuditService(전역 AuditModule)·DataSource(전역 TypeOrmModule)는 주입으로 쓴다.
 */
@Module({
  imports: [AdminAuthModule],
  controllers: [ConfigController],
  providers: [ConfigService],
})
export class ConfigModule {}
