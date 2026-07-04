# TC 실행 환경 구축 (검증 도구 MCP)

[`../qa-execution.md`](../qa-execution.md) 의 도구 운용 하위 지침. 검증 TC 를 **실제 동작 재현**으로 실행하기 위한 검증 도구(MCP 서버)의 설치·등록·연결 검증·식별자 수집 절차를 정의한다. 수행 시점·주체·체크 기록은 [`project-bootstrap.md`](../project-bootstrap.md) §6 을 따른다.

## 구성 전략

테스트 대상 프로그램을 **UI 종류**로 분류하고, 종류마다 담당 MCP 를 하나씩 둔다. 분류 입력은 directing 프로그램 구성표([`../qa-execution.md`](../qa-execution.md) §케이스 선택)다. 한 제품이 여러 종류를 동시에 가지면(예: 네이티브 앱 + 내장 웹뷰) 해당 MCP 를 모두 등록해 세션이 컨텍스트에 따라 전환한다.

| 검증 케이스 | 대상 UI 종류 | 담당 MCP | 연결 방식 |
|---|---|---|---|
| [web-ui.md](web-ui.md) | 브라우저 웹·SPA | playwright-mcp | 브라우저 직접 기동 |
| [web-ui.md](web-ui.md) 병행 | 네이티브 내장 웹뷰(하이브리드) | playwright-mcp | 원격 디버깅 포트 + CDP attach |
| [desktop-ui.md](desktop-ui.md) | 데스크톱 네이티브 UI | pywinauto-mcp 등 OS UI 자동화 | 접근성/UI API — 백엔드 선택(아래) |
| [api-server.md](api-server.md) · [cli-batch.md](cli-batch.md) | UI 없음 | 별도 MCP 불필요 | HTTP 호출·명령 실행 도구로 충분 |

모바일 등 신규 케이스가 추가되면 해당 자동화 MCP(appium 계열 등)를 같은 절차(설치 → 등록 → 검증)로 갖춘다.

**데스크톱 네이티브 백엔드 선택 기준** — 대상 앱이 UI Automation(접근성 트리)을 노출하는지로 갈린다.

- UIA 지원 관리형 프레임워크(WinForms·WPF·UWP·.NET 계열) → `uia` 백엔드. `AutomationId`/`Name` 기반 제어.
- UIA 미지원·구형 Win32 계열(클래식 Win32·MFC·Delphi/VCL 등) → `win32` 백엔드. 창 클래스명 기반 제어.
- 판단이 어려우면 §사전 준비의 검사 도구로 대상 앱을 먼저 찍어 본다 — 컨트롤이 `AutomationId`/`ControlType` 으로 풍부하게 보이면 `uia`, 창 클래스명으로만 보이면 `win32` 가 안정적이다.

## 사전 준비

1. **런타임** — Node.js(playwright-mcp 구동용)는 부트스트랩 §1 로 이미 갖춰진다. 네이티브 UI 대상이 있으면 Python 3.10 이상을 추가 설치한다. 대상 앱이 요구하는 런타임(.NET·내장 Chromium 등)은 설치 산출물이 갖는다.
2. **검사 도구** — 식별자 확인용. 대상 종류에 해당하는 것만 준비한다.
	- 웹·내장 웹뷰 → 브라우저 DevTools. DOM 의 `role`·`data-testid`·`aria-label`·주요 셀렉터 확인.
	- 네이티브(UIA) → `Inspect.exe`(Windows SDK 포함). UIA 트리의 `AutomationId`/`Name`/`ControlType` 확인.
	- 네이티브(Win32) → `Spy++`(Visual Studio 설치 시 포함). 창 클래스명·컨트롤 텍스트 확인.

## 설치

대상에 해당하는 서버만 설치한다. 전부 **PC 로컬** 항목이다.

1. **playwright-mcp** (웹·하이브리드) — `npm install -g @playwright/mcp`. 순수 웹 대상이면 Playwright 가 자체 브라우저를 받아 직접 기동하고, 내장 웹뷰(CDP attach) 대상이면 앱이 Chromium 런타임을 내장하므로 별도 다운로드가 불필요하다.
2. **pywinauto-mcp** (데스크톱 네이티브) — `<QA_TOOLS_HOME>` 하위에 저장소를 복제해 가상환경으로 설치한다.
	1. `git clone https://github.com/sandraschi/pywinauto-mcp.git` 후 해당 폴더에서 `python -m venv venv` → venv 활성화.
	2. `pip install -e ".[all]"` (OCR·플러그인 포함 전체 의존성).
	3. venv 내 python 절대 경로를 확인해 둔다(§MCP 등록에서 사용) — `Get-Command python`.
	4. 동작 확인 — `python -m pywinauto_mcp` 실행 시 stdio 대기 상태에 진입하면 정상(Ctrl+C 로 종료).

## 내장 웹뷰의 원격 디버깅(CDP) 활성화

네이티브 앱에 내장된 웹 화면을 playwright-mcp 로 제어하려면 그 웹뷰의 원격 디버깅 포트가 열려 있어야 한다. WebView2·CEF·Electron 등 Chromium 계열 웹뷰는 모두 CDP 를 지원하며, 포트를 켜는 방법만 런타임마다 다르다. 원칙은 **운영 빌드는 건드리지 않고 테스트 시점에만 포트를 여는 것**이다.

1. **환경변수·실행 인자 주입 (권장 — 앱 코드 변경 불필요)** — 앱 기동 전 런타임별 디버깅 인자(`--remote-debugging-port=9222`)를 주입한다. WebView2 는 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 환경변수로, Electron/CEF 는 실행 인자로 전달한 뒤 `<APP_BIN>.exe` 를 기동한다.
2. **앱 코드에 명시 (주입이 안 통할 때)** — 테스트 전용 빌드 구성(조건부 컴파일 심볼)으로 감싸 운영 빌드에 유출되지 않게 하고, 웹뷰 초기화 시 디버깅 인자를 추가한다.
3. **확인** — 앱 실행 후 `http://localhost:9222/json/version` 응답에 `webSocketDebuggerUrl` 필드가 나오면 정상이다. `http://localhost:9222/json` 목록에 웹뷰 페이지가 떠야 한다.

비 Chromium 웹뷰는 CDP 를 지원하지 않는다 — 구형 IE 기반 WebBrowser 컨트롤은 네이티브 UI 자동화(desktop-ui 케이스)로만 다룬다.

## MCP 등록

Claude Code CLI 로 등록한다. 팀 공유를 위해 **project 스코프**(워크스페이스 루트 `.mcp.json` 저장·커밋)를 기본으로 한다.

1. 워크스페이스 루트에서 대상에 해당하는 서버만 등록한다.
	- playwright: `claude mcp add playwright -s project -- npx -y "@playwright/mcp@latest"`
	- pywinauto: `claude mcp add pywinauto -s project -- "<QA_TOOLS_HOME>\pywinauto-mcp\venv\Scripts\python.exe" -m pywinauto_mcp`
2. PC 마다 설치 경로가 다르면 literal 경로 대신 OS 환경변수로 추상화해 등록하고, 그 키를 [`CLAUDE.local.md`](../../../CLAUDE.local.md) §OS 환경변수에 기록한다.
3. 등록 확인 — `claude mcp list` 에 서버가 나열되는지 확인한다. 설정 변경은 `claude mcp remove <이름>` 후 재등록한다.

## 연결 검증 체크리스트

**새** Claude Code 세션에서 `/mcp` 로 등록 서버가 모두 `connected` 인지 확인한 뒤(등록은 실행 중 세션에 반영되지 않는다), 대상에 해당하는 항목만 순서대로 검증한다.

1. **선행 체크 (사람)**
	- (웹·웹뷰) 브라우저 DevTools 로 대상 페이지의 `role`/`data-testid` 가 식별되는가.
	- (네이티브 UIA) `Inspect.exe` 로 찍었을 때 컨트롤 트리가 `AutomationId`/`Name` 으로 풍부하게 나오는가.
	- (네이티브 Win32) `Spy++` 로 찍었을 때 창 클래스명이 보이는가.
	- (내장 웹뷰) 앱 실행 후 `http://localhost:9222/json` 목록에 웹뷰 페이지가 뜨는가.
2. **세션 내부 체크 (세션에 지시해 확인)**
	- (네이티브) 열려 있는 창들의 타이틀·프로세스명 나열 → 대상 앱 창이 반환되는가.
	- (웹) 대상 URL 을 열고 페이지 title 조회 → 페이지 정보가 반환되는가.
	- (내장 웹뷰) `localhost:9222` 에 CDP 연결해 첫 페이지의 URL·title 조회 → 웹뷰 내 페이지 정보가 반환되는가.

대상에 해당하는 항목이 모두 성공해야 TC 실행이 가능하다. 실패 항목이 있으면 §문제 해결로 원인을 잡고 재검증한다.

## 식별자 수집

TC 실행 전 사람이 한 번 수행해 두는 준비다 — 세션의 식별자 추측을 줄이고 실패 시 대안 탐색을 빠르게 한다.

1. 각 대상 앱·페이지를 수동 실행하고, §사전 준비의 검사 도구로 주요 화면의 식별자를 정리한다 — 웹: 셀렉터·`data-testid` / UIA: `AutomationId`·`Name` / Win32: 창 클래스명·컨트롤 텍스트.
2. 정리 결과는 해당 케이스 하위 지침([web-ui.md](web-ui.md)·[desktop-ui.md](desktop-ui.md))의 §검증 도구·절차 프로젝트별 채움 항목에 기입한다. 양이 많으면 개발사양(`docs/prd/devspec/`) 하위에 컨트롤 카탈로그 문서로 두고 채움 항목에서 링크한다.

## 문제 해결

- `/mcp` 에서 `failed` 상태 — 서버 실행 명령을 수동으로 직접 실행해 에러 메시지를 확인한다(venv python 경로 오탈자·의존성 누락이 흔하다).
- 원인이 안 보이면 `claude --mcp-debug` 로 세션을 열어 MCP 통신 로그에서 연결 실패 원인을 찾는다.
- 보안 제품이 프로세스 생성을 막거나, PowerShell 실행 정책(`Get-ExecutionPolicy`)이 스크립트를 차단하는 경우가 있다.
