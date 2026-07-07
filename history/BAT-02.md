# IA: BAT-02 — 보관정책 배치

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-07 10:30 | spec | `process_PROC-402.md` 개정 — 연동이력(ENT-007) 삭제 두 갈래 확대(수신=수신 일시·미수신=연동 요청 일시, BR-402, IX_HISTORY_RETENTION_RECEIVED/PENDING 청크 DELETE)·BE 의사코드 B1~B5 재편(처리상태·연동이력 각각 청크 커밋)·단계 통합 6단계·MDL-402 신형상(statusTargetCount/statusDeletedCount/historyTargetCount/historyDeletedCount) 정합·DATA-006 정책·ENT-007 참조 추가·`spec-process.md` 카탈로그 DATA-004/006/OPS-003 갱신·BR-402·삭제 후 PROC-302 404 정합 | `accountinterlockhub#30` | 🚧 |
| 2026-07-07 09:30 | spec | `function_FN-011.md` 개정 — 연동이력 삭제 두 갈래 확대(수신=수신 일시·미수신=연동 요청 일시, DATA-006, IX_HISTORY_RETENTION_RECEIVED/PENDING·BR-402)·의사코드 5단계 재편(처리상태·연동이력 각각 청크 DELETE)·MDL-402 각각 집계 정합(status/history 4필드)·연관 정책 DATA-006·참조 데이터 ENT-007 추가·`spec-functions.md` 카탈로그 배치 행(상태·연동이력 보관 삭제) 갱신 | `accountinterlockhub#28` | 🚧 |
| 2026-07-07 08:27 | spec | `data_ENT-007.md` 신설 — 보관 삭제 이원 기산 부분 인덱스 2종(IX_HISTORY_RETENTION_RECEIVED/PENDING, PROC-402)·청크 DELETE+autovacuum 0.05(ENT-004 동일 접근)·`model_api.md` MDL-402 개정(처리상태·연동이력 각각 집계)·spec-datas.md 물리 설계 절 ENT-007 정합 | `accountinterlockhub#27` | 🚧 |
| 2026-07-07 06:35 | spec | `service_SVC-007.md` 개정 — 연동이력 삭제 두 갈래 확대(F-006/007, DATA-006 기산 이원화)·BR-402 신설·Happy Path 7단계 재편·감사 각각 집계·OPS-003 앵커 정합·SVC-008 404 정합 | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 보관 배치 확대 — DATA-006 신설(연동이력 90일 삭제, 기산점 W4 확정: 콜백 수신 건=수신 일시·미수신 건=연동 요청 일시)·OPS-003 개정(적용 범위 처리상태+연동이력, 정책명 '보관 배치 실행') | `accountinterlockhub#25` | 🚧 |
| 2026-07-06 22:01 | spec ⓒ | (공통 반영) PostgreSQL 최적화 재정의 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 17:10 | spec ⓒ | (공통 반영) DB 표기 PostgreSQL 정합화 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 03:20 | spec | DATA-004·OPS-003·SVC-007·FN-011·PROC-402·TC BAT-02 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec ⓒ | (공통 반영) 무저장·신뢰위임·공통 기능·디자인 시스템·시나리오 TC — common.md | `accountinterlockhub#24` | ℹ️ |
