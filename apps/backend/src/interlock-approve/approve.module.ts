// PROC-103·PROC-104 동의·승인 제출 + 연동 실행(복호화·전달) 모듈 — POST
// <INTERLOCK_ENTRY_PATH>/approve(accountinterlockhub#486, P09).
import { DynamicModule, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RecordsModule } from '../records/records.module';
import { ResultInfoBuilder } from '../interlock-entry/result-info.builder';
import { createApproveController } from './approve.controller';
import { ConsentApprovalService } from './consent-approval.service';
import { InterlockDeliveryService } from './interlock-delivery.service';

/**
 * `entryPath` 는 기동 시 검증된 런타임 상수(`main.ts` → `AppModule.register()`)라 동적 모듈로
 * 받는다 — `EntryModule.forRoot()`·`InterlockConfigModule.forRoot()` 와 같은 결이다.
 *
 * `ResultInfoBuilder`(PROC-105)는 `EntryModule` 도 이미 provider 로 두지만 그쪽이 `exports` 에
 * 넣지 않았고, `EntryModule.forRoot()` 를 여기서 다시 부르면 `createEntryController()` 가 매
 * 호출마다 새 컨트롤러 클래스를 만들어 `GET <INTERLOCK_ENTRY_PATH>` 라우트가 중복 등록된다 —
 * 그래서 `EntryModule` 을 import 하지 않고 이 모듈이 `ResultInfoBuilder` 를 독립적으로 다시
 * provider 로 둔다. 상태를 갖지 않는 클래스(입력마다 순수 계산만 수행하고, 유일한 의존성인
 * `InterlockConfigService` 는 어차피 전역 싱글턴)라 두 인스턴스가 동시에 존재해도 안전하다.
 */
@Module({})
export class ApproveModule {
  static forRoot(entryPath: string): DynamicModule {
    return {
      module: ApproveModule,
      imports: [DatabaseModule, RecordsModule],
      controllers: [createApproveController(entryPath)],
      providers: [ResultInfoBuilder, InterlockDeliveryService, ConsentApprovalService],
    };
  }
}
