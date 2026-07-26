// PROC-101 연동 링크 진입 접점 모듈 — GET <INTERLOCK_ENTRY_PATH>(accountinterlockhub#484, P07).
import { DynamicModule, Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { createEntryController } from './entry.controller';
import { ResultInfoBuilder } from './result-info.builder';

/**
 * `interlockEntryPath` 는 기동 시 검증된 런타임 상수(`main.ts` → `AppModule.register()`)라
 * 동적 모듈로 받는다 — `config/interlock-config.module.ts` `InterlockConfigModule.forRoot()` 와
 * 같은 결이다. `RecordsModule` 을 imports 해 `MetricCounterService`(FN-013·PROC-303)를 DI 로
 * 받는다(`InterlockConfigService` 는 `@Global()` 모듈이라 별도 import 없이 주입된다).
 */
@Module({})
export class EntryModule {
  static forRoot(entryPath: string): DynamicModule {
    return {
      module: EntryModule,
      imports: [RecordsModule],
      controllers: [createEntryController(entryPath)],
      providers: [ResultInfoBuilder],
    };
  }
}
