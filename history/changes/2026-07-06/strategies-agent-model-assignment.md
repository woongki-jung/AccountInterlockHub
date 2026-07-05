# strategies-agent-model-assignment (2026-07-06)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`agents.md`](../../../ai/strategies/agents.md) §모델 정책 — `model: inherit` 고정 정책을 **에이전트별 명시 지정**으로 전환: ai-pm = `fable`(fallback `opus`), 판단·평가 역할(단계 오케스트레이터 spec·build·qa, prd-reviewer·spec-reviewer·code-reviewer·test-planner) = `opus`, 작성·실행 역할(prd-to-* 7종, backend/frontend-developer, mockup-builder, tester, build-installer) = `sonnet`. 파일 형식 예시의 model 주석도 갱신.
	- [`ai/bots/ai-pm/ai-pm.md`](../../../ai/bots/ai-pm/ai-pm.md) frontmatter — `model: fable` 로 변경, `model fallback: opus` 추가.
	- `ai/agents/**` 에이전트 정의 19개 frontmatter — `model: inherit` 를 위 기준의 `opus`(7)·`sonnet`(12)으로 교체.
	- [`ai-pm-session.ps1`](../../../ai/scripts/ai-pm-session.ps1) — 봇 정의의 `model fallback:` 파싱 추가. 1차 모델 기동 불가(60초 내 비정상 종료) 시 fallback 모델로 즉시 재시도하고, `.restart` 재기동 시 1차 모델부터 다시 시도한다.
- **왜**: 담당자 지시(2026-07-06) — 모든 에이전트 정의에 모델 설정을 명시하고, 최상위 ai-pm 은 fable(불가 시 opus), 나머지는 에이전트 속성에 맞는 모델을 지정. 판단·평가는 정확도 우선(opus), 작성·실행은 opus 평가자의 리뷰·판정이 뒤따르므로 처리량·비용 효율 우선(sonnet)으로 배치.
- **영향**: 구동 중인 ai-pm 래퍼·세션은 기동 시 파싱한 값(opus)을 유지한다 — fable 적용은 래퍼 재기동(`.stop` 후 재실행)부터, 서브에이전트 모델은 각 디스패치 시점의 정의 파일 기준이라 즉시 반영된다.
- **관련 일감**: 없음 (담당자 직접 지시 세션).
