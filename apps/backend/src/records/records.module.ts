import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MetricCounterService } from './metric-counter.service';
import { TrackingRecordService } from './tracking-record.service';
import { ConsentProofRecordService } from './consent-proof-record.service';

/**
 * FN-007~013 기록 계층 모듈(function_FN-007-008.md·function_FN-009-011.md·
 * function_FN-012-013.md). DatabaseModule 을 직접 import 해 DatabaseService 를 DI 로 받으므로,
 * AppModule 은 이 모듈만 imports 에 추가하면 된다(DatabaseModule 도 함께 등록해 두는 이유는
 * database.module.ts 자체의 안내 주석 — "런타임 조회·갱신이 필요한 첫 Phase 가 AppModule.imports
 * 에 배선한다" — 를 명시적으로 이행하기 위해서다).
 */
@Module({
  imports: [DatabaseModule],
  providers: [MetricCounterService, TrackingRecordService, ConsentProofRecordService],
  exports: [MetricCounterService, TrackingRecordService, ConsentProofRecordService],
})
export class RecordsModule {}
