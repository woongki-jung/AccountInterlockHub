// FN-007~013 기록 공통 기능 + PROC-301 kind 디스패처(process_PROC-301.md, P06 —
// accountinterlockhub#483) 배럴 익스포트. PROC-302·PROC-303 은 진입 계기가 하나뿐이라 별도
// 디스패처가 필요 없다 — ConsentProofRecordService.recordConsentProof()·
// MetricCounterService.recordEvent() 가 각각 그 전체 구현이다(tracking-record.process.ts 문서
// 주석 참고). PROC-102~104·201·203 등 상위 프로세스(후속 Phase)의 배선은 그 Phase 소관이며, 본
// 모듈은 그 배선이 그대로 가져다 쓸 단위(TrackingRecordProcessService.record() 포함)를 제공한다.
export * from './query-executor';
export * from './records.errors';
export * from './metric-date';
export * from './metric-event.types';
export * from './metric-counter.service';
export * from './tracking-record.types';
export * from './tracking-record.service';
export * from './tracking-record.process';
export * from './consent-proof-record.types';
export * from './consent-proof-record.service';
export * from './records.module';
