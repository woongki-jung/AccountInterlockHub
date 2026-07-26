// PROC-204 연동 규약 자가진단 API 모듈 — POST <SELFCHECK_PATH>(accountinterlockhub#489, P12).
import { DynamicModule, Module } from '@nestjs/common';
import { createSelfcheckController } from './selfcheck.controller';
import { ProtocolConformanceService } from './protocol-conformance.service';

/**
 * `selfcheckPath` 는 기동 시 검증된 런타임 상수(`main.ts` → `AppModule.register()`)라 동적
 * 모듈로 받는다 — `VerifyModule.forRoot()`·`ApproveModule.forRoot()` 와 같은 결이다.
 *
 * `DatabaseModule`·`RecordsModule` 을 **가져오지 않는다** — 자가진단은 어떤 저장소도 읽거나
 * 쓰지 않는다(`SEC-003-03` · `PROC-204` §연관 데이터 및 외부 호출 "데이터 조회 대상: 없음 ·
 * 데이터 변경 대상(CRUD): 없음").
 */
@Module({})
export class SelfcheckModule {
  static forRoot(selfcheckPath: string): DynamicModule {
    return {
      module: SelfcheckModule,
      controllers: [createSelfcheckController(selfcheckPath)],
      providers: [ProtocolConformanceService],
    };
  }
}
