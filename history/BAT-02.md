# IA: BAT-02 — 보관정책 배치

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-08 09:38 | build | `batch/retention.service.ts`·`retention.scheduler.ts`·`retention.module.ts`·`retention.env.ts`·`retention.types.ts`·`run-retention-batch.ts` 신규(BAT-P1) — FN-011 runRetentionBatch(PROC-402): 처리상태(ENT-004 완료=result_confirmed_at·미완료=processed_at)·연동이력(ENT-007 수신=callback_received_at·미수신=requested_at) 네 갈래 청크 하드 삭제(`ctid IN (SELECT ctid ... LIMIT)`, 청크마다 autocommit 독립 커밋·조건절이 곧 멱등 가드, 부분 인덱스 IX_STATUS/HISTORY_RETENTION_*)·기동/종료/실패 BATCH_RUN 감사(FN-013, detail 건수만 SEC-005)·MDL-402 각각 집계(status/history 4필드) 반환·상태·이력 테이블 미저장. @nestjs/schedule @Cron 일 1회(RETENTION_CRON 기본 '0 3 * * *')·CLI 온디맨드 러너(npm run batch:retention, MDL-402 JSON stdout). env 훅 RETENTION_DAYS(90)/CHUNK_SIZE(5000)/NOW. `app.module.ts` ScheduleModule.forRoot()+RetentionModule 배선·`common/db/query-result.util.ts` affectedCount 추가·package.json @nestjs/schedule^6.1.3+batch:retention 스크립트. `npm run build` exit 0. 리뷰·기능검증 대기 | `accountinterlockhub#53` | 🚧 |
| 2026-07-07 11:15 | spec | `qa/BAT/tc_BAT-02.md` 증분 — 연동이력 삭제 확대 검증 TC 7건 추가(_011~017: 수신/미수신 삭제 BR-402·수신/미수신 90일 경계·연동이력 청크 멱등·MDL-402 신형상 각각 집계·삭제 후 완료 확인 404 정합 EXC-DATA-11)·검증 목적 연동이력 확대·BAT-02 10→17·`spec-qa.md` §4-1·§5-2(PROC-402 BR-402)·§5-4(DATA-006·OPS-003)·§6(BLK-14/16)·§3 시드 반영 | `accountinterlockhub#31` | 🚧 |
| 2026-07-07 10:30 | spec | `process_PROC-402.md` 개정 — 연동이력(ENT-007) 삭제 두 갈래 확대(수신=수신 일시·미수신=연동 요청 일시, BR-402, IX_HISTORY_RETENTION_RECEIVED/PENDING 청크 DELETE)·BE 의사코드 B1~B5 재편(처리상태·연동이력 각각 청크 커밋)·단계 통합 6단계·MDL-402 신형상(statusTargetCount/statusDeletedCount/historyTargetCount/historyDeletedCount) 정합·DATA-006 정책·ENT-007 참조 추가·`spec-process.md` 카탈로그 DATA-004/006/OPS-003 갱신·BR-402·삭제 후 PROC-302 404 정합 | `accountinterlockhub#30` | 🚧 |
| 2026-07-07 09:30 | spec | `function_FN-011.md` 개정 — 연동이력 삭제 두 갈래 확대(수신=수신 일시·미수신=연동 요청 일시, DATA-006, IX_HISTORY_RETENTION_RECEIVED/PENDING·BR-402)·의사코드 5단계 재편(처리상태·연동이력 각각 청크 DELETE)·MDL-402 각각 집계 정합(status/history 4필드)·연관 정책 DATA-006·참조 데이터 ENT-007 추가·`spec-functions.md` 카탈로그 배치 행(상태·연동이력 보관 삭제) 갱신 | `accountinterlockhub#28` | 🚧 |
| 2026-07-07 08:27 | spec | `data_ENT-007.md` 신설 — 보관 삭제 이원 기산 부분 인덱스 2종(IX_HISTORY_RETENTION_RECEIVED/PENDING, PROC-402)·청크 DELETE+autovacuum 0.05(ENT-004 동일 접근)·`model_api.md` MDL-402 개정(처리상태·연동이력 각각 집계)·spec-datas.md 물리 설계 절 ENT-007 정합 | `accountinterlockhub#27` | 🚧 |
| 2026-07-07 06:35 | spec | `service_SVC-007.md` 개정 — 연동이력 삭제 두 갈래 확대(F-006/007, DATA-006 기산 이원화)·BR-402 신설·Happy Path 7단계 재편·감사 각각 집계·OPS-003 앵커 정합·SVC-008 404 정합 | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 보관 배치 확대 — DATA-006 신설(연동이력 90일 삭제, 기산점 W4 확정: 콜백 수신 건=수신 일시·미수신 건=연동 요청 일시)·OPS-003 개정(적용 범위 처리상태+연동이력, 정책명 '보관 배치 실행') | `accountinterlockhub#25` | 🚧 |
| 2026-07-06 22:01 | spec ⓒ | (공통 반영) PostgreSQL 최적화 재정의 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 17:10 | spec ⓒ | (공통 반영) DB 표기 PostgreSQL 정합화 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 03:20 | spec | DATA-004·OPS-003·SVC-007·FN-011·PROC-402·TC BAT-02 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec ⓒ | (공통 반영) 무저장·신뢰위임·공통 기능·디자인 시스템·시나리오 TC — common.md | `accountinterlockhub#24` | ℹ️ |
