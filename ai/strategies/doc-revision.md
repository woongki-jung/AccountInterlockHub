# 운영 문서 개정 이력 관리 전략

본 문서는 **운영 문서를 개정할 때**의 이력 관리 정책을 정의한다. 제품 산출물의 시계열 이력은 [`ia-history.md`](ia-history.md)가 담당하고, 본 문서는 **운영 문서(에이전트·전략·스킬·봇·스크립트·루트 config)의 개정 기록**을 담당한다.

## 대상

- **운영 문서** — `ai/agents/**`·`ai/strategies/**`·`ai/skills/**`·`ai/bots/**`·`ai/scripts/**` 와 루트 config(`CLAUDE.md`·`CLAUDE.env.md`·`package.json` 등).
- 제품 산출물(`docs/`·`apps/`·`mockup/`)의 이력은 본 정책 대상이 아니다([`ia-history.md`](ia-history.md)).

## 원칙 — 본문 직접 수정

운영 문서는 **현재 상태 중심으로 본문을 직접 수정**한다([`document-master-guide.md`](document-master-guide.md)). 폐기·대체·과거 경위를 본문에 남기지 않는다 — 무엇이 왜 바뀌었는지의 경위는 본문이 아니라 외부 이력에 둔다. 그래야 문서를 읽는 사람이 항상 "지금 맞는 내용"만 본다.

## 외부 이력 — `history/changes/`

개정 경위는 `history/changes/<YYYY-MM-DD>/<영역>-<주제>.md` 에 **개정 1건 = 파일 1개**로 남긴다.

- **`<YYYY-MM-DD>`**: 개정 수행 일자 묶음 폴더.
- **`<영역>`**: `agents`·`strategies`·`skills`·`bots`·`scripts`·`config` 중 하나.
- **`<주제>`**: 개정 주제 한 줄 슬러그.

### entry 양식

```markdown
# <영역>-<주제> (<YYYY-MM-DD>)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**: 바뀐 문서·섹션과 변경 요지.
- **왜**: 개정 이유·배경.
- **영향**: 함께 바뀐 문서·배선(링크·참조).
- **관련 일감**: (있으면) Redmine 이슈 번호.
```

## 갱신 책임

- 운영 문서를 개정한 주체가 **같은 commit 에** 해당 `history/changes/...` 파일을 추가한다(문서 본문과 경위가 함께 추적되도록).
- 여러 문서를 한 주제로 개정하면 묶어 1개 파일로 기록하고 §영향에 전부 나열한다.

## ia-history 와의 구분

| | doc-revision (본 문서) | [`ia-history.md`](ia-history.md) |
|---|---|---|
| 대상 | 운영 문서(`ai/**`·루트 config) 개정 | 제품 산출물(IA 노드별 작업) |
| 단위 | 개정 1건 = `changes/<날짜>/<영역>-<주제>.md` | IA 노드 1개 = `history/<ia-code>.md` |
| 성격 | 1회 작성(경위 스냅샷) | append-only 시계열 |

## 백필

본 정책 도입 이전 개정은 백필하지 않는다(forward-only).
