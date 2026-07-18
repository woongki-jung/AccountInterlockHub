# 🛠️ TC 실행환경 구축 가이드

대상: **WinForms 기반 WebView2 하이브리드 앱**과 **Delphi(VCL) 네이티브 앱**에 대한 크로스 앱 테스트 자동화를 수행하기 위해, 로컬에 MCP 기반 테스트 환경을 구축하려는 QA 엔지니어.

본 문서는 **설치·등록·검증 단계**까지를 다룬다. 에이전트가 TC를 실제 실행할 때 따라야 할 규칙은 `tc-guide.md`를 참조한다.

## 📦 구성 전략

`pywinauto-mcp`를 네이티브 UI 제어의 단일 창구로 두고 백엔드만 상황별로 전환한다. WebView2 내부 DOM 조작은 `playwright-mcp`가 CDP를 통해 담당한다.

- **Delphi(VCL) 앱** → pywinauto-mcp, backend=`win32`
- **WinForms 네이티브 UI** → pywinauto-mcp, backend=`uia`
- **WebView2 내부 웹 콘텐츠** → playwright-mcp, `connectOverCDP`

---

## 1. 사전 준비

### 1.1 운영체제 및 런타임

Windows 10 22H2 이상 또는 Windows 11을 권장한다. UI Automation과 WebView2 모두 최신 런타임에서 안정적이다. 다음 런타임을 미리 확보한다.

- ⬜ Python 3.10 이상 (pywinauto-mcp 구동용)
- ⬜ Node.js 18 이상 (playwright-mcp 구동용)
- ⬜ Microsoft Edge WebView2 Runtime (Evergreen 배포판 권장, 테스트 대상 WinForms 앱이 요구하는 버전 이상)
- ⬜ .NET 6 이상 (테스트 대상 WinForms 앱 빌드 및 실행에 필요한 경우)

### 1.2 MCP 클라이언트: Claude Code

본 가이드는 **Claude Code**를 기준으로 작성되었다. Claude Code는 CLI 기반이라 MCP 구성과 TC 실행을 스크립트화하기 쉽고, headless 모드로 CI 통합까지 자연스럽게 연결된다.

```powershell
# Node.js 18 이상 필요
npm install -g @anthropic-ai/claude-code

# 버전 확인
claude --version
```

### 1.3 실행 환경 선택

Windows 앱 자동화이므로 Claude Code도 **Windows 네이티브 쉘(PowerShell 또는 Windows Terminal)에서 실행**하는 것을 권장한다. WSL에서 실행할 수도 있지만, 이 경우 MCP 서버(특히 pywinauto-mcp)는 Windows API에 접근해야 하므로 반드시 Windows 측에서 구동되어야 하고, `powershell.exe` 브릿지가 필요하다. WSL 사용 시 추가 설정은 §3.4에 별도 기술했다.

### 1.4 스코프

Claude Code의 MCP 설정에는 세 가지 스코프가 있다.

- `local` (기본값) — 현재 프로젝트, 현재 사용자만. 실험용으로 가볍게 쓸 때.
- `project` — 프로젝트 루트의 `.mcp.json`에 저장되어 팀과 공유. QA 프로젝트 저장소에 포함시킬 때.
- `user` — 사용자 홈의 `~/.claude.json`에 저장되어 모든 프로젝트에서 공통 사용. 개인 QA 작업 환경용.

본 가이드는 팀 공유를 전제로 `project` 스코프를 기본으로 한다. 개인 검증 단계에서는 `user` 스코프로 시작해도 무방하다.

### 1.5 검사 도구 (선택이지만 강력 권장)

- `Inspect.exe` — Windows SDK 포함. UIA 트리 탐색. WinForms 앱의 AutomationId/Name 확인용. 경로: `C:\Program Files (x86)\Windows Kits\10\bin\<sdk-ver>\x64\Inspect.exe`
- `Spy++` — Visual Studio 설치 시 포함. Win32 메시지 및 클래스명 확인. Delphi 컨트롤 식별용 필수.

테스트 스크립트 작성 전에 이 두 도구로 각각 앱을 찍어 컨트롤 식별자를 미리 확보해두면 에이전트에게 넘길 힌트가 명확해진다.

---

## 2. MCP 서버 설치

### 2.1 pywinauto-mcp 설치

Delphi와 WinForms 네이티브를 모두 담당할 핵심 컴포넌트다.

```powershell
# 작업 디렉터리 선택 후
git clone https://github.com/sandraschi/pywinauto-mcp.git
cd pywinauto-mcp

python -m venv venv
.\venv\Scripts\Activate.ps1

# 전체 의존성(OCR, 보안 플러그인 포함)
pip install -e ".[all]"
```

설치 후 venv 내 Python 경로를 확인한다. MCP 설정에서 사용할 절대 경로다.

```powershell
Get-Command python | Select-Object -ExpandProperty Source
# 예: C:\repo\pywinauto-mcp\venv\Scripts\python.exe
```

동작 확인. 서버가 stdio로 대기 상태에 진입하면 정상이다. `Ctrl+C`로 종료.

```powershell
python -m pywinauto_mcp
```

### 2.2 playwright-mcp 설치

WebView2 내부 웹 콘텐츠 테스트용. Microsoft가 공식 배포하는 패키지를 쓰는 게 가장 깔끔하다.

```powershell
npm install -g @playwright/mcp
```

Playwright 자체 브라우저 바이너리는 CDP attach 모드에서는 쓰지 않는다. WebView2가 이미 Edge Chromium 런타임을 내장하고 있기 때문에 별도 다운로드는 불필요하다.

### 2.3 WinForms 앱의 CDP 활성화

WebView2를 Playwright가 제어하려면 CDP 포트가 열려 있어야 한다. 두 방법 중 테스트 환경에 맞는 쪽을 선택한다.

**방법 A: 환경변수 주입 (권장, 앱 코드 변경 불필요)**

테스트 실행 스크립트에서 앱 런치 시 환경변수를 주입한다. 운영 빌드는 그대로 두고 테스트 시점에만 CDP를 연다.

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222 --auto-open-devtools-for-tabs"
$env:WEBVIEW2_USER_DATA_FOLDER = "C:\temp\wv2-test-userdata"
Start-Process "C:\path\to\YourWinFormsApp.exe"
```

- `--auto-open-devtools-for-tabs`는 초기 셀렉터 작성 단계에서만 켜고, CI에서는 빼는 것을 권장한다.

**방법 B: 앱 코드에 명시**

테스트 전용 빌드 컨피그(`#if DEBUG` 또는 커스텀 심볼)로 감싸 운영 빌드에 유출되지 않게 한다.

```csharp
#if TEST_AUTOMATION
var options = new CoreWebView2EnvironmentOptions {
    AdditionalBrowserArguments = "--remote-debugging-port=9222"
};
var env = await CoreWebView2Environment.CreateAsync(null, null, options);
await webView.EnsureCoreWebView2Async(env);
#else
await webView.EnsureCoreWebView2Async();
#endif
```

**확인**

앱을 실행하고 브라우저에서 다음 URL에 접속했을 때 JSON 응답에 `webSocketDebuggerUrl` 필드가 나오면 정상이다.

```
http://localhost:9222/json/version
http://localhost:9222/json
```

---

## 3. MCP 서버 등록 (Claude Code)

Claude Code는 CLI 명령으로 MCP 서버를 등록한다. 등록이 완료되면 `.mcp.json`(project 스코프) 또는 `~/.claude.json`(user 스코프)에 자동 저장된다.

### 3.1 프로젝트 디렉터리 이동 후 시작

```powershell
# QA 자동화 프로젝트 루트로 이동 (TC 스크립트와 산출물이 모일 위치)
cd C:\qa\cross-app-tests
```

### 3.2 서버 등록

**pywinauto-mcp 등록 (project 스코프)**

절대 경로는 앞서 설치한 venv의 경로로 수정한다.

```powershell
claude mcp add pywinauto -s project `
  -- "C:\repo\pywinauto-mcp\venv\Scripts\python.exe" -m pywinauto_mcp
```

**playwright-mcp 등록**

```powershell
claude mcp add playwright -s project `
  -- npx -y "@playwright/mcp@latest"
```

### 3.3 팀 공유 시

`project` 스코프로 등록하면 프로젝트 루트에 `.mcp.json`이 생성된다. 이 파일을 저장소에 커밋하면 팀원이 `claude` 실행 시 동일 구성을 자동으로 사용하게 된다. 단, 팀원별로 pywinauto-mcp 설치 경로가 다를 수 있으므로 환경변수로 경로를 추상화하는 방법도 있다.

```powershell
# 환경변수 방식 예시 - 팀원이 각자 PYWINAUTO_MCP_PY 환경변수를 설정
claude mcp add pywinauto -s project `
  -- "%PYWINAUTO_MCP_PY%" -m pywinauto_mcp
```

### 3.4 WSL에서 Claude Code를 쓰는 경우

pywinauto-mcp는 Windows API가 필요하므로 WSL 내부에서 직접 돌릴 수 없다. `powershell.exe`를 통해 Windows 측 파이썬을 호출하는 형태로 등록한다.

```bash
# WSL 내부에서 실행
claude mcp add pywinauto -s user \
  -- powershell.exe -NoProfile -Command \
  "C:\repo\pywinauto-mcp\venv\Scripts\python.exe -m pywinauto_mcp"

claude mcp add playwright -s user \
  -- powershell.exe -NoProfile -Command \
  "npx -y @playwright/mcp@latest"
```

playwright-mcp는 WSL 내부에서도 돌 수 있지만, WebView2의 CDP 포트가 Windows 측 `localhost:9222`에 열려 있어 WSL에서 접근하려면 네트워크 경로 구성이 추가로 필요하다. 단순화를 위해 양쪽 모두 Windows 측에서 돌리는 편이 낫다.

### 3.5 등록 확인

```powershell
claude mcp list
```

출력 예시:

```
pywinauto   stdio   C:\repo\pywinauto-mcp\venv\Scripts\python.exe -m pywinauto_mcp
playwright  stdio   npx -y @playwright/mcp@latest
```

### 3.6 서버 제거 및 재등록

설정 변경이 필요할 때:

```powershell
claude mcp remove pywinauto
claude mcp remove playwright

# 다시 추가
claude mcp add pywinauto -s project -- ...
```

---

## 4. 연결 검증 체크리스트

Claude Code 세션을 시작해서 각 항목을 확인한다.

```powershell
cd C:\qa\cross-app-tests
claude
```

세션이 열리면 `/mcp` 명령으로 서버 연결 상태를 확인한다.

```
/mcp
```

두 서버가 모두 `connected` 상태여야 한다. 그다음 아래 항목을 순서대로 검증한다.

- ⬜ `Inspect.exe`로 WinForms 앱을 찍었을 때 컨트롤 트리가 풍부하게 나오는가 (AutomationId/Name)
- ⬜ `Spy++`로 Delphi 앱을 찍었을 때 `TEdit`, `TButton` 등 VCL 클래스명이 보이는가
- ⬜ WinForms 앱 실행 후 `http://localhost:9222/json`에 WebView 페이지가 목록에 뜨는가
- ⬜ Claude Code 세션에서 `pywinauto로 현재 열려 있는 창들의 타이틀과 프로세스명을 나열해줘`라고 요청했을 때 두 앱 창이 반환되는가
- ⬜ Claude Code 세션에서 `playwright로 http://localhost:9222에 CDP 연결해서 첫 페이지의 URL과 title을 알려줘`라고 요청했을 때 WebView 내 페이지 정보가 반환되는가

항목 1~3은 사람이 직접 확인하는 선행 체크이고, 4~5는 Claude Code 세션 내부에서 확인한다. 모두 성공해야 TC 실행 단계로 넘어간다.

### 🩹 문제 해결

`/mcp`에서 `failed` 상태로 나올 때:

- 서버의 실제 실행을 수동으로 테스트한다. `C:\repo\pywinauto-mcp\venv\Scripts\python.exe -m pywinauto_mcp`를 직접 실행해서 에러 메시지를 확인한다.
- `claude --mcp-debug` 옵션으로 세션을 열면 MCP 통신 로그가 출력되어 연결 실패 원인을 찾기 쉽다.
- Windows Defender나 사내 보안 정책이 프로세스 생성을 막는 경우가 있다. PowerShell 실행 정책(`Get-ExecutionPolicy`)도 확인한다.

---

## 5. 초기 셀렉터 수집 워크플로우

TC를 에이전트에게 전달하기 전, 사람이 수행해야 할 준비 작업이다. 한 번만 해두면 이후 에이전트에게 반복해서 안내할 필요가 없다.

- ⬜ 각 앱을 수동 실행
- ⬜ Delphi 앱은 Spy++로 찍어 각 화면의 창 클래스명, 버튼 텍스트, 입력 필드의 부모/인덱스를 정리
- ⬜ WinForms 앱은 Inspect.exe(UIA 모드)로 찍어 AutomationId, Name, ControlType을 정리
- ⬜ WebView 내부는 DevTools(F12)로 role, testid, 주요 셀렉터를 정리
- ⬜ 위 결과를 "컨트롤 카탈로그" 마크다운으로 정리해 프로젝트 루트의 `./docs/control-catalog.md`에 저장하고 `CLAUDE.md`에서 참조 링크를 걸어둔다

Claude Code는 `CLAUDE.md`와 함께 참조된 문서를 세션 시작 시 함께 읽으므로, 셀렉터 추측을 줄이고 실패 시에도 대안을 빠르게 찾을 수 있다.

**예시 — `CLAUDE.md`에서 카탈로그 참조**

```markdown
## 참조 문서

TC 실행 시 다음 문서를 항상 우선 참조할 것:
- 컨트롤 카탈로그: @docs/control-catalog.md
- 앱별 프로세스/창 정보: @docs/app-registry.md
```

`@` 접두사를 쓴 파일 경로는 Claude Code가 세션 시작 시 자동으로 컨텍스트에 포함한다.

---

## 📎 다음 단계

환경 구축이 완료되면 에이전트가 실제 TC를 실행할 때의 규칙·패턴·CI 통합 방안은 `tc-guide.md`를 참조한다.
