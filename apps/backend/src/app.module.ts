import { DynamicModule, Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
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
 * `CommonModule`(P05) 은 FN-014/015 전역 예외 필터(`APP_FILTER`)를 등록한다 — 캐시 금지 헤더·
 * 405 판정 미들웨어는 순서 제약 때문에 이 모듈이 아니라 main.ts 가 app.use() 로 직접 배선한다.
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
        CommonModule,
      ],
    };
  }
}
