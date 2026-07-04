# 스킬 정의·활용 전략

본 문서는 스킬 파일 형식과 워크스페이스에서 활용 가능한 스킬의 목록·역할을 정의한다. 어떤 작업에 어떤 스킬을 적용할지 선택할 때 참조한다. 스킬은 에이전트가 특정 작업을 수행할 때 끌어다 쓰는 **재사용 지식·절차 묶음**이다.

## 스킬 파일 형식 (`ai/skills/<name>/SKILL.md`)

```yaml
---
name: skill-name
description: 스킬 설명 (언제 쓰는지 포함 — 적용 판단에 사용)
---
```

- 본문은 스킬이 제공하는 절차·체크리스트·가이드라인을 담는다. 작성 규칙은 [`document-master-guide.md`](document-master-guide.md).
- 스킬 폴더에 보조 리소스(스크립트·템플릿)를 함께 둘 수 있다.

## 활용 스킬 카탈로그

| 스킬 | 역할 | 사용 시점(단계) |
|---|---|---|
| `make-prd-requirements` | 담당자와 대화로 목표·사용자·IA·서비스 기능·화면 요구사항을 단계적으로 정의해 PRD·요구사항 산출 | directing (PRD·IA 작성) |
| `make-prd-specifications` | 담당자와 대화로 DB 설계·외부 API·인프라·기술 스택을 정의해 개발 사양 산출 | directing·spec (개발사양·프로그램 구성) |
| `writing-plans` | 다단계 작업을 검증 가능한 bite-sized task 로 분해(TDD·DRY·YAGNI) | build (구현 계획·코드 작성 전) |
| `karpathy-guidelines` | LLM 코딩 실수 방지(과도한 복잡성 회피·최소 변경·가정 명시·검증 기준 정의) | build (작성·리뷰·리팩토링) |
| `reverse-engineering-guidelines` | 레거시 코드 분석으로 구현 독립 명세를 도출할 때의 행동 규칙 | 레거시 분석·역추출 |
| `opendataloader-pdf` | PDF → Markdown 변환(미설치 시 자동 설치 후 변환) | PDF 입력 자료를 읽을 때(전 단계 공통) |
| `check-dev-environments` | 로컬 실행 환경(방화벽·외부 API 접근·런타임)이 올바른지 체크리스트로 점검 | build·qa (환경 준비) |

- **단계 정합**: `make-prd-requirements` 는 directing 의 PRD·IA 작성([`stages/directing.md`](stages/directing.md)), `make-prd-specifications` 는 directing 의 프로그램 구성·기술스택 및 개발사양 작성에 대응한다.
- 프로젝트 고유 값(점검 대상 주소·자격·스택 등)은 스킬 본문에 박지 않고 사양·개발사양(`docs/prd/devspec/` — [`doc-structure.md`](doc-structure.md))·[`CLAUDE.env.md`](../../CLAUDE.env.md) 를 단일 출처로 참조한다.
