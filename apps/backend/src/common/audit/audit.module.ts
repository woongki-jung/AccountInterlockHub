import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// 전 도메인이 주입해 쓰는 횡단 감사 서비스(FN-013). DataSource(TypeOrmModule) 는 앱 전역 제공된다.
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
