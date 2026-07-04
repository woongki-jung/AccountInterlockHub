# strategies-tc-execution-environment (2026-07-04)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`ai/strategies/qa-execution/tools-setup.md`](../../../ai/strategies/qa-execution/tools-setup.md) **신설** — TC 실행 환경 구축(검증 도구 MCP) 절차의 정본: UI 종류별 담당 MCP 매핑(playwright-mcp / pywinauto-mcp / CDP attach), 데스크톱 네이티브 백엔드(`uia`/`win32`) 선택 기준, 설치·MCP 등록(project 스코프)·연결 검증 체크리스트·식별자 수집·문제 해결.
	- [`ai/strategies/project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) — §6 TC 실행 환경 신설(시점 = directing 프로그램 구성표 확정 후 ~ 첫 기능검증·qa 착수 전, 주체·완료 기준 정의, 절차는 tools-setup.md 위임). 준비 체크리스트 양식·절차 요약 표에 §6 항목 추가, 준비완료 판정을 §1~§5 기준으로 명시(§6 은 지연 항목), §다른 PC 재구성에 §6 재수행 항목 추가.
	- [`ai/strategies/qa-execution.md`](../../../ai/strategies/qa-execution.md) — §공통 원칙에 "실동작 재현" 신설(케이스별 지정 도구로 실제 프로그램 조작·관측, 코드 정독만은 🟣 Pass-Static 한정, 도구 미구축 TC 는 🟠 Block + 환경 보완 요청), §케이스 카탈로그에 tools-setup.md 정본 참조 추가.
	- [`ai/strategies/qa-execution/web-ui.md`](../../../ai/strategies/qa-execution/web-ui.md)·[`desktop-ui.md`](../../../ai/strategies/qa-execution/desktop-ui.md) — §검증 도구·절차에 지정 도구 명시(web: playwright-mcp + 하이브리드 CDP attach / desktop: pywinauto-mcp 등 + `uia`/`win32` 선택), 도구 미연결 TC 의 🟠 Block 처리, 프로젝트별 채움 항목에 식별자 수집 결과 연결.
	- [`ai/agents/workflow-qa/tester.md`](../../../ai/agents/workflow-qa/tester.md) — §2 실행 환경 확인에 지정 검증 도구(MCP) 가용성 확인을 추가(미구축·미연결 시 🟠 Block + tools-setup.md 보완을 호출자에 요청).
	- [`CLAUDE.env.md`](../../../CLAUDE.env.md) — 신규 플레이스홀더 `<QA_TOOLS_HOME>`(검증 도구 MCP 설치 루트, PC 로컬) 추가.
	- [`CLAUDE.md`](../../../CLAUDE.md) — 프로젝트 부트스트랩 전략 요약의 준비 항목 나열에 "TC 실행 환경(검증 도구)" 추가.
- **왜**: 실무 QA 운영 경험의 TC 실행환경 구축 가이드(`etc/workflow-guide/` — 사람 참고용)를 워크플로우에 편입하기 위함. 두 방향의 공백을 해소 — ① 워크스페이스 구성 체크리스트에 TC 실행 환경 설치 항목이 없어 qa 착수 시점에 도구 부재가 드러나던 문제, ② 케이스 하위 지침이 "구체 도구는 프로젝트별로 채운다"로만 되어 있어 지정 도구 기반 실동작 재현이 강제되지 않던 문제.
- **영향**: 검증 도구 구축 절차의 단일 출처가 tools-setup.md 로 생기고, 부트스트랩(§6 지연 항목) ↔ qa-execution(공통 원칙·케이스) ↔ tester(가용성 확인·Block 처리) 가 같은 절차를 참조한다. 준비완료 플래그 판정은 §1~§5 로 유지되어 기존 부트스트랩 흐름에 영향 없음. 이 PC 의 `CLAUDE.local.md` 체크리스트에도 §6 항목을 추가했다(git 비관리 — 다른 PC 는 재구성 시 양식 복사로 반영). 참고 원본: `etc/workflow-guide/tc환경구축.md`(에이전트 참조 제외 폴더 — 지침 반영분이 실행 정본).
- **관련 일감**: 없음 (Redmine 미구축 상태).
