# strategies-prd-to-spec-model-opus (2026-07-06)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- `ai/agents/workflow-prd-to-spec/prd-to-*` 7종 frontmatter — `model: sonnet` 을 `model: opus` 로 변경.
	- [`agents.md`](../../../ai/strategies/agents.md) §모델 정책 — 사양 작성 doer(`prd-to-*`)를 opus 그룹(판단·분석 역할)으로 이동하고 그룹 기준 서술을 조정(opus = 분석·판단 필요 역할, sonnet = 확정 사양 기반의 정형 작성·실행).
- **왜**: 담당자 지시(2026-07-06) — 사양 문서 작성은 PRD 분석·도메인 해석이 필요한 작업이므로 opus 가 적합하다는 판단(같은 날 도입한 모델 명시 지정 정책의 배치 조정).
- **영향**: prd-to-* 디스패치는 다음 실행부터 opus 로 기동된다. sonnet 유지 대상은 코드 작성·목업·검증 실행·빌드 4계열.
- **관련 일감**: 없음 (담당자 직접 지시 세션).
