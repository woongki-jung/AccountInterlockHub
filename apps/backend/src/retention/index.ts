// PROC-304 보관정책 배치(process_PROC-304.md, P13 — accountinterlockhub#490) 배럴 익스포트.
// 스케줄(C1)·CLI(C2, cli/retention.ts) 두 진입 경로가 여기서 export 하는 RetentionService 하나만
// 공유한다(BR-015). AppModule 은 RetentionScheduleModule 을, CLI 는 RetentionModule 만 가져온다.
export * from './retention.types';
export * from './retention-datetime';
export * from './retention-output';
export * from './retention.service';
export * from './retention.module';
export * from './retention-scheduler.service';
export * from './retention-schedule.module';
