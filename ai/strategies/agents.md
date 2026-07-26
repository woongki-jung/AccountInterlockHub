# 에이전트 정의·실행 전략

본 문서는 에이전트 파일 형식과 실행 규칙, 워크스페이스 디스패치 모델을 정의한다. 어떤 작업을 어느 에이전트로 실행할지 선택할 때 참조한다.

## 에이전트 파일 형식 (`ai/agents/*.md`)

YAML frontmatter 로 시작한다.

```yaml
---
name: agent-name
description: 한 줄 역할 설명
model: opus           # 사용 모델 명시 (§모델·추론 강도(effort) 정책)
effort: max           # 추론 강도 명시 (§모델·추론 강도(effort) 정책)
color: blue           # 표시 색(선택)
memory: project       # 프로젝트 메모리 자동 주입(선택)
---
```

- 본문은 역할·입력·절차·산출·예외를 담는다. 작성 규칙은 [`document-master-guide.md`](document-master-guide.md) 를 따른다.
- **워크스페이스 밖 경로를 참조하지 않는다.** `memory: project` 가 런타임에 경로를 주입한다.

## 모델·추론 강도(effort) 정책

에이전트마다 frontmatter `model:`(사용 모델)·`effort:`(추론 강도)를 **명시 지정**한다. 디스패치 주체는 서브에이전트 기동 시 이 **두 값을 그대로 적용**한다(세션 구성 상속 없음) — 담당자가 지정한 설정으로 실행하는 것이 원칙이다. `effort` 허용값은 `low`·`medium`·`high`·`xhigh`·`max`(CLI `--effort` 기준)다. 역할 속성에 따라 model·effort 를 함께 다음 기준으로 지정한다.

- **ai-pm (마스터)** — model `inherit` · effort `max`. 모델은 세션 구성(담당자가 `claude --model` 등으로 정한 값, 기본 모델 포함)을 따르고, 상위 모델(fable)을 쓸지는 담당자가 선택한다 — 쓸 수 없으면 `model fallback:` 의 `opus` 로 자동 전환한다(래퍼가 기동 실패 시 재시도, `--fallback-model` 으로 세션 도중 불가 시에도 전환). 추론 강도는 최상위 **`max`**(opus 역할과 동일 상한)로 기동하며(세션 래퍼가 `--effort max`), 복잡·비가역 작업에서 워크플로 오케스트레이션·다중 검증을 우선하는 운영 posture 는 [`ai-pm.md`](ai-pm.md) 가 정본이다.

서브에이전트는 아래 **4등급 사다리**로 배치한다. 등급을 가르는 축은 둘이다 — ① **오판의 되돌림 비용**(한 레그 이상을 되돌리면 상위 등급), ② **뒤를 받는 백스톱의 유무**(상위 등급 평가자·담당자가 산출을 판정하면 하위 등급 가능). 백스톱이 없는 역할은 강등하지 않는다.

| 등급 | 구성 | 성격 | 배치 |
|---|---|---|---|
| **T1 판정·게이트** | `opus` / `max` | 오판이 한 레그 이상을 되돌린다. 이 층이 아래 전부의 백스톱이므로 강등 대상이 아니다 | `product-loop` · `prd-reviewer` · `spec-reviewer` · `code-reviewer` |
| **T2 해석·설계** | `opus` / `xhigh` | 해석 여지가 있으나 T1 평가자가 뒤를 받는다. 단계 조율은 판정을 직접 내리지 않고 **evaluator doer 가 낸 판정을 라우팅**한다 | `spec` · `build` · `qa` 오케스트레이터 · `test-planner` · `prd-to-`{`policies`·`service`·`datas`·`functions`·`screens`} |
| **T3 전사·정형 사양** | `opus` / `high` | 선행 도메인이 의미 축을 이미 확정한 뒤의 전사. 전용 템플릿이 있고 커버리지는 `spec-reviewer` 매트릭스가 게이트한다 | `prd-to-process` · `prd-to-qa` |
| **T4 확정 입력 기반 실행** | `sonnet` / `xhigh` | 사양·계획 확정 후의 정형 산출·실행. opus 평가자 또는 담당자 눈검증이 뒤를 받는다 | `backend-developer` · `frontend-developer` · `mockup-builder` · `build-installer` · `tester` · `session-reporter` |

- **`tester` 는 강등하지 않는다** — 오탐 PASS 는 하류에서 아무도 잡지 못하는 유일한 실패 모드다(T4 중 유일하게 상위 평가자가 산출을 재판정하지 않는다).
- 새 에이전트는 위 두 축으로 등급을 정한다. 판단 기준이 모호하면 **한 등급 높게** 배치하고 아래 되돌림 기준으로 관측한다.

### 되돌림 기준 (관측 기반 복귀)

등급 하향은 잠정이며, 아래 신호가 나오면 **해당 에이전트만** 한 등급 되돌린다. 신호는 Redmine 정본에 남으므로 별도 계측이 필요 없다.

- **T3 → T2**: `spec-reviewer` 가 프로세스·검증 TC 도메인에서 `오류` 이상을 **2회 이상 반복 반환**할 때.
- **T2 → T1**: 같은 도메인의 교차검증 회귀가 **3회 소진(보류 전환)** 되는 사례가 반복될 때, 또는 오케스트레이터가 evaluator 판정을 잘못 라우팅해 레그가 되돌아갈 때.
- 되돌린 사실과 근거 일감 번호는 [`doc-revision.md`](doc-revision.md) 절차로 개정 이력에 남긴다.

## 실행 규칙

- **디스패치 주체 = ai-pm** — 제품 루프 작업(spec·build·qa)은 ai-pm 이 **제품 루프 오케스트레이터(`product-loop`) 1개를 디스패치**하고, 그 오케스트레이터가 단계 오케스트레이터를 하위 호출한다([`ai-pm.md`](ai-pm.md) §단계 연결·§디스패치 계약). directing 은 ai-pm 이 직접 수행한다.
- **단일 스레드 기본** — 명시적으로 지정되지 않으면 단일 스레드로 실행한다. 병렬은 결과 품질 저하 우려가 없을 때만 허용한다(정확도 우선).
- **책임 분리** — 한 단계 안에서 계획·실행·평가·정리, 작성·리뷰·검증의 책임을 서로 다른 실행 주체가 맡는다. 작성 주체가 자기 산출을 합격 판정·검증하지 않는다([`stages/build.md`](stages/build.md) §책임 분리).
- **입력 최소화** — 디스패치 주체는 doer 에 **그 doer 가 실제로 의존하는 입력만** 넘긴다. "전체 문서를 주고 알아서 고르게 하는" 방식은 금지다 — 정확도에 기여하지 않으면서 매 회 전량 재적재된다. 도메인별 필수 입력의 정본은 [`stages/spec.md`](stages/spec.md) §도메인 의존 순서의 입력 범위 규약이다. 범위 밖 자료는 **경로만** 알려 doer 가 필요할 때 직접 열게 한다.
- **증분 회귀** — 평가자 지적으로 작성 doer 를 회귀 호출할 때는 **지적된 절만 수정**하도록 지시한다. 문서·구현의 전면 재생성을 금지한다(회귀 1회가 최초 작성 1회와 같은 비용이 되는 것을 막는다). 회귀 호출에는 지적 항목·대상 절·직전 산출물 경로를 넘기고, 무엇을 고쳤는지 doer 가 절 단위로 회신한다.
- **반환 규약** — doer 는 **결론 요약 + 산출물 경로 + 후속 판단 필요 항목**만 반환한다. 산출 문서·코드 본문을 반환값에 싣지 않는다(오케스트레이터 컨텍스트가 doer 수에 비례해 부풀지 않게 한다). 오케스트레이터가 본문을 확인해야 하면 경로로 직접 읽는다.
- **Redmine 일감 반영** — 서브에이전트는 진행·산출물을 관련 Redmine 일감에 반영한다([`work-tracking.md`](work-tracking.md)).
- **검토 협의** — 모호하거나 비가역적 판단이 필요하면 가정하지 않고 담당 채널에 질의·응답을 참조해 진행한다([`prompt-conversation.md`](prompt-conversation.md) §검토 협의). 백그라운드 서브에이전트의 질의·승인은 ai-pm 릴레이로 처리한다([`ai-pm.md`](ai-pm.md) §질의·승인 릴레이).

## 디스패치 모델 (단계 ↔ 역할)

ai-pm 은 요청을 **directing / 제품 루프** 둘로 분기한다 — directing 은 ai-pm 직접, 제품 루프(spec·build·qa)는 **제품 루프 오케스트레이터(`product-loop`)** 1개를 디스패치하고 그 오케스트레이터가 아래 단계 오케스트레이터를 순서대로 하위 호출한다([`ai-pm.md`](ai-pm.md) §단계 연결). 역할의 상세 흐름은 각 stages 문서가 정본이다.

| 단계(레그) | 역할(서브에이전트) |
|---|---|
| (전체 흐름 제어) | 제품 루프 오케스트레이터 — [`product-loop`](../agents/product-loop.md) |
| spec | 요구사항 게이트 · 도메인별 사양 정의 · 교차검증 · 정리 · (마무리) 목업 — [`stages/spec.md`](stages/spec.md) |
| build | 계획 · 코드 작성 · 코드리뷰 · 기능검증 · 배포 산출물 · 정리 — [`stages/build.md`](stages/build.md) |
| qa | 환경 구성 · 검증 계획 · 검증 실행 · 결과 평가 — [`stages/qa.md`](stages/qa.md) |
| (업무 종결 보고) | 작업 보고 doer — [`session-reporter`](../agents/session-reporter.md) |

각 단계 오케스트레이터는 자기 레그를 마칠 때 **레그 report** 를 직접 등록하고, 업무 1건이 끝날 때의 **세션 report** 는 `session-reporter` 가 맡는다([`work-tracking.md`](work-tracking.md) §작업 보고).

## 등록 카탈로그

- **ai-pm**(`ai/bots/ai-pm/`) — 마스터 디스패처(봇). 정의·운영은 [`ai-pm.md`](ai-pm.md).
- **제품 루프 오케스트레이터**(`ai/agents/product-loop.md`) — ai-pm 이 제품 루프 작업으로 디스패치하는 상위 조율자. spec→build→qa 흐름을 하이브리드(체크포인트) 승인으로 제어하고 단계 오케스트레이터를 하위 호출한다([`base-workflow.md`](base-workflow.md) §단계 진행 모델).
- **단계 오케스트레이터**(`ai/agents/`) — 제품 루프 오케스트레이터가 하위 호출하는 조율자: `spec.md`·`build.md`·`qa.md`. 각자 stages 흐름을 doer 호출로 실행한다(directing 은 ai-pm 이 직접 수행 — 오케스트레이터 없음).
- **작업 보고 doer**(`ai/agents/session-reporter.md`) — ai-pm 이 작업세션 이슈 종결 직전 디스패치한다. Redmine 정본·git 이력에서 그 업무 1건의 경과를 재구성해 `report` 일감으로 등록한다([`work-tracking.md`](work-tracking.md) §작업 보고). 레그 단위 보고는 각 단계 오케스트레이터가 직접 남긴다.
- **doer**(`ai/agents/workflow-*/`) — 오케스트레이터가 호출하는 실행 단위:
	- spec: prd-reviewer · prd-to-{policies·service·datas·functions·screens·process·qa} · spec-reviewer · mockup-builder
	- build: backend-developer · frontend-developer · code-reviewer · build-installer (기능검증은 tester 공유)
	- qa: test-planner · tester
- 템플릿·하위 리소스(prd-to-process-logic-template·prd-to-datas-ent-template·prd-to-qa-tc-template·anti-patterns/react·report-template)는 독립 실행 단위가 아니므로 카탈로그에 올리지 않는다.
