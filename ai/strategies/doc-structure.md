# 저장소 구조

본 문서는 워크스페이스 디렉터리 트리와 각 위치의 역할을 정의하는 단일 기준이다. 새 산출물의 저장 위치를 정하거나 기존 문서의 위치를 확인할 때 참조한다. 일부 폴더는 **해당 작업이 수행될 때 생성**된다(⬦ 표기 — 현재 미존재일 수 있음).

```
ai/                         # 에이전트 기반 운영 자산
  agents/                   # 단계 서브에이전트 정의 (정책: agents.md)
  bots/                     # 마스터 봇 런타임
    ai-pm/                  # ai-pm 디스패처 (정의 + _slack 런타임). 정책: ai-pm.md
  scripts/                  # 세션 래퍼 등 운영 스크립트
  skills/                   # 스킬 정의 (정책: skills.md)
  strategies/               # 운영 전략 문서 (단일 출처)
    stages/                 # 단계별(directing/spec/build/qa) 상세 지침
docs/                       # 요구사항·사양 문서
  prd/                      # 제품 요구사항 (directing 산출)
    PRD.md                  # 방향 정의서 루트
    ia/                     # 정보 구조(IA) — directing 산출. 정책: ia.md
      IA.md                 # IA 맵 (서비스 제공 기능단위까지)
    ⬦ devspec/              # 개발사양 (외부 API·DB·인프라 등 개발 고정값) — directing 산출. 정책: stages/directing.md
  ⬦ specs/                  # 제품 상세 사양 (spec 산출) — 도메인별 폴더
      policies/ services/ datas/ functions/ screens/ processes/ qa/
  ⬦ releases/               # 릴리스 노트 (버전별 1파일). 정책: delivery.md
⬦ mockup/                   # UI 목업 (spec 마무리 산출 — throwaway). 정책: stages/spec.md
⬦ apps/                     # 소스코드 루트 (build 산출). 모든 코드는 이 하위
⬦ works/                    # 작업 실행 임시 영역 — 일감별 하위 폴더, git 비관리 (§작업 실행 산출)
⬦ history/                  # 누적 이력 (IA 노드별 시계열). 정책: ia-history.md
    <ia-code>.md            #   IA 노드별 이력 · common.md 횡단 · bak-<YYYY>.md 연도 백업
    changes/                #   운영 문서 개정 이력. 정책: doc-revision.md
⬦ wiki/                     # 용어사전 (WIKI.md). 정책: document-master-guide.md §독자·표현
etc/                        # 참고 자료 보관 — 직접 참조 금지 (§etc/)
CLAUDE.md / CLAUDE.env.md / CLAUDE.local.md   # 루트 설정
package.json                # ai-pm 런타임 의존
```

⬦ = 해당 단계 작업 수행 시 생성.

## 산출물 위치 (단계별)

| 산출물 | 위치 | 단계 |
|---|---|---|
| 방향 정의서 | `docs/prd/PRD.md` | directing |
| 정보 구조(IA) | `docs/prd/ia/IA.md` | directing |
| 개발사양 | `docs/prd/devspec/` | directing |
| 사양서(도메인별) | `docs/specs/<도메인>/` | spec |
| 목업 | `mockup/` | spec(마무리) |
| 제품 코드·배포 구성 | `apps/` | build |
| 릴리스 노트 | `docs/releases/<버전>.md` | 릴리스([`delivery.md`](delivery.md)) |
| 누적 이력 | `history/` | 전 단계 |

- 모든 산출물은 워크스페이스 파일이 정본(SoT)이며, Redmine 일감은 그 추적·미러다([`work-tracking.md`](work-tracking.md)).
- 개발사양(외부 API·DB·인프라 등 프로젝트 고정값)은 `docs/prd/devspec/` 하위에 두며, 구성·작성은 [`stages/directing.md`](stages/directing.md) §산출물이 정의한다.

## 작업 실행 산출

단계 실행 과정의 중간 산출(실행 계획·진행 기록·결과 보고·검증 증빙)의 정본은 **해당 Redmine 일감**이다 — 계획·보고는 일감 설명·노트로, 스크린샷·로그 등 증빙 파일은 일감 첨부로 남긴다([`work-tracking.md`](work-tracking.md)).

- 실행 중 임시 파일(스크립트·중간 데이터)은 `works/<프로젝트식별자>-<이슈번호>/` 에 둔다(git 비관리). 작업 종료 시 보존할 증빙을 일감에 첨부한 뒤 폴더를 정리한다.
- 동시 실행되는 작업은 각자 자기 일감 폴더만 사용한다(교차 접근 금지).

## `etc/` — 참고 전용 (직접 참조 금지)

`etc/` 는 외부에서 들여온 참고 자료를 **보관만** 하는 폴더다. 에이전트·스킬·전략 정의는 `etc/` 하위를 직접 참조·링크하지 않는다. 필요한 내용은 `ai/strategies/` 의 내부 표준 문서로 자립화(SoT 화)한 뒤 그 문서를 참조한다. `etc/` 가 비거나 통째로 교체돼도 운영이 깨지지 않도록, 운영 의존성은 항상 내부 문서로 둔다.
