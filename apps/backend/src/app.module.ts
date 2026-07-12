import { join } from 'path';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AdminAuthModule } from './admin/auth/admin-auth.module';
import { ConfigModule as AdminConfigModule } from './admin/config/config.module';
import { ApiCommonModule } from './api/common/api-common.module';
import { StatusModule } from './api/status/status.module';
import { ApiInterlockModule } from './api/interlock/api-interlock.module';
import { AdminIpMiddleware } from './common/middleware/admin-ip.middleware';
import { AuditModule } from './common/audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { RetentionModule } from './batch/retention.module';
import { InterlockModule } from './user/interlock/interlock.module';
import { ConsentModule } from './user/consent/consent.module';

// 프런트엔드 정적 산출물 경로. 운영/로컬에서 배치가 다를 수 있어 환경변수로 재정의 가능하게 두고,
// 기본값은 컴파일 산출물(dist) 기준 apps/frontend/dist 로 해석한다.
const frontendDistPath =
  process.env.FRONTEND_DIST_PATH ?? join(__dirname, '..', '..', 'frontend', 'dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 보관정책 배치(BAT-02, PROC-402) 스케줄 등록. ScheduleModule 이 있어야 RetentionScheduler 의 @Cron 이
    // 활성화된다(일 1회 도래 시 runRetentionBatch 호출). CLI 온디맨드 러너는 본 등록 없이 실행한다.
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    RetentionModule,
    AdminAuthModule,
    AdminConfigModule,
    // 사용자 이용 동의 조회(PROC-201) — USR-01. GET /api/consent/:accessAddressId(FN-008 buildConsentView).
    ConsentModule,
    // 사용자 연동 실행(승인 게이팅 PROC-202 + 복호화·이력·전달·상태 PROC-203) — USR-01·USR-02.
    // POST /api/interlock/approve. ConsentModule(FN-008 게이팅)·HubDecryptModule(FN-020 복호화, 여기서
    // import 하지 않고 InterlockModule 내부에서 import 해 소비한다 — P5 로 실 소비자가 생겨 앱 레벨의
    // 자리표시자 import(구 HubDecryptModule 직접 등록)는 제거했다.
    InterlockModule,
    // 서비스 대면 API 공통 가드 인프라(FN-004 인증·FN-014 요청제한) — API-01/02/03 횡단(API-P1).
    // 가드·인증·카운터 provider 를 세워 앱 부팅을 성립시키고, 후속 P2~P4 모듈이 import 해 소비한다.
    ApiCommonModule,
    // 처리상태 확인 API(API-P2) — GET /api/status/:requestKey. PROC-301 / SVC-006 / API-01.
    // 서비스 A 자격으로 요청 키값의 처리·결과 확인 상태를 조회하고, 최초 조회 시 결과 확인을 멱등 갱신한다.
    StatusModule,
    // 연동 완료 확인 API(API-P3) — POST /api/interlock/completion. PROC-302 / SVC-008 / API-02.
    // 서비스 A 자격으로 {구성 식별자 + 사용자 키값} 스코프 최신 이력의 완료 콜백 수신 여부를 조회한다(읽기 전용).
    // FN-019(스코프 조회)는 후속 P4 콜백(API-03)과 공유하는 단일 소스로 본 모듈이 export 한다.
    ApiInterlockModule,
    // React 정적 서빙: API 경로(/api/**)만 제외해 컨트롤러가 처리하고, 그 외 경로(사용자 웹 SPA — 발송처
    // 링크 진입 `/interlock/entry/:accessAddressId`·결과 `/interlock/result` 포함, 관리자 웹 SPA)는
    // 정적 산출물(및 index.html 폴백)로 응답한다. `#214`(P5) 로 사용자 BE 엔드포인트가 전량 /api/** 로
    // 이동해 구 `/interlock/{*splat}` 제외(구 POST /interlock/entry BE 라우트 대응)가 불필요해졌다 — 남겨
    // 두면 SPA 라우트(/interlock/entry/:id·/interlock/result)가 index.html 폴백을 받지 못해 404 로
    // 응답한다(accountinterlockhub#229 P5 라우팅 갭 해소).
    ServeStaticModule.forRoot({
      rootPath: frontendDistPath,
      exclude: ['/api/{*splat}'],
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
