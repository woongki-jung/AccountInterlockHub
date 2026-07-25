import { DynamicModule, Module } from '@nestjs/common';
import { InterlockConfigModule } from './config/interlock-config.module';
import { ConsentConfig, InterlockConfig } from './config/interlock-config.types';
import { DatabaseModule } from './database/database.module';
import { RecordsModule } from './records/records.module';

export interface AppBootstrapConfig {
  config: InterlockConfig;
  consent: ConsentConfig;
}

/**
 * 애플리케이션 루트 모듈. 기동 시 검증된 연동 구성 상수를 받아 전역 등록한다(register()).
 * 관리자 모듈·관리자 인증·인증 미들웨어는 두지 않는다 — "통과시키는 인증 계층"도 두지 않는 것이 규칙이다(AUTH-001-01).
 * 후속 Phase 가 사용자 진입·서버 대면 API·배치 모듈을 이 모듈의 imports 에 추가한다.
 */
@Module({})
export class AppModule {
  static register(bootstrapConfig: AppBootstrapConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InterlockConfigModule.forRoot(bootstrapConfig.config, bootstrapConfig.consent),
        DatabaseModule,
        RecordsModule,
      ],
    };
  }
}
