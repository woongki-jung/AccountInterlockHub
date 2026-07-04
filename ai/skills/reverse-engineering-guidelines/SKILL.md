---
name: reverse-engineering-guidelines
description: AI 에이전트 기반 소프트웨어 역공학 가이드라인. 레거시 코드를 분석하여 구현 독립적 명세를 생성할 때 발생하는 공통 실수를 방지하는 행동 규칙. Agentless(UIUC 2024), DocAgent(Meta ACL 2025), CodexGraph(2024), LLMCompiler(ICML 2024), Anthropic Context Engineering(2025), User Story Recovery(2025) 기반.
license: MIT
---

# Reverse Engineering Guidelines

AI 에이전트가 레거시 코드를 역공학할 때 발생하는 공통 실수를 방지하는 행동 규칙.

**핵심 전제**: LLM은 컨텍스트와 자율성이 무분별하게 주어질수록 성능이 저하된다. 범위를 좁히고, 역할을 분리하고, 즉시 검증하고, 필요한 것만 로드하는 것이 성공의 조건이다.

---

## 1. 전체부터 보고 나서 부분으로 들어가라

**계층적 좁히기. 처음부터 전체 코드를 읽지 마라.**

- 파일 트리 → 의심 파일 선택 → 해당 파일의 시그니처(skeleton) → 핵심 구현 순서로 점진적으로 좁힌다.
- 전체 코드를 먼저 로드하고 나중에 분류하는 방식은 금지한다.
- 수정/분석할 위치가 전체 코드베이스의 일부임을 항상 인식한다.

**근거**: Agentless(arxiv:2407.01489). 저장소에 수백 개의 파일이 있어도 실제 관련 위치는 수 개의 함수에 불과하다. Skeleton 형식은 "수천 줄 파일을 한 번에 처리하는 것을 실용적/비용적으로 불가능하게 하는 문제를 해결한다." 전수 조사 후 필터링 방식 대비 비용 3~5배 절감, 정확도 유지.

---

## 2. 의존성이 없는 것부터 먼저 분석하라

**위상 정렬 순서. 하위 컴포넌트가 먼저 문서화되어야 상위가 정확해진다.**

- 분석 시작 전 모듈 간 의존 관계를 파악한다.
- 의존성이 없는 하위 컴포넌트(라이브러리, 유틸리티)를 먼저 분석하고, 이를 참조하는 상위 컴포넌트를 나중에 분석한다.
- 아직 분석되지 않은 컴포넌트를 참조해야 하는 상황을 만들지 않는다.

**근거**: DocAgent(Meta, ACL 2025). "위상 정렬 순서는 특정 컴포넌트를 문서화할 때 그것의 모든 의존성이 이미 기술된 상태임을 보장한다." Ablation: 무작위 순서 vs 위상 정렬 순서에서 사실 정확도(Truthfulness) 86.75% → 94.64%로 향상.

---

## 3. 추론과 생성을 같은 에이전트에 맡기지 마라

**역할 분리. 사실 추출과 문서 작성은 별개다.**

- "무엇이 있는가"를 추출하는 작업과 "어떻게 기술할 것인가"를 결정하는 작업을 분리한다.
- 한 에이전트가 코드 분석, 분류 판단, 문서 작성을 동시에 수행하면 모든 부분의 품질이 떨어진다.
- 추출 에이전트는 판단 없이 관찰한 사실만 기록한다. 분류/작성 에이전트가 해석과 변환을 담당한다.

**근거**: CodexGraph(arxiv:2408.03910). "역할 분리는 주요 LLM이 고수준 추론에 집중하면서 구문적으로 올바른 쿼리를 보장한다." Translation agent 제거 시 성능이 27.90% → 8.30%로 급락(70% 저하). 단일 에이전트에 인지 부하를 분산하면 양쪽 모두에서 품질이 저하된다.

---

## 4. 독립적인 분석은 병렬로 실행하라

**DAG 기반 병렬화. 의존성이 없는 작업을 순차 실행하는 것은 낭비다.**

- 분석 작업의 의존 관계를 먼저 파악한다.
- 서로 독립적인 작업(외부 API 분석, DB 스키마 분석, 인프라 분석 등)은 동시에 실행한다.
- 이전 단계의 결과가 필요한 작업만 순차 실행한다.
- 불필요한 의존성을 만들어 병목을 생성하지 않는다.

**근거**: LLMCompiler(ICML 2024). "순차적 추론은 각 함수 호출마다 높은 지연(latency)과 비용을 유발한다." DAG 기반 병렬화로 ReAct 대비 속도 3.7배, 비용 6.7배 절감, 정확도 9% 향상.

---

## 5. 필요할 때만, 필요한 것만 로드하라

**Just-In-Time 컨텍스트. 모든 관련 파일을 미리 로드하지 마라.**

- 진입점 파일을 먼저 읽고, 추적하면서 필요한 파일을 그때그때 읽는다.
- 컨텍스트에는 현재 분석 작업에 직접 필요한 정보만 넣는다.
- 중간 결과는 컨텍스트에 계속 유지하지 말고 파일로 저장하고, 필요할 때 참조한다.
- 서브에이전트는 수만 토큰을 탐색하되 1,000~2,000 토큰의 요약만 반환한다.

**근거**: Anthropic Context Engineering(2025). "컨텍스트 창의 토큰 수가 증가할수록 모델의 정보 회상 능력이 저하된다(Context Rot)." 트랜스포머는 n² attention 계산을 수행하므로 10만 토큰은 100억 개의 관계를 처리한다. "불필요한 모든 단어, 중복된 설명, 오래된 데이터는 에이전트 성능을 저하시킨다." Opus 4 + Sonnet 서브에이전트 구조가 단일 Opus 4보다 90.2% 우수.

---

## 6. 예시는 하나로 충분하다

**1-shot. 과도한 예시는 패턴 고착을 유발한다.**

- 분석 예시를 제공할 때 완성도 높은 예시 1개로 충분하다.
- 여러 예시를 제공하면 모델이 예시 패턴에 과적합하여 새로운 코드 구조를 유연하게 해석하지 못한다.
- Chain-of-Thought(CoT)는 대형 모델에서만 소폭 유효하고, 소형 모델에서는 효과가 없다.

**근거**: User Story Recovery(arxiv:2509.19587, 2025). 1,750개 C++ 스니펫, 5개 최신 LLM, 6가지 프롬프팅 전략 실험. "단 하나의 예시로 8B 모델이 70B 모델과 동등한 성능을 낸다." Few-shot은 1-shot 대비 1% 향상에 불과하며, 모델이 예시 패턴 모방에 집중하게 만든다.

---

## 7. 200줄 이상의 코드는 분할하여 분석하라

**단위 분할. 긴 코드는 중간 부분이 무시된다.**

- 한 번에 분석할 코드 단위를 200줄 이하로 유지한다.
- 긴 파일은 기능 단위로 분할하여 각각 분석한다.
- "Lost in the Middle" 현상을 인식한다: 긴 프롬프트의 중간에 위치한 정보는 모델의 attention을 덜 받는다.

**근거**: User Story Recovery(arxiv:2509.19587). 코드가 200줄을 초과할 때 F1 점진적 저하 발생. 원인은 긴 입력에서 중간 위치 토큰이 무시되는 "Lost in the Middle" 효과.

---

## 8. 생성한 내용은 즉시 검증하라

**즉각 피드백 루프. 검증 없는 생성은 환각 생성과 같다.**

- 문서나 명세를 생성한 직후 자동 검증을 실행한다.
- 검증 실패 시 전체를 재생성하지 말고 해당 항목만 재작성한다.
- 배치 검증(모두 생성 후 한 번에 검증)보다 단위 검증(생성 즉시 검증)이 효과적이다.
- `[확인필요]` 항목을 명시하고 검증 없이 넘어가지 않는다.

**근거**: ThoughtWorks CodeConcise 실험(2025). "AI가 존재하지 않는 라이브러리를 참조하고, 잘못된 패키지를 사용했다." "단위 테스트가 제공할 수 있는 피드백이 없다면, AI는 표면적으로 그럴싸하지만 실제로는 작동하지 않는 코드를 생성한다." 피드백 루프 없이는 오류가 나중에 발견되어 "both disruptive and costly"해진다. DocAgent: 컴포넌트 단위 즉시 검증 시 사실 정확도 94.64%.

---

## 9. 코드를 번역하지 말고 의미를 추출하라

**의미 추출. 구현 상세를 명세에 포함하지 마라.**

- 코드 구문을 그대로 옮기지 않는다. 그 코드가 달성하는 비즈니스 결과를 기술한다.
- 클래스명, 메서드명, 파일 경로는 명세에 포함하지 않는다.
- 수치(500포인트, 30초)는 비즈니스 의미와 함께 기술한다.
- 판단 기준: "이것을 바꾸면 비즈니스 결과가 달라지는가?" Yes → 명세 포함. No → 구현 상세, 제외.

| ❌ 코드 번역 | ✅ 의미 추출 |
|:---|:---|
| `SafeApiAct(() => { ... })` | 모든 API는 예외 발생 시 표준 에러 응답을 반환한다 |
| `if (recvMsg == 0) skip()` | 수신 거부한 고객은 발송 대상에서 제외한다 |
| `maxRetry = 3` | 발송 실패 시 최대 3회 재시도한다 |
| `Thread.Sleep(30000)` | 30초 간격으로 실행한다 |

**근거**: Anthropic Code Modernization Playbook(2025). 코드 현대화의 핵심은 "비즈니스 로직을 보존하면서 구현을 교체"하는 것이다. 구현 상세가 명세에 포함되면 다른 기술 스택으로의 이식이 불가능해진다.

---

## 10. 잘 동작하는 코드에만 AI를 신뢰하라

**전제 조건. AI 출력 품질은 입력 코드 품질에 비례한다.**

- 모듈화되고 깔끔한 코드에서는 AI 출력 품질이 높다.
- 스파게티 코드, 광범위한 전역 상태, 비표준 패턴은 AI 분석 품질을 저하시킨다.
- AI가 익숙하지 않은 내부 프레임워크나 독점 라이브러리 환경에서는 결과를 의심한다.
- 코드가 복잡할수록 도메인 전문가의 검증이 더 중요해진다.

**근거**: ThoughtWorks CodeConcise 실험(2025). Python(표준화된 생태계) → 97% 성공. JavaScript(파편화된 생태계) → 완전 실패. "잘 설계된 모듈식 코드가 AI 출력의 품질을 극대화한다." "광범위하게 확립된 라이브러리를 사용할 수 있는 환경이어야 한다."

---

## 참고

- [Agentless: Demystifying LLM-based Software Engineering Agents](https://arxiv.org/abs/2407.01489) — UIUC, 2024
- [DocAgent: A Multi-Agent System for Automated Code Documentation Generation](https://aclanthology.org/2025.acl-demo.44/) — Meta/Facebook Research, ACL 2025
- [CodexGraph: Bridging LLMs and Code Repositories via Code Graph Databases](https://arxiv.org/abs/2408.03910) — 2024
- [LLMCompiler: An LLM Compiler for Parallel Function Calling](https://arxiv.org/abs/2312.04511) — ICML 2024
- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic, 2025
- [Reverse Engineering User Stories from Code using LLMs](https://arxiv.org/abs/2509.19587) — 2025
- [Claude Code saved us 97% of the work — then failed utterly](https://www.thoughtworks.com/en-us/insights/blog/generative-ai/claude-code-codeconcise-experiment) — ThoughtWorks, 2025
- [Code Modernization Playbook](https://resources.anthropic.com/code-modernization-playbook) — Anthropic, 2025
