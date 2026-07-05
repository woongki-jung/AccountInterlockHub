# 디자인 시스템 정의 — AccountInterlockHub

본 문서는 AccountInterlockHub 의 관리자 웹·사용자 웹 전반에 적용하는 디자인 시스템(토큰·공통 컴포넌트·레이아웃·상태 표현·접근성)을 정의한다. spec 단계 화면 도메인 산출물이며, 개별 화면([`spec-screens.md`](spec-screens.md) 하위 `screen_SCR-*.md`)은 본 문서의 토큰·컴포넌트를 인용한다. 특정 프레임워크·라이브러리를 강제하지 않고 React(TypeScript) SPA 구현에 필요한 요구사항만 정의한다.

## 적용 원칙

- **2개 표면 1개 시스템**: 관리자 웹(구성 관리)과 사용자 웹(동의)은 동일 토큰·컴포넌트를 공유한다. 관리자는 정보 밀도 높은 좌우 넓은 레이아웃, 사용자는 단일 중앙 카드 레이아웃으로 배치만 달리한다.
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
| `Button` | primary·secondary·danger·ghost / size md(높이 40px)·sm(32px) | 로딩 시 스피너+`disabled`, 파괴적 액션은 danger 색. 최소 터치 영역 40x40px |
| `TextField` | text·url·password·number | 라벨(상단)+입력+에러 캡션 3단. 에러 시 경계 `color-danger`, `aria-invalid=true`, 에러 캡션 `role=alert` |
| `Select` | 단일 선택(enum) | 허용값 목록 바인딩(예: HTTP 메서드) |
| `Checkbox` | 단일·목록 | 동의 항목·필수 여부 등 불리언 입력. 라벨 클릭 영역 포함 |
| `Toggle` | 활성/비활성 | 구성 활성 상태 전환. 상태 라벨 병기 |
| `RepeatableRows` | 행 추가·삭제·순서 | 동의 항목·전달 파라미터 동적 입력. 각 행은 필드 그룹+삭제 버튼, 하단 "행 추가" 버튼 |
| `Table` | 헤더·행·행 액션·정렬 | 목록 표시. 행 hover 강조, 행 클릭=상세 이동. 헤더 배경 `color-bg-subtle` |
| `Card` | 제목·본문·액션 | 상세·동의 화면의 정보 묶음. `shadow-sm`, `radius-md` |
| `Modal` | 확인·경고 / 콘텐츠(약관 상세) | 확인·경고: 삭제 확인 등 파괴적 액션 확인(danger·secondary 액션). 콘텐츠: 제목+스크롤 본문(`max-height` 내 `overflow-y:auto`)+하단 액션. 공통: 배경 스크림, ESC·배경 클릭 닫기, 포커스 트랩. 약관 상세 변형은 하단 [동의](primary)·[닫기](secondary)를 두며 [동의]=호출 항목 동의 처리 후 닫기·[닫기]=닫기만(SCR-005·BIZ-002-05·EXC-BIZ-08) |
| `Toast` | success·error·info | 저장·삭제·전환 결과 알림. 4초 자동 소멸, `aria-live=polite` |
| `Badge` | active(초록)·inactive(회색)·성공·거부·실패 | 활성 여부·처리 결과 상태 표기 |
| `Banner` | info·warning·error | 화면 상단 안내(세션 만료·개인정보 경고·전달 실패 안내) |
| `Spinner`·`Skeleton` | 로딩 표현 | 초기 로딩=Skeleton, 액션 대기=Spinner |
| `EmptyState` | 아이콘·안내·CTA | 목록 0건 시 안내+생성 유도 |
| `AdminNav` | 상단 바(제품명·계정·로그아웃) | 관리자 화면 공통 헤더. 인증 세션에서만 렌더 |

## 레이아웃·반응형

- **관리자 셸(SCR-001~004)**: 상단 헤더(높이 56px, `AdminNav`) + 본문 컨테이너(최대 폭 1120px, 좌우 중앙 정렬, 좌우 여백 24px). 로그인 화면(SCR-001)은 헤더 없이 중앙 카드.
- **사용자 셸(SCR-005~006)**: 헤더 없는 단일 중앙 카드(최대 폭 480px, 상하 여백 48px). 모바일 진입 비중이 높아 단일 컬럼 우선.
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

## 마스킹·노출 제어(정책 반영)

- **민감값 마스킹(SEC-005)**: 회원 키·인증 자격을 화면에 표시할 경우 앞 2·뒤 2자만 노출(SEC-005-01). 단, MVP 화면 중 회원 키를 표시하는 화면은 없다(사용자 동의 화면은 회원 키 미표시, 처리상태 조회는 화면 없는 API-01). 처리상태 조회 응답은 상태 4항목만 포함(SEC-005-02).
- **관리자 구성 데이터 예외(EXC-SEC-05)**: 연동 구성의 서비스 A/B 주소·파라미터 정의는 설정 데이터로 마스킹하지 않는다.
- **역할별 노출**: 관리자 전용 컨트롤(구성 등록·활성 전환·삭제)은 인증 세션(AUTH-001)에서만 렌더한다. IP 차단(SEC-001)·미인증은 각각 접근 차단·로그인 유도로 처리한다.

## 접근성 기준

- **대비**: 본문·상호작용 텍스트는 WCAG AA(4.5:1) 이상, 큰 제목(≥ 22px)은 3:1 이상.
- **키보드 탐색**: 모든 상호작용 요소는 Tab 순회 가능. 포커스 링(2px `color-primary`, 오프셋 2px)을 항상 노출한다. 모달은 포커스 트랩·ESC 닫기.
- **스크린리더**: 폼 라벨은 `label for`/`aria-label` 연결, 에러는 `role=alert`, 토스트는 `aria-live=polite`, 로딩은 `aria-busy=true`.
- **의미 전달**: 상태를 색으로만 전달하지 않고 텍스트 라벨(활성/비활성·성공/거부/실패)을 병기한다.
- **터치 영역**: 상호작용 요소 최소 40x40px 확보.
