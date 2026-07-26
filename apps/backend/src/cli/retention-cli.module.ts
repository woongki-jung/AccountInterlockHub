import { DynamicModule, Module } from '@nestjs/common';
import { InterlockConfigModule } from '../config/interlock-config.module';
import { ConsentConfig, InterlockConfig } from '../config/interlock-config.types';
import { DatabaseModule } from '../database/database.module';
import { RetentionModule } from '../retention/retention.module';

export interface RetentionCliBootstrapConfig {
  config: InterlockConfig;
  consent: ConsentConfig;
}

/**
 * 보관 배치 CLI(`cli/retention.ts`, PROC-304 C2) 전용 최소 애플리케이션 컨텍스트 루트 모듈.
 * `AppModule`(app.module.ts)과 달리 HTTP 컨트롤러 모듈(EntryModule·ApproveModule·VerifyModule·
 * ServerApiModule)과 전역 예외 필터 모듈(CommonModule)을 배선하지 않는다 — 보관 배치는 그
 * 표면과 무관하고(§실행 규약 4 "HTTP 관리 경로를 만들지 않는다"), `NestFactory.
 * createApplicationContext()` 는 HTTP 서버를 열지 않으므로 그 모듈들을 등록해도 실질적으로
 * 아무것도 서빙하지 않지만, 배치 전용 진입에 불필요한 표면·의존성을 끌어들이지 않기 위해
 * 처음부터 최소 구성으로 둔다. `RetentionScheduleModule`(스케줄 배선)도 가져오지 않는다 —
 * 1회 실행 후 종료하는 컨텍스트에 스케줄러가 필요 없다(retention/retention-schedule.module.ts
 * 문서 주석 참고).
 *
 * `AppModule.register()` 와 같은 결의 동적 모듈 패턴이다 — `main.ts` 가 `loadInterlockConfig()`
 * 로 이미 검증을 마친 값을 그대로 주입받는다(이 모듈 자신은 검증을 수행하지 않는다).
 */
@Module({})
export class RetentionCliModule {
  static register(bootstrapConfig: RetentionCliBootstrapConfig): DynamicModule {
    return {
      module: RetentionCliModule,
      imports: [
        InterlockConfigModule.forRoot(bootstrapConfig.config, bootstrapConfig.consent),
        DatabaseModule,
        RetentionModule,
      ],
    };
  }
}
