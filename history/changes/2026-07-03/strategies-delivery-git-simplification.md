# strategies-delivery-git-simplification (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`delivery.md`](../../../ai/strategies/delivery.md) — §git 운용 → **§저장소 운용**으로 축소: 작업 브랜치(`<단계>/<주제>`)·main 병합·PR 리뷰 매체·릴리스 태깅 규정 제거. **모든 작업은 main 단일 브랜치에서 수행**, 커밋은 "산출물+이력 같은 commit·승인된 단계 디스패치의 위임 범위"만 유지. §배포 실행을 **담당자 요청으로 시작(자동 트리거 없음)** 으로 명확화.
	- [`spec.md`](../../../ai/agents/spec.md)·[`build.md`](../../../ai/agents/build.md)·[`qa.md`](../../../ai/agents/qa.md) — 같은 날 감사 보완에서 배선한 "착수 시 작업 브랜치 확인·생성" 규칙 제거(build 의 케이스 확정·전달은 유지).
	- [`backend-developer.md`](../../../ai/agents/workflow-code-write/backend-developer.md)·[`frontend-developer.md`](../../../ai/agents/workflow-code-write/frontend-developer.md) — "커밋은 작업 브랜치에서만·main 병합/push 승인" 단서 제거(Phase 단위 커밋 규칙은 유지).
	- [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) §1 — "브랜치·커밋 정책은 §git 운용" 참조를 main 단일 브랜치 운용으로 교체.
	- [`CLAUDE.md`](../../../CLAUDE.md) §릴리스·배포·유지보수 전략 — 요약에서 git 운용(브랜치·리뷰 매체)·태깅 제거, "담당자 요청 기반 배포 실행·main 단일 브랜치" 반영.
- **왜**: 담당자 지시(2026-07-03) — 배포 단계가 git 제어(브랜치 흐름·병합·태깅)까지 관여하지 않도록 워크플로우 중심으로 단순화. 우선 main 브랜치에서 모든 동작을 수행하고, git flow 는 추후 별도 정리.
- **영향**: 같은 날 [`agents-workflow-audit-remediation.md`](agents-workflow-audit-remediation.md) 로 배선한 브랜치 책임·커밋 게이트 항목이 본 개정으로 대체됨. `§git 운용` 참조 잔재 grep 0건 확인.
- **관련 일감**: 없음(담당자 직접 요청 세션).
