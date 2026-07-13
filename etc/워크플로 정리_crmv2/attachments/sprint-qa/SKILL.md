---
name: sprint-qa
description: 품질검수 스프린트 목표와 실행 범위에 따라 작업그룹을 정하고 start-qa 에이전트로 스프린트를 수행하기 위한 스킬
license: MIT
---

## 사용 상황

- 마일스톤에 따라 지정 영역의 품질 검수 작업을 시작할 때

## 실행 파라메터

- 스프린트 목표: 스프린트 실행 간 달성해야 하는 목표 서술
- 스프린트 범위: 마일스톤 중 품질 검증을 진행하고자 하는 범위.

## 실행 동작

### 1. 스프린트 목표 및 범위 확인

- 실행 시 입력되지 않으면 질문을 통해 내용 확인 후 다음 단계 이행

### 2. 스프린트 대상 확인

- `sprints/milestone.md` 및 하위문서를 기준으로 지정된 품질 검증 범위 확인

### 3. 스프린트 실행

- 마일스톤의 각 개발 항목 별 순차적으로 `ai/agents/start-qa.md` 에이전트에 품질검수 범위로 전달하여 개발 스프린트 실행

#### 3-1. 분할 단위 (N leaf → N sprint)

- 범위가 N개 leaf 인 경우 N개 sprint 로 분할 실행한다.
- 각 sprint 의 폴더명은 `sprints/qa/<YYYY-MM-DD>/qa-<n>-<git 유저명>/` 이며, `qa-<n>` 의 n 은 직전 sprint 의 마지막 번호 + 1 부터 시작한다.
- 이 규약은 `sprint-build` 의 분할 컨벤션(N leaf → N sprint)과 동일하다.

#### 3-2. 실행 순서 (직렬 + 포어그라운드 의무)

- **분할된 sprint 는 반드시 직렬로 실행한다.** 동시 병렬 실행 금지.
- **`Agent(run_in_background=true)` 사용 금지.** 모든 sprint 는 메인 응답 흐름 안에서 포어그라운드로 실행한다.
- 직전 sprint 의 commit/push 가 완료된 후 다음 sprint 에 진입한다.
- 사용자가 진행 상황을 실시간으로 화면에서 관찰·중간 개입할 수 있도록 한다.
- 사유: 자동 검증 도구가 동일 CDP 포트(9222)와 WebView2 UserData 폴더를 공유하므로 동시 실행 시 정확도가 훼손되며, UI 검증은 본질적으로 사용자가 화면을 볼 수 있어야 한다.

#### 3-3. 동적 검증 시도 의무 (2026-05-21 sprint-qa 환경 룰 개정 / 자동 환경 한계 사전 단정 금지)

**sprint-qa 환경 표준 (2026-05-21 / 의무)**

- **검증 대상**: `apps/deploy/scripts/build.ps1 -Mode <Test|Release>` 산출 인스톨러 → 자동 설치 → **표준 설치 경로 (`D:\YSR2000\YSRCRMv2\App\` 등 YSR_PATH_LIST 우선순위) 의 exe** 를 직접 기동한다. 워크스페이스 `apps/CRMv2.Net.App/bin/` 직접 기동은 sprint-qa 에서는 사용하지 않는다.
- **모드 분기**: 모드 미지정 시 **Test** 패키지 default. Debug 컴파일 산출물은 사용 금지.
- **CRM 플레이어 역할**: API 호스트 한정. WinForms 자동화는 **홈화면 렌더링까지만** (build sprint 와 동일).
- **UI 제어 채널**: 홈화면 도달 후 **Playwright MCP + 별도 브라우저 + CRM 셀프호스트 주소 직접 접속**. WebView2 내부 (CDP 9222) attach 는 사용하지 않는다.
- **자동화 도구**: pywinauto (WinForms `uia` / Delphi VCL `win32`) + Playwright MCP.

**의무 시도 절차 (각 sprint Phase 0)**

다음을 **반드시 1회 이상 시도**한다.

1. **인스톨러 빌드 + 자동 설치** (start-qa.md §사전 환경 준비 5 단계 절차 / 본 sprint 최초 1회):
	- `pwsh apps/deploy/scripts/build.ps1 -Mode <Test|Release>` → 산출물 정합 검증
	- InnoSetup `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS` 자동 설치
	- 표준 설치 경로의 App·Agent exe 정합 검증

2. **설치 경로 exe 기동** — `D:\YSR2000\YSRCRMv2\App\YSRCRMv2.Net.App.exe` (YSR_PATH_LIST 우선순위 탐색):
	```powershell
	$appExe = "D:\YSR2000\YSRCRMv2\App\YSRCRMv2.Net.App.exe"  # YSR_PATH_LIST 우선순위 탐색
	$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
	Start-Process -FilePath $appExe
	```
	WebView2 CDP 9222 활성은 sprint-qa 의 fallback 용도로만 유지 (기본 UI 제어는 Playwright 별도 브라우저).

3. **doctor/1 로그인 자동화** (pywinauto-mcp `uia` backend — sprint-build 동일).

4. **비밀번호 재설정 다이얼로그 자동 dismiss** (`tests/automation/dismiss-password-dialog.py` / pywinauto-mcp `win32` backend / 좌표 click — sprint-build 동일).

5. **홈화면 렌더링 도달 확인** — 다음 3 신호 모두 충족 (WinForms 자동화는 본 단계까지 한정):
	- `MainWindowTitle="의사랑 CRM"` 변경
	- WebView2 자식 프로세스 up (App PID 의 `msedgewebview2` 자식 1건 이상)
	- `D:\YSR2000\YSRCRMv2\App\service_info.json` LastWriteTime 갱신 + **`uri=http://localhost:<self-host-port>` 확보** (본 URI 가 후속 6 단계의 진입 주소)

6. **Playwright MCP 별도 브라우저 기동 + 셀프호스트 직접 진입** — 홈화면 도달 이후 모든 UI 조작의 유일 채널:
	```
	mcp__playwright__browser_navigate <service_info.json 의 uri>
	mcp__playwright__browser_snapshot     # UI 트리 덤프 (네이티브-Delphi/WinForms 외)
	```
	**Vite dev (5173) 는 사용하지 않는다.** sprint-qa 는 인스톨러 설치본의 wwwroot/ 가 셀프호스트에 의해 serve 되는 React UI 를 검증 대상으로 한다.

7. **UI 트리 사전 덤프** — sprint-qa 의 의미 단위:
	- `dumps/native-tree.json` — pywinauto 메인창 트리 (홈화면 도달 시점 / 네이티브 영역 한정)
	- `dumps/webview-tree.json` — Playwright MCP `browser_snapshot` 결과 (셀프호스트 URI 진입 직후 / SPA 영역)
	- 두 덤프 모두 본 sprint 시작 시점의 baseline 으로 보존하고, 각 phase 의 셀렉터 산출 근거로 활용한다.

**준비·실행·결과 3 단계 스크린샷**: 각 Phase 진행 시 `report-data/phase-N/` 하위에 보존 (UI 진입 가능 기능 한정 / `start-qa.md` §증빙 보존 의무).

**일반 단정 금지**: "자동 환경 한계" / "모든 input 자동화 차단" 등의 일반 단정으로 위 시도 자체를 봉쇄하지 않는다. 차단된 도구·동작에 한해 개별 🟠 Block 처리하고 **사유·시도 결과·차단된 도구·우회 시도 결과**를 모두 phase 문서에 기록한다.

본 의무는 [`CLAUDE.md` §기능 검증 — 실 사용자 시나리오 검증 절차](../../../CLAUDE.md) 7 단계 및 [`ai/agents/start-qa.md` §제약사항 — 증빙 보존 의무](../../agents/start-qa.md) + [`ai/strategies/ui-automation.md` §7 sprint-qa 표준 흐름](../../strategies/ui-automation.md) 와 정합한다.

### 4. 결과 수집

- `sprint/qa/<작업자명>-<날짜>-<result>.md` 파일로 3에서 진행된 모든 스프린트의 결과보고와 토큰 사용 보고서를 취합하여 작성한다.
- `sprint/milestone.md` 의 구현 대상 항목에 품질거증 진척 상태 업데이트
	- 하위문서의 세부 항목에 스프린트 실행 결과의 제안/이슈사항을 착안사항란에 업데이트

### 5. 결과 업로드

- 작업 결과물을 현재 브랜치에 commit/push한다.

### 6. 스프린트 closer 환경 정리 (마지막 sprint 사후)

본 sprint-qa 호출의 **마지막 sprint commit/push + 통합 보고서(§4·§5) commit/push 가 모두 완료된 직후** 본 sprint-qa 가 실행한 모든 프로세스를 종료한다.

#### 6-1. 종료 대상

- §3-3 동적 검증 시도 의무에 따라 설치 경로의 exe 로 기동한 **CRM 프로세스** (`YSRCRMv2.Net.App.exe` / 본 sprint-qa 가 띄운 PID 한정).
- 위 CRM 에 종속된 **WebView2 자식 프로세스** (CRM 종료 시 자동 종료되지만 잔존 시 명시 종료).
- 본 sprint-qa 가 기동한 **Playwright MCP 별도 브라우저 인스턴스** (셀프호스트 진입용 / `browser_close` 로 종료).
- 본 sprint-qa 가 시작한 **pywinauto-mcp 세션** (필요 시 명시 close).
- `start-qa.md §3-7` 임시 파일 정리 그대로 적용 (`tmp/tc-*/` 등 부산물).

#### 6-2. 보존 대상 (sprint-qa 가 띄우지 않은 외부 작업)

- 사용자가 사전에 실행 중이었던 **Vite dev server** (port 5173 / sprint-build 잔존 — sprint-qa 는 Vite 를 사용하지 않으므로 본 sprint 영향 0).
- 다른 sprint-build·hotfix 작업이 띄운 **빌드 출력** (`bin/Debug/` 등).
- 사용자의 별도 작업 프로세스 (IDE·터미널·외부 도구 등).
- **설치 산출물**: 사전 환경 준비에서 자동 설치한 표준 경로의 App·Agent 는 보존한다 (사용자 PC 운영 환경 정합 / 다음 sprint 의 재사용 가능). 단 사용자 운영 환경과 검증 환경 분리가 필요한 경우 closer 보고에 별도 안내.

#### 6-3. 종료 절차

- 본 sprint-qa 가 띄운 PID 를 사전에 기록해 두고, closer 시점에 해당 PID 만 종료한다.
- PowerShell: `Stop-Process -Id <본_sprint_qa_가_띄운_PID> -Force`.
- 종료 후 잔존 확인: `Get-Process -Name 'YSRCRMv2.Net.App' -ErrorAction SilentlyContinue` 결과가 비어있어야 한다.
- Playwright 별도 브라우저 종료 확인: `mcp__playwright__browser_close` 호출 후 추가 Playwright 도구 호출 시 "no browser context" 응답이어야 한다.

#### 6-4. 보고 의무

- 종료 결과를 통합 결과 보고서(§4 / `정웅기-<날짜>-qa-<도메인>.md`)의 마지막 절에 한 줄로 등재한다:
  - `**환경 정리 (closer)**: CRM PID=<N> 종료 + WebView2 자동 종료 + Playwright 별도 브라우저 종료 / 설치 산출물 (<Mode> 모드) 표준 경로 보존 / tmp/tc-* 정리 완료.`
- 종료 실패 시 잔존 프로세스 PID + 사유를 동일 절에 명시한다 (다음 sprint-qa 호출의 사전 환경 점검에서 영향 검토 가능하도록).