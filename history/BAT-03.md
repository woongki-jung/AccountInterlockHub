# IA: BAT-03 — 연동이력 저장

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-07 10:30 | spec | `process_PROC-403.md` 신설(연동이력 기록 — 내부 EVT·엔드포인트 없음, 생성 진입 FN-016(PROC-201 호출)·완료 기록 진입 FN-018(PROC-303 호출) 두 진입, INSERT PK 1건 보장·완료 기록 UPDATE 조건절 멱등 가드·처리상태 불변경 BIZ-004-06·요청 키값 소프트 참조 연결, PROC-401 종착 템플릿)·`spec-process.md` 카탈로그 PROC-403 행·SVC-004/009 매핑·ENT-007 C/U·의존관계 반영 | `accountinterlockhub#30` | 🚧 |
| 2026-07-07 09:30 | spec | `function_FN-016.md` 신설(연동이력 생성 — 진입 시 1건, PROC-201 내부 PROC-403 예약, 지정 파라미터 값 원문 추출·미지정 구성 null 미기록·값 누락 400 EX-BIZ-007, 항목 6종 상한 DATA-005)·완료 기록은 콜백 FN-018 이 담당(PROC-403 공유)·`spec-functions.md` 카탈로그 저장 흐름 행(연동이력 생성·완료 기록)·EX-BIZ-007 등재 | `accountinterlockhub#28` | 🚧 |
| 2026-07-07 08:27 | spec | `data_ENT-007.md` 신설(ENT-007 채번 — TBL_INTERLOCK_HISTORY: request_key PK·config_id FK·user_key varchar(512) 원문·requested_at·callback_received/at, DATA-005 상한 준수·개인정보 컬럼 없음)·`model_api.md` MDL-303(연동이력 도메인, COM) 신설·MDL-201 지정 값 유입 명시·목록 갱신(spec-datas.md·spec-models.md — 관계·인덱스·물리 설계). 보관 90일·원문 저장은 기본안(EXC-DATA-09/10, `#33` 대기) | `accountinterlockhub#27` | 🚧 |
| 2026-07-07 06:35 | spec | 연동이력 저장의 서비스 반영 — 생성 `service_SVC-004.md`(진입)·완료 기록 `service_SVC-009.md`(콜백)·삭제 `service_SVC-007.md`(배치)로 분산 매핑(BAT-01 선례, 별도 SVC 미신설)·MDL-303 후보 신설(항목 6종 상한, spec-services.md) | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 연동이력 정책 신설 — DATA-005(저장 최소항목·전달 파라미터 원문 무저장 상한 W6·키값 원문 저장 전제 `#33` 대기)·DATA-006(보관·삭제 90일, 기산점 W4)·BIZ-004-01/02(진입 시 기록 개시·지정 파라미터 값 누락 400 EX-BIZ-007)·EXC-DATA-07(무저장 원칙의 PRD 확정 예외) | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
