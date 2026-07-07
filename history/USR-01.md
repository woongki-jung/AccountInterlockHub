# IA: USR-01 — 이용 동의

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-07 09:30 | spec | `function_FN-016.md` 신설(연동 요청 진입 처리 중 연동이력 생성 — PROC-201 내부 호출)·`spec-functions.md` 카탈로그 `/interlock/entry`(PROC-201) 행 주요 호출 FN 에 FN-016 추가 | `accountinterlockhub#28` | 🚧 |
| 2026-07-07 08:27 | spec | `model_user.md` MDL-201 개정 — 지정 구성의 지정 파라미터 값 필수·비공백 검증(BIZ-004-02) 명시, 지정 값의 연동이력(ENT-007.user_key) 원문 유입 주석(모델 자체는 무저장 전송 전용 유지) | `accountinterlockhub#27` | 🚧 |
| 2026-07-07 06:35 | spec | `service_SVC-004.md` 개정 — F-006 지정 파라미터 값 검증(400 EX-BIZ-007)·F-007 연동이력 1건 생성(진입 시, PROC-403 예약)·BR-203 신설·Happy Path 7단계 재편·관련 IA + BAT-03 | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 진입 시 연동이력 기록 개시 — BIZ-004-01(지정 구성 진입 시 이력 1건 생성: 키값·구성·요청 키값·요청 일시)·BIZ-004-02(지정 파라미터 값 누락·공백 시 진입 거부 400 EX-BIZ-007, 기본안) | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
| 2026-07-06 17:10 | spec ⓒ | (공통 반영) DB 표기 PostgreSQL 정합화 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 04:05 | spec | 동의 약관 상세/모달 반영 — BIZ-002-05·ENT-002.terms_content·FN-008·SCR-005([상세]+약관모달)·PROC-201·TC USR-01(_018~020)·목업 SCR-005 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec | BIZ-002·DATA-002·SVC-004·FN-007/008·SCR-005·PROC-201/202·TC USR-01 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec ⓒ | (공통 반영) 무저장·신뢰위임·공통 기능·디자인 시스템·시나리오 TC — common.md | `accountinterlockhub#24` | ℹ️ |
