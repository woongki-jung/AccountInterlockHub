# config-etc-init-guide (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- `etc/init/` **신설**(사람 참고 전용 — 운영 문서 아님): 새 프로젝트 준비 체크리스트·가이드 6파일 — `README.md`(사용법·순서) / `01-pc.md`(PC 설치 요소) / `02-workspace.md`(저장소·루트 설정·산출물 정리) / `03-redmine.md`(인스턴스 구축·트래커 구성·MCP 등록·프로젝트 생성) / `04-slack.md`(워크스페이스·ai-pm 앱 scope/이벤트·토큰·config 기입) / `05-verify.md`(통합 검증·기동).
	- [`CLAUDE.md`](../../../CLAUDE.md) — §기본 지침 데이터 참조 예외의 `etc/` 예시에 `etc/init/` 추가.
	- [`doc-structure.md`](../../../ai/strategies/doc-structure.md) — 루트 트리에 `etc/init/` 등재, §etc/ 에 "준비 가이드는 사람 전용·에이전트 측 정본은 project-bootstrap.md" 문장 추가.
- **왜**: 담당자 요청(2026-07-03) — 워크플로우 실행 전 사전 구성 요소(Redmine 프로젝트 생성·Slack 구성·PC 설치·git 구성 등)의 체크리스트·가이드를 새 프로젝트 준비에 활용. 준비 단계는 워크플로우 진행 간 참조 자료가 아니므로 위치는 `preset/` 안(초안)이 아닌 **`etc/`(사람 참고 전용)** 로 확정.
- **영향**: 에이전트 측 준비 절차 정본은 종전대로 [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) — 전략 문서는 `etc/init/` 를 참조·링크하지 않는다(참조 금지 원칙 유지). 가이드 파일의 정합 유지는 사람 몫이며 정본과 어긋나면 정본 우선.
- **관련 일감**: 없음(담당자 직접 요청 세션).
