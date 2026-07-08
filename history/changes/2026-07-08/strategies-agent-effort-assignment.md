# strategies-agent-effort-assignment (2026-07-08)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`CLAUDE.md`](../../../CLAUDE.md) §기본 지침 — `모델 활용 규칙` → **`모델·추론 강도 활용 규칙`** 으로 갱신: 서브에이전트 실행 시 `model`·`effort` 를 지정값 그대로 적용(opus=effort `max`·sonnet=effort `xhigh`)한다고 명시하고 agents.md 정책을 참조.
	- [`agents.md`](../../../ai/strategies/agents.md) §모델 정책 → **§모델·추론 강도(effort) 정책** 개명·확장 — 각 에이전트 frontmatter 에 `effort:`(추론 강도)를 `model:` 과 함께 명시하고, 디스패치 주체가 두 값을 **지정값 그대로 적용**하도록 규정. 기준: 판단·분석 역할(opus) = effort `max`, 정형 작성·실행 역할(sonnet) = effort `xhigh`, ai-pm(마스터) = effort `max`. 파일 형식 예시에 `effort:` 필드 추가.
	- `ai/agents/**` 에이전트 정의 19개 frontmatter — `model:` 다음에 `effort:` 추가: opus 14개 → `max`, sonnet 5개 → `xhigh`. 템플릿 5개(비-에이전트, model 라인 없음)는 제외.
	- [`ai/bots/ai-pm/ai-pm.md`](../../../ai/bots/ai-pm/ai-pm.md) — frontmatter `effort: max` 추가. 페르소나에 **운영 강도** 항목, 디스패치 항목에 서브에이전트 `model`·`effort` 지정값 적용 문구 추가.
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) — §운영 모델에 ai-pm 세션 최상위 강도(`max`) 항목 추가, §디스패치 계약 1 에 서브에이전트 `model`·`effort` 지정값 적용 문구 추가.
	- [`ai-pm-session.ps1`](../../../ai/scripts/ai-pm-session.ps1) — 봇 정의 `effort:` 파싱 추가. 허용값(low/medium/high/xhigh/max)만 `--effort` 로 부여하고 그 외 값은 무시(세션 기본). 세션 기동 시 `--effort` 부여 및 기동 로그에 effort 표기.
- **왜**: 담당자 지시(2026-07-08) — 모델에 이어 추론 강도(effort)도 에이전트 구성에 명시: opus=`max`, sonnet=`xhigh` 를 기본값으로, 최상위 ai-pm 은 `max`(초기 `ultracode` 로 지정했으나 CLI `--effort` 미구성 항목이라 담당자 지시로 `max` 로 정정). 하위 에이전트 호출 시 모두 지정 설정으로 실행되게 함이 목적.
- **영향**: 서브에이전트 effort 는 각 디스패치 시점의 정의 파일 기준이라, 재기동해 개정 지침을 다시 읽은 ai-pm 세션부터 적용된다(지침 재적용 = `.restart`). ai-pm 자기 세션의 `max`(→ `--effort max`)는 래퍼가 기동 시 1회 파싱하므로 **래퍼 재기동**(`.stop` 후 재실행)부터 적용된다. 운영 posture(워크플로 오케스트레이션·교차검증 우선)는 지침이 정본이다.
- **관련 일감**: 없음 (담당자 직접 지시 세션).
