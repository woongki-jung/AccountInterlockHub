# IA: BAT-01 — 처리상태 저장

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-11 20:30 | spec | `function_FN-009.md` 개정(처리상태 저장 — saveStatus 키 requestKey→trackingKey·내부 surrogate uuid PK·성공/실패 1건 EXC-BIZ-06·복호화 성공 후 SVC-005 저장·저장 항목 4+구성 참조·개인식별 배제 DATA-003-04) | `accountinterlockhub#219`·`#214` | 🚧 |
| 2026-07-11 20:30 | spec ⓒ | (공통 반영) #214 기능·API 사양 개정 — FN-020 허브 복호화 신규·추적 키 단독 추적·무저장·에러 체계 — common.md | `accountinterlockhub#219`·`#214` | ℹ️ |
| 2026-07-11 19:30 | spec | `data_ENT-004.md` 처리상태 저장(연동 추적 키 기준·복호화 성공 후 전달 결과 1건 생성·상태 4항목+생성일시·개인식별/복호화 원문 원천 배제 DATA-003-04)·`model_api.md` MDL-301 정합 | `accountinterlockhub#218`·`#214` | 🚧 |
| 2026-07-11 19:30 | spec ⓒ | (공통 반영) #214 데이터 사양 개정 — 무저장 강화·비영속 컨텍스트·연동 추적 키·surrogate PK·보관 fallback·ENT-003 폐기 — common.md | `accountinterlockhub#218`·`#214` | ℹ️ |
| 2026-07-11 18:30 | spec | `service_SVC-005.md` 개정 — 처리상태 저장을 **연동 추적 키 기준**으로 전환(요청 키값 폐기). 복호화 성공 후 전달 결과를 처리상태 4항목에 1건 저장(DATA-003-05·PROC-401), 복호화 이전 거부·복호화 실패는 추적 키 없어 미저장(감사만·EXC-DATA-03) | `accountinterlockhub#217`·`#214` | 🚧 |
| 2026-07-11 18:30 | spec ⓒ | (공통 반영) #214 서비스 목록문서 개정 — spec-services.md 사용자 정의 4역할·시나리오·의존관계·BR/EX/MDL/POL 카탈로그 — common.md | `accountinterlockhub#217`·`#214` | ℹ️ |
| 2026-07-11 16:20 | spec ⓒ | (공통 반영) #214 암호화 연동 정책 개정 — DATA-003 처리상태 저장 키를 요청키값 UUID→연동 추적 키로 전환(4항목 유지)·EXC-DATA-06 운영컬럼 허용 — common.md | `accountinterlockhub#216`·`#214` | ℹ️ |
| 2026-07-09 03:20 | qa | BAT-01 독립 검증 9 TC 전수(v0.1.0/688fec2, 실 DB psql+서비스A status API HMAC) → 🟢8·🟣1·🔵0·🔴0·🟠0. 실측: 성공/거부/전달실패 처리상태 각 1건(is_success=true/false/false·unconfirmed·rca NULL·processed_at·created_at 자동)(001~003)·ENT-004 컬럼 7개(request_key·config_id·is_success·is_result_confirmed·processed_at·result_confirmed_at·created_at) 회원키/개인식별 부재(004)·CK_STATUS_CONFIRM_CONSISTENCY (false,NULL)OK·(true,NULL)거부·UPDATE(true,now)OK(005)·PK_PROCESS_STATUS 동일 request_key 2회째 unique_violation(006)·결과확인 최초갱신 false→true·rca=now(status API 경유·DB 반영)(007)·재확인 무갱신 멱등 rca 불변(008). 정적🟣: INSERT/UPDATE 오류 EX-FN-999 전파(process-status.service:32·전역필터 500, 006 PK위반 실 DB 실측 보강)(009). 오류일감 0. evidence works/accountinterlockhub-54/evidence/UQA/ | `accountinterlockhub#54` (검증 #140~#148) | ✅ |
| 2026-07-08 10:15 | build | `user/status/process-status.service.ts` 신규(USR-P2) — FN-009 saveStatus(PROC-401): ENT-004 처리상태 1건 INSERT(request_key·config_id·is_success·is_result_confirmed=false·processed_at·result_confirmed_at=null). 개인식별 컬럼 원천 배제(요청키·구성참조·상태 4항목만)·PK 중복 방지·CHECK 정합(미확인⇒확인일시 NULL)·파라미터 바인딩. 거부·전달 성공·실패 모두 1건. 결과확인 갱신은 API Phase 소관(본 Phase 저장만). `npm run build` 0건. 3책임 통과(리뷰 PASS·tester 처리상태 1건 저장·개인식별 컬럼 부재·무저장 경계 🟢) | `accountinterlockhub#46` | ✅ |
| 2026-07-07 06:20 | spec | 처리상태·연동이력 이중 추적 관계(W5) — BIZ-004-06(완료 콜백은 처리상태 4항목 불변경)·DATA-005-04(연동이력이 요청 키값 참조로 처리상태 건과 연결, 요청 1건당 이력 최대 1건) | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
| 2026-07-06 22:01 | spec ⓒ | (공통 반영) PostgreSQL 최적화 재정의 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 17:10 | spec ⓒ | (공통 반영) DB 표기 PostgreSQL 정합화 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 03:20 | spec | DATA-003·ENT-004·SVC-005·FN-009·PROC-401·TC BAT-01 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec ⓒ | (공통 반영) 무저장·신뢰위임·공통 기능·디자인 시스템·시나리오 TC — common.md | `accountinterlockhub#24` | ℹ️ |
