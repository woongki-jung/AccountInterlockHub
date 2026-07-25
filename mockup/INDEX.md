# 목업 인덱스 — 사용자 연동 4화면

본 문서는 `mockup/` 의 화면↔SCR↔IA 매핑, 열람 방법, 흐름 요약, 디자인 근거, 사양 보완 후보를 담는 추적 문서다. 클릭 진입은 [`index.html`](index.html)(열람 허브), 추적·매핑은 본 문서가 담당한다. 정본은 [`ai/agents/workflow-mockup/mockup-builder.md`](../ai/agents/workflow-mockup/mockup-builder.md) §3단계.

## 단일 경로 위의 네 단계 (화면별 URL 없음)

이 제품의 사용자 표면은 **경로 하나**다 — 진입부터 결과까지 `<INTERLOCK_ENTRY_PATH>` 라는 같은 URL 위에서 진행되고, 단계 전환은 리다이렉트 없이 같은 문서 안에서 서버 응답이 결정한다([`spec-screens.md`](../docs/specs/screens/spec-screens.md) §이 표면의 형태). 즉 **SCR-001~004 는 화면마다 URL 을 갖지 않는 하나의 여정의 네 단계**다.

목업 파일은 담당자가 각 단계를 독립적으로 열람·검토할 수 있도록 **화면 1개 = 파일 1개**로 나누었다 — 이는 목업 열람 편의를 위한 분리이며, 제품의 URL 구조를 반영한 것이 아니다. 실제 제품에서는 이 네 화면이 전부 같은 문서 안에서 내용만 교체되며 그려진다.

## 화면 ↔ SCR ↔ IA 매핑표

| 목업 파일 | 화면명 | SCR 코드 | 단계(stage) | 관련 IA | 관련 서비스(SVC) | 트리거 PROC |
|---|---|---|---|---|---|---|
| [`SCR-001.html`](SCR-001.html) | 본인확인 | SCR-001 | `IDENTITY` | `USR-01` · `USR-03` | SVC-001 · SVC-002 | PROC-102 |
| [`SCR-002.html`](SCR-002.html) | 동의·승인 | SCR-002 | `CONSENT` | `USR-04` | SVC-003 | PROC-103 |
| [`SCR-003.html`](SCR-003.html) | 연동 진행 안내 | SCR-003 | `PROCESSING`(화면 소유) | `USR-02` | SVC-004 | 없음(인터랙션 없음) |
| [`SCR-004.html`](SCR-004.html) | 연동 결과 안내 | SCR-004 | `RESULT` | `USR-05` | SVC-005 | 없음(액션 없음) |
| [`index.html`](index.html) | 열람 허브 | — | — | — | — | — |

- 화면 사양 정본: [`docs/specs/screens/spec-screens.md`](../docs/specs/screens/spec-screens.md) · `screen_SCR-001.md`~`screen_SCR-004.md`.
- 디자인 정본: [`design-system.md`](../docs/specs/screens/design-system.md) · [`design-system-components.md`](../docs/specs/screens/design-system-components.md).
- `USR-02`(연동 실행)는 승인 이후 서버 처리이며 사용자에게는 SCR-003 의 대기 표시로만 나타난다 — 별도 화면을 갖지 않는다.

## 열람 방법

1. `mockup/index.html` 을 브라우저로 직접 연다(더블클릭 또는 `file://` 경로 열기) — 인터넷 연결이 없어도 된다. 외부 자원(CDN·웹폰트·이미지)을 쓰지 않는다.
2. 허브에서 카드를 클릭해 원하는 화면으로 이동하거나, 각 화면 상단의 **목업 전용 도구모음**(어두운 바탕 + 노란 테두리)으로 다른 화면·허브를 오간다.
3. 각 화면 도구모음의 **상태 전환 버튼**을 눌러 사양에 정의된 화면 상태·변형을 하나씩 확인한다(§시연한 상태·변형 참고). 일부 화면(SCR-001·SCR-002)은 실제 입력 필드·체크박스도 조작할 수 있다(값 검증·API 호출 없음 — 외형만 반응).
4. 도구모음은 **목업 전용**이며 "목업 전용 — 제품 UI 아님" 라벨이 항상 붙어 있다. 카드 안쪽 흰 영역만 실제 화면 사양이다.
5. Redmine 첨부로도 같은 파일 5종(html 4 + 이 문서)이 미러링되어 있다 — 목업 일감(§Redmine 미러 참고)에서 내려받아 열어도 된다.

## 화면 흐름 요약

정본은 [`spec-screens.md`](../docs/specs/screens/spec-screens.md) §화면 간 이동 경로. 모든 전환은 서버 응답이 결정하며 화면이 스스로 단계를 건너뛰지 않는다.

1. 발송처 링크 진입 → 구조 판정 통과 시 **SCR-001**, 진입 자체가 실패(`EX-SEC-001`·`EX-SEC-004`)면 **SCR-004(경로 ③)**.
2. **SCR-001** 확인 제출 → 성공(`stage=CONSENT`)이면 **SCR-002**, 확정 결과 재안내나 오류(`EX-SEC-001`·`EX-SEC-002`)면 **SCR-004**, 형식·재입력·처리 오류는 **SCR-001 유지**.
3. **SCR-002** 승인 클릭(필수 동의 충족 시 항상) → **SCR-003**. 거부 클릭 → 진행 화면 없이 바로 **SCR-004(경로 ②)**. 필수 미충족·처리 오류는 **SCR-002 유지**. 재복호화 실패(`EX-AUTH-001`·`EX-AUTH-002`)는 **SCR-001** 로 되돌아간다(재입력 안내).
4. **SCR-003** 은 조작 요소가 없다 — 응답 수신으로만 다음 화면이 정해진다. 결과 확정(경로 ①·③·④)은 **SCR-004**, `EX-BIZ-001`·`EX-BIZ-003` 은 **SCR-002**, `EX-AUTH-001`·`EX-AUTH-002` 는 **SCR-001** 로 되돌아간다. 응답 미수신은 같은 화면에서 `Unconfirmed` 안내만 한다.
5. **SCR-004** 는 여정의 끝이다 — 이동 수단이 없다. 새로고침·같은 링크 재진입은 항상 **SCR-001** 부터 다시 시작하고(세션 없음), 결과가 확정된 추적 키라면 본인확인 통과 후 다시 **SCR-004**(확정 결과 재안내)로 온다.
6. 뒤로 가기로 단계를 되돌릴 수 없다 — 리다이렉트를 쓰지 않아 브라우저 이력에 단계가 쌓이지 않는다.

각 화면 파일 하단의 "화면 흐름" 박스(점선 테두리)에서 위 전환을 실제 링크로 클릭해 볼 수 있다.

## 시연한 상태·변형

목업 지시(§3) 항목별 구현 여부. 전환은 각 화면 상단 도구모음의 버튼으로 조작한다.

### SCR-001 본인확인 — 6개 상태

| 상태 | 사양 대응 | 비고 |
|---|---|---|
| 초기 | Initial | 빈 입력, 알림 없음 |
| 입력 중 | Editing | 샘플 값 입력됨(보너스 — §3 필수 항목 아님) |
| 확인 중(로딩) | Submitting | 버튼 Spinner+"확인 중", 필드 잠금(readonly) |
| 입력 오류(형식) | ReEntry(형식) | `EX-AUTH-001` 기본 문구, 필드 경계 danger |
| 재입력 안내(불일치) | ReEntry(불일치) | `EX-AUTH-002` 기본 문구, **값 유지 + 전체 선택**(실제 `input.select()` 호출), 시도 횟수 미표시 |
| 처리 오류 | Retryable | `EX-BIZ-003` 기본 문구, 버튼 재활성 |

§3 요구 5항목(초기·로딩·입력오류·재입력안내·처리오류) 전건 구현. 실제 "확인" 버튼 클릭도 확인 중 상태로 전환된다.

### SCR-002 동의·승인 — 6개 상태

| 상태 | 사양 대응 | 비고 |
|---|---|---|
| 초기(미동의) | Initial | 안내 문구 표시, 미체크 → 승인 버튼 `aria-disabled="true"` |
| 동의 완료 | Initial(체크됨) | 승인 버튼 활성 — 비활성과 대비해 시연 |
| 안내 문구 없음 | (빈 값 변형) | NoticeBlock **영역 자체를 렌더하지 않음**(`EXC-BIZ-07`) — §3 명시 요구 |
| 필수 동의 미충족 오류 | Blocked | `EX-BIZ-001` 문구, 승인 버튼 비활성 |
| 거부 처리 중 | SubmittingReject | 보조 버튼 Spinner+"처리 중", 목록 잠금(체크박스 disabled) |
| 처리 오류 | Retryable | `EX-BIZ-003` 문구, 체크 상태 유지 |

§3 요구 4항목(안내 영역 미렌더 변형·목록 렌더·승인 버튼 비활성·"되돌릴 수 없음" 한 줄) 전건 구현. 체크박스를 직접 클릭해도 승인 버튼 활성 여부가 실시간 반영된다. "동의하고 연동하기"(활성 시)·"동의하지 않고 종료"는 실제로 SCR-003·SCR-004 로 이동한다.

### SCR-003 연동 진행 안내 — 2개 상태

| 상태 | 사양 대응 | 비고 |
|---|---|---|
| 대기·진행 표시 | Waiting | Spinner(32px)+제목+보조 문구, `role="status"`·`aria-busy="true"`, 조작 요소 0 |
| 응답 미수신(Unconfirmed) | Unconfirmed | 위 표시에 InlineAlert 추가(재진입 안내), 다섯 번째 결과 경로 아님 |

§3 요구 2항목(대기·진행 표시 · Unconfirmed) 전건 구현. 이 화면은 사양대로 버튼이 전혀 없다.

### SCR-004 연동 결과 안내 — 경로 4종 × 사유 4종(경로③) × 재안내 on/off

| 축 | 값 |
|---|---|
| 결과 경로 | ① 연동 완료 / ② 사용자 거부 / ③ 링크·복호화 오류 / ④ 수신처 전달 실패 |
| 경로 ③ 사유(하위 토글) | `EX-SEC-001`·`EX-SEC-004`·`EX-SEC-002`·`EX-OPS-002` 기본 문구 4종(제목·아이콘·색은 동일) |
| 확정 결과 재안내 | 배지 "이미 처리된 요청입니다"(제목 바로 아래) + 설명 문단 끝 한 문장, on/off 토글(**경로 ①·②·④ 한정** — 경로③ 선택 시 토글 비활성화·자동 해제) |

§3 요구(결과 4경로 전부 + 확정 결과 재안내 배지 변형) 전건 구현, 다섯 번째 경로 없음(`BIZ-001-02`). 경로③ 은 사유 4종까지 하위 토글로 시연해 요구 범위를 넘겨 구현했다. **경로③ 은 확정 결과 재안내 대상이 아니다**(`EXC-BIZ-14` 확정 — §사양 보완 후보 1) — 화면은 경로③ 선택 시 재안내 토글을 비활성화하고 안내 문구를 보여준다.

## 디자인 근거

정본은 [`design-system.md`](../docs/specs/screens/design-system.md). 목업은 아래 값을 하드코딩으로 그대로 반영했다(throwaway 이므로 CSS 커스텀 속성 이름은 정본과 동일하게 유지하되 토큰 파일을 분리하지 않았다).

- **색 토큰 23종** — `--color-*` 전량을 각 파일 `:root` 에 원문 16진수 값 그대로 포함(예: `--color-primary:#1F5EAE`). design-system.md §색 대비 검증 실측 24행이 보장하는 조합(본문 4.5:1·경계/아이콘 3:1)만 사용했고 임의 색을 추가하지 않았다.
- **결과 4경로 시각 구분 3중(색+아이콘+제목)** — 아이콘은 전량 인라인 SVG(`aria-hidden="true"`), 거부(②)는 danger 가 아닌 `--color-neutral` 중립 회청색 사용.
- **모바일 우선 단일 컬럼** — 브레이크포인트 2개(`480px`·`768px`)를 그대로 구현. 기본(0~479px) 카드 패딩은 수직 `--space-lg`/수평 `--space-md` 비대칭, `480px` 이상은 카드 최대폭 440px+패딩 균일 `--space-lg`, `768px` 이상은 카드 최대폭 480px(`--size-content-max`).
- **터치 히트 영역 44×44** — 버튼 높이 `--size-control-height`(48px), 동의 항목 행 `min-height:var(--size-hit-min)`(44px), 행 전체가 레이블.
- **입력 글자 16px 하한** — 생년월일 입력 `--font-size-lg`(18px)로 하한을 상회.
- **포커스 표시** — `:focus-visible` 전역 적용, 채워진 버튼 위에서는 흰 안쪽 링(2px)+포커스색 바깥 링(box-shadow)으로 이중 표시.
- **외부 자원 0** — 시스템 글꼴 스택 + 인라인 SVG + 인라인 `<style>`/`<script>` 뿐이며 CDN·웹폰트·이미지 링크가 없다. 오프라인에서 그대로 열린다.
- **감소 모션** — `prefers-reduced-motion: reduce` 에서 Spinner 회전 주기를 0.9초 → 1.6초로 늦춘다(제거하지 않음).

## 사양 보완 후보 — 처리 결과

목업 제작 중 발견한 모호·누락·상충 3건을 spec 오케스트레이터에 보고했고, **전건 처리·반영이 완료**됐다(`accountinterlockhub#477` 후속 라운드 — 사양 commit `1c098b5`·`c9a48e5`). 각 항목의 확정 내용·근거·목업 반영 결과를 기록한다.

### 1. 경로 ③ + 확정 결과 재안내 조합 — 해소(구조적으로 도달 불가로 확정)

- **확정 내용**: 추적 키는 복호화 판정 3·4단계 통과로만 얻어지는데, `DECRYPT_FAILED`(경로 ③)를 만드는 실패가 바로 그 3·4단계 실패라 추적 레코드 자체가 만들어지지 않는다(허브에 세션이 없어 앞 요청의 키를 이어받을 수도 없다). **재안내 배지가 붙는 경로는 ①·②·④ 뿐이며 경로 ③ 은 재안내 대상이 아니다.**
- **근거**: [`policy_BIZ.md`](../docs/specs/policies/policy_BIZ.md) `EXC-BIZ-14`(신설) · [`screen_SCR-004.md`](../docs/specs/screens/screen_SCR-004.md) §확정 결과 재안내("대상 경로 — ①·②·④ 뿐") · [`process_PROC-105.md`](../docs/specs/processes/process_PROC-105.md)(`RECORD` 출처가 싣는 값은 `SUCCESS`·`USER_DENIED`·`DELIVERY_FAILED` 뿐 — `DECRYPT_FAILED` case 는 방어적 분기로 표기) · [`data_ENT-001.md`](../docs/specs/datas/data_ENT-001.md) 컬럼 주석.
- **목업 반영**: `mockup/SCR-004.html` — 경로 ③ 선택 시 "확정 결과 재안내로 보기" 체크박스를 `disabled` 처리하고 자동 해제하며, "경로 ③ 은 확정 결과 재안내 대상이 아닙니다(`EXC-BIZ-14`)" 안내 문구를 노출한다. 이전에 띄워 두었던 노란 경고 배너는 제거했다(사양이 확정돼 더 이상 미해소 항목이 아니다).

### 2. SCR-001 처리 오류(EX-BIZ-003) 인라인 알림의 위치 서술 차이 — 해소(목업 구현대로 확정, 변경 불요)

- **확정 내용**: 인라인 알림은 오류 유형(입력·처리)과 무관하게 **화면 사양이 고정한 알림 영역 한 곳**(본문 영역 아래·액션 영역이 있으면 그 위)에만 나타난다. design-system.md 의 "카드 상단" 서술은 폐기됐다.
- **근거**: [`design-system.md`](../docs/specs/screens/design-system.md) §상태 표현("인라인 알림의 위치는 오류 유형에 따라 달라지지 않는다") · [`design-system-components.md`](../docs/specs/screens/design-system-components.md) §InlineAlert "위치".
- **목업 반영**: 목업은 처음부터 이 방식(입력 아래 단일 알림 영역)으로 구현돼 있었다 — **파일 변경 불요**. 사양이 목업 구현에 맞춰 확정됐다.

### 3. ConsentList "잠금(제출 중)" 상태의 구체적 시각 처리 — 해소(비활성 토큰 쌍으로 확정)

- **확정 내용**: 잠금 상태는 `opacity` 로 흐리지 않는다(전경·배경을 함께 옅게 만들면 실측 대비비가 무효화되므로 금지). 대신 행 바탕 `--color-disabled-bg`·항목명/설명/체크 표시 글자 `--color-disabled-fg`(버튼 비활성과 **같은 토큰 쌍**, 대비비 4.82:1 재사용)로 표현한다. 체크 상태·구분선·행 높이·`필수` 배지는 그대로 두고, 목록 컨테이너에 `aria-busy="true"`·체크박스에 `disabled`(`aria-disabled` 아님 — 잠금 중엔 안내할 것이 없다)를 준다.
- **근거**: [`design-system-components.md`](../docs/specs/screens/design-system-components.md) §ConsentList·ConsentItem(갱신) · [`design-system.md`](../docs/specs/screens/design-system.md) §색 대비 검증(4.82:1 용도에 "잠금 동의 목록 글자" 추가) · §상태 표현("비활성" 행).
- **목업 반영**: `mockup/SCR-002.html` — `.consent-list.locked{opacity:.6}` 를 제거하고 `--color-disabled-bg`(행 바탕)·`--color-disabled-fg`(항목명·설명·체크 `accent-color`)로 교체, 목록 컨테이너에 `aria-busy="true"` 를 추가했다. `pointer-events:none`·체크박스 `disabled`·`필수` 배지 원 색상은 그대로 유지했다.

## Redmine 미러

목업 일감(부모 `accountinterlockhub#469`)에 html 4종 + 본 문서가 첨부로 미러링되어 있다. 정본은 항상 이 워크스페이스 파일이며, 내용이 바뀌면 일감 첨부는 최신 파일로 교체한다([`work-tracking.md`](../ai/strategies/work-tracking.md)).
