# 디자인 시스템 정의 — AccountInterlockHub

본 문서는 AccountInterlockHub 의 관리자 웹·사용자 웹 전반에 적용하는 디자인 시스템(토큰·공통 컴포넌트·레이아웃·상태 표현·접근성)을 정의한다. spec 단계 화면 도메인 산출물이며, 개별 화면([`spec-screens.md`](spec-screens.md) 하위 `screen_SCR-*.md`)은 본 문서의 토큰·컴포넌트를 인용한다. 특정 프레임워크·라이브러리를 강제하지 않고 React(TypeScript) SPA 구현에 필요한 요구사항만 정의한다.

> **2026-07-11 `#214` 개정**: 사용자 접근·동의 화면(SCR-005)에 **생년월일 입력**과 연동 실행 상태(복호화 실패 재입력·전달 실패·링크 오류·완료)를 반영해 `TextField(birthdate)` 변형·§사용자 연동 실행 상태 표현·민감값(encX·encY·생년월일) 미노출 규칙을 추가했다. 관리자 폼의 전달 파라미터·사용자 키값 지정 입력(`#33`)이 폐기돼 `RepeatableRows` 사용처를 동의 항목으로 한정했다.
>
> **2026-07-12 `#215` 개정(목업 리뷰 보완)**: 복호화 실패 문구를 "사용자 정보가 일치하지 않습니다."로 고정(FE 형식 안내와 구분)하고, **전달 실패(EX-BIZ-004)를 SCR-006 결과 화면에서 SCR-005 재시도 `Banner`("동의 처리에 실패했습니다. 다시 시도해주세요.")로 이관**했다(SCR-006 `Badge` 변형에서 전달실패 제거). 거부 배지는 info(청록)로 확정(변경 없음).
>
> **2026-07-18 `#408` 개정(사용자 페이지 시각 개선)**: 사용자 화면(SCR-005·006)의 시각 폴리시를 위해 **§사용자 표면 확장**을 신설했다 — 접두어 `-u-` 사용자 전용 토큰(색·타이포·간격·형태·모션), 배경·전경·경계 3종 색 조합과 실제 렌더 조합을 등재한 대비 실측표, 컴포넌트 사용자 변형, 결과 상태 아이콘 규격, 콘텐츠 상한·오버플로 수치를 확정했다. 사용자 화면 오류 문구의 정본이 화면 정의서임을 §상태 표현 규칙에 명시하고, `Badge` 사용자 변형의 토큰 매핑을 확정했다.
>
> 전역 영역의 변경 범위는 다음과 같다. **전역 토큰(§디자인 토큰)의 키·값은 0건 변경**해 관리자 화면(SCR-001~004)의 렌더가 불변이다. 다만 §공통 컴포넌트의 두 행은 **규칙 문구를 고쳤다** — (1) `Button` 의 "최소 터치 영역 40x40px" 에 *히트 영역과 가시 높이는 별개이며 `sm` 은 투명 여백으로 히트 영역을 확장한다* 는 해석을 명문화했다(변형 값·크기 수치는 불변, 관리자 화면에 `sm` 인용처가 없어 실제 렌더 영향 0건), (2) `Badge` 행을 관리자 변형(active·inactive)과 사용자 변형으로 나눠 기술했다(관리자 변형의 렌더·의미 불변). 기능·플로우·민감값 노출 규칙은 불변이다.

## 적용 원칙

- **2개 표면 1개 시스템**: 관리자 웹(구성 관리)과 사용자 웹(동의)은 동일 토큰·컴포넌트를 공유한다. 관리자는 정보 밀도 높은 좌우 넓은 레이아웃, 사용자는 단일 중앙 카드 레이아웃으로 배치만 달리한다.
- **표면 한정 확장은 신설로**: 한 표면(관리자·사용자)에만 적용할 시각 요구는 전역 토큰 값을 고치지 않고 접두어 `-u-`(user) 토큰·사용자 변형을 신설해 해결한다(§사용자 표면 확장). 전역 토큰 값 변경은 두 표면 모두의 렌더를 바꾸므로 담당자 확인 사항이다.
- **정책 반영**: 민감값 마스킹(SEC-005)·역할별 노출 제어(AUTH·SEC-001)를 컴포넌트·상태 규칙에 반영한다. 관리자 연동 구성은 설정 데이터로 마스킹 대상이 아니다(EXC-SEC-05).
- **무모호 수치**: 간격·크기·대비는 모두 수치로 규정한다.

## 디자인 토큰

### 색상 팔레트

| 토큰 | 값(HEX) | 용도 |
|------|---------|------|
| `color-primary` | #2563EB | 주요 액션 버튼·링크·활성 강조 |
| `color-primary-hover` | #1D4ED8 | 주요 버튼 hover |
| `color-primary-weak` | #DBEAFE | 선택 배경·정보 강조 배경 |
| `color-danger` | #DC2626 | 삭제·오류·파괴적 액션 |
| `color-danger-weak` | #FEE2E2 | 오류 배경·삭제 확인 강조 |
| `color-success` | #16A34A | 성공 토스트·완료 상태 배지 |
| `color-warning` | #D97706 | 경고(개인정보 파라미터 등) |
| `color-info` | #0891B2 | 안내·중립 정보 |
| `color-text` | #111827 | 본문 기본 텍스트 |
| `color-text-muted` | #6B7280 | 보조 설명·placeholder·비활성 라벨 |
| `color-text-inverse` | #FFFFFF | 채색 버튼 위 텍스트 |
| `color-border` | #D1D5DB | 입력·카드·테이블 경계 |
| `color-bg` | #FFFFFF | 카드·표면 배경 |
| `color-bg-subtle` | #F9FAFB | 페이지 배경·테이블 헤더 |
| `color-disabled-bg` | #E5E7EB | 비활성 컨트롤 배경 |

- 대비 기준: 본문 텍스트(#111827) / 배경(#FFFFFF) 대비 ≥ 15:1, 보조 텍스트(#6B7280) / 배경 ≥ 4.5:1(WCAG AA 본문 충족). 채색 버튼은 텍스트(#FFFFFF)/배경 대비 ≥ 4.5:1 을 만족하는 값만 사용.

### 타이포그래피

| 토큰 | 크기/행간 | 굵기 | 용도 |
|------|-----------|------|------|
| `font-family-base` | system-ui, sans-serif | - | 전 화면 기본(한국어 우선 렌더) |
| `text-display` | 28px / 36px | 700 | 페이지 대표 제목 |
| `text-h1` | 22px / 30px | 700 | 화면 제목 |
| `text-h2` | 18px / 26px | 600 | 섹션 제목·카드 제목 |
| `text-body` | 15px / 22px | 400 | 본문·입력 값 |
| `text-label` | 14px / 20px | 500 | 폼 라벨·테이블 헤더 |
| `text-caption` | 13px / 18px | 400 | 보조 설명·에러 메시지·메타 |

### 간격·라운딩·그림자

| 구분 | 토큰·값 |
|------|---------|
| 간격 스케일 | `space-1` 4px · `space-2` 8px · `space-3` 12px · `space-4` 16px · `space-6` 24px · `space-8` 32px · `space-12` 48px |
| 컴포넌트 내부 여백 | 입력·버튼 상하 10px·좌우 14px, 카드 24px, 모달 24px |
| 요소 간격 | 폼 필드 간 16px, 섹션 간 32px, 반복 행 간 12px |
| 라운딩 | `radius-sm` 4px(배지·태그) · `radius-md` 8px(버튼·입력·카드) · `radius-lg` 12px(모달) |
| 그림자 | `shadow-sm` 0 1px 2px rgba(0,0,0,.06) · `shadow-md` 0 4px 12px rgba(0,0,0,.10) · `shadow-lg` 0 12px 32px rgba(0,0,0,.16) |

## 공통 컴포넌트

| 컴포넌트 | 변형·구성 | 규칙 |
|----------|-----------|------|
| `Button` | primary·secondary·danger·ghost / size md(높이 40px)·sm(32px) | 로딩 시 스피너+`disabled`, 파괴적 액션은 danger 색. 최소 터치 영역 40x40px — 이는 **히트(포인터 대상) 영역** 기준이며 가시 높이와 별개다. 가시 높이가 40px 미만인 변형(`sm`)은 투명 여백으로 히트 영역을 40x40px 이상까지 확장한다 |
| `TextField` | text·url·password·number·**birthdate** | 라벨(상단)+입력+에러 캡션 3단. 에러 시 경계 `color-danger`, `aria-invalid=true`, 에러 캡션 `role=alert`. `birthdate` 변형=6자리 숫자(`inputMode=numeric`·`maxLength=6`·YYMMDD 플레이스홀더), 본인확인용 민감값이라 값을 로그·URL·타 화면에 노출하지 않고 제출 본문으로만 전송(SCR-005·AUTH-004·SEC-005-06) |
| `Select` | 단일 선택(enum) | 허용값 목록 바인딩(예: HTTP 메서드) |
| `Checkbox` | 단일·목록 | 동의 항목·필수 여부 등 불리언 입력. 라벨 클릭 영역 포함 |
| `Toggle` | 활성/비활성 | 구성 활성 상태 전환. 상태 라벨 병기 |
| `RepeatableRows` | 행 추가·삭제·순서 | 동의 항목 동적 입력(전달 파라미터 입력은 `#214` 로 폐기). 각 행은 필드 그룹+삭제 버튼, 하단 "행 추가" 버튼. 최소 1행 유지(BIZ-001-04) |
| `Table` | 헤더·행·행 액션·정렬 | 목록 표시. 행 hover 강조, 행 클릭=상세 이동. 헤더 배경 `color-bg-subtle` |
| `Card` | 제목·본문·액션 | 상세·동의 화면의 정보 묶음. `shadow-sm`, `radius-md` |
| `Modal` | 확인·경고 / 콘텐츠(약관 상세) | 확인·경고: 삭제 확인 등 파괴적 액션 확인(danger·secondary 액션). 콘텐츠: 제목+스크롤 본문(`max-height` 내 `overflow-y:auto`)+하단 액션. 공통: 배경 스크림, ESC·배경 클릭 닫기, 포커스 트랩. 약관 상세 변형은 하단 [동의](primary)·[닫기](secondary)를 두며 [동의]=호출 항목 동의 처리 후 닫기·[닫기]=닫기만(SCR-005·BIZ-002-05·EXC-BIZ-08) |
| `Toast` | success·error·info | 저장·삭제·전환 결과 알림. 4초 자동 소멸, `aria-live=polite` |
| `Badge` | **관리자 변형** active(초록)·inactive(회색) / **사용자 변형** 완료·거부·링크오류·Fallback | 관리자 변형은 구성 활성 여부 표기로 현행 렌더·의미를 유지한다. 사용자 변형은 SCR-006 결과 유형 표기이며 `Badge(user)` 3종 토큰 쌍을 쓴다(§사용자 표면 확장) — 완료=`color-u-success-*`·거부=`color-u-info-*`(중립, 오류 아님)·링크오류=`color-u-danger-*`·Fallback=`color-u-neutral-*`. 라벨 원문은 [`screen_SCR-006.md`](screen_SCR-006.md) §고정 문구 정본이 정본이다. 전달 실패는 `#215` 로 SCR-005 의 `Banner`(재시도 알림)로 이관 |
| `Banner` | info·warning·error | 화면 상단 안내(세션 만료·개인정보 경고·전달 실패 안내) |
| `Spinner`·`Skeleton` | 로딩 표현 | 초기 로딩=Skeleton, 액션 대기=Spinner |
| `EmptyState` | 아이콘·안내·CTA | 목록 0건 시 안내+생성 유도 |
| `AdminNav` | 상단 바(제품명·계정·로그아웃) | 관리자 화면 공통 헤더. 인증 세션에서만 렌더 |

## 레이아웃·반응형

- **관리자 셸(SCR-001~004)**: 상단 헤더(높이 56px, `AdminNav`) + 본문 컨테이너(최대 폭 1120px, 좌우 중앙 정렬, 좌우 여백 24px). 로그인 화면(SCR-001)은 헤더 없이 중앙 카드.
- **사용자 셸(SCR-005~006)**: 헤더 없는 단일 중앙 카드(최대 폭 480px, 상하 여백 `space-u-shell-y` — ≥640px 48px / <640px 24px). 모바일 진입 비중이 높아 단일 컬럼 우선. 카드 자체의 형태·내부 여백은 §사용자 표면 확장의 `Card(user)` 가 정본이다.
- **그리드**: 관리자 폼은 12컬럼 기준, 데스크톱에서 라벨-입력 2컬럼 가능. 목록 테이블은 가로 스크롤 컨테이너(`overflow-x:auto`)로 좁은 폭 보호.
- **브레이크포인트**: `mobile` < 640px · `tablet` 640~1024px · `desktop` > 1024px.
	- mobile: 관리자 테이블은 주요 열(구성명·활성·액션)만 노출하고 나머지 접기, 폼은 1컬럼. 사용자 카드는 좌우 여백 16px 로 전체 폭.
	- desktop: 관리자 폼 2컬럼, 테이블 전체 열 노출.

## 상태 표현 규칙

| 상태 | 표현 | 적용 |
|------|------|------|
| 초기(Initial) | Skeleton 블록(목록 행 3개·폼 필드 골격) | 페이지 mount 직후 |
| 로딩(Loading) | 액션 버튼 Spinner + 폼/버튼 `disabled` | API 응답 대기 |
| 로드(Loaded) | 데이터 렌더링 | 200 응답 |
| 빈 상태(Empty) | `EmptyState`(안내 문구 + 생성 유도 CTA) | 목록 0건 |
| 에러(Error) | `Banner`(error) 또는 인라인 에러 캡션 + 재시도 버튼 | 4xx/5xx 응답 |
| 비활성(Disabled) | `color-disabled-bg` 배경, 커서 not-allowed | 조건 미충족 컨트롤 |

- 에러 메시지는 공통 에러 엔벨로프([FN-015](../functions/function_FN-015.md))의 `error.message` 를 사용자 문구로 노출하고, `error.details`(필드 오류 배열)는 해당 입력 필드의 에러 캡션에 매핑한다.
- **사용자 화면 문구 정본(SCR-005·006 한정 예외)**: 사용자 화면 오류·결과 문구의 정본은 각 화면 정의서([`screen_SCR-005.md`](screen_SCR-005.md)·[`screen_SCR-006.md`](screen_SCR-006.md))의 고정 문구다. 화면 정의에 문구가 지정된 EX 코드는 엔벨로프 `error.message` 를 노출하지 않고 **화면 정의 고정 문구를 그대로 표시**하며, 화면 정의에 매핑이 없는 코드에 한해 `error.message` 를 폴백으로 노출한다. `error.details` 는 어느 필드에 오류가 있는지 판별하는 데만 쓰고, 노출 문구는 해당 필드의 고정 문구로 치환한다. 고정 문구는 띄어쓰기까지 원문 그대로 복제하며 임의 정규화·의역·요약을 금지한다. 본 문서는 사용자 문구를 정의하지 않는다(중복 정의 금지).

### 사용자 연동 실행 상태 표현 (SCR-005·006)

암호화 연동 플로우(승인→허브 복호화→수신처 전달)의 결과·실패 상태를 사용자 화면에 일관되게 표현한다(`#214`). 상태 색은 항상 텍스트 라벨과 병기한다(§접근성).

| 상태 | 표현 | 화면 | 관련 코드 |
|------|------|------|-----------|
| 본인확인 입력 | 생년월일 `TextField(user/birthdate)` + 안내 캡션 | SCR-005 | AUTH-004 |
| 제출 대기(Submitting) | 승인/거부 버튼 Spinner + 폼 `disabled` | SCR-005 | PROC-202 |
| 복호화 실패·재입력 | 생년월일 필드 인라인 에러(`role=alert`, "사용자 정보가 일치하지 않습니다.") + 필드 재활성·재제출 허용(화면 유지). FE 형식 위반 안내와 문구 구분 | SCR-005 | EX-SEC-006(BR-204) |
| 링크 오류(재입력 불가) | danger `Badge(user)` + 발송처 문의 안내(입력 폼 없음) | SCR-006 | EX-SEC-007·EX-BIZ-008 |
| 전달 실패(재시도) | danger `Banner(user)` + "동의 처리에 실패했습니다. 다시 시도해주세요." + 승인 재제출(재승인) 허용(화면 유지) | SCR-005 | EX-BIZ-004(`#215`) |
| 연동 완료 | success `Badge(user)` + 완료 안내(원문·회원 키·추적 키 미포함) | SCR-006 | BIZ-003-05·SEC-007-02 |
| 거부(취소) | info(중립) `Badge(user)` + 취소 안내 | SCR-006 | BIZ-002-07(EXC-BIZ-03) |
| 결과 없음(Fallback) | neutral `Badge(user)` + 중립 안내 + 발송처 재진입 유도 | SCR-006 | (표시 규칙) |

- 복호화 실패·전달 실패는 **화면을 이탈하지 않고**(SCR-005 유지) 각각 생년월일 재입력·승인 재제출로 재시도를 유도하고, 발송처 데이터·링크 오류(형식·추적 키 누락)는 재입력이 무의미하므로 결과 화면(SCR-006)으로 종료 안내한다(EXC-BIZ-13, `#215`).

## 마스킹·노출 제어(정책 반영)

- **민감값 마스킹(SEC-005)**: 회원 키·연동 추적 키·인증 자격을 화면에 표시할 경우 앞 2·뒤 2자만 노출(SEC-005-01·04). 단, MVP 화면 중 회원 키·추적 키를 표시하는 화면은 없다(사용자 동의·결과 화면 미표시, 처리상태 조회는 화면 없는 API-01). 처리상태 조회 응답은 상태 4항목만 포함(SEC-005-02).
- **암호값·생년월일 전량 미노출(`#214`·SEC-005-06·SEC-006-06)**: encX·encY 는 URL 파라미터로 수신하되 화면에 렌더하지 않고 승인 제출 본문으로만 전송한다(SCR-005). 생년월일은 입력 필드 값으로만 두고 화면 에코·로그·URL 에 남기지 않는다. 복호화 원문 X·회원 키는 서버-서버로만 다뤄져 사용자 화면(완료 페이지 포함)에 존재하지 않는다(SEC-007-02).
- **관리자 구성 데이터 예외(EXC-SEC-05)**: 발송처 접근 주소 구성의 접근 주소 고유 ID·수신처 B 주소는 설정 데이터로 마스킹하지 않는다(전달 파라미터 정의는 `#214` 로 폐기).
- **역할별 노출**: 관리자 전용 컨트롤(구성 등록·활성 전환·삭제)은 인증 세션(AUTH-001)에서만 렌더한다. IP 차단(SEC-001)·미인증은 각각 접근 차단·로그인 유도로 처리한다.

## 접근성 기준

- **대비**: 본문·상호작용 텍스트는 WCAG AA(4.5:1) 이상, 큰 제목(≥ 22px)은 3:1 이상.
- **키보드 탐색**: 모든 상호작용 요소는 Tab 순회 가능. 포커스 링(2px `color-primary`, 오프셋 2px)을 항상 노출한다. 모달은 포커스 트랩·ESC 닫기.
- **스크린리더**: 폼 라벨은 `label for`/`aria-label` 연결, 에러는 `role=alert`, 토스트는 `aria-live=polite`, 로딩은 `aria-busy=true`.
- **의미 전달**: 상태를 색으로만 전달하지 않고 텍스트 라벨(활성/비활성·성공/거부/실패)을 병기한다.
- **터치 영역**: 상호작용 요소 최소 40x40px 확보.

## 사용자 표면 확장 (SCR-005·006 한정)

사용자 화면은 발송처 링크로 처음 도착한 사람이 **낯선 화면에서 생년월일을 입력**하는 신뢰 민감 구간이다. 그래서 장식성보다 **신뢰감·명료함·차분함**을 우선한다 — 저채도 배경 위 진한 전경으로 대비를 확보하고, 정보 위계를 제목 → 본인확인 → 동의 항목 → 액션 순으로 시각적으로 분리하며, 연출은 상태 변화 인지를 돕는 수준으로 절제한다. 본 절의 토큰·변형은 **사용자 화면(SCR-005·006)에만 적용**하며, 관리자 화면(SCR-001~004)은 전역 토큰·컴포넌트 정의 그대로 유지된다.

### 사용자 색 토큰

| 토큰 | 값(HEX) | 용도 |
|------|---------|------|
| `color-u-canvas` | #EEF2F7 | 카드 바깥 페이지 배경(카드 부양감) |
| `color-u-text-muted` | #5F6773 | 사용자 화면 **보조 텍스트 전용**(안내 문구·섹션 라벨·캡션·항목 설명·마무리 문구·placeholder) |
| `color-u-border` | #7D8698 | 입력·체크박스·배지·배너 등 **컴포넌트 식별 경계** 기본값 |
| `color-u-border-strong` | #4B5563 | hover 시 경계 강조 |
| `color-u-divider` | #DDE3EA | 섹션 구분선(**장식 전용** — 정보 단독 전달 금지) |
| `color-u-row-hover` | #F5F7FA | 동의 항목 행 hover 배경 |
| `color-u-row-selected` | #EFF4FE | 동의 항목 체크 상태 배경(경계는 `color-primary`) |
| `color-u-success-bg` · `-fg` · `-border` | #E7F6EC · #166534 · #15803D | 연동 완료 배지·결과 아이콘 |
| `color-u-info-bg` · `-fg` · `-border` | #E6F6FB · #155E75 · #0E7490 | 거부(취소) 배지·결과 아이콘 — 중립(오류 아님) |
| `color-u-danger-bg` · `-fg` · `-border` | #FEF2F2 · #B91C1C · #DC2626 | 링크 오류 배지·전달 실패 배너·입력 인라인 에러 |
| `color-u-neutral-bg` · `-fg` · `-border` | #F1F5F9 · #334155 · #64748B | Fallback 안내 |

- 3종 쌍의 역할: `-bg` 는 배지·배너·아이콘 원형의 **채움**, `-fg` 는 그 위의 **텍스트·글리프**, `-border` 는 1px **외곽선**이다. 채색 배경 위 흰 텍스트 조합은 사용자 화면에서 쓰지 않는다(연한 배경 + 진한 전경 원칙).
- **보조 텍스트는 `color-u-text-muted` 만 쓴다** — 사용자 화면에서 전역 `color-text-muted`(#6B7280)를 인용하지 않는다. 전역 값은 흰 배경(4.83:1)에서만 AA 를 넘고 동의 항목 행의 체크 배경(`color-u-row-selected`) 위에서는 4.38:1 로 미달하기 때문이다. 사용자 화면의 보조 텍스트는 흰 배경뿐 아니라 행 hover·행 선택 배경 위에도 얹히므로, 세 배경 모두에서 4.5:1 을 넘는 전용 값을 둔다(§대비 검증).
- 본문 계열 텍스트(제목·항목 라벨·입력 값·secondary 버튼 텍스트)는 전역 `color-text`(#111827)를 그대로 쓴다 — 세 배경 모두에서 16:1 이상이라 별도 사용자 토큰이 필요 없다. 보조 텍스트(#5F6773)와의 명도차로 정보 위계를 유지한다.
- 경고(warning) 계열은 사용자 화면에서 사용하지 않으므로 사용자 토큰을 두지 않는다.

### 대비 검증 (WCAG 2.2 AA 실측)

사용자 화면에서 **실제로 겹치는 전경·배경 조합**을 빠짐없이 등재한다. 사용자 화면에 존재하는 배경은 카드 #FFFFFF · 약관 모달 패널 `color-bg` #FFFFFF(`Modal(user/terms)` — 카드와 동일 값) · 페이지 `color-u-canvas` · 동의 항목 행의 `color-u-row-hover`·`color-u-row-selected` · 버튼 채움 `color-primary`(hover 시 `color-primary-hover`) · 배지·배너·결과 아이콘 채움 각 계열 `-bg` 로 한정되며, 아래 표는 그 각각에 얹히는 전경을 모두 나열한 것이다.

| 조합 | 대비비 | 기준 | 판정 |
|------|--------|------|------|
| `color-text` #111827(제목·항목 라벨·입력 값·secondary 버튼 텍스트) / 카드 #FFFFFF | 17.74:1 | 4.5:1 | ✅ |
| `color-text` / `color-u-row-hover` | 16.53:1 | 4.5:1 | ✅ |
| `color-text` / `color-u-row-selected` | 16.09:1 | 4.5:1 | ✅ |
| `color-text`(약관 모달 제목 `text-h2`·약관 본문) / `Modal(user/terms)` 패널 `color-bg` #FFFFFF | 17.74:1 | 4.5:1 | ✅ |
| `color-u-text-muted` #5F6773(안내 문구·섹션 라벨·캡션·항목 설명·마무리 문구) / 카드 #FFFFFF | 5.72:1 | 4.5:1 | ✅ |
| `color-u-text-muted` / `color-u-row-hover` | 5.33:1 | 4.5:1 | ✅ |
| `color-u-text-muted` / `color-u-row-selected` | 5.18:1 | 4.5:1 | ✅ |
| `color-text-inverse` / `color-primary`(승인 버튼·체크 글리프) | 5.17:1 | 4.5:1 | ✅ |
| `color-text-inverse` / `color-primary-hover`(승인 버튼 hover) | 6.70:1 | 4.5:1 | ✅ |
| `color-primary`([상세] ghost-link 텍스트·포커스 링·체크 채움·카드 액센트) / 카드 #FFFFFF | 5.17:1 | 4.5:1 | ✅ |
| `color-primary`(ghost-link 텍스트·포커스 링) / `color-u-row-hover` | 4.82:1 | 4.5:1 | ✅ |
| `color-primary`(ghost-link 텍스트·포커스 링·선택 행 경계) / `color-u-row-selected` | 4.69:1 | 4.5:1 | ✅ |
| `color-primary` 포커스 링 / `color-u-canvas` | 4.60:1 | 3:1 (비텍스트 1.4.11) | ✅ |
| `color-u-danger-fg` / 카드 #FFFFFF (인라인 에러 캡션) | 6.47:1 | 4.5:1 | ✅ |
| 각 계열 `-fg` / 같은 계열 `-bg` (배지·배너 텍스트·아이콘 글리프) | success 6.38 · info 6.55 · danger 5.91 · neutral 9.45 | 4.5:1 | ✅ |
| `color-u-border`(입력·체크박스·secondary 버튼 경계) / 카드 #FFFFFF | 3.66:1 | 3:1 | ✅ |
| `color-u-border`(항목 행 안 체크박스 경계) / `color-u-row-hover` | 3.41:1 | 3:1 | ✅ |
| `color-u-border`(항목 행 안 체크박스 경계) / `color-u-row-selected` | 3.32:1 | 3:1 | ✅ |
| `color-u-border-strong`(hover 경계) / 카드 #FFFFFF | 7.56:1 | 3:1 | ✅ |
| 각 계열 `-border` / 카드 #FFFFFF (배지·배너 외곽선 바깥쪽) | success 5.02 · info 5.36 · danger 4.83 · neutral 4.76 | 3:1 | ✅ |
| 각 계열 `-border` / 같은 계열 `-bg` (배지·배너 외곽선 안쪽) | success 4.49 · info 4.83 · danger 4.41 · neutral 4.34 | 3:1 | ✅ |

- 값은 WCAG 2.x 상대휘도 공식(sRGB 선형화 후 0.2126R+0.7152G+0.0722B, `(L밝음+0.05)/(L어두움+0.05)`)으로 산출한 실측치다.
- **본 표에 등재한 조합은 모두 기준을 충족한다.** 사용자 화면에 새 색 조합이 생기면(토큰 신설·기존 전경을 다른 배경 위에 얹는 배치 변경 포함) **본 표 등재와 계산값 기입을 필수**로 한다 — 등재되지 않은 조합은 미검증으로 간주한다.
- `Modal(user/terms)` 패널은 카드와 같은 `color-bg` #FFFFFF 라, 패널 위에 얹히는 나머지 전경(하단 [동의]/[닫기] 버튼의 `color-text-inverse` on `color-primary`·`color-text`·경계 `color-u-border`, 포커스 링 `color-primary`)의 대비는 위 "카드 #FFFFFF" 행이 같은 값으로 그대로 적용된다. 모달 스크림(rgba(17,24,39,.48))은 텍스트를 얹지 않는 장식 오버레이라 대비 기준 대상이 아니다.
- `ConsentItem(user)` 의 필수/선택 텍스트 태그는 각각 `color-text`·`color-u-text-muted` 를 쓰므로 위 카드·행 hover·행 선택 3개 배경 행이 그대로 적용된다(신규 조합 없음). 생년월일 라벨 우측의 "필수" 텍스트 태그도 같은 `color-text` / 카드 #FFFFFF 조합이라 신규 조합이 아니다.
- `color-u-canvas`(1.12:1)·`color-u-divider`(1.29:1)·각 `-bg`(1.09~1.12:1)·`color-u-row-hover`(1.07:1)·`color-u-row-selected`(1.10:1)는 **정보를 단독으로 전달하지 않는 장식**이라 1.4.11 대상이 아니다 — 구분선을 지워도 섹션 제목 텍스트로 구조를 알 수 있고, 배지 배경은 항상 텍스트 라벨·1px 경계와 병기되며, 행 배경은 체크박스 상태와 병기된다.
- 비활성 컨트롤(`color-disabled-bg`)은 WCAG 1.4.3·1.4.11 의 비활성 요소 예외라 대비 기준을 적용하지 않는다. 대신 비활성 사유를 항상 텍스트로 안내한다.

### 사용자 타이포·간격·형태

| 토큰 | 값 | 용도 |
|------|-----|------|
| `text-u-title` | 24px / 32px, 700, `color-text` | 카드 대표 제목(SCR-005 동의 제목, SCR-006 결과 제목) |
| `text-u-lead` | 15px / 24px, 400, `color-u-text-muted` | 제목 아래 안내 문구·결과 설명 문구(행간 1.6) |
| `text-u-section` | 13px / 18px, 600, 자간 0.04em, `color-u-text-muted` | 섹션 라벨("본인확인"·"동의 항목") |
| `text-u-item` | 15px / 22px, 500, `color-text` | 동의 항목 라벨 |
| `text-u-value` | 17px / 24px, 500, 자간 0.06em, `color-text` | 생년월일 입력 값(6자리 판독성) |
| `text-u-caption` | 13px / 18px, 400, `color-u-text-muted` | 보조 설명·항목 설명·안내 마무리 문구. 에러 캡션일 때만 `color-u-danger-fg` |
| `space-u-shell-y` | 48px(≥640px) / 24px(<640px) | 카드 상하 여백 |
| `space-u-card` | 28px(≥640px) / 20px(<640px) | 카드 내부 여백 |
| `space-u-section` | 28px | 섹션 간 간격 |
| `space-u-stack` | 12px | 섹션 내 요소 간 간격 |
| `radius-u-card` | 16px | 사용자 카드 |
| `radius-u-control` | 10px | 입력·버튼·항목 행·배너 |
| `radius-u-pill` | 999px | 배지 |
| `shadow-u-card` | 0 1px 2px rgba(16,24,40,.04), 0 12px 32px rgba(16,24,40,.08) | 사용자 카드 부양 |

- 사용자 셸 최대 폭 480px·단일 중앙 카드·단일 컬럼은 현행 유지한다(§레이아웃·반응형). `space-u-shell-y` 는 그 상하 여백의 브레이크포인트별 정의다.

### 모션

| 토큰 | 값 | 적용 |
|------|-----|------|
| `motion-u-fast` | 120ms | 색·경계 전환(버튼 hover·체크박스 토글·행 hover) |
| `motion-u-base` | 200ms | 카드·모달·배너·인라인 에러 등장 |
| `motion-u-slow` | 320ms | 결과 상태 아이콘 등장(SCR-006 진입 1회) |
| `ease-u-standard` | cubic-bezier(0.2, 0, 0, 1) | 일반 전환 |
| `ease-u-decelerate` | cubic-bezier(0, 0, 0, 1) | 등장(진입) 전환 |

- 지속시간과 이징은 짝지어 쓴다 — **상태 변화**(hover·포커스·체크 토글·색/경계 전환)는 `motion-u-fast`(필요 시 `motion-u-base`) + `ease-u-standard`, **요소 등장**(진입 시 처음 나타남)은 `motion-u-base`·`motion-u-slow` + `ease-u-decelerate` 를 적용한다.
- 등장 연출은 **불투명도 0→1 + Y축 8px 이동**만 사용한다(스케일·회전·바운스·패럴랙스 금지).
- 로딩 스피너는 800ms linear 무한 회전 1종만 쓴다.
- **`prefers-reduced-motion: reduce`** 이면 이동·회전 애니메이션을 제거하고 지속시간을 0ms 로 취급해 최종 상태를 즉시 렌더한다. 스피너는 회전 없이 정적으로 표시하고 `aria-busy=true` 와 진행 텍스트로 상태를 전달한다.

### 컴포넌트 사용자 변형

| 변형 | 규격 |
|------|------|
| `Card(user)` | 최대 폭 480px, `radius-u-card`, `shadow-u-card`, 배경 `color-bg`, 외곽선 없음. 상단 4px `color-primary` 액센트 라인(카드 상단 라운딩에 맞춤). 페이지 배경은 `color-u-canvas`, 내부 여백 `space-u-card` |
| `Button(user/primary·secondary)` | 높이 48px, `radius-u-control`, 텍스트 15px/600, 좌우 여백 20px. 폭 = 100%(<640px, 세로 스택) / 내용 맞춤(≥640px). primary=`color-primary` 채움 + `color-text-inverse`, secondary=`color-bg` 채움 + 텍스트 `color-text` + 1px `color-u-border`. hover 시 primary=`color-primary-hover`·secondary 경계=`color-u-border-strong`, 전환 `motion-u-fast`·`ease-u-standard` |
| `Button(user/ghost-link)` | 약관 [상세] 전용. 텍스트 13px/600 `color-primary`, 가시 높이 32px, **히트 영역 44x44px 이상**(상하 padding 6px·좌우 padding 10px·`min-height:44px`). 평상시 밑줄 없음, hover·focus 시 밑줄. 사용자 화면에서 전역 `Button` 의 `sm` 변형은 사용하지 않는다 |
| `TextField(user/birthdate)` | 높이 48px, `radius-u-control`, 1px `color-u-border`, 값 `text-u-value`, placeholder `color-u-text-muted`. focus=경계 `color-primary` + 포커스 링 2px·offset 2px. error=경계 `color-u-danger-border` + 캡션 `color-u-danger-fg`(`role=alert`) + `aria-invalid=true`, 입력 배경은 흰색 유지(배경 착색 금지 — 값 판독성 우선). 라벨 우측(간격 4px)에 **"필수" 텍스트 태그**를 둔다 — `ConsentItem(user)` 의 필수/선택 텍스트 태그와 동일 규격(13px/18px·700·`color-text`)이며 별표(`*`) 는 쓰지 않는다 |
| `Checkbox(user)` | 박스 20x20px, `radius-sm`, 2px `color-u-border`. 체크 시 `color-primary` 채움 + `color-text-inverse` 체크 글리프. 히트 영역 = 항목 행 전체(최소 높이 48px) |
| `ConsentItem(user)` | 동의 항목 1행. 좌측 `Checkbox(user)` + 우측에 라벨(`text-u-item`)·필수/선택 텍스트 태그·설명(`text-u-caption`)·[상세] `Button(user/ghost-link)`. **필수/선택 텍스트 태그는 항목 라벨 우측(간격 8px)에 "필수" 또는 "선택" 을 텍스트로 표기**하며 — 별표(`*`)·색·기호 단독 표기는 쓰지 않는다(§접근성 "상태를 색으로만 전달하지 않는다") — **`text-u-caption` 크기(13px/18px)를 쓰되 필수는 굵기 700·색 `color-text`(강조), 선택은 `text-u-caption` 기본값(400·`color-u-text-muted`)** 으로 둔다. 필수·선택은 텍스트 자체가 의미를 전달하므로 오류 계열(`color-u-danger-*`)을 쓰지 않고 굵기·명도 위계로만 구분한다. 행 여백 12px 14px, `radius-u-control`, 행 간격 8px. hover=`color-u-row-hover`, 체크 상태=`color-u-row-selected` + 1px `color-primary`, 전환 `motion-u-fast`·`ease-u-standard` |
| `Badge(user)` | `radius-u-pill`, 높이 28px, 좌우 여백 12px, 텍스트 12px/700. 배경 `-bg`·텍스트 `-fg`·1px `-border` 3종 쌍 적용(완료=success·거부=info·링크오류=danger·Fallback=neutral). 상태 텍스트 라벨을 항상 포함한다 |
| `Banner(user)` | 여백 14px 16px, `radius-u-control`, 배경 `-bg` + 1px `-border` + 텍스트 `-fg` 14px/20px. 좌측 20x20px 아이콘(글리프 색 `-fg` — 같은 계열의 텍스트와 동일 값, `aria-hidden=true`) + 문구. **danger 변형만 사용**한다 — 사용자 화면의 `Banner` 인스턴스는 전부 4xx/5xx 오류 알림(SCR-005 전달 실패·요청 제한·형식/크기, SCR-006 링크 오류)이라 `role=alert` 를 부여한다. 중립 안내는 `Badge(user)`·본문 문구가 담당하므로 success·info·neutral 변형은 두지 않는다 |
| `Modal(user/terms)` | 폭 = min(520px, 뷰포트 폭 − 32px), 최대 높이 = min(640px, 뷰포트 높이 − 64px). **패널 배경 `color-bg`**(카드와 동일 표면, 외곽선 없음). 헤더 64px(제목 `text-h2` · 색 `color-text`) · 본문 가변(`overflow-y:auto`, 최대 높이 = 모달 최대 높이 − 140px, **약관 원문 타이포 = `text-u-lead` 크기 15px/24px·400 + 색 `color-text`** — 동의 판단의 근거가 되는 읽기 본문이라 보조 색을 쓰지 않는다) · 액션 76px 고정(`Button(user/primary·secondary)`). `radius-lg`, 스크림 rgba(17,24,39,.48). 포커스 트랩·ESC·배경 클릭 닫기와 [동의]/[닫기] 동작은 전역 `Modal` 콘텐츠 변형 규칙 그대로 유지 |
| `ResultIcon(user)` | §결과 상태 아이콘 |

### 결과 상태 아이콘 (SCR-006)

| 결과 유형 | 원형 채움 | 글리프 형태(서술) | 글리프 색 |
|-----------|-----------|-------------------|-----------|
| 연동 완료 | `color-u-success-bg` | 체크 표시(꺾인 선 1개) | `color-u-success-fg` |
| 거부(취소) | `color-u-info-bg` | 가로 막대 1개 — 중립 종료(오류 기호·X 표 금지) | `color-u-info-fg` |
| 링크 오류 | `color-u-danger-bg` | 느낌표(세로 막대 + 점) | `color-u-danger-fg` |
| Fallback | `color-u-neutral-bg` | 물음표 | `color-u-neutral-fg` |

- 규격: 원형 64x64px, 글리프 28x28px, 선 굵기 2.5px, 선 끝 둥글게. 카드 상단 중앙 정렬, 아래 `space-u-stack` 만큼 띄우고 `Badge(user)` 를 둔다.
- 아이콘은 `aria-hidden="true"` 로 보조기기에서 숨긴다 — 상태는 항상 인접한 `Badge` 텍스트 라벨과 결과 제목이 전달한다(색·형태 단독 전달 금지).
- 특정 아이콘 라이브러리를 강제하지 않는다. 위 형태 서술을 만족하면 인라인 SVG·아이콘 세트 어느 쪽도 허용한다.
- 등장 연출은 `motion-u-slow`·`ease-u-decelerate`(불투명도 + 8px 상승) 1회로 제한한다.

### 콘텐츠 상한·오버플로

| 대상 | 규칙 |
|------|------|
| 동의 대상 설명 문구(consentNotice, 최대 1000자) | 영역 최대 높이 144px(`text-u-lead` 행간 24px 기준 6줄). 초과 시 영역 내부 세로 스크롤(`overflow-y:auto`), 말줄임 없음 |
| 동의 항목 목록(1개 이상, 상한 없음 — BIZ-001-04) | 목록 컨테이너에 **항목 수·내용 길이와 무관하게 상시** 최대 높이 360px(≥640px)·320px(<640px) + `overflow-y:auto` 를 적용한다. 내용 높이가 상한보다 작으면 스크롤이 생기지 않아 자연 높이로 렌더된다 |
| 동의 항목 라벨(최대 200자)·설명(최대 1000자) | **말줄임(line-clamp) 금지 — 전량 표시**. 고지 정보의 일부 은닉을 막기 위함이며, 상한을 넘는 길이는 항목 수와 무관하게 위 목록 컨테이너의 상시 최대 높이·스크롤이 흡수한다 |
| 약관 본문(terms_content, 대용량) | `Modal(user/terms)` 본문 영역만 스크롤(수치는 §컴포넌트 사용자 변형). 말줄임 없음 |

- 세로 스크롤이 생기는 컨테이너(설명 문구 영역·항목 목록)는 `tabindex="0"` + `role="group"` + `aria-label` 을 부여해 키보드만으로도 스크롤할 수 있게 한다(WCAG 2.1.1).
- 스크롤 가능 상태는 컨테이너 상·하단 8px 페이드로 보조 표시한다(장식 — 스크롤 가능 여부는 스크롤바로도 전달된다).

### 사용자 화면 접근성 보강

- **히트 영역**: 사용자 화면의 모든 상호작용 요소는 히트 영역 **44x44px 이상**을 확보한다(가시 높이와 별개 — 가시 높이 32px 인 [상세] 버튼은 투명 여백으로 확장). 전역 최소 기준 40x40px 보다 엄격하다.
- **포커스**: 포커스 링 2px `color-primary`·offset 2px 를 상시 노출한다(카드 위 5.17:1, 페이지 배경 위 4.60:1).
- **상태 전달**: 색·아이콘 단독 전달 금지 — 배지 텍스트 라벨·결과 제목·에러 캡션을 항상 병기한다.
