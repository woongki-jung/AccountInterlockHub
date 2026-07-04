# strategies-git-flow-adoption (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`git-flow.md`](../../../ai/strategies/git-flow.md) **신설** — 브랜치·커밋·병합(MR) 운용 규칙의 단일 출처: 단계 착수(디스패치) 1회 = 브랜치(`<단계>/<이슈번호>-<주제>`, 운영 작업은 `docs/`·`chore/`), Phase·작업 항목 = commit(산출물+이력 같은 commit, 양식 `<단계>: <요약>` + `관련 일감:`), 담당자 승인 = main 병합(no-ff, `Merge: <요약> (<브랜치명>)`, 승인 접수 주체가 수행·오케스트레이터 자기 병합 금지, 병합 후 브랜치 삭제). main = 승인 통과 기준선. 릴리스 태그 `v<버전>` 정의.
	- [`delivery.md`](../../../ai/strategies/delivery.md) — §저장소 운용의 "main 단일 브랜치" 규정을 git-flow.md 참조로 교체, §버전·릴리스에 릴리스 태그 step 추가.
	- [`spec.md`](../../../ai/agents/spec.md)·[`build.md`](../../../ai/agents/build.md)·[`qa.md`](../../../ai/agents/qa.md) — 착수 시 단계 브랜치 확인·생성(재디스패치는 기존 브랜치 재사용), 정리에 "main 병합은 승인 접수 주체의 몫 — 자기 병합 금지" 배선.
	- [`backend-developer.md`](../../../ai/agents/workflow-code-write/backend-developer.md)·[`frontend-developer.md`](../../../ai/agents/workflow-code-write/frontend-developer.md) — 표기 원칙의 커밋 규칙을 1 Phase = 1 commit + git-flow.md §커밋 양식 참조로 갱신.
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) — §질의·승인 릴레이에 단계 완료 승인 시 main 병합 수행, §단계 연결에 git-flow 준수·directing 브랜치 생성 주체 배선.
	- [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) §1·[`CLAUDE.md`](../../../CLAUDE.md) — 단일 브랜치 문구를 git-flow.md 참조로 교체, 전략 목록에 git flow 항목 추가.
- **왜**: 담당자 지시(2026-07-03) — git flow 를 워크플로우에 통합: sprint 레벨(단계 착수)은 브랜치 분기, Phase 레벨은 commit 분기로 하고, 브랜치명·커밋 메시지·MR 전략을 워크플로우에 맞춰 정의. 같은 날 [`strategies-delivery-git-simplification.md`](strategies-delivery-git-simplification.md) 의 "git flow 추후 정리" 를 본 개정이 이행.
- **영향**: main 단일 브랜치 운용(같은 날 도입)이 "main = 승인 통과 기준선 + 작업 브랜치" 모델로 대체됨. 단계 승인 게이트가 main 병합 게이트를 겸한다 — 별도 승인 절차 신설 없음. 기존 병합 관행(`Merge: <제목> (<브랜치명>)` no-ff)을 정책으로 승격.
- **관련 일감**: 없음(담당자 직접 요청 세션).
