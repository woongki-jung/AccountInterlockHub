# IA: API-02 — 연동 완료 확인 API

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-07 10:30 | spec | `process_PROC-302.md` 신설(연동 완료 확인 API — POST /api/interlock/completion, FN-004/014/005 진입 가드·SEC-003-03 서비스 A 주체 분리·FN-017 위임 판정(내부 FN-019/010/013)·읽기 전용 무갱신·BR-302 완료/미완료 둘 다 200·404 EX-BIZ-005 단일화)·`spec-process.md` 카탈로그 PROC-302 행·SVC-008 매핑·정책(SEC-003/004/005·OPS-001·BIZ-004·DATA-006)/FN/CRUD(ENT-007 R)/의존/BR-302/EX-BIZ-005 반영 | `accountinterlockhub#30` | 🚧 |
| 2026-07-07 09:30 | spec | `function_FN-017.md` 신설(연동 완료 확인 판정 — PROC-302 예약, 읽기 전용, 완료/미완료 둘 다 200·BR-302, 404 EX-BIZ-005 단일화·SEC-005-03 응답 3항목)·`function_FN-019.md` 신설(스코프 조회·구성 지정 검증 — 완료 판정·콜백 특정 단일 소스, leaf)·`spec-functions.md` 카탈로그 API-02 엔드포인트(POST /api/interlock/completion) 행·EX-BIZ-005 등재·의존관계·POL 매핑(BIZ-004·SEC-005·DATA-006) 반영 | `accountinterlockhub#28` | 🚧 |
| 2026-07-07 08:27 | spec | `data_ENT-007.md` 신설(연동이력 — 완료 판정 근거)·`model_api.md` MDL-303(연동이력 도메인)·MDL-304(완료 확인 응답 — 판정 항목 3개만, SEC-005-03) 신설 — 판정 조회는 IX_HISTORY_SCOPE(config_id·user_key·requested_at DESC, PROC-302 예약) 지원·목록 갱신(spec-datas.md·spec-models.md) | `accountinterlockhub#27` | 🚧 |
| 2026-07-07 06:35 | spec | `service_SVC-008.md` 신설 — 연동 완료 확인 API(PROC-302 예약): 조회 스코프 필수 조건·읽기 전용 판정·BR-302(수신/미수신)·404 단일화(구성 미존재·미지정·이력 없음, EX-BIZ-005)·응답 최소 항목(SEC-005-03)·구성 식별자는 진입 계약과 동일 값 사용 확정 | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 완료 판정 정책 신설 — BIZ-004-04(E2 확정: {연동 구성 식별자+사용자 키값} 복합 스코프·최신 건 판정, 사용자 키값 단독은 판정 대상 비유일)·BIZ-004-05(미지정 구성 404)·SEC-003(인증 확장)·SEC-005-03(응답 최소 항목)·OPS-001(요청 제한)·EX-BIZ-005 채번 | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
