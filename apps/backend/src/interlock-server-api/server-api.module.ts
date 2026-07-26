// PROC-201·202·203 서버 대면 API 모듈(API-01·API-02·API-03) — 리터럴 경로 3종이라 동적 모듈
// (forRoot)이 필요 없다(entry.module.ts·verify.module.ts·approve.module.ts 와 달리
// `<INTERLOCK_ENTRY_PATH>` 같은 런타임 상수를 받지 않는다).
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RecordsModule } from '../records/records.module';
import { ServerApiController } from './server-api.controller';
import { InterlockStatusService } from './interlock-status.service';
import { InterlockCompletionService } from './interlock-completion.service';
import { InterlockCallbackService } from './interlock-callback.service';

@Module({
  imports: [DatabaseModule, RecordsModule],
  controllers: [ServerApiController],
  providers: [InterlockStatusService, InterlockCompletionService, InterlockCallbackService],
})
export class ServerApiModule {}
