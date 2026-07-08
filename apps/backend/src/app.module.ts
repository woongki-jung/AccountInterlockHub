import { join } from 'path';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AdminAuthModule } from './admin/auth/admin-auth.module';
import { AdminIpMiddleware } from './common/middleware/admin-ip.middleware';
import { AuditModule } from './common/audit/audit.module';
import { DatabaseModule } from './database/database.module';

// 프런트엔드 정적 산출물 경로. 운영/로컬에서 배치가 다를 수 있어 환경변수로 재정의 가능하게 두고,
// 기본값은 컴파일 산출물(dist) 기준 apps/frontend/dist 로 해석한다.
const frontendDistPath =
  process.env.FRONTEND_DIST_PATH ?? join(__dirname, '..', '..', 'frontend', 'dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    AdminAuthModule,
    // React 정적 서빙: API 경로(/api/**)와 서비스 A 진입(/interlock/**)은 제외해 컨트롤러가 처리하고,
    // 그 외 경로(사용자 웹·관리자 웹 SPA)는 정적 산출물(및 index.html 폴백)로 응답한다.
    ServeStaticModule.forRoot({
      rootPath: frontendDistPath,
      exclude: ['/api/{*splat}', '/interlock/{*splat}'],
    }),
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 관리자 경로(SPA /admin/**, API /api/admin/**)에 IP 접근 제한(PROC-104·FN-001·SEC-001)을 선적용한다.
    // 허용목록(ADMIN_IP_ALLOWLIST 운영 구성값) 밖 출발지는 403 EX-SEC-001 로 차단(ADM-P1, refs #38).
    consumer.apply(AdminIpMiddleware).forRoutes('admin', 'api/admin');
  }
}
