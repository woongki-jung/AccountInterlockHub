# strategies-ai-pm-model-inherit (2026-07-07)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`ai/bots/ai-pm/ai-pm.md`](../../../ai/bots/ai-pm/ai-pm.md) — frontmatter `model: fable` → **`model: inherit`** (세션 구성을 따름). `model fallback: opus` 는 유지.
	- [`ai/scripts/ai-pm-session.ps1`](../../../ai/scripts/ai-pm-session.ps1) — claude 기동 인자에 `--fallback-model <fallback>` 추가. 기존 래퍼 폴백(기동 즉시 실패 시 재시도)에 더해, **세션 도중** 1차 모델 사용 불가(과부하·한도)에도 CLI 가 opus 로 자동 전환한다.
	- [`ai/strategies/agents.md`](../../../ai/strategies/agents.md) — §모델 정책의 ai-pm 항목을 `fable` 고정에서 `inherit`(세션 구성 선택) + opus 폴백으로 갱신.
- **왜**: fable 토큰 사용량 부담으로 상위 모델을 고정 지정하지 않고, ai-pm 세션 모델을 담당자 세션 구성에 맡기되 사용 불가 시 opus 로 자동 강등되도록 하라는 담당자 지시(2026-07-07). 판단 opus·작성 sonnet 의 에이전트별 지정([`strategies-agent-model-assignment.md`](../2026-07-06/strategies-agent-model-assignment.md))은 그대로 유지한다.
- **영향**: ai-pm 기동 시 `--model` 인자가 붙지 않으며(세션 기본 모델 사용), 래퍼 기동 로그의 모델 표기는 `(기본) (fallback: opus)` 형태가 된다. 상위 모델 사용 여부는 실행 장비의 claude 세션 구성이 결정한다.
- **관련 일감**: 없음 (담당자 직접 요청 세션).
