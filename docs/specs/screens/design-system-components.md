# 공통 컴포넌트 카탈로그

정본은 [`design-system.md`](design-system.md)(토큰·레이아웃·접근성 기준). 화면 목록은 [`spec-screens.md`](spec-screens.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

이 표면이 쓰는 컴포넌트는 **11종**이다. 여기 없는 요소를 화면이 임의로 만들지 않는다 — 필요하면 본 문서를 먼저 고친다. 모든 컴포넌트는 [`design-system.md`](design-system.md) 의 토큰만 참조하고 자기 색·간격 값을 갖지 않는다.

## 목록

| 컴포넌트 | 쓰는 화면 | 한 줄 용도 |
|---|---|---|
| AppShell | 전체 | 페이지 바탕 + 중앙 카드 |
| StageTitle | 전체 | 화면 제목(h1)과 보조 설명 |
| TextField | SCR-001 | 한 줄 입력. 생년월일 변형을 갖는다 |
| Button | SCR-001 · SCR-002 | 주 액션·보조 액션 |
| NoticeBlock | SCR-002 | 동의 안내 문구(상수) 표시 |
| ConsentList · ConsentItem | SCR-002 | 동의 항목 목록과 항목별 체크 |
| InlineAlert | SCR-001 · SCR-002 · SCR-003 | 단계를 바꾸지 않는 오류·안내 |
| Spinner | SCR-001 · SCR-002 · SCR-003 | 처리 중 표시 |
| ProgressPanel | SCR-003 | 승인 후 대기 화면 본문 |
| ResultPanel | SCR-004 | 결과 4경로 표시 |
| Badge | SCR-002 · SCR-004 | 필수 표시·확정 결과 재안내 보조 표시 |

## AppShell

- **구조**: 페이지(`--color-bg`) > 카드(`--color-surface`·`--radius-lg`·`--shadow-card`) > 내용. 카드는 최대 폭 `--size-content-max`, 가로 중앙.
- **없는 것**: 헤더 바·브랜드 로고·전역 네비게이션·사이드바·푸터 메뉴. 사용자 대면 서비스 표시 명칭 상수가 없으므로 임의 문구를 넣지 않는다.
- **마크업**: 카드는 `<main>`. 페이지에 `<header>`·`<nav>` 를 두지 않는다.
- **반응형**: [`design-system.md`](design-system.md) §반응형 브레이크포인트를 그대로 따른다.

## StageTitle

- **구조**: 제목(`<h1>`·`--font-size-xl`·`--font-weight-bold`) + 선택적 보조 설명(`--font-size-sm`·`--color-text-muted`). 아래 여백 `--space-lg`.
- **상태**: 없음(정적).
- **접근성**: 문서에 `<h1>` 은 하나이며 **단계가 바뀌면 내용이 교체**된다. 교체 시 `tabindex="-1"` 인 이 제목으로 포커스를 옮기고 문서 제목(`document.title`)도 같은 문구로 맞춘다.

## TextField

- **구조**: 레이블(`<label for>`·`--font-size-sm`·`--font-weight-semibold`) + 입력(`--size-control-height`·경계 1px `--color-border`·`--radius-sm`) + 도움말 또는 오류 문구.
- **생년월일 변형**: `type="text"`·`inputmode="numeric"`·`autocomplete="off"`·`maxlength=6`·글자 `--font-size-lg`·자간 `0.15em`·고정폭 숫자. 숫자 외 문자는 입력 시점에 걸러 낸다.
	- **값을 가리지 않는다**(비밀번호형 표시를 쓰지 않는다) — 사용자가 방금 넣은 자기 값이며 오타를 눈으로 고쳐야 한다. 이 값은 필드 밖 어디에도(다른 화면 요소·오류 문구·주소창·브라우저 저장소) 나타나지 않는다([`../datas/model_MDL-004-006.md`](../datas/model_MDL-004-006.md) `MDL-006` 마스킹 규칙).
	- **자동 포커스를 주지 않는다** — 진입 즉시 키보드가 올라오면 안내 문구가 가려진다. 오류로 되돌아올 때만 포커스를 옮긴다.
- **상태**: 기본 / 포커스(포커스 링) / 오류(경계 `--color-danger` + 오류 문구) / 잠금(제출 중·`readonly` 로 값 유지).
- **접근성**: 레이블은 항상 보인다(자리표시자로 대체하지 않는다). 오류 문구는 `aria-describedby` 로 연결하고 필드에 `aria-invalid="true"` 를 준다.

## Button

- **변형**: `primary`(`--color-primary` 바탕·흰 글자) · `secondary`(카드 바탕·1px `--color-border`·`--color-primary` 글자). 이 표면에 위험(빨강) 버튼을 두지 않는다 — **거부는 위험한 행동이 아니라 정당한 선택**이다.
- **크기**: 높이 `--size-control-height`, 좌우 여백 `--space-md`, 글자 `--font-size-base`·`--font-weight-semibold`, 모서리 `--radius-md`. 카드 폭을 채우는 전체 폭이 기본이다.
- **상태**: 기본 / 눌림(`--color-primary-strong`) / 포커스(포커스 링) / 비활성(`--color-disabled-bg`·`--color-disabled-fg`·`aria-disabled="true"`) / 처리 중(Spinner + 문구 교체·중복 제출 차단).
- **접근성**: 네이티브 `<button>` 만 쓴다. 비활성은 `disabled` 대신 `aria-disabled="true"` 로 두어 **포커스를 받을 수 있게** 한다 — 왜 못 누르는지 안내를 읽을 수 있어야 한다. 클릭은 무시하고 필요한 안내를 알린다.
- 액션이 둘이면 세로로 쌓고 주 액션을 위에 둔다.

## NoticeBlock

- **구조**: 약한 바탕(`--color-primary-weak`)·`--radius-md`·안쪽 여백 `--space-md`. 안내 문구 상수의 **단락을 그대로 문단으로** 렌더한다.
- **상태**: 값이 비면 **렌더하지 않는다**(제목·구분선·여백 포함).
- **제약**: 문구를 자르거나 접거나 요약하지 않는다. 서식·링크·HTML 을 해석하지 않는다(`DATA-003-05`). 최대 400자·3단락 전제는 [`design-system.md`](design-system.md) §안내 영역 레이아웃 전제.

## ConsentList · ConsentItem

- **ConsentList**: 항목 1건이어도 **목록 구조로** 렌더한다(항목 수는 상수로 바뀐다). 항목 사이 구분선 `--color-divider`.
- **ConsentItem 구조**: 체크박스 + 항목명(`--font-weight-semibold`) + `필수` 배지(필수 항목만) + 설명(`--font-size-sm`·`--color-text-muted`).
- **히트 영역**: **행 전체가 레이블**이라 어디를 눌러도 체크가 토글된다. 행 최소 높이 `--size-hit-min`.
- **상태**: 미선택 / 선택(체크 표시 `--color-primary`) / 포커스(행에 포커스 링) / **잠금(제출 중)** — 아래 정의를 따른다.
- **잠금(제출 중)의 시각 처리**: 거부 제출 응답을 기다리는 동안 목록을 잠근다([`screen_SCR-002.md`](screen_SCR-002.md) §화면 상태 전이 `SubmittingReject`). 행 바탕 `--color-disabled-bg`, 항목명·설명·체크 표시 글자 `--color-disabled-fg` — 버튼 비활성과 **같은 토큰 쌍**이며 대비비 **4.82:1** 이 이미 실측돼 있다([`design-system.md`](design-system.md) §색 대비 검증).
	- **불투명도(`opacity`)로 흐리지 않는다** — 전경과 배경을 함께 옅게 만들어 실측 대비비를 무효로 한다. 색 값을 비활성 토큰으로 바꿔 대비를 지킨다.
	- 체크 상태·구분선·행 높이·`필수` 배지는 그대로 둔다 — 방금 무엇을 선택했는지가 잠금 중에도 읽혀야 하고, 필수 여부는 잠금과 무관한 사실이다.
- **접근성**: 네이티브 `<input type="checkbox">` + `<label>` 조합. 목록은 `<ul>`·항목은 `<li>`. 필수 항목에는 `필수` 라는 **글자**를 함께 둔다(별표 하나로 대신하지 않는다). 잠금 상태에서는 목록에 `aria-busy="true"`, 체크박스에 **`disabled`** 를 준다 — Button 이 `aria-disabled` 를 쓰는 이유(왜 못 누르는지 안내를 읽혀야 한다)가 여기에는 없다. 제출 중에는 안내할 것이 없고 버튼 안 진행 표시가 상태를 전한다.
- 항목명·설명·필수 여부는 상수에서 온 값을 그대로 쓴다.

## InlineAlert

- **용도**: 단계를 바꾸지 않는 알림 — 입력 형식 오류, 본인확인 재입력 안내, 필수 동의 미충족, 내부 오류 후 재시도 안내.
- **구조**: 아이콘 + 문구. 위험 계열 바탕 `--color-danger-weak`·글자 `--color-danger-strong`·왼쪽 강조선 3px `--color-danger`. 모서리 `--radius-md`, 안쪽 여백 `--space-sm`~`--space-md`.
- **위치**: 화면 사양이 고정한 **알림 영역** 한 곳 — 본문(입력·목록·진행 표시) 영역 아래이며 액션 영역이 있으면 그 위다([`screen_SCR-001.md`](screen_SCR-001.md) §레이아웃 구성 3 · [`screen_SCR-002.md`](screen_SCR-002.md)·[`screen_SCR-003.md`](screen_SCR-003.md) §레이아웃 구성 4). **오류 유형(입력·처리)에 따라 자리를 옮기지 않는다**([`design-system.md`](design-system.md) §상태 표현).
- **접근성**: `role="status"`(공손) 로 알린다. 필드에 매인 경우 `aria-describedby` 로 연결한다. 알림이 뜬다고 포커스를 빼앗지 않되, 재입력 안내는 해당 필드로 포커스를 옮긴다.
- 문구는 각 화면 사양이 정한 값을 쓴다. 사유 코드·단계 번호·내부 메시지를 노출하지 않는다(`SEC-002-05`).

## Spinner

- **구조**: 원형 진행 표시. 지름 20px(버튼 안) / 32px(진행 화면).
- **접근성**: `aria-hidden="true"` 로 두고 **상태는 옆 문구가 전달**한다. 감소 모션 설정에서는 회전 주기를 1.6초 이상으로 늦춘다(없애지 않는다).
- 진행률을 알 수 없으므로 퍼센트·남은 시간을 표시하지 않는다.

## ProgressPanel

- **용도**: 승인 제출 후 결과가 확정되기까지의 대기 표시(SCR-003).
- **구조**: Spinner(32px) + 제목(`--font-size-lg`) + 보조 문구(`--color-text-muted`). 세로 가운데 정렬, 위아래 여백 `--space-xl`.
- **제약**: 이 상태에는 **조작 요소를 두지 않는다** — 취소 버튼을 두면 이미 진행 중인 서버 처리와 화면이 어긋난다. 뒤로 가기·새로고침은 진입부터 다시 시작한다.
- **접근성**: 영역에 `role="status"`·`aria-live="polite"`·`aria-busy="true"`. 전환 시 제목으로 포커스를 옮긴다.
- 대기 시간 상한은 정책 `BIZ-004-02` 가 정한 전달 재시도 총 소요 상한이 결정한다 — 화면은 **수치를 자체로 정의하지 않는다**.

## ResultPanel

- **용도**: 결과 4경로 표시(SCR-004). 경로별 색·아이콘·제목은 [`design-system.md`](design-system.md) §결과 4경로의 시각 구분이 정본이다.
- **구조**: 경로 아이콘(40px) → 제목(`<h1>`·`--font-size-2xl`) → 보조 표시 배지(재안내일 때만) → 설명 문단(`--color-text`) → 다음 안내 한 줄(`--color-text-muted`). 패널 바탕은 경로별 약한 바탕, 왼쪽 강조선 4px.
- **상태**: 경로 4종 × 재안내 여부. 그 밖의 상태를 만들지 않는다.
- **접근성**: 아이콘은 `aria-hidden="true"`. 결과 도착 시 제목으로 포커스를 옮기고, 영역은 `role="status"` 로 둔다(경고음 같은 강한 알림을 쓰지 않는다).
- **제약**: 추적 키·암호값·복호화 원문·사유 코드 원문을 표시하지 않는다. 액션 버튼을 두지 않는다.

## Badge

- **변형**: `필수`(동의 항목용·`--color-primary-weak` 바탕·`--color-primary-strong` 글자) / `재안내`(확정 결과 재안내용·`--color-neutral-weak` 바탕·`--color-neutral` 글자 + 되돌림 아이콘).
- **구조**: `--font-size-xs`·`--radius-pill`·좌우 여백 `--space-xs`. 조작 요소가 아니므로 히트 영역 규칙을 적용하지 않는다.
- **접근성**: 글자를 그대로 읽히게 둔다(아이콘만 쓰지 않는다). 장식 아이콘은 `aria-hidden="true"`.
