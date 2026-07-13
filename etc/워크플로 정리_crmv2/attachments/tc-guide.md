# 🤖 에이전트용 TC 실행 가이드

대상: Claude Code 세션에서 **WinForms+WebView2 / Delphi(VCL) 크로스 앱 TC**를 실행하는 오케스트레이터 에이전트.

본 문서는 **TC 실행 단계의 규칙·패턴**을 다룬다. 로컬 MCP 환경 설치·등록·검증은 `tc환경구축.md`를 참조한다.

## 🎯 에이전트의 역할

Claude Code 세션에서 TC(Test Case)를 받으면 각 스텝마다 적절한 MCP를 선택해 호출한다. 사람이 작성하는 TC는 UI 도구를 직접 지정하지 않고 **의도 중심**으로 기술되어 있다. 도구 선택은 에이전트가 백엔드/MCP 규칙에 따라 결정한다.

## 🗂️ 앱별 도구 매핑

| 대상 | MCP | 백엔드 / 모드 | 식별자 우선순위 |
|---|---|---|---|
| Delphi 앱 (`LegacyClient.exe` 등, 창 클래스 `TApplication`/`TForm*`) | pywinauto | `win32` | `class_name` ("TEdit", "TButton"), `title`, `control_id`, `best_match` |
| WinForms 네이티브 UI (`OrderManager.exe` 등) | pywinauto | `uia` | `auto_id`, `title`, `control_type` |
| WinForms 앱 내 WebView2 영역 | playwright | `connectOverCDP("http://localhost:9222")` | `getByRole(name=...)`, `getByTestId`, `getByLabel`, css, xpath |

---

## 1. `CLAUDE.md` — 프로젝트 지침 파일

Claude Code는 프로젝트 루트의 `CLAUDE.md` 파일을 세션 시작 시 자동으로 읽는다. 여기에 오케스트레이션 규칙을 정의해두면 매번 프롬프트로 입력할 필요가 없다.

프로젝트 루트에 `CLAUDE.md` 생성 예시:

```markdown
# 크로스 앱 QA 자동화 프로젝트

## 역할
너는 QA 자동화 오케스트레이터다. 아래 규칙을 따라 MCP 도구를 선택해라.

## 앱별 도구 매핑

- **Delphi 앱** (프로세스: `LegacyClient.exe`, 창 클래스: `TApplication`, `TForm*`)
  - pywinauto MCP, backend=`win32`
  - 식별자 우선순위: `class_name` ("TEdit", "TButton" 등), `title`, `control_id`, `best_match`

- **WinForms 앱의 네이티브 UI** (프로세스: `OrderManager.exe`)
  - pywinauto MCP, backend=`uia`
  - 식별자 우선순위: `auto_id`, `title`, `control_type`

- **WinForms 앱의 WebView2 내부**
  - playwright MCP, `connectOverCDP("http://localhost:9222")`
  - 식별자 우선순위: `getByRole(name=...)`, `getByTestId`, `getByLabel`, css, xpath

## 실행 원칙

0. **[Phase 0] TC 실행 진입 전, 대상 앱의 네이티브 메인창과 WebView2 내부 양측의 UI 트리를 각각 1회 덤프하여 각 TC가 네이티브/SPA 중 어디 소관인지 사전 분류한다.** 한쪽만 탐색하면 반대편 TC가 "도구 미가용" 으로 오판되어 블로킹 보고되는 사고가 발생한다(2026-04-19 사례). 덤프는 `./artifacts/<run-id>/dumps/native-tree.json` · `webview-tree.json` 으로 저장한다.
1. 매 스텝 전에 어느 컨텍스트(네이티브-Delphi / 네이티브-WinForms / Web)에 있는지 명시한다.
2. 컨텍스트가 바뀌면 MCP를 전환했음을 한 줄로 로깅한다. **MCP 이름은 공식 표기로만 기재**: `pywinauto-mcp (uia|win32 백엔드)` / `Playwright MCP`. "UIAutomation MCP"·"UI Automation MCP" 등 가상의 이름은 스펙 문서·로그·리포트 어디에도 쓰지 않는다.
3. WebView 진입 직후에는 `document.readyState === "complete"` 및 `networkidle`을 기다린 뒤 어설션을 시작한다.
4. 네이티브 → Web 전이 시, 네이티브 쪽 완료 신호(특정 버튼 사라짐, 스피너 종료 등)를 먼저 확인한 뒤 Playwright를 호출한다.
5. 모든 스텝은 "기대 결과"와 "실제 결과"를 기록하고, 불일치 시 스크린샷을 `./artifacts/<tc-id>/step-<n>.png` 경로로 남긴다.
6. 실패한 스텝은 TC 전체를 중단하지 않고 다음 독립 스텝으로 진행한다. 선행 의존 스텝이 실패한 경우 해당 종속 스텝은 Skip 처리한다.
7. 모든 타임아웃은 기본 10초, 네트워크 대기 포함은 30초를 상한으로 한다.

## 산출물

- 스크린샷: `./artifacts/<tc-id>/`
- UI 트리 덤프: `./artifacts/<tc-id>/dumps/`
- 실행 리포트: `./reports/<yyyymmdd-hhmm>-<tc-id>.md`

## TC 파일 위치

- `./tests/*.md` — 사람이 작성한 TC 명세 (Markdown)
- 실행 지시 시: "TC-001 실행해줘" → `./tests/TC-001-*.md` 파일을 읽고 실행
```

이 파일을 `.mcp.json`과 함께 저장소에 커밋하면 팀 전체가 동일한 실행 규칙을 공유하게 된다.

### 슬래시 커맨드 (선택)

자주 쓰는 실행 패턴은 Claude Code의 커스텀 슬래시 커맨드로 등록할 수 있다. `.claude/commands/run-tc.md`를 만들고 다음 내용을 넣는다.

```markdown
---
description: 지정한 TC 실행
---

아래 TC 파일을 읽고 CLAUDE.md의 실행 원칙에 따라 단계별로 실행해라.
결과는 `./reports/` 디렉터리에 리포트로 남긴다.

TC 파일: $ARGUMENTS
```

이후 세션에서 `/run-tc ./tests/TC-001-login-order.md`처럼 한 줄로 호출할 수 있다.

---

## 2. TC 기술 포맷

에이전트가 해석하기 쉬운 구조화된 TC 포맷. Given/When/Then 스타일과 호환된다.

```markdown
## TC-001 로그인 후 주문 조회 하이브리드 플로우

**선행 조건**
- Delphi 앱과 WinForms 앱이 모두 실행 가능한 상태
- 테스트 계정: qa_user / Qa!234

**스텝**
1. Delphi 앱 실행 (C:\App\LegacyClient.exe)
2. 로그인 폼에서 사번 "12345" 입력, 비밀번호 "Qa!234" 입력 후 로그인 버튼
3. 로그인 성공 후 "연동 보기" 메뉴 클릭 — 이 동작이 WinForms 앱을 기동시킨다
4. WinForms 앱 메인 윈도우가 포그라운드로 올 때까지 대기 (최대 15초)
5. 좌측 네비게이션에서 "주문 현황" 클릭
6. WebView2 내 주문 테이블이 로딩 완료될 때까지 대기
7. 첫 행의 "주문번호" 컬럼이 "ORD-" 접두사로 시작하는지 검증
8. 필터 입력창에 "2026-04" 입력, Enter
9. 테이블에 남은 행 수가 1개 이상이며, 모든 행의 주문일이 2026년 4월인지 검증

**기대 결과**
- 모든 스텝 통과
- 실패 시 단계별 스크린샷과 pywinauto dump, playwright trace 첨부
```

에이전트는 이 TC를 받으면 각 스텝별로:

- 스텝 1~3: pywinauto(win32)로 Delphi 조작
- 스텝 4~5: pywinauto(uia)로 WinForms 조작
- 스텝 6~9: playwright로 WebView 조작

---

## 3. 컨텍스트 전환 패턴

에이전트가 자주 실수하는 지점이 컨텍스트 전환이다. 다음 패턴을 TC 또는 시스템 지침에 명시한다.

### 패턴 A: 네이티브 → 네이티브 (Delphi → WinForms)

```
1. pywinauto(win32)에서 Delphi 앱의 트리거 버튼 클릭
2. pywinauto.Desktop(backend="uia")로 WinForms 창 타이틀을 polling (1초 간격, 최대 15초)
3. 창이 활성화되면 set_focus() 호출 후 다음 스텝
```

### 패턴 B: WinForms 네이티브 → WebView

```
1. pywinauto(uia)로 메뉴/탭 클릭
2. WebView 영역이 보이도록 네이티브 상태 확인 (로딩 인디케이터 사라짐 등)
3. playwright로 http://localhost:9222 에 connectOverCDP
4. browser.contexts[0].pages 중 원하는 페이지를 URL 또는 title로 선별
5. page.waitForLoadState("networkidle") 후 DOM 조작 시작
```

### 패턴 C: WebView → 네이티브 (브릿지 호출 결과 검증)

```
1. playwright로 WebView 내 버튼 클릭 (window.chrome.webview.postMessage 등으로 네이티브에 신호)
2. pywinauto(uia)로 WinForms 측 모달/토스트 등장 여부 polling
3. 등장 확인 후 네이티브 UI 어설션
```

---

## 4. 셀렉터 작성 원칙

### Delphi (win32 백엔드)

`class_name`과 인덱스 조합이 가장 안정적이다. 같은 부모 하에 `TEdit`가 여러 개면 `found_index`로 구분한다. `title` 속성은 caption이 있는 컨트롤(버튼 등)에만 유효하다.

```
로그인 버튼       → class_name="TButton", title="로그인"
사번 입력        → class_name="TEdit", found_index=0
비밀번호 입력    → class_name="TEdit", found_index=1
```

Delphi 쪽에서 커스텀 그리드(TcxGrid, TVirtualStringTree 등)는 셀 단위 제어가 어렵다. 이 경우 포커스 이동 후 키보드 입력으로 조작한다.

```
grid.set_focus()
send_keys("^{HOME}")      # 첫 셀로 이동
send_keys("{DOWN 3}")     # 4번째 행으로
send_keys("{TAB 2}")      # 3번째 컬럼으로
```

### WinForms (uia 백엔드)

WinForms 컨트롤은 AutomationId를 코드에서 명시적으로 지정하는 것이 이상적이다. 빌드 가능 환경이라면 폼 디자이너에서 `AccessibleName` 또는 이름이 의미 있게 설정되어 있는지 먼저 확인한다.

```
auto_id="btnSubmit"                    # 가장 안정적
control_type="Button", title="저장"    # auto_id가 없을 때
best_match="저장"                      # 마지막 수단
```

### WebView (Playwright)

role 기반 셀렉터를 우선 쓴다. testid(`data-testid`)가 심어져 있으면 그것이 최우선이다.

```
page.getByRole("button", { name: "검색" })
page.getByTestId("order-search-input")
page.getByLabel("주문번호")
```

CSS나 XPath는 다른 방법이 없을 때만 사용한다. SPA의 경우 렌더링 타이밍 이슈로 인해 `getBy*` + 자동 대기 조합이 가장 안정적이다.

---

## 5. 상태 관리와 세션 유지

복수 MCP를 쓰는 구성에서는 **각 MCP의 세션이 독립적**임을 유의한다.

- pywinauto의 `Application` 객체는 해당 MCP 호출이 끝나도 프로세스 내 캐시에 유지되지만, 대화 세션이 리셋되면 사라진다. 각 스텝 시작 시 `Application().connect(process=...)`로 재바인딩하는 것이 안전하다.
- Playwright의 `connectOverCDP`로 얻은 브라우저 핸들도 마찬가지다. 긴 TC라면 스텝 그룹 단위로 재연결한다.
- WebView 내 내비게이션이 발생하면 page 핸들이 갱신될 수 있다. `browser.contexts[0].pages[-1]`로 가장 최근 페이지를 가져오거나 URL로 필터링한다.

---

## 6. 에러 처리와 재시도

에이전트에게 주는 규칙 세트 예시:

```
[재시도 정책]
- 요소를 찾지 못했을 때: 500ms 간격 최대 10초 polling
- 타임아웃 시: 해당 스텝 Fail 처리, 현재 화면 스크린샷 + UI 트리 덤프 수집
- 네트워크 대기 실패 시: networkidle 대신 domcontentloaded로 한 번 더 시도

[종료 조건]
- 3개 이상 연속 실패 시 TC 중단
- 앱 크래시 감지 시 (프로세스 종료) 해당 TC의 이후 스텝 전부 Skip

[리포트 항목]
- 스텝별 시작/종료 시각
- 각 스텝의 도구 호출 로그 (MCP 이름, 메서드, 인자)
- Pass/Fail/Skip 상태
- Fail 시 스크린샷 경로 + UI 덤프 경로 + 예외 메시지
```

---

## 7. 대화 진행 예시

사용자가 에이전트에게 TC 실행을 지시할 때의 실제 대화 흐름 예시다.

```
사용자: TC-001을 실행해줘. 결과는 단계별로 알려줘.

에이전트 (내부 계획):
  1) pywinauto(win32)로 Delphi 앱 실행, 로그인
  2) "연동 보기" 클릭 → WinForms 앱 기동 트리거
  3) pywinauto(uia)로 WinForms 앱 포커스 이동
  4) 메뉴 클릭
  5) playwright로 CDP 연결, WebView 조작

에이전트 (실행):
  [컨텍스트: Delphi / win32]
  → pywinauto.start("C:\App\LegacyClient.exe")
  → LoginForm에서 사번, 비밀번호 입력, 로그인 버튼 클릭
  → 로그인 성공 확인 (메인 메뉴 등장)
  STEP 1-3: PASS

  [컨텍스트 전환: Delphi → WinForms / uia]
  → Desktop(backend="uia").window(title_re="주문관리*") polling
  → 12.3초 후 창 감지, set_focus()
  STEP 4: PASS

  → "주문 현황" 메뉴 클릭
  STEP 5: PASS

  [컨텍스트 전환: WinForms → Web / playwright]
  → chromium.connectOverCDP("http://localhost:9222")
  → page.waitForLoadState("networkidle")
  → 테이블 로딩 완료 확인
  STEP 6: PASS

  → 첫 행 주문번호 검증
  실제값: "ORD-20260418-001"
  STEP 7: PASS

  → 필터 "2026-04" 입력, Enter
  STEP 8: PASS

  → 남은 행 수: 23, 모두 2026-04 범위 내
  STEP 9: PASS

TC-001 전체: PASS (9/9)
총 소요시간: 47.2초
```

---

## 8. 흔한 실패 유형과 대응

|증상|원인|대응|
|---|---|---|
|Delphi 앱의 버튼 클릭이 "통과"로 기록되지만 실제 동작 안 함|disabled 상태에서 클릭|클릭 전 `.is_enabled()` 확인, 또는 `.wait("enabled", timeout=5)`|
|WinForms 창이 `Desktop().window()`에 안 잡힘|UIA 트리에 노출되기까지 지연|polling 간격 늘리고 최대 대기시간 20초로|
|`connectOverCDP` 실패|WebView2 기동이 느려 포트 listen 전|`/json/version` 응답 확인을 polling 조건으로 사용|
|Playwright에서 `browser.newContext()` 에러|CDP attach 모드 제약|기존 `contexts[0]` 사용, 새 컨텍스트 생성 금지|
|그리드 셀 값이 안 읽힘 (Delphi)|커스텀 컨트롤은 Win32로도 접근 제한|키보드 네비게이션 + 클립보드 복사(`^a^c`)로 우회|
|WebView 페이지 전환 후 page 객체 stale|내비게이션으로 페이지 교체|`context.on("page")` 이벤트로 재취득 또는 `pages[-1]`|

---

## 9. CI 통합 (Claude Code headless 모드)

로컬에서 TC를 검증한 뒤 CI에서 재현하려면 Claude Code의 **headless(non-interactive) 모드**를 쓴다. `-p` 또는 `--print` 옵션으로 프롬프트를 전달하고 결과를 stdout으로 받는 방식이다.

### 9.1 기본 형태

```powershell
claude -p "TC-001 실행하고 리포트를 ./reports/ 에 저장해줘" `
  --output-format stream-json `
  --permission-mode acceptEdits
```

주요 옵션:

- `-p "<프롬프트>"` — headless 실행. 프롬프트 전달 후 응답을 받고 종료.
- `--output-format stream-json` — NDJSON 스트림으로 출력. CI 로그 수집과 파싱에 유리.
- `--permission-mode acceptEdits` — 파일 쓰기(리포트, 스크린샷 저장)를 자동 허용.
- `--mcp-config <path>` — 별도 MCP 설정 파일 지정 가능. CI 전용 구성을 쓸 때.

### 9.2 CI에서 필요한 환경 조건

- ⬜ **테스트 빌드 플래그** — WebView2 CDP 활성화가 테스트 빌드에만 적용되도록 분기 (`tc환경구축.md` §2.3 참조)
- ⬜ **워커 단위 포트/데이터 폴더 분리** — 병렬 실행 시 `WEBVIEW2_USER_DATA_FOLDER`와 `--remote-debugging-port`를 워커별로 다르게 주입
- ⬜ **대화형 데스크톱 세션** — Windows runner는 UI 렌더를 위해 interactive session이 필요하다. GitHub Actions의 `windows-latest` 러너는 서비스 세션이라 UI가 안 뜨므로, self-hosted runner에 autologon을 설정하거나 Azure VM + RDP 세션 유지 방식을 써야 한다.
- ⬜ **MCP 설정 공유** — `.mcp.json`을 저장소에 커밋해두면 CI에서 `claude` 실행 시 자동으로 로드된다. 경로 차이는 환경변수로 추상화.
- ⬜ **API 키** — `ANTHROPIC_API_KEY` 환경변수가 설정되어 있어야 한다. CI secrets에 등록.

### 9.3 GitHub Actions 예시 (self-hosted Windows runner)

```yaml
name: Cross-app E2E

on:
  workflow_dispatch:
  schedule:
    - cron: '0 18 * * *'  # UTC 18:00 = KST 03:00

jobs:
  e2e:
    runs-on: [self-hosted, windows, qa-desktop]
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      PYWINAUTO_MCP_PY: C:\repo\pywinauto-mcp\venv\Scripts\python.exe
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: --remote-debugging-port=9222
      WEBVIEW2_USER_DATA_FOLDER: C:\temp\wv2-ci-${{ github.run_id }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Verify MCP servers
        run: claude mcp list

      - name: Run TC suite
        run: |
          claude -p "tests/ 디렉터리의 모든 TC를 순차 실행하고 결과를 reports/ci-${{ github.run_id }}.md 로 저장해줘" `
            --output-format stream-json `
            --permission-mode acceptEdits `
            --max-turns 200 `
            > ci-output.ndjson

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: qa-artifacts-${{ github.run_id }}
          path: |
            artifacts/
            reports/
            ci-output.ndjson
```

### 9.4 로컬에서 동일 명령 드라이 런

CI 파이프라인에 넣기 전에 로컬에서 동일한 명령으로 검증한다.

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
claude -p "TC-001 실행해줘" --output-format stream-json --permission-mode acceptEdits
```

NDJSON 출력을 `jq`나 PowerShell의 `ConvertFrom-Json`으로 파싱하면 스텝별 결과를 구조화 데이터로 추출할 수 있어 리포트 자동화에 유리하다.

### ⚠️ 주의

- `--permission-mode bypassPermissions`는 편리하지만 **쓰지 말 것**. TC 실행 과정에서 파일 삭제 등 예상 밖의 동작까지 허용된다. `acceptEdits`로 파일 쓰기만 허용하는 것이 안전하다.
- `--max-turns`는 에이전트가 내부적으로 취할 수 있는 도구 호출 턴 수 상한이다. 긴 TC 스위트는 넉넉하게 200 이상을 준다.
- CI 실패 시 재현을 위해 `ci-output.ndjson`을 아티팩트로 반드시 보존한다.

---

## 📎 참고

- 로컬 MCP 환경 설치·등록·검증: `tc환경구축.md`
- 초기 셀렉터 수집 워크플로우: `tc환경구축.md` §5
