# IA: 공통 — 횡단 사양 이력

> 본 문서는 특정 IA 노드에 매이지 않는 횡단(공통) 사양의 시계열 이력(최신순)이다. 영향받는 IA 노드는 영향 IA 열에 나열하고, 각 노드 파일에는 `spec ⓒ` 역링크 entry(ℹ️)를 둔다. 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 영향 IA | 관련 일감 | 상태 |
|---|---|---|---|---|---|
| 2026-07-06 16:56 | directing | DB 요구사항 MSSQL → PostgreSQL 전환(담당자 지시) — `docs/prd/PRD.md` §시스템 제약사항·`devspec/database.md`·`devspec/infra.md`·`CLAUDE.env.md` 갱신. `docs/specs/`(datas·process·qa)의 MSSQL 기준 표기는 spec 재정렬 대상(#24 노트) | ADM-01, ADM-02, ADM-03, USR-01, USR-02, API-01, BAT-01, BAT-02 | `accountinterlockhub#24` | ✅ |
| 2026-07-06 03:20 | spec | `docs/specs/` 횡단 사양 — DATA-001 무저장·SEC-002 신뢰위임·FN-013/014/015 감사·요청제한·응답엔벨로프·design-system.md·qa SCEN 시나리오 TC(#25·#28·#29·#31) | ADM-01, ADM-02, ADM-03, USR-01, USR-02, API-01, BAT-01, BAT-02 | `accountinterlockhub#24` | 🚧 |
