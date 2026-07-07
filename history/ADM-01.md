# IA: ADM-01 — 연동 구성 등록·편집

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-08 09:10 | spec | 사용자 키값 파라미터 지정 **필수화**(선택→exactly-one, 2026-07-08 담당자 지시) — `policy_BIZ.md` BIZ-001-07(정확히 1개·0개/2개↑ 422)·EXC-BIZ-09(필수 확정·BLK-13 해소)·BIZ-004-05('미지정' 방어적 잔존)·구현가이드·개요·`spec-policies.md` §Q5 정합 | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 11:15 | spec | `qa/ADM/tc_ADM-01.md` 증분 — 사용자 키값 파라미터 지정 검증 TC 5건 추가(_017~021: 지정 정상 저장·다중 지정 422·미실재 지정 422·미지정 허용·편집 지정 파라미터 삭제 시 지정 해제 동반, FN-006 step4 BIZ-001-07 서버 검증 기준)·ADM-01 16→21·`spec-qa.md` §4-1·§5-2(PROC-101 BIZ-001-07)·§5-4(BIZ-001)·§6(BLK-13)·§3 시드 반영 | `accountinterlockhub#31` | 🚧 |
| 2026-07-07 10:10 | spec | `screen_SCR-003.md` 개정 — 전달 파라미터 반복 행에 '사용자 키값' 단일 선택 라디오 UI 추가(선택 입력·구성당 최대 1개·미지정 허용·지정 행 삭제 시 자동 해제, BIZ-001-07·EXC-BIZ-09)·데이터 표시(isUserKey)·인터랙션(라디오 선택/해제, 클라이언트·PROC 없음)·입력 폼 검증(FN-006 step4 정합, 라디오 구조로 다중·미실재 지정 구조적 차단)·조건부 표시·구현 가이드 반영·`spec-screens.md`(데이터·마스킹 요약·담당자 확정 대기) 최소 갱신 | `accountinterlockhub#29` | 🚧 |
| 2026-07-07 09:30 | spec | `function_FN-006.md` 개정 — 사용자 키값 파라미터 지정 검증 추가(선택·전달 파라미터 중 실재 1개·구성당 최대 1개, BIZ-001-07, step 4)·EX-BIZ-001 조건 확장(다중 지정·미실재 지정)·지정 파라미터 값 누락 검증은 진입(FN-016 EX-BIZ-007)과 구별 명시·`spec-functions.md` 카탈로그(FN-006 연관정책·EX-BIZ-001 행) 정합 | `accountinterlockhub#28` | 🚧 |
| 2026-07-07 08:27 | spec | `data_ENT-001.md`·`data_ENT-003.md` 개정 — ENT-001.user_key_param_id 신설(ENT-003.id 참조 저장, NULL=미지정, 단일 컬럼으로 구성당 최대 1개 구조 보장, RESTRICT 로 지정 파라미터 삭제 차단)·`model_admin.md` MDL-101 중첩 Parameter.isUserKey 추가(true 최대 1개 검증)·목록(spec-datas.md·spec-models.md) 정합 | `accountinterlockhub#27` | 🚧 |
| 2026-07-07 06:35 | spec | `service_SVC-001.md` 개정 — F-006 사용자 키값 파라미터 지정(선택 입력)·검증 확장(실재·구성당 최대 1개, BIZ-001-07)·BR-107 신설·EX-BIZ-001 조건 확장·MDL-101 후보 항목 추가(spec-services.md) | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 사용자 키값 파라미터 지정 정책 — BIZ-001-07(선택 입력·전달 파라미터 중 실재 1개·구성당 최대 1개)·EXC-BIZ-09(E1 확정: 미지정 허용 기본안, 미지정 구성은 연동이력·API-02/03 대상 밖 — 근거: PRD 능력 서술·기존 구성 호환·무저장 기본값) | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
| 2026-07-06 22:01 | spec ⓒ | (공통 반영) PostgreSQL 최적화 재정의 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 17:10 | spec ⓒ | (공통 반영) DB 표기 PostgreSQL 정합화 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 04:05 | spec | 동의 약관 컨텐츠 반영 — BIZ-001-06·ENT-002.terms_content·MDL-101·FN-006·SCR-003(약관 textarea)·SCR-004(약관 열람)·PROC-101·TC ADM-01(_015~016)·목업 SCR-003/004 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec | `docs/specs/` spec 정의 — BIZ-001·SVC-001·ENT-001/002/003·FN-005/006·SCR-003·PROC-101·TC ADM-01(#25~31) | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec ⓒ | (공통 반영) 무저장·신뢰위임·공통 기능·디자인 시스템·시나리오 TC — common.md | `accountinterlockhub#24` | ℹ️ |
