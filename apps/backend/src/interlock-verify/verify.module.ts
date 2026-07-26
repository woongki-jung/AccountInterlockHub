// PROC-102 본인확인 제출 모듈 — POST <INTERLOCK_ENTRY_PATH>/verify(accountinterlockhub#485, P08).
import { DynamicModule, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RecordsModule } from '../records/records.module';
import { ResultInfoBuilder } from '../interlock-entry/result-info.builder';
import { createVerifyController } from './verify.controller';
import { IdentityVerificationService } from './identity-verification.service';

/**
 * `entryPath` 는 기동 시 검증된 런타임 상수(`main.ts` → `AppModule.register()`)라 동적 모듈로
 * 받는다 — `EntryModule.forRoot()`·`ApproveModule.forRoot()` 와 같은 결이다.
 *
 * `ResultInfoBuilder`(PROC-105)는 `EntryModule` 도 이미 provider 로 두지만 그쪽이 `exports` 에
 * 넣지 않았다 — `ApproveModule` 과 같은 이유로 이 모듈이 독립적으로 다시 provider 로 둔다(상태를
 * 갖지 않는 순수 계산 클래스라 여러 인스턴스가 동시에 존재해도 안전하다 — approve.module.ts 문서
 * 주석 참고).
 */
@Module({})
export class VerifyModule {
  static forRoot(entryPath: string): DynamicModule {
    return {
      module: VerifyModule,
      imports: [DatabaseModule, RecordsModule],
      controllers: [createVerifyController(entryPath)],
      providers: [ResultInfoBuilder, IdentityVerificationService],
    };
  }
}
