# IA: API-01 — 처리상태 확인 API

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-08 08:28 | build | 처리상태 확인 API(API-P2) — GET /api/status/:requestKey. StatusController(가드 소비·UUID v4 형식 검증)·StatusService(findByKey 404·결과확인 멱등 갱신·MDL-302 4항목 변환)·StatusModule 신설, app.module 등록. npm run build 0 에러. 3책임 통과(리뷰 PASS·tester 실 HTTP+실 DB round-trip 🟢: 정상조회 5필드(configId 배제)·최초조회 멱등 갱신(DB 반영)·재조회 무갱신·미존재 404 EX-DATA-003·형식오류 400 EX-DATA-002(v1 거부)·주체분리 401) | `accountinterlockhub#50` | ✅ |
| 2026-07-07 06:20 | spec | 이중 추적 의미 경계(W5) — BIZ-004-06(API-01 "처리 성공 여부"=허브의 서비스 B 전달 성공 vs API-02 "처리완료"=콜백 수신, 콜백은 처리상태 4항목 불변경)·SEC-003/OPS-001 적용 범위 확장 표기 정합 | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
| 2026-07-06 22:01 | spec ⓒ | (공통 반영) PostgreSQL 최적화 재정의 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 17:10 | spec ⓒ | (공통 반영) DB 표기 PostgreSQL 정합화 — common.md | `accountinterlockhub#24` | ℹ️ |
| 2026-07-06 03:20 | spec | SEC-003·DATA-002/003·SVC-006·FN-004/009·PROC-301·TC API-01 | `accountinterlockhub#24` | 🚧 |
| 2026-07-06 03:20 | spec ⓒ | (공통 반영) 무저장·신뢰위임·공통 기능·디자인 시스템·시나리오 TC — common.md | `accountinterlockhub#24` | ℹ️ |
