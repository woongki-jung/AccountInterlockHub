# IA: 공통 — 횡단 사양 이력

> 본 문서는 특정 IA 노드에 매이지 않는 횡단(공통) 사양의 시계열 이력(최신순)이다. 영향받는 IA 노드는 영향 IA 열에 나열하고, 각 노드 파일에는 `spec ⓒ` 역링크 entry(ℹ️)를 둔다. 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 영향 IA | 관련 일감 | 상태 |
|---|---|---|---|---|---|
| 2026-07-06 22:01 | spec | `docs/specs/datas/` PostgreSQL 물리 설계 spec 확정(build 이관 반려 재반영) — UUID v4 PK 유지(uuidv7 미채택)·ENT-004 시간 파티셔닝 미채택(전역 유니크 강제 불가·이원 삭제 기준)→청크 DELETE 5,000행+autovacuum scale_factor 0.05·fillfactor 기본 유지(HOT 불가)·ENT-006 힙 순서 의존 서술 제거(ORDER BY 논리 보장, 보존 삭제 시 BRIN/월별 파티셔닝 방향 확정)·spec-datas.md §PostgreSQL 물리 설계·운영 전제 신설(INCLUDE·BRIN 미채택 근거 포함). 의미 층위(컬럼·제약·정책) 불변. 후속 도메인 반영(FN-011·013, PROC-402, qa TC)도 본 entry 가 포괄 | ADM-01, ADM-02, API-01, BAT-01, BAT-02 | `accountinterlockhub#24` | ✅ |
| 2026-07-06 17:10 | spec | `docs/specs/`(datas·functions·processes·qa) MSSQL→PostgreSQL 표기 정합화 — 타입(uuid·varchar·text·timestamptz·boolean·bigint)·기본값(gen_random_uuid()·now()·GENERATED ALWAYS AS IDENTITY)·부분 인덱스(partial)·boolean 비교(true/false)·트랜잭션(BEGIN)·DATEADD→INTERVAL 등 36개 파일 정합. 사양 의미 불변(#24 노트 이행) | ADM-01, ADM-02, ADM-03, USR-01, USR-02, API-01, BAT-01, BAT-02 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 16:56 | directing | DB 요구사항 MSSQL → PostgreSQL 전환(담당자 지시) — `docs/prd/PRD.md` §시스템 제약사항·`devspec/database.md`·`devspec/infra.md`·`CLAUDE.env.md` 갱신. `docs/specs/`(datas·process·qa)의 MSSQL 기준 표기는 spec 재정렬 대상(#24 노트) | ADM-01, ADM-02, ADM-03, USR-01, USR-02, API-01, BAT-01, BAT-02 | `accountinterlockhub#24` | ✅ |
| 2026-07-06 03:20 | spec | `docs/specs/` 횡단 사양 — DATA-001 무저장·SEC-002 신뢰위임·FN-013/014/015 감사·요청제한·응답엔벨로프·design-system.md·qa SCEN 시나리오 TC(#25·#28·#29·#31) | ADM-01, ADM-02, ADM-03, USR-01, USR-02, API-01, BAT-01, BAT-02 | `accountinterlockhub#24` | 🚧 |
