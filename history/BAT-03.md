# IA: BAT-03 — 연동이력 저장

> 본 IA 노드와 연관된 작업의 시계열 이력(최신순). 정책: ai/strategies/ia-history.md

| 일시 (KST) | 단계 | 산출물·결과 | 관련 일감 | 상태 |
|---|---|---|---|---|
| 2026-07-07 06:35 | spec | 연동이력 저장의 서비스 반영 — 생성 `service_SVC-004.md`(진입)·완료 기록 `service_SVC-009.md`(콜백)·삭제 `service_SVC-007.md`(배치)로 분산 매핑(BAT-01 선례, 별도 SVC 미신설)·MDL-303 후보 신설(항목 6종 상한, spec-services.md) | `accountinterlockhub#26` | 🚧 |
| 2026-07-07 06:20 | spec | 연동이력 정책 신설 — DATA-005(저장 최소항목·전달 파라미터 원문 무저장 상한 W6·키값 원문 저장 전제 `#33` 대기)·DATA-006(보관·삭제 90일, 기산점 W4)·BIZ-004-01/02(진입 시 기록 개시·지정 파라미터 값 누락 400 EX-BIZ-007)·EXC-DATA-07(무저장 원칙의 PRD 확정 예외) | `accountinterlockhub#25` | 🚧 |
| 2026-07-07 06:20 | spec ⓒ | (공통 반영) 키값 용어 정의(W3)·DATA-001-01 개정(연동이력 예외) — common.md | `accountinterlockhub#25` | ℹ️ |
