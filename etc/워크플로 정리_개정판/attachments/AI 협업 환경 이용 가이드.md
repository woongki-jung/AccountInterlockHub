# AI 협업 환경 이용 가이드 — AccountInterlockHub

이 문서는 현재 워크스페이스(**AccountInterlockHub**)의 **AI 협업 환경**을 담당자가 어떻게 쓰는지 한곳에 정리한 안내서다.
"어디서 무엇을 요청하면, 누가 어떤 순서로 처리해 무엇이 만들어지는가"를 빠르게 찾기 위한 용도다.

이 환경의 핵심은 **담당자가 에이전트 프롬프트를 직접 입력하지 않는다**는 점이다. 담당자는 **Slack 에서 마스터 세션 `ai-pm` 과 대화**하고, ai-pm 이 필요한 작업을 판단해 하위 **서브에이전트**를 자동으로 기동한다. (이전 스프린트/웹훅 기반 환경과 가장 크게 달라진 부분이다.)

- 정책·운영의 단일 출처: [`ai/strategies/`](ai/strategies/) — 본 가이드는 그 정책을 담당자 시점에서 풀어 쓴 사본이며, 상충 시 정본이 우선한다.
- 에이전트 정의 원본: [`ai/agents/`](ai/agents/) · 마스터 봇: [`ai/bots/ai-pm/`](ai/bots/ai-pm/) · 스킬: [`ai/skills/`](ai/skills/)
- 최상위 워크스페이스 지침: [`CLAUDE.md`](CLAUDE.md)

## 이 문서의 사용법

- **처음 접하는 담당자**라면 → [0. 협업 환경 기본 구성](#0-협업-환경-기본-구성)부터 읽어 전체 그림을 잡는다.
- **바로 일을 시작**하려면 → [3. 담당자가 하는 일 (Slack 기반 협업)](#3-담당자가-하는-일-slack-기반-협업)만 봐도 된다.
- **내부 동작(어떤 서브에이전트가 무엇을 하는지)**이 궁금하면 → [4. 단계별 상세 (파이프라인)](#4-단계별-상세-파이프라인)의 파이프라인 문서로 이동한다.
- 처음 보는 약어는 [6. 용어 설명](#6-용어-설명)을 참고한다.

---

## 0. 협업 환경 기본 구성

작업은 사람 담당자와 AI가 **Slack에서 채팅으로 협업**하고, 실제 작업은 **서브에이전트**가 수행하며, 그 기록은 **Redmine 일감**에 남는 구조다. 세 축의 역할이 다르다.

| 축 | 무엇 | 역할 |
|---|---|---|
| **Slack** | 프로젝트 워크스페이스·채널 | 담당자 ↔ ai-pm 의 **실시간 대화 통로**. 요청·질의·승인·보고가 오간다. |
| **ai-pm** | 마스터 세션(봇) | 채널 대화에서 **할 일을 식별해 서브에이전트로 디스패치**하고 결과를 다시 Slack 으로 알리는 **얇은 오케스트레이터**. 직접 작업은 하지 않는다. |
| **Redmine** | 이슈 트래커 | 작업 수행 기록의 **정본**. 명세·진행 노트·상태·결과가 일감에 쌓인다(대화는 휘발성, 이슈는 영속). |

### 협업 흐름 한 사이클

```
[담당자] ──(Slack 채널/DM 에 요청·멘션)──▶ [ai-pm 마스터 세션]
                                              │  ① 처리 대상으로 인식 → 스레드에 '접수' 피드백 게시
                                              │  ② 관련 Redmine 일감 확인/생성
                                              ▼
                                       [서브에이전트 하위 세션] ──작업 수행──▶ 산출물(docs/·apps/ 등) + Redmine 일감 갱신
                                              │
                    (질의·승인 필요 시) ◀── 중간 보고 ── │
   [담당자] ◀──(ai-pm 이 Slack 으로 릴레이)──────────────┘
                                              │  ③ 완료 보고 → ai-pm 이 담당자·채널에 Slack 통지
                                              ▼
                                       (담당자 승인 시) 단계 브랜치를 main 에 병합
```

### 꼭 알아둘 원칙 5가지

1. **담당자는 Slack 으로만 지시한다.** 에이전트 이름이나 프롬프트를 외울 필요가 없다. 자연어로 "무엇을 해달라"고 하면 ai-pm 이 어느 단계·어느 에이전트로 처리할지 판단한다.
2. **4단계는 자동으로 이어지지 않는다.** `directing → spec → build → qa` 는 각각 **독립 완결** 프로세스이며, 다음 단계로 넘어가려면 **담당자 승인**이 필요하다(수동 이행). 한 요청이 반드시 4단계를 다 거치지도 않는다 — 필요한 단계만 지목해 착수한다.
3. **진행 상황은 하나의 피드백 메시지로 보인다.** 요청 1건마다 ai-pm 이 스레드에 피드백 메시지 1건을 유지하고 `접수 → 작업 시작 → 진행 중 → 종료`로 **같은 메시지를 갱신**한다(스레드가 길어지지 않게).
4. **질의·승인은 ai-pm 이 릴레이한다.** 서브에이전트는 백그라운드라 Slack 에 직접 닿지 못한다. 판단이 필요한 지점에 오면 일감에 남기고 중간 보고로 멈추며, ai-pm 이 담당자에게 Slack 으로 물어보고 답을 다시 전달한다.
5. **정본은 Redmine·저장소 파일이다.** Slack 대화는 통로일 뿐, 작업 증적은 Redmine 일감과 저장소 산출물에 남는다. 진행 현황은 Redmine 에서 직접 조회한다.

### 4단계 큰 그림

| 단계 | 무엇을 | 실행 주체 | 주요 산출물 |
|---|---|---|---|
| **directing** (방향설정) | 목적·목표·이용 대상·제공 가치·성과 지표 등 방향 정의 | **ai-pm 이 담당자와 직접 대화**(서브에이전트 없음) | 방향 정의서, PRD·IA |
| **spec** (사양정의) | 방향을 구체 요구사항·사양서로 전환 | ai-pm → **spec 오케스트레이터** → doer들 | `docs/specs/` 도메인별 사양서, 목업 |
| **build** (구현) | 확정 사양을 제품 코드로 구현 | ai-pm → **build 오케스트레이터** → doer들 | `apps/` 제품 코드, 배포 산출물 |
| **qa** (품질검증) | 산출물이 사양을 충족하는지 사용자 동일 환경에서 검증 | ai-pm → **qa 오케스트레이터** → doer들 | 품질검증 보고, `검증` 일감(5종 판정) |

배포 가능 판정 이후의 릴리스·배포·유지보수는 [`delivery.md`](ai/strategies/delivery.md)가 정의한다.

### 저장소 반영(git-flow) 요약

작업 단위를 git 단위에 대응시킨다 — **단계 착수 1회 = 브랜치**(`<단계>/<이슈번호>-<주제>`), **Phase·작업 항목 = commit**, **담당자 승인 = main 병합**(`--no-ff`, 병합 후 브랜치 삭제). main 은 승인 통과 기준선이다. 상세는 [`git-flow.md`](ai/strategies/git-flow.md).

### ai-pm 세션은 어디서 도는가

ai-pm 세션·Slack 런타임은 **지정 실행 장비에서만** 단일 세션으로 기동한다(세션 래퍼 `ai/scripts/ai-pm-session.ps1`). 담당자가 Slack 에서 `ai-pm 초기화` 라고 하면 세션이 안전하게 리셋·재기동된다. 운영 세부는 [`ai-pm.md`](ai/strategies/ai-pm.md).

---

## 1. 전체 워크플로 한눈에 보기

각 단계는 담당자의 Slack 요청으로 착수되고, ai-pm 이 그 단계 **오케스트레이터**를 서브에이전트로 디스패치하며, 오케스트레이터가 다시 여러 **doer**를 순서대로 호출한다(directing 은 ai-pm 이 직접 수행).

```
[담당자] 방향 요청 (Slack)
      ▼
① directing   ai-pm 직접 퍼실리테이션 (서브에이전트 없음)
      │        └ make-prd-requirements·make-prd-specifications 스킬 활용
      ▼        → 방향 정의서 · PRD · IA · 개발사양
② spec        ai-pm → [spec 오케스트레이터]
      │        ├ prd-reviewer            (요구사항 정합성 게이트)
      │        ├ prd-to-policies → service → datas → functions → screens → process → qa  (도메인 순차)
      │        ├ spec-reviewer           (완성 사양서 교차검증)
      │        └ mockup-builder          (목업 검증 루프)
      ▼        → docs/specs/ (정책·서비스·데이터·기능·화면·프로세스·검증 TC) + 목업
③ build       ai-pm → [build 오케스트레이터]
      │        ├ (Phase마다) backend-developer / frontend-developer  (코드 작성)
      │        │            → code-reviewer                          (코드리뷰 판정)
      │        │            → tester                                 (기능검증 round-trip)
      │        ├ build-installer         (배포 산출물 빌드)
      │        └ (런타임 게이트) tester   (배포 산출물 최종 검증)
      ▼        → apps/ 제품 코드 + 배포 산출물
④ qa          ai-pm → [qa 오케스트레이터]
             ├ (사전) 배포 산출물 설치·기동 (사용자 동일 환경)
             ├ test-planner            (검증 계획 · TC를 Phase로 배정)
             └ tester                  (Phase별 TC 실행 · 5종 판정)
             → 품질검증 보고 + Redmine `검증` 일감 (Pass→해결)
```

> 단계 사이의 화살표(▼)는 **자동 연쇄가 아니다.** 각 단계 완료 후 담당자 승인이 있어야 다음 단계에 착수한다.

## 2. 에이전트 전체 지도

현재 워크스페이스는 **마스터 봇 1종 + 단계 오케스트레이터 3종 + doer 15종 + 스킬 7종**으로 구성된다.
"호출 주체"는 그 에이전트를 누가 부르는지를 뜻한다 — `담당자(Slack)`는 사람이 대화로, `ai-pm`·오케스트레이터는 상위가 자동 호출한다.

| 단계 | 이름 | 종류 | 모델 / effort | 호출 주체 | 한 줄 역할 |
|---|---|---|---|---|---|
| 마스터 | [`ai-pm`](ai/bots/ai-pm/ai-pm.md) | 봇(마스터) | inherit / max | 담당자(Slack) | 채널 대화에서 작업을 식별해 서브에이전트로 디스패치·보고 |
| ② spec | [`spec`](ai/agents/spec.md) | 오케스트레이터 | opus / max | ai-pm | 요구사항 게이트→도메인 사양→교차검증→목업 조율 |
| ② spec | [`prd-reviewer`](ai/agents/workflow-prd-review/prd-reviewer.md) | doer | opus / max | spec | 요구사항·사양서 정합성(누락·충돌) 평가 |
| ② spec | [`prd-to-policies`](ai/agents/workflow-prd-to-spec/prd-to-policies.md) | doer | opus / max | spec | 정책 정의서 생성 |
| ② spec | [`prd-to-service`](ai/agents/workflow-prd-to-spec/prd-to-service.md) | doer | opus / max | spec | 서비스 기능 정의서 생성 |
| ② spec | [`prd-to-datas`](ai/agents/workflow-prd-to-spec/prd-to-datas.md) | doer | opus / max | spec | 데이터·DB 설계 정의서 생성 |
| ② spec | [`prd-to-functions`](ai/agents/workflow-prd-to-spec/prd-to-functions.md) | doer | opus / max | spec | 공통 기능·API 인터페이스 정의서 생성 |
| ② spec | [`prd-to-screens`](ai/agents/workflow-prd-to-spec/prd-to-screens.md) | doer | opus / max | spec | 화면 기획·디자인 시스템 정의서 생성 |
| ② spec | [`prd-to-process`](ai/agents/workflow-prd-to-spec/prd-to-process.md) | doer | opus / max | spec | 기능 실행 프로세스(의사코드) 정의서 생성 |
| ② spec | [`prd-to-qa`](ai/agents/workflow-prd-to-spec/prd-to-qa.md) | doer | opus / max | spec | 기획서 검증 + 검증 TC 정의서 생성 |
| ② spec | [`spec-reviewer`](ai/agents/workflow-prd-to-spec/spec-reviewer.md) | doer | opus / max | spec | 완성 사양서 교차 정합성 평가 |
| ② spec | [`mockup-builder`](ai/agents/workflow-mockup/mockup-builder.md) | doer | sonnet / xhigh | spec | 화면 목업 생성(승인 루프) |
| ③ build | [`build`](ai/agents/build.md) | 오케스트레이터 | opus / max | ai-pm | 계획→Phase별(작성·리뷰·검증)→배포 산출물 조율 |
| ③ build | [`backend-developer`](ai/agents/workflow-code-write/backend-developer.md) | doer | sonnet / xhigh | build | 백엔드(NestJS) 구현 |
| ③ build | [`frontend-developer`](ai/agents/workflow-code-write/frontend-developer.md) | doer | sonnet / xhigh | build | 프런트엔드(React/Vite) 구현 |
| ③ build | [`code-reviewer`](ai/agents/workflow-code-write/code-reviewer.md) | doer | opus / max | build | 구현 코드 PASS/FAIL 리뷰 |
| ③ build | [`build-installer`](ai/agents/workflow-publish/build-installer.md) | doer | sonnet / xhigh | build | 배포 산출물(패키지·번들 등) 빌드 |
| ③④ | [`tester`](ai/agents/workflow-qa/tester.md) | doer | sonnet / xhigh | build·qa | TC/기능검증 실 환경 실행·5종 판정 (build·qa 공유) |
| ④ qa | [`qa`](ai/agents/qa.md) | 오케스트레이터 | opus / max | ai-pm | 환경 구성→검증 계획→검증 실행→결과 평가 조율 |
| ④ qa | [`test-planner`](ai/agents/workflow-qa/test-planner.md) | doer | opus / max | qa | 검증 계획(TC를 Phase로 배정) 수립 |

> 모델·강도 규칙: 계획·판정·분석 역할은 정확도를 위해 **opus / effort `max`**, 확정 사양 기반의 정형 작성·실행은 **sonnet / effort `xhigh`** 를 쓴다. 마스터 ai-pm 은 세션 구성 모델(inherit)·`max` 로 기동한다. 단일 출처는 [`agents.md`](ai/strategies/agents.md) §모델·추론 강도(effort) 정책.

### 활용 스킬 (7종)

스킬은 에이전트가 특정 작업에서 끌어다 쓰는 재사용 지식·절차 묶음이다(담당자가 직접 부르지 않는다).

| 스킬 | 역할 | 사용 단계 |
|---|---|---|
| [`make-prd-requirements`](ai/skills/make-prd-requirements/SKILL.md) | 대화로 목표·사용자·IA·기능·화면 요구사항 정의 → PRD·요구사항 산출 | directing |
| [`make-prd-specifications`](ai/skills/make-prd-specifications/SKILL.md) | 대화로 DB·외부 API·인프라·스택 정의 → 개발사양 산출 | directing·spec |
| [`writing-plans`](ai/skills/writing-plans/SKILL.md) | 다단계 작업을 검증 가능한 단위로 분해(TDD·DRY·YAGNI) | build |
| [`karpathy-guidelines`](ai/skills/karpathy-guidelines/SKILL.md) | LLM 코딩 실수 방지(과복잡 회피·최소 변경·가정 명시) | build |
| [`reverse-engineering-guidelines`](ai/skills/reverse-engineering-guidelines/SKILL.md) | 레거시 코드 분석으로 구현 독립 명세 도출 | 레거시 분석 |
| [`opendataloader-pdf`](ai/skills/opendataloader-pdf/SKILL.md) | PDF → Markdown 변환 | 전 단계 공통 |
| [`check-dev-environments`](ai/skills/check-dev-environments/SKILL.md) | 로컬 실행 환경(방화벽·외부 API·런타임) 점검 | build·qa |

## 3. 담당자가 하는 일 (Slack 기반 협업)

담당자의 실제 조작은 **Slack 채팅**이 전부다. 진입 프롬프트를 외울 필요 없이, 아래 네 가지 상황에서 자연어로 대화한다.

### 3-1. 작업 요청·착수

- **어떻게**: 해당 작업 채널에 **요청을 공유하거나 ai-pm 을 멘션/DM** 한다. 어느 단계인지 몰라도 된다 — ai-pm 이 판단한다.
- **예시(Slack 메시지)**:
  ```
  @ai-pm  spec 단계 착수해줘. 방향 정의서 최신본 기준으로 계정 연동 도메인 사양을 정리해줘.
  ```
  ```
  @ai-pm  로그인 화면 목업을 먼저 만들어서 확인하고 싶어.
  ```
- **바로 일어나는 일**: ai-pm 이 처리 대상으로 인식하는 즉시 스레드에 `접수` 피드백을 달고, 관련 Redmine 일감을 확인/생성한 뒤 해당 단계 오케스트레이터를 디스패치한다. 이후 같은 메시지가 `작업 시작 → 진행 중 → 종료`로 갱신된다.

### 3-2. 질의에 응답 (검토 협의)

- **어떻게**: 서브에이전트가 모호하거나 비가역적 판단이 필요해 멈추면, ai-pm 이 그 질의를 Slack 으로 전달한다. 담당자는 스레드에 **그대로 답하면** 된다.
- ai-pm 이 담당자 답변을 관련 Redmine 일감 노트에 기록하고, 그 맥락을 더해 작업을 **재디스패치**한다(중단 지점부터 재개).

### 3-3. 승인 (단계 이행·목업 등)

- **어떻게**: 단계 완료·목업 확정처럼 승인 게이트가 오면 ai-pm 이 승인을 요청한다. 담당자가 **승인**하면 해당 단계 브랜치가 main 에 병합되고 다음 단계로 넘어갈 수 있게 된다.
- 승인 전까지는 다음 단계로 자동 진행하지 않는다(§0 원칙 2).

### 3-4. 진행 현황 확인·세션 관리

- **진행 현황**: Redmine 프로젝트(`accountinterlockhub`)의 이슈 목록·상태로 직접 조회한다(저장 쿼리로 진행 중/대기/완료 뷰 공유 가능).
- **세션 리셋**: 컨텍스트가 누적되었거나 새로 시작하고 싶으면 Slack 에 `ai-pm 초기화` 를 입력한다 — ai-pm 이 리셋 공지 후 안전하게 재기동한다.

> 참고: `directing` 단계는 별도 서브에이전트 없이 **ai-pm 이 담당자와 직접 대화로** 진행한다. 방향이 정리되면 방향 정의서·PRD·IA 로 산출된다.

## 4. 단계별 상세 (파이프라인)

각 단계 오케스트레이터가 어떤 doer를 **언제·어떤 입력으로 호출해 무엇을 만드는지**는 단계별 파이프라인 문서로 분리했다.

- 📄 [사양 분석 파이프라인](사양분석-파이프라인.md) — spec 오케스트레이터 + prd-reviewer·prd-to-* 7종·spec-reviewer·mockup-builder
- 📄 [제품 생산 파이프라인](제품생산-파이프라인.md) — build 오케스트레이터 + backend/frontend-developer·code-reviewer·tester·build-installer
- 📄 [품질 검증 파이프라인](품질검증-파이프라인.md) — qa 오케스트레이터 + test-planner·tester

directing 은 파이프라인(서브에이전트 체인)이 아니라 ai-pm 의 직접 퍼실리테이션이므로 별도 파이프라인 문서를 두지 않는다 — 상세는 [`stages/directing.md`](ai/strategies/stages/directing.md).

## 활용 사례 (실제 Slack 채널 타임라인)

이 워크스페이스의 `account-interlock-hub` Slack 채널에서 실제로 오간 담당자 요청과 ai-pm 실행 결과다. `directing → spec → build → qa` 전 단계가 어떻게 순환했는지 시간순으로 보여준다. (세션 재기동·진단 등 운영 메시지는 생략, 워크플로 이정표만. 민감정보는 대화에 노출되지 않음.)

- **2026-07-05 · directing (프로젝트 착수)**
	- 담당자: "프로젝트 초기 구성을 시작하자"
	- ai-pm: 채널 감시 시작 → directing 을 직접 대화로 진행(방향·PRD·IA 도출) → spec 피드백 스레드로 연결.
- **2026-07-06 · spec (사양·목업 + 피드백 스레드)**
	- ai-pm: **목업 6화면 · 사양 73파일(7도메인) · 검증 TC 107** 산출(그룹 일감 `accountinterlockhub#24`, 브랜치 `spec/24-product-spec`). 결정 필요 항목·수치 기본안·제안 3건을 스레드로 제시 → 담당자 피드백 수렴.
- **2026-07-06 · spec-sync (인프라 변경 역전파)**
	- 담당자: "MSSQL 로 구성했던 걸 PostgreSQL 로 바꿨어. CLAUDE.local.md 에 DB 접근 정보를 넣어뒀어."
	- ai-pm: MSSQL 전제 최적화를 전수 탐색해 **PostgreSQL 물리 설계로 재정의**, 개발사양 DB 확정.
- **2026-07-06 · spec (PRD 요구기능 추가)**
	- 담당자: "백엔드 API 두 개 추가 — ① 서비스 A 의 B 처리완료 확인 ② 서비스 B 완료 콜백"
	- ai-pm: PRD 갱신 + 서비스 대면 API 사양(처리상태 확인·완료 콜백) 반영.
- **2026-07-08 · spec 확정 · main 병합**
	- 담당자: "키값 속성이 반드시 한 개 들어가야 한다는 옵션으로 정리하고, 연관 사양 정리·브랜치 병합까지 완료해줘"
	- ai-pm: 키값 파라미터 **정확히 1개 필수**(선택→필수). **독립 교차검증 SUCCESS(치명 0·오류 0, TC 156 일치).** `spec/24-product-spec → main`(commit `daed31f`, no-ff), Redmine #24·#25~#33 완료.
- **2026-07-08 · build (제품 구현, 19/19 Phase · 도메인별)**
	- 담당자: "정리된 사양으로 제품 개발 진행하자. 첫 진행이니 핵심 결정사항 검토/합의 후 시작하자."
	- ai-pm(관리자 도메인): 로그인(IP+계정·5회 잠금)·연동 구성 CRUD(키값 exactly-one). 실환경 round-trip(PostgreSQL+NestJS+실 브라우저), 회귀 1건 자체 발견·수정.
	- ai-pm(사용자 도메인): 이용 동의·요청키 UUID·서비스 B 전달(재시도 2회). 무저장 경계 검증(센티넬 0건).
	- ai-pm(서비스 대면 API): API키+HMAC-SHA256·상수시간·fail-closed·요청제한 60/분·완료 콜백(exactly-once). 실 crypto·실 HTTP round-trip.
	- ai-pm: **build 전체 완료 19/19 Phase + 배포 산출물 + 최종 게이트 PASS.** `build/34-product-mvp → main`(commit `a6fcc72`, no-ff).
- **2026-07-09 · qa (품질 검증, v0.1.0)**
	- 담당자: "개발 버전에 대한 품질 검증을 진행하고 결과를 보고해줘"
	- ai-pm: **검증 TC 156건 전부 완료(해결)**, 배포 판정(담당자 직접) 대기. 검증 일감이 '신규'에 고착된 원인(검증 트래커 상태전이 워크플로 미구성) 확인·해소.
- **2026-07-11 · directing 재순환 (정책 변경)**
	- 담당자: "핵심 서비스 정책 일부를 변경해야겠어. directing 세션을 시작하자."
	- ai-pm: directing → build → qa 재순환. **암호화 연동 플로우 main 병합** — 권장안 4건 반영(오류 #237~240 해결).

## 5. 공통 규약 및 주의사항

- **단계는 수동 이행**: 각 단계는 독립 완결 프로세스이며 담당자 승인으로만 다음 단계에 착수한다(자동 연쇄 없음).
- **책임 분리**: 한 단계 안에서 작성·리뷰·검증을 서로 다른 주체가 맡는다. 작성 주체가 자기 산출을 합격 판정·검증하지 않는다.
- **실 동작 검증 의무**: 정적 검증(컴파일·타입 체크)만으로 완료 처리하지 않고, 실제 실행해 저장→조회 왕복(round-trip)까지 확인한다.
- **회귀 상한**: 검증 결과가 기준 미달이면 앞 단계로 회귀해 재시도하되 **최대 3회**, 시도 횟수는 Redmine 일감 노트로 기록한다.
- **정본 분리**: 대화는 Slack(휘발성), 작업 기록은 Redmine 일감, 산출물은 저장소 파일(`docs/`·`apps/`). 상태·이력의 정본은 항상 저장소·Redmine 이다.
- **민감정보 보호**: 계정·키 등 원문(`CLAUDE.local.md` 변수)은 리포트·커밋·Slack 어디에도 노출하지 않는다.
- **`etc/` 는 사람 참고 전용**: 본 폴더를 포함한 `etc/` 하위는 사람 참고용이다. 정책·산출물의 단일 출처는 항상 `etc/` 바깥(`ai/`·루트 config)이며, 본 가이드가 정본과 어긋나면 정본이 우선한다([`CLAUDE.md`](CLAUDE.md) §기본 지침).

## 6. 용어 설명

- **ai-pm**: 프로젝트 Slack 워크스페이스를 감시하며 작업을 서브에이전트로 디스패치하는 마스터 세션(봇). 직접 작업하지 않는 얇은 오케스트레이터.
- **오케스트레이터 / doer**: 오케스트레이터는 한 단계의 흐름을 조율하는 서브에이전트(`spec`·`build`·`qa`), doer 는 그 흐름 안에서 실제 산출을 만드는 실행 단위(`ai/agents/workflow-*/`).
- **단계(stage)**: 업무를 나누는 4구간 — directing(방향설정)·spec(사양정의)·build(구현)·qa(품질검증).
- **Phase**: 한 단계·브랜치 안의 세부 실행 단위(= commit 1건). build 는 구현 항목 1건, qa 는 검증 TC 1건이 1 Phase.
- **Redmine 일감(이슈)**: 작업 수행 기록의 정본. 트래커(사양·기능·검증·오류 등)와 상태(신규→진행→해결→완료, 보류·거절)로 관리한다.
- **PRD / 사양서(스펙)**: PRD 는 제품 요구사항 문서(`docs/prd/`), 사양서는 이를 개발 가능한 수준으로 상세화한 문서(`docs/specs/`).
- **IA**: 정보 구조(Information Architecture). 제품 기능 단위까지의 좌표 체계(`ia-code`)로, 작업 범위·이력의 기준이 된다.
- **5종 판정**: 검증 결과 등급 — 🟢 Pass(실 환경) / 🔵 Pass-Mock / 🟣 Pass-Static / 🔴 Fail / 🟠 Block.
- **round-trip(왕복 검증)**: 저장한 값을 다시 조회했을 때 그대로 나오는지 실 환경에서 확인하는 검증.
- **검토 협의 / 질의·승인 릴레이**: 서브에이전트가 판단이 필요할 때 멈추고, ai-pm 이 담당자에게 Slack 으로 물어 답을 전달하는 절차.
- **git-flow**: 단계 착수=브랜치, Phase=commit, 담당자 승인=main 병합(no-ff)의 저장소 운용 규칙.
