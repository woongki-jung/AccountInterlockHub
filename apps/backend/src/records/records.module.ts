import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MetricCounterService } from './metric-counter.service';
import { TrackingRecordService } from './tracking-record.service';
import { TrackingRecordProcessService } from './tracking-record.process';
import { ConsentProofRecordService } from './consent-proof-record.service';

/**
 * FN-007~013 기록 계층 + PROC-301 kind 디스패처(TrackingRecordProcessService, P06 —
 * accountinterlockhub#483) 모듈. DatabaseModule 을 직접 import 해 DatabaseService 를 DI 로 받으므로,
 * AppModule 은 이 모듈만 imports 에 추가하면 된다(DatabaseModule 도 함께 등록해 두는 이유는
 * database.module.ts 자체의 안내 주석 — "런타임 조회·갱신이 필요한 첫 Phase 가 AppModule.imports
 * 에 배선한다" — 를 명시적으로 이행하기 위해서다). PROC-302·PROC-303 은 별도 디스패처가 없다 —
 * ConsentProofRecordService.recordConsentProof()·MetricCounterService.recordEvent() 가 각각 그
 * 전체 구현이다(tracking-record.process.ts 문서 주석 참고).
 */
@Module({
  imports: [DatabaseModule],
  providers: [MetricCounterService, TrackingRecordService, TrackingRecordProcessService, ConsentProofRecordService],
  exports: [MetricCounterService, TrackingRecordService, TrackingRecordProcessService, ConsentProofRecordService],
})
export class RecordsModule {}
