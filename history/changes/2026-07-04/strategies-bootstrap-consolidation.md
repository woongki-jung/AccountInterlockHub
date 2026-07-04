# strategies-bootstrap-consolidation (2026-07-04)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) **전면 개정** — `etc/init/` 준비 가이드 6파일(01 PC 도구 · 02 워크스페이스 · 03 Redmine · 04 Slack · 05 통합 검증 · README)의 상세 내용을 흡수해 준비 절차 전체의 단일 출처로 확장(§1 PC 공통 환경 ~ §5 통합 검증·기동 + §다른 PC 재구성 + 준비 체크리스트 양식·문제 해결 포함).
	- `etc/init/` 6파일 **삭제** — 준비 절차 설명의 출처가 project-bootstrap.md 로 일원화되어 역할 소멸.
	- `CLAUDE.local.md`(git 비관리) — §준비 체크리스트 **신설**: 준비 항목의 수행 여부만 체크(PC 별). 항목 설명은 두지 않고 project-bootstrap.md 절 번호로 연결.
	- [`CLAUDE.md`](../../../CLAUDE.md) — §기본 지침 데이터 참조 예외의 `etc/init/` 예시 제거, §운용 전략 부트스트랩 항목을 "준비 절차 전체 + 진행 기록은 CLAUDE.local.md §준비 체크리스트"로 갱신, §워크스페이스 구성 준비를 재작성(준비 = project-bootstrap.md 절차·위임 가능 항목 명시, 부족 내역 도출 = §준비 체크리스트 미체크 항목, 안내 양식의 참조처를 etc/init → project-bootstrap.md 로 교체).
	- [`doc-structure.md`](../../../ai/strategies/doc-structure.md) — 루트 트리의 `etc/init/` 제거, §etc/ 의 준비 가이드 문장 제거.
- **왜**: 담당자 결정(2026-07-04) — 준비 절차 설명이 3층(etc/init 상세 → project-bootstrap.md 요약 → 개별 전략 상세)으로 중복되고, project-bootstrap.md 는 실참조 없는 요약 계층이었다. 절차 설명의 단일 출처를 에이전트 가독 문서(project-bootstrap.md)로 일원화하고, 진행 체크 기록은 CLAUDE.local.md(PC 별·git 비관리)로 분리해 "체크리스트는 수행 여부만, 설명은 bootstrap" 구조로 정리.
- **영향**:
	- 에이전트가 준비 절차 전체를 읽을 수 있게 되어, 담당자로부터 준비 항목(Redmine 프로젝트 생성·산출물 정리 등)을 위임받아 수행하거나 준비 상태를 진단할 수 있다.
	- 준비 미완료 안내의 부족 내역이 CLAUDE.local.md §준비 체크리스트의 미체크 항목에서 자동 도출된다(종전: 준비완료 값의 잔여 메모).
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) §기동 절차의 "상세 절차는 project-bootstrap.md §4" 참조가 실내용(Slack scope·이벤트 목록)을 갖게 되어 실효화. `etc/` 참조 금지 원칙은 변경 없음.
	- 준비 체크 상태는 git 에 남지 않는다 — 프로젝트 저장소의 준비 완료 기록은 §5 의 git 기준선 커밋이 담당.
- **관련 일감**: 없음 (담당자 직접 지시 세션).
