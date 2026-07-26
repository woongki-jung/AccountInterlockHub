import { DynamicModule, Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { InterlockConfigModule } from './config/interlock-config.module';
import { ConsentConfig, InterlockConfig } from './config/interlock-config.types';
import { DatabaseModule } from './database/database.module';
import { RecordsModule } from './records/records.module';
import { EntryModule } from './interlock-entry/entry.module';
import { ApproveModule } from './interlock-approve/approve.module';
import { VerifyModule } from './interlock-verify/verify.module';

export interface AppBootstrapConfig {
  config: InterlockConfig;
  consent: ConsentConfig;
}

/**
 * 애플리케이션 루트 모듈. 기동 시 검증된 연동 구성 상수를 받아 전역 등록한다(register()).
 * 관리자 모듈·관리자 인증·인증 미들웨어는 두지 않는다 — "통과시키는 인증 계층"도 두지 않는 것이 규칙이다(AUTH-001-01).
 * 사용자 진입(`EntryModule`, P07)이 먼저 붙었고 동의·승인 제출(`ApproveModule`, P09, #486)·
 * 본인확인 제출(`VerifyModule`, P08, #485)이 이어 붙었다 — 후속 Phase 가 서버 대면 API·배치
 * 모듈을 이 모듈의 imports 에 계속 추가한다.
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
        // PROC-101 연동 링크 진입(GET <INTERLOCK_ENTRY_PATH>, accountinterlockhub#484 P07).
        // 경로가 런타임 상수라 InterlockConfigModule 과 같은 결의 동적 모듈로 받는다.
        EntryModule.forRoot(bootstrapConfig.config.interlockEntryPath),
        // PROC-103·PROC-104 동의·승인 제출(POST <INTERLOCK_ENTRY_PATH>/approve,
        // accountinterlockhub#486 P09). 위와 같은 이유로 동적 모듈로 받는다.
        ApproveModule.forRoot(bootstrapConfig.config.interlockEntryPath),
        // PROC-102 본인확인 제출(POST <INTERLOCK_ENTRY_PATH>/verify, accountinterlockhub#485
        // P08). 위와 같은 이유로 동적 모듈로 받는다.
        VerifyModule.forRoot(bootstrapConfig.config.interlockEntryPath),
      ],
    };
  }
}
