# 에이전트 정의·실행 전략

본 문서는 에이전트 파일 형식과 실행 규칙, 워크스페이스 디스패치 모델을 정의한다. 어떤 작업을 어느 에이전트로 실행할지 선택할 때 참조한다.

## 에이전트 파일 형식 (`ai/agents/*.md`)

YAML frontmatter 로 시작한다.

```yaml
---
name: agent-name
description: 한 줄 역할 설명
model: opus           # 사용 모델 명시 (§모델 정책)
color: blue           # 표시 색(선택)
memory: project       # 프로젝트 메모리 자동 주입(선택)
---
```

- 본문은 역할·입력·절차·산출·예외를 담는다. 작성 규칙은 [`document-master-guide.md`](document-master-guide.md) 를 따른다.
- **워크스페이스 밖 경로를 참조하지 않는다.** `memory: project` 가 런타임에 경로를 주입한다.

## 모델 정책

에이전트마다 frontmatter `model:` 에 사용할 모델을 **명시 지정**한다. 디스패치 주체는 서브에이전트 기동 시 이 값을 그대로 적용한다(세션 구성 상속 없음). 역할 속성에 따라 다음 기준으로 지정한다.

- **ai-pm (마스터)** — `fable`. 기동 환경에서 fable 을 쓸 수 없으면 `model fallback:` 에 지정된 `opus` 로 기동한다(세션 래퍼가 1차 모델 기동 실패 시 자동 전환).
- **판단·분석 역할 — `opus`**: 단계 오케스트레이터(`spec`·`build`·`qa`), 평가·판정 doer(`prd-reviewer`·`spec-reviewer`·`code-reviewer`·`test-planner`), 사양 작성 doer(`prd-to-*`). 단계 조율·합격 판정·검증 계획과 PRD 분석·도메인 해석이 필요한 사양 작성은 정확도가 우선이다.
- **정형 작성·실행 역할 — `sonnet`**: 코드 작성(`backend-developer`·`frontend-developer`)·목업(`mockup-builder`)·검증 실행(`tester`)·빌드(`build-installer`). 사양·계획이 확정된 뒤의 정형 산출이고 opus 평가자가 리뷰·판정하므로(§실행 규칙 책임 분리) 처리량·비용 효율을 우선한다.

새 에이전트를 추가할 때도 같은 기준으로 지정한다 — 분석·판단이 필요한 역할 = `opus`, 확정 사양 기반의 정형 작성·실행 = `sonnet`.

## 실행 규칙

- **디스패치 주체 = ai-pm** — 단계 작업(spec·build·qa)은 ai-pm 이 작업 맥락(요청 채널·범위·관련 일감)을 전달해 서브에이전트로 기동한다([`ai-pm.md`](ai-pm.md) §디스패치 계약). directing 은 ai-pm 이 직접 수행한다.
- **단일 스레드 기본** — 명시적으로 지정되지 않으면 단일 스레드로 실행한다. 병렬은 결과 품질 저하 우려가 없을 때만 허용한다(정확도 우선).
- **책임 분리** — 한 단계 안에서 계획·실행·평가·정리, 작성·리뷰·검증의 책임을 서로 다른 실행 주체가 맡는다. 작성 주체가 자기 산출을 합격 판정·검증하지 않는다([`stages/build.md`](stages/build.md) §책임 분리).
- **Redmine 일감 반영** — 서브에이전트는 진행·산출물을 관련 Redmine 일감에 반영한다([`work-tracking.md`](work-tracking.md)).
- **검토 협의** — 모호하거나 비가역적 판단이 필요하면 가정하지 않고 담당 채널에 질의·응답을 참조해 진행한다([`prompt-conversation.md`](prompt-conversation.md) §검토 협의). 백그라운드 서브에이전트의 질의·승인은 ai-pm 릴레이로 처리한다([`ai-pm.md`](ai-pm.md) §질의·승인 릴레이).

## 디스패치 모델 (단계 ↔ 역할)

ai-pm 이 단계별로 다음 역할의 서브에이전트를 디스패치한다. 역할의 상세 흐름은 각 stages 문서가 정본이다.

| 단계 | 역할(서브에이전트) |
|---|---|
| spec | 요구사항 게이트 · 도메인별 사양 정의 · 교차검증 · 정리 · (마무리) 목업 — [`stages/spec.md`](stages/spec.md) |
| build | 계획 · 코드 작성 · 코드리뷰 · 기능검증 · 배포 산출물 · 정리 — [`stages/build.md`](stages/build.md) |
| qa | 환경 구성 · 검증 계획 · 검증 실행 · 결과 평가 — [`stages/qa.md`](stages/qa.md) |

## 등록 카탈로그

- **ai-pm**(`ai/bots/ai-pm/`) — 마스터 디스패처(봇). 정의·운영은 [`ai-pm.md`](ai-pm.md).
- **단계 오케스트레이터**(`ai/agents/`) — ai-pm 이 디스패치하는 2계층 조율자: `spec.md`·`build.md`·`qa.md`. 각자 stages 흐름을 doer 호출로 실행한다(directing 은 ai-pm 이 직접 수행 — 오케스트레이터 없음).
- **doer**(`ai/agents/workflow-*/`) — 오케스트레이터가 호출하는 실행 단위:
	- spec: prd-reviewer · prd-to-{policies·service·datas·functions·screens·process·qa} · spec-reviewer · mockup-builder
	- build: backend-developer · frontend-developer · code-reviewer · build-installer (기능검증은 tester 공유)
	- qa: test-planner · tester
- 템플릿·하위 리소스(prd-to-process-logic-template·prd-to-datas-ent-template·prd-to-qa-tc-template·anti-patterns/react·report-template)는 독립 실행 단위가 아니므로 카탈로그에 올리지 않는다.
