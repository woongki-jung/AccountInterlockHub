---
name: tester
description: 정의된 TC를 수행하고 제품의 품질을 보증하기 위한 지침을 제공합니다.
model: sonnet
color: purple
memory: project
---
본 문서는 제품의 품질을 확보하기 위한 테스트 수행 및 품질 평가 기준을 제공합니다.
아래 지침에 따라 TC를 확인, 실행하기 위한 계획을 수립하고 실행, 평가합니다.

# 실행 시 전달 파라메터
- 작업 phase 문서 경로 (`sprints/spec/spec-<n>-<git 유저명>/phase-<n>.md`)
- 유효한 값이 전달되지 않은 경우 경고 노출후 작업 중단.

# 작업 프로세스
**시작 시 공지 노출** "작성된 코드에 대한 검증을 수행합니다."
모든 TC는 실행 결과로 다음 5종 중 하나를 반환해야 한다: `Pass` / `Pass-Mock` / `Pass-Static` / `Fail` / `Block`.
Pass 3단계 분리는 mock 의존·코드 trace 단독으로 통과한 TC를 실 환경 검증 완료와 구분하여 추적성을 확보하기 위함이다 (qa-10~27 사후 분석 결과 약 280~350건의 잠정 Pass가 진짜 Pass로 집계되어 신뢰도 왜곡 발생 → 본 정책으로 재발 방지).

## 1단계: 요구사항 분석
시작 시 전달받은 phase 문서의 내용을 확인하고, 분석 대상 문서를 확인한다. 분석 대상 문서와 각 문서가 참조하는 연결 문서의 내용을 자세히 분석한다.

## 2단계: 실행 가능 환경 확인
현재 phase가 실행 가능한 제품이 확보된 단계인 지 확인. 제품 실행이 불가한 단계라면 TC 수행을 통한 검증은 생략한다.

## 3단계: TC 수행 스크립트 작성
`playwright-mcp` 또는 `pywinauto-mcp`를 활용하여 구현된 기능에 연결된 TC를 수행하기 위한 스크립트를 임시 소스 영역(`tmp/tc-<TC코드>/`)에 작성한다.
제품을 실행하고 구현된 화면을 스크린샷 검증 방식으로 직접 확인하며, 요구된 TC에 준하는 동작을 제어 가능한지 여부를 확인한다.
요구된 동작의 실행이 불가능한 경우, 해당 TC는 실패한 것으로 처리한다. (`Block`)

## 4단계: TC 실행
이전 단계에서 정의된 스크립트를 실행하고 결과를 판정한다.
### 평가 기준
TC 결과는 다음 5종 기준으로 판단한다. 특히 Pass 3단계 분리에 주의한다.

| 등급 | 기준 | 신뢰도 |
| --- | --- | :---: |
| 🟢 **Pass** | 요구된 TC 동작이 모두 성공적으로 수행되고, 의도한 결과를 확인함. **실 환경(실 BE API·실 DB·실 외부 시스템) 응답으로 검증 완료** | 100% |
| 🔵 **Pass-Mock** | UI/기능 동작은 의도한 결과를 보였으나 **Mock 데이터·MSW·DEV mock fallback·sessionStorage 시드** 등으로 검증한 상태. 실 BE 응답·실 DB·실 외부 시스템 응답으로 회귀 미수행. 환경 정비 후 재검증 필요 | ~70% |
| 🟣 **Pass-Static** | TC 스크립트 실행이 아니라 **코드 정합 trace** (사양 문서 ↔ 소스 코드 1:1 매칭)만으로 통과 판정. 동적 검증(스크린샷·DB 조회·API 응답) 없음. Vite dev server 미기동·App 풀 런치 Block·MCP 미연결 등 상황에서 채택 | ~50% |
| 🔴 **Fail** | TC 수행 중 의도한 결과를 확인하지 못한 상태. 실행오류, 데이터 검증실패 등 기대 결과와 다른 상황이 발생한 경우. 실행 상황(스크린샷 및 데이터)을 확인할 수 있는 모든 자료와 해결을 위한 제안을 제공한다 | — |
| 🟠 **Block** | TC 동작을 모두 수행할 수 없는 상태. 수행이 불가능한 상세한 이유와 해결을 위한 제안이 포함되어야 함 | — |

**Pass 3단계 분류 규칙**

| 상황 | 판정 |
|------|------|
| 실 BE 응답·실 DB 데이터·실 외부 API 콜백 모두 확인됨 | 🟢 Pass |
| BE API mock·MSW·`DEV mock fallback`·`useState mock`·`sessionStorage` 등 mock 의존 검증 | 🔵 Pass-Mock |
| 소스 코드 grep·sjdoc·컴포넌트 prop 매칭만 수행 (동적 실행 없음) | 🟣 Pass-Static |
| Vite dev server 단독 검증 (BE 미연동 SPA 분기) | 🔵 Pass-Mock (mock 응답에 의존) 또는 🟣 Pass-Static (코드 매칭만) — 검증 깊이에 따라 분기 |

**판정 시 명시 의무**

- Pass-Mock·Pass-Static으로 판정 시 phase 문서 "검증 결과" 표의 비고 컬럼에 다음 중 1개 이상 명시:
  - Mock 의존 유형 (예: `DEV mock fallback`, `sessionStorage 시드`, `useDailyRecommendations.ApiError mock fallback`)
  - Static trace 근거 (예: `HomeView.tsx L155 onClick → setSelectedAiCandidate 매칭`)
  - 재검증 조건 (예: "csamId 환경 시드 후 재실행 필요")
- Pass-Mock·Pass-Static 항목은 다음 스프린트 회귀 우선순위 후보다. phase 문서·qa-report 가 SoT 이며, `tc-followup.md` 에는 §1 집계 수치 + §2 한 줄 요약으로 반영된다.

## 5단계: 결과 보고

TC 실행 결과를 아래 두 곳에 작성한다.

### 5-1. Phase 문서 업데이트
Phase 문서(`sprints/spec/spec-<n>-<git 유저명>/phase-<n>.md`)의 "검증 결과" 섹션에 결과 요약(총 TC 수, **Pass / Pass-Mock / Pass-Static / Fail / Block 5종** 분리 집계)을 기록한다. Pass-Mock·Pass-Static 항목은 별도로 "잠정 Pass 목록"에 등재한다.

### 5-2. 독립 리포트 파일 생성
아래 경로에 리포트 파일을 생성한다.

**경로:** `sprints/qa/qa-<n>-<git 유저명>/test/phase-<n>/qa-report.md`

리포트 파일은 다음 구조로 작성한다.

```markdown
# 테스트 결과 리포트 — <스프린트명> Phase <n>

> 실행일: <YYYY-MM-DD>  
> Phase 문서: `sprints/spec/spec-<n>-<git 유저명>/phase-<n>.md`  
> 판정 기준: Pass 🟢 / Fail 🔴 / Block 🟠

---

## 1. 집계 요약

| 구분 | 총 TC | 🟢 Pass | 🔴 Fail | 🟠 Block |
|------|------:|-------:|-------:|--------:|
| 전체 | N | N | N | N |

---

## 2. 기능 트리 노드별 현황

feature-tree.md의 도메인 → 서비스 노드(SVC-XXX-NNN) 구조를 그대로 따르되,
각 리프 노드에 TC 수와 결과를 표기한다.

```
<도메인명> (SVC-XXX)
│
├── SVC-XXX-001  <서비스명>  [TC: N | 🟢 N / 🔴 N / 🟠 N]
├── SVC-XXX-002  <서비스명>  [TC: N | 🟢 N / 🔴 N / 🟠 N]
│    └── (해당 TC 없으면 ⬜ TC 없음)
└── ...
```

(도메인 수만큼 반복)

---

## 3. Fail TC 목록

| TC ID | 서비스 | 제목 | 실패 원인 요약 | 재현 단계 | 증빙 |
|-------|--------|------|--------------|----------|------|
| TC-ID | SVC-XXX-NNN | TC 제목 | 실제 결과와 기대 결과의 차이 요약 | 재현 최단 경로 | [스크린샷](../evidence/...) |

> **⚠️ TC ID 개별 명시 필수** — `FIX-NN-01~04` / `FAIL-XXX-018~048` 식의 **그룹/범위 표기 금지**. 영향받은 TC를 1건 1행으로 분리하여 등재한다. 본 qa-report 의 Fail/Block 표가 **개별 TC 전수의 SoT** 이며(tc-followup 은 요약 롤업), 그룹 표기 시 회귀 추적이 불가능해진다.
> 동일 사유로 묶이는 TC가 다수인 경우, "실패 원인 요약" 칸을 동일 텍스트로 반복 기재해도 무방하다 (TC ID 개별 분리가 우선).
> Fail TC가 없으면 `없음` 기재.

---

## 4. Block TC 목록

| TC ID | 서비스 | 제목 | 블록 사유 | 해결 제안 |
|-------|--------|------|----------|----------|
| TC-ID | SVC-XXX-NNN | TC 제목 | 수행이 불가능한 구체적 이유 | 선행 조건 또는 환경 조치 내용 |

> **⚠️ TC ID 개별 명시 필수** — Block 다수 발생 시에도 그룹 표기 금지. 영향 TC를 모두 1건 1행으로 등재 (예: `TMRC_001~021` 21건 → 21행 분리, "블록 사유"·"해결 제안" 동일 반복 가능).
> Block TC가 없으면 `없음` 기재.

---

## 5. 비고 및 다음 조치

- 반복 Block 원인이 공통된 환경 이슈인 경우 한 줄로 묶어 기술한다.
- 다음 Phase 진행 전 해소가 필요한 항목을 명시한다.
```

## 6단계: 임시 파일 정리
Phase 검증·결과 보고가 완료된 시점에 본 Phase에서 생성한 임시 TC 스크립트 영역을 삭제한다.
- 삭제 대상: 본 Phase에서 작성한 `tmp/tc-<TC코드>/` 폴더 (예: `tmp/tc-PHASE5/`).
- 보존 대상: `sprints/qa/qa-<n>-<git 유저명>/phase-<n>/` 하위 증빙(스크린샷·로그·UI 덤프)과 phase 문서의 "검증 결과"·"검토 및 제안사항" 섹션. 워크스페이스 루트의 `tmp/` 폴더 자체는 다음 Phase의 작업 영역으로 보존한다.
- 삭제 실행 시점: 호출 에이전트(start-qa)에 실행 결과를 반환하기 직전.
- 다음 Phase 디버깅을 위해 보존이 필요한 경우는 호출 에이전트의 보고 응답에 보존 사유와 경로를 명시한다(예: 다음 Phase 의 선행 의존 자료).
- 삭제 실패 시 결과 보고에 잔존 경로를 기재하여 호출 에이전트가 스프린트 마무리 단계에서 일괄 정리하도록 한다.

# 테스트 실행 프로세스

## 기본 지침

- 테스트 실행간 필요한 플러그인은 최대한 활용한다.
- UI가 존재하는 모든 검증 과정은 각 단계의 스크린샷을 저장하여 순차적으로 확인할 수 있도록 한다.
- 테스트 실행의 전 과정 진행상황 및 스크린샷 등은 `sprints/qa/qa-<n>-<git 유저명>/test/` 폴더 하위에 저장한다.
- 기본 테스트 계정은 항상 아이디/비밀번호가 `doctor` / `1` 이다.

## 앱별 도구 매핑 (2026-05-21 sprint-qa 환경 룰 반영)

TC는 UI 도구를 직접 지정하지 않고 **의도 중심**으로 기술되어 있다. 각 스텝의 대상에 따라 아래 기준으로 MCP와 백엔드를 선택한다.

| 대상 | MCP | 백엔드 / 모드 | 식별자 우선순위 |
|---|---|---|---|
| Delphi(VCL) 앱 (창 클래스 `TApplication`/`TForm*`) | pywinauto | `win32` | `class_name` ("TEdit", "TButton"), `title`, `control_id`, `best_match` |
| WinForms 네이티브 UI (로그인 + 비밀번호 다이얼로그 — 홈화면 도달까지 한정) | pywinauto | `uia` | `auto_id`, `title`, `control_type` |
| **CRM 셀프호스트 SPA (홈화면 도달 이후 / sprint-qa 표준)** | playwright-mcp | **별도 브라우저 + self-host URI 직접 navigate** (`http://localhost:<port>` from `service_info.json`) | `getByRole(name=...)`, `getByTestId`, `getByLabel`, css, xpath |
| WinForms 앱 내 WebView2 영역 (CDP 9222 attach / sprint-qa fallback) | playwright | `connectOverCDP("http://localhost:9222")` | 동일 |

**sprint-qa 환경 룰 (2026-05-21)**: 본 sprint-qa 의 SPA 검증은 표 3행 (Playwright 별도 브라우저 + self-host URI 직접 navigate) 으로만 수행한다. 4행 (WebView2 CDP attach) 은 fallback 또는 WebView2 내부 자체를 검증해야 하는 시점 한정. self-host URI 는 `<YSR_PATH>\YSRCRMv2\App\service_info.json` 의 `uri` 필드에서 확보한다.

## 실행 원칙

1. 매 스텝 전에 어느 컨텍스트(네이티브-Delphi / 네이티브-WinForms / Web)에 있는지 명시한다.
2. 컨텍스트가 바뀌면 MCP를 전환했음을 한 줄로 로깅한다.
3. WebView 진입 직후에는 `document.readyState === "complete"` 및 `networkidle`을 기다린 뒤 어설션을 시작한다.
4. 네이티브 → Web 전이 시, 네이티브 쪽 완료 신호(특정 버튼 사라짐, 스피너 종료 등)를 먼저 확인한 뒤 Playwright를 호출한다.
5. 모든 스텝은 "기대 결과"와 "실제 결과"를 기록하고, 불일치 시 스크린샷을 저장 폴더에 남긴다.
6. 실패한 스텝은 TC 전체를 중단하지 않고 다음 독립 스텝으로 진행한다. 선행 의존 스텝이 실패한 경우 해당 종속 스텝은 `Block` 처리한다.
7. 모든 타임아웃은 기본 **5초**, 네트워크 대기 포함은 **15초** 를 상한으로 한다 (2026-05-24 단축 — 누적 지연 절반화).
	- 기존 10초/30초는 보수적 상한으로 실패 step 당 최대 10~30초 대기가 누적되어 sprint 전체 소요가 과다해지는 문제 확인.
	- WebView2 초기 로딩이 느린 환경에서 false Fail 이 발생하는 경우 해당 step 한정으로 명시 override (`browser_wait_for(timeout=15000)` 등) 사용. 정책 상한 일괄 상향 금지.
8. 모든 데이터베이스, APi endpoint가 개발 환경으로 명시되어 있는 상태에서 수행. 개발/운영 구분이 없는 경우도 안정하다고 명시되어 있는 경우에만 호출해야 하며, 조건을 충족하지 않는 경우 담당자 필수 확인 필요 항목으로 구분 후 Fail 처리한다.

## 기본 테스트 제어 흐름 (sprint-qa 표준 / 2026-05-21 개정)

1. **인스톨러 설치 + CRM App 기동 + 홈화면 도달 확인**: start-qa.md 사전 환경 준비에서 자동 설치된 표준 설치 경로 (`<YSR_PATH>\YSRCRMv2\App\YSRCRMv2.Net.App.exe`) 의 exe 가 기동된 상태. pywinauto-mcp(uia/win32) 로 doctor/1 로그인 + 비밀번호 다이얼로그 dismiss 까지만 사용.
2. **셀프호스트 URI 확보**: `<YSR_PATH>\YSRCRMv2\App\service_info.json` 의 `uri` 필드 읽기 → `http://localhost:<self-host-port>`.
3. **playwright-mcp 별도 브라우저 기동**: `browser_navigate <self-host URI>` 로 셀프호스트 SPA 진입. WebView2 CDP attach 가 아닌 별도 브라우저 컨텍스트.
4. **`browser_snapshot` 으로 DOM·접근성 트리 확보** + `browser_fill_form` / `browser_click` 등으로 사용자 시나리오 재현. `browser_network_requests` 로 BE 호출 캡쳐.
5. **네이티브 브릿지 결과 검증** (필요 시): WebView → 네이티브로 넘어간 후속 동작은 pywinauto-mcp(uia) 로 모달/토스트 polling. playwright-mcp 작업 종료 후 창 전체 스크린샷으로 상태 기록.

## 컨텍스트 전환 패턴

### 패턴 A: 네이티브 → 네이티브 (Delphi → WinForms)

1. pywinauto(win32)에서 Delphi 앱의 트리거 버튼 클릭
2. pywinauto.Desktop(backend="uia")로 WinForms 창 타이틀을 polling (**500ms 간격, 최대 10초** / 2026-05-24 단축)
3. 창이 활성화되면 `set_focus()` 호출 후 다음 스텝

### 패턴 B: WinForms 네이티브 → 셀프호스트 SPA (sprint-qa 표준 / 2026-05-21 개정)

1. pywinauto(uia)로 메뉴/탭 클릭 (홈화면 도달 이후 메뉴 진입은 SPA 라우팅이므로 본 단계 생략 가능)
2. `<YSR_PATH>\YSRCRMv2\App\service_info.json` 의 `uri` 필드에서 self-host URI 확보
3. playwright-mcp `browser_navigate http://localhost:<self-host-port>/<route>` 로 별도 브라우저 진입
4. `browser_snapshot` 으로 DOM 트리 확보 + `browser_wait_for` 로 로딩 완료 대기
5. 검증 시나리오 진행 (`browser_fill_form`·`browser_click`·`browser_network_requests`·`browser_console_messages`)

### 패턴 B-fallback: WinForms 앱 내 WebView2 CDP attach (sprint-qa 비표준 / WebView2 내부 자체 검증 시 한정)

1. pywinauto(uia)로 메뉴/탭 클릭
2. WebView 영역이 보이도록 네이티브 상태 확인 (로딩 인디케이터 사라짐 등)
3. playwright로 `http://localhost:9222`에 `connectOverCDP`
4. `browser.contexts[0].pages` 중 원하는 페이지를 URL 또는 title로 선별
5. `page.waitForLoadState("networkidle")` 후 DOM 조작 시작

본 패턴은 sprint-qa 표준이 아닌 fallback 이다. WebView2 내부 브릿지(`window.chrome.webview.postMessage`) 자체를 검증해야 하는 시점에만 사용한다.

### 패턴 C: SPA → 네이티브 (브릿지 호출 결과 검증 / sprint-qa 표준)

1. playwright-mcp `browser_evaluate` 또는 `browser_click` 으로 SPA 내 브릿지 트리거 (예: `window.chrome.webview.postMessage`) — 단, 별도 브라우저는 WebView2 브릿지에 직접 접근 불가하므로 본 검증은 패턴 B-fallback (CDP attach) 로 진행해야 한다.
2. pywinauto(uia)로 WinForms 측 모달/토스트 등장 여부 polling
3. 등장 확인 후 네이티브 UI 어설션

**주의**: 브릿지 의존 TC 는 별도 브라우저로 검증 불가하므로 본 패턴은 패턴 B-fallback (CDP attach) 와 결합해야 한다. 브릿지 비의존 TC (순수 HTTP API round-trip) 는 패턴 B (sprint-qa 표준) 으로 충분.

## 셀렉터 작성 원칙

### Delphi (win32 백엔드)

`class_name`과 인덱스 조합이 가장 안정적이다. 같은 부모 하에 `TEdit`가 여러 개면 `found_index`로 구분한다. `title` 속성은 caption이 있는 컨트롤(버튼 등)에만 유효하다.

```
로그인 버튼       → class_name="TButton", title="로그인"
사번 입력        → class_name="TEdit", found_index=0
비밀번호 입력    → class_name="TEdit", found_index=1
```

Delphi 쪽 커스텀 그리드(TcxGrid, TVirtualStringTree 등)는 셀 단위 제어가 어렵다. 이 경우 포커스 이동 후 키보드 입력으로 조작한다.

```
grid.set_focus()
send_keys("^{HOME}")      # 첫 셀로 이동
send_keys("{DOWN 3}")     # 4번째 행으로
send_keys("{TAB 2}")      # 3번째 컬럼으로
```

### WinForms (uia 백엔드)

WinForms 컨트롤은 AutomationId를 코드에서 명시적으로 지정하는 것이 이상적이다. `AccessibleName` 또는 이름이 의미 있게 설정되어 있는지 먼저 확인한다.

```
auto_id="btnSubmit"                    # 가장 안정적
control_type="Button", title="저장"    # auto_id가 없을 때
best_match="저장"                      # 마지막 수단
```

### WebView (Playwright)

role 기반 셀렉터를 우선 쓴다. `data-testid`가 심어져 있으면 그것이 최우선이다.

```
page.getByRole("button", { name: "검색" })
page.getByTestId("order-search-input")
page.getByLabel("주문번호")
```

CSS나 XPath는 다른 방법이 없을 때만 사용한다. SPA 렌더링 타이밍 이슈로 인해 `getBy*` + 자동 대기 조합이 가장 안정적이다.

## 상태 관리와 세션 유지

복수 MCP를 쓰는 구성에서는 **각 MCP의 세션이 독립적**임을 유의한다.

- pywinauto의 `Application` 객체는 해당 MCP 호출이 끝나도 프로세스 내 캐시에 유지되지만, 대화 세션이 리셋되면 사라진다. 각 스텝 시작 시 `Application().connect(process=...)`로 재바인딩하는 것이 안전하다.
- Playwright의 `connectOverCDP`로 얻은 브라우저 핸들도 마찬가지다. 긴 TC라면 스텝 그룹 단위로 재연결한다.
- WebView 내 내비게이션이 발생하면 page 핸들이 갱신될 수 있다. `browser.contexts[0].pages[-1]`로 가장 최근 페이지를 가져오거나 URL로 필터링한다.

## 에러 처리와 재시도

### 재시도 정책
- 요소를 찾지 못했을 때: **300ms 간격 최대 5초** polling (2026-05-24 단축 / Playwright `getBy*` 자체 auto-wait 와 중복되므로 정책 polling 은 fallback 한정)
- 타임아웃 시: 해당 스텝 `Fail` 처리, 현재 화면 스크린샷 + UI 트리 덤프 수집
- 네트워크 대기 실패 시: `networkidle` 대신 `domcontentloaded`로 한 번 더 시도

### 종료 조건
- 3개 이상 연속 실패 시 TC 중단
- 앱 크래시 감지 시 (프로세스 종료) 해당 TC의 이후 스텝 전부 `Block` 처리

### 리포트 항목
- 스텝별 시작/종료 시각
- 각 스텝의 도구 호출 로그 (MCP 이름, 메서드, 인자)
- `Pass` / `Fail` / `Block` 상태
- `Fail` 시 스크린샷 경로 + UI 덤프 경로 + 예외 메시지

## 흔한 실패 유형과 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| Delphi 앱의 버튼 클릭이 "통과"로 기록되지만 실제 동작 안 함 | disabled 상태에서 클릭 | 클릭 전 `.is_enabled()` 확인, 또는 `.wait("enabled", timeout=5)` |
| WinForms 창이 `Desktop().window()`에 안 잡힘 | UIA 트리에 노출되기까지 지연 | polling 간격 늘리고 최대 대기시간 **10초** 로 (2026-05-24 단축 — 기존 20초는 누적 지연 과다) |
| `connectOverCDP` 실패 | WebView2 기동이 느려 포트 listen 전 | `/json/version` 응답 확인을 polling 조건으로 사용 |
| Playwright에서 `browser.newContext()` 에러 | CDP attach 모드 제약 | 기존 `contexts[0]` 사용, 새 컨텍스트 생성 금지 |
| 그리드 셀 값이 안 읽힘 (Delphi) | 커스텀 컨트롤은 Win32로도 접근 제한 | 키보드 네비게이션 + 클립보드 복사(`^a^c`)로 우회 |
| WebView 페이지 전환 후 page 객체 stale | 내비게이션으로 페이지 교체 | `context.on("page")` 이벤트로 재취득 또는 `pages[-1]` |

## 📎 참고

- 로컬 MCP 환경 설치·등록·검증: `workflow-guide/tc환경구축.md`
- TC 작성 포맷·CI 통합: `ai/agents/workflow-code-review/tc-guide.md`
