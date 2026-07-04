# config-bootstrap-wiring (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`CLAUDE.md`](../../../CLAUDE.md) — §워크스페이스 운용 전략에 릴리스·배포·유지보수 전략(`delivery.md`)·프로젝트 부트스트랩 전략(`project-bootstrap.md`) 배선, ai-pm 항목에 질의·승인 릴레이 언급, 품질 검증 항목의 폐기 용어(sprint-build/sprint-qa)를 build·qa 단계로 정정, "프로젝트가 바뀌면 CLAUDE.env.md 만 교체" 서술을 부트스트랩 절차 참조로 교체.
	- [`CLAUDE.env.md`](../../../CLAUDE.env.md) — 삭제된 `task-master.md` 링크·웹훅 플러그인 언급 제거, `<REDMINE_HOME>` 에 PC 로컬 경로 주의 표기, `<REDMINE_PROJECT>` 의 "프로젝트 정의 단계" 용어를 프로젝트 부트스트랩으로 교체, 머리말의 프로젝트 교체 안내를 부트스트랩 절차 참조로 교체.
	- `.gitignore` — 작업 실행 임시 영역 `works/` 등재.
- **왜**: 표준 템플릿 관점 전수 분석(2026-07-03)에서 확인된 구 체계(task-master·스프린트) 잔재 제거와 신설 전략 배선.
- **영향**: 전략 문서 개정과 한 묶음 — 경위는 [`strategies-template-gap-remediation.md`](strategies-template-gap-remediation.md).
- **관련 일감**: 없음(담당자 직접 요청 세션).
