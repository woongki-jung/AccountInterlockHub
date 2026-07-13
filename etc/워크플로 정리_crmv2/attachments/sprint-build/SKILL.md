---
name: sprint-build
description: 빌드 스프린트 목표와 실행 범위에 따라 작업그룹을 정하고 start-builder 에이전트로 스프린트를 수행하기 위한 스킬
license: MIT
---

## 사용 상황

- 마일스톤에 따라 지정 영역의 코드 구현 작업을 시작할 때

## 실행 파라메터

- 스프린트 목표: 스프린트 실행 간 달성해야 하는 목표 서술
- 스프린트 범위: 마일스톤 중 구현하고자 하는 범위.

## 실행 동작

### 1. 스프린트 목표 및 범위 확인

- 실행 시 입력되지 않으면 질문을 통해 내용 확인 후 다음 단계 이행

### 2. 스프린트 대상 확인

- `sprints/milestone.md` 및 하위문서를 기준으로 지정된 개발 범위 확인

### 2.5. 스프린트 분할 (1 leaf = 1 sprint 원칙 / 2026-05-21 신설 / 의무)

마일스톤 기준으로 확인된 범위가 **여러 leaf (마일스톤 하위문서의 개별 도메인 셀)** 를 포함하는 경우, 1 leaf = 1 sprint 단위로 분할하여 순차 실행한다. 단일 sprint 로 여러 leaf 를 묶지 않는다.

- **근거**:
	- [`ai/strategies/sprint-ui-dev.md`](../../strategies/sprint-ui-dev.md) §L1~L10 — 모든 셀은 단일 파트가 책임지며, 페이지·모달·도메인 단위로 1 셀이 정의된다.
	- 동 문서 L162 — "각 후보의 셀 명세는 `sprints/build-<n>/ROADMAP.md` 의 Phase 단위로 1:1 변환해 발행" — 1 셀 = 1 sprint Phase 매핑.
	- 실증 패턴: build-93~98 시리즈 (AF 6 leaf AFA~AFF = 6 sprint), build-139~159 시리즈 (각 피드백/leaf 별 별도 sprint).
- **분할 식별 절차**:
	1. 입력된 "스프린트 범위" 가 `sprints/milestone/A_crm-player/AF_template.md` 등 leaf 다수 보유 milestone 의 상위 도메인 (예: "AF. 템플릿 관리") 을 지칭하면 → 하위 leaf 목록 (AFA, AFB, ...) 전수 추출.
	2. 입력에 "하위 전체 구현 요소" / "전체" / "모든 leaf" 등 leaf 다수를 명시한 표현이 포함되어 있어도 → 동일하게 분할 대상.
	3. 입력이 단일 leaf 직접 지칭 (예: "AFA. 카테고리 트리") 인 경우만 단일 sprint 진행.
- **분할 후 실행 순서**:
	- 각 leaf 별로 별도 sprint 번호 (build-N, build-N+1, ...) 부여.
	- 각 sprint 마다 `ai/agents/start-builder.md` 4 단계 (planner / worker / installer / closer) 를 **완료** 한 후 다음 sprint 착수.
	- 직전 sprint 의 commit/push 완료를 확인하지 않고 다음 sprint 를 시작하지 않는다 (sprint 간 작업 트리 잔재 누적 방지).
- **예외**:
	- 단일 leaf 만 다루는 sprint 는 분할 없이 진행.
	- 여러 leaf 를 명시적으로 단일 sprint 로 묶어달라는 사용자 지시가 있는 경우만 통합 진행 (이 경우 ROADMAP 의 Phase 가 leaf 별로 1:1 분리 작성되어야 한다).
- **사용자 확인 의무**:
	- 분할 sprint 수가 3 개 이상이 되는 경우, 첫 sprint 시작 전에 사용자에게 분할 계획 (sprint 수 + 각 sprint 의 leaf + 예상 build 번호) 을 보고하고 진행 의도 (1 sprint 씩 끊어 확인할지 / 연속 자동 진행할지) 확인한다.
	- 사용자 확인 없이 분할된 sprint 를 임의로 통합하거나 일부 leaf 만 선택 수행하지 않는다.

### 2.6. 외부 API 사양 의무 참조 (2026-05-22 신설 / 의무 / build-67~180 사고 재발 방지)

BE wire 결정 시 **`docs/prd/specification/api/` 외부 API 사양 디렉터리를 의무로 참조**한다. "DDL 부재 → mutation 본구현 불가" 라는 정당화는 외부 API 가 해당 기능을 제공하는 경우 무효이다.

- **근거**:
	- 본 프로젝트의 BE 는 외부 API (utengine-crm / utengine-ubms-client / 도로명주소 등) 의 프록시 역할이 핵심. CLAUDE.md §"FE 외부 API 직접 호출 금지" 정책에 따라 BE 가 단일 경유점.
	- 사내 DB (EMR PostgreSQL / TBL_*) 가 부재해도 외부 API 가 카테고리·템플릿·검수·메시지·요금 등의 CRUD 기능을 제공하면 BE 는 즉시 본구현 가능.
	- 실증 사고: build-67 ~ build-180 누적 50+ sprint 가 외부 API 사양 미참조로 인해 "DDL 부재" 정당화로 mutation 본구현을 TD 후속 위임 처리 → 사용자가 누적 결함 발견 (2026-05-22).
- **참조 의무 절차** (planner 단계):
	1. 변경 대상이 BE 라면 `docs/prd/specification/api/` 하위에서 관련 도메인 디렉터리 (예: `utengine-crm/template/`, `utengine-ubms-client/cost/`) 를 우선 확인한다.
	2. 사양 파일 (각 endpoint 별 .md) 의 **경로 / Method / Request Body / Response shape** 을 phase-1.md 의 변경 매트릭스에 기록한다.
	3. 외부 API 가 제공하는 endpoint 가 있으면 BE 는 `CrmApiClient` / `UbmsApiClient` 등 외부 API client 의 해당 메서드를 본구현 (`NotImplementedException` 제거 → `PostApiAsync(...)` 1줄) 하고, BE Controller 는 client 경유 호출로 본구현한다.
	4. FE 는 BE 프록시 endpoint 를 호출하는 `useMutation` hook 을 신설하고, 부모 컴포넌트의 onClick 핸들러에서 mutate 호출한다.
	5. "DDL 부재" 또는 "TBL_* 사양 미정비" 같은 사유로 본 sprint 의 mutation 본구현을 TD 후속 위임 처리하기 전에, **반드시 외부 API 사양 디렉터리를 확인** 한 후 위임 사유를 phase-1.md 에 기록한다.
- **검증 의무**:
	- planner 가 외부 API 사양 디렉터리를 미참조하면 closer 단계의 검증 게이트에서 차단된다 (phase-1.md 의 외부 API 사양 매트릭스 항목 부재 시).
	- BE wire 가 정의된 모든 sprint 는 `docs/prd/specification/api/` 디렉터리 참조 매트릭스를 phase-1.md 에 포함한다.
- **잘못된 등재 시 즉시 정정 의무**:
	- 외부 API 사양과 다른 형태의 endpoint 신설 TD 가 등재된 경우 (예: build-165 TD-165-01 "이미지 업로드 multipart/form-data endpoint 신설" — 실제 외부 API 는 template-create 의 image / mmsImage Base64 인라인 필드), 발견 즉시 본해소 sprint 분기로 처리하고 TD 를 명문 해소한다.
- **예외**:
	- 외부 API 가 제공하지 않는 기능 (예: 사내 EMR DB 직접 접근, 로컬 캐시 등) 만 사내 DDL 의존 본구현으로 진행.

### 3. 스프린트 실행

- §2.5 에서 분할된 leaf 별로 (분할 없는 경우 단일 sprint 로) 순차적으로 `ai/agents/start-builder.md` 에이전트를 호출하여 개발 스프린트를 실행한다.
- 각 sprint 호출 시 작업범위는 단일 leaf 로 한정한다 (해당 leaf 의 페이지·모달·hook·BE controller 등 구현 요소 포함).
- 직전 sprint 의 closer 완료 (commit/push 까지) 후에 다음 sprint 를 시작한다.

### 3.5. 런타임 동작 검증 (2026-05-19 신설 / 2026-05-21 sprint-build 환경 룰 분기 반영 / closer 진입 전 의무)

각 sprint 의 코드 변경 직후 closer 단계 진입 직전에, 변경된 endpoint·기능을 **직접 실행하여 정상 동작을 확인**한다. 컴파일·정적 검증·인스톨러 결정성 보존만으로 완료 처리하지 않는다.

**환경 표준 (2026-05-21 / sprint-build 전용 / 의무)**

- **빌드 모드**: 항상 **Debug 빌드** 로 검증한다 (`-BuildMode Debug` 명시). 외부 API (UBMS / utenginecrm / 도로명주소 등) 호출을 개발 서버로 분기시키기 위함이며, 외부 API 호출 TC 유무와 무관.
- **CRM 플레이어 역할**: API 호스트로만 활용한다. WinForms 자동화는 **홈화면 렌더링까지만** 사용 (App 기동 + doctor/1 로그인 + 비밀번호 다이얼로그 dismiss). 홈화면 진입 이후 모든 UI 조작은 Playwright 로만 수행.
- **UI 제어 채널**: Vite dev server (`http://localhost:5173`) + Playwright MCP 단일 채널. WebView2 CDP 9222 + WebSocket `Runtime.evaluate` + fetch interceptor 패턴은 **sprint-build 에서는 deprecated** (사용 금지).
- **로컬 DB**: EMR PostgreSQL 단일 환경 (Debug/Release 무관 동일 DB).
- 본 환경 룰의 도구·backend 매핑·셀렉터 원칙 단일 진실 출처: [`ai/strategies/ui-automation.md`](../../strategies/ui-automation.md) §6 sprint-build 표준 흐름.

**BE API 변경 시 (필수)**
- `tests/automation/launch-crm-app.ps1 -BuildMode Debug -OpenDevTools` 로 App 기동.
- 변경된 endpoint 식별 (Phase 1 매트릭스의 endpoint 목록 활용).
- 각 endpoint 를 `Invoke-RestMethod`/`curl` 로 호출 → 응답 status·shape·필드 값 확인.
- **save·update endpoint 는 save → get round-trip 검증 필수**: 송신 payload 의 모든 키가 직후 GET 응답에 그대로 반영되는지 1:1 확인. key shape 비대칭(adapter 누락 등) 검출.
- 데이터 변경 endpoint 는 호출 전후 DB SELECT 또는 동일 응답 GET 으로 변경 적용 여부 확인.

**FE UI 변경 시 (필수)**
- Vite dev server 기동 (`apps/CRMv2.Node.App.UI/` 에서 `npm run dev`) + **Playwright MCP** 로 `http://localhost:5173/<route>` 직접 진입 + 사용자 시나리오 재현 + `browser_console_messages` 콘솔 에러 0 확인 + `browser_network_requests` 로 BE 호출 캡쳐.

**검증 결과 등재**
- phase-N.md "검증 결과" 표 + closer build-report.md 에 결과 표기:
	- 🟢 Pass — 실 동작 round-trip 확인 완료
	- 🟠 Block — 자동 환경 한계로 검증 불가 + 사용자 수동 검증 절차 명시
	- 🟣 Pass-Static — 정적 검증만 수행 (후속 회귀 우선순위 등재)
- 실패 시 sprint 를 closer 로 진입시키지 않고 코드 수정 후 재검증 또는 분기 변경 결정.

**QM-06 단서 명확화**: "변경성 동작 주의" 정책은 외부 시스템(UBMS·utenginecrm 등) 호출 endpoint 한정. 로컬 BE ↔ 사내 EMR DB round-trip 은 self-test 데이터로 검증 가능하며, 변경된 endpoint 의 동작 검증을 생략하는 사유로 사용할 수 없다.

**실 사용자 시나리오 검증 패턴 (hotfix 6 사례 2026-05-19 / 2026-05-21 Playwright 전환 / 의무)**
- 본 sprint 의 hotfix 1~5 까지 모두 짧은 raw JSON round-trip 만 검증해서 **DBMS 컬럼 truncation (FOPTION SETUPVALUE 128 char 한계)** 결함을 5 회차 연속 미검출했다. hotfix 6 차수에 실 UI 시나리오 (Vite dev + 통합 payload + BE log 모니터링) 로 한 번에 본질 포착. 본 패턴을 모든 BE 변경 sprint 의 의무 검증으로 등재.
- 단계 (BE API 변경 sprint 의 closer 진입 직전 의무):
	1. **App 기동** — `tests/automation/launch-crm-app.ps1 -BuildMode Debug -OpenDevTools`. (외부 API 개발 서버 호출 + WebView2 CDP 활성 / sprint-build 표준)
	2. **자동 로그인** — pywinauto MCP `automation_elements` 로 `txtLoginID=doctor`/`txtPassword=1` set_text + PostMessage WM_KEYDOWN/UP Enter (main + child txtPassword HWND 동시 송신).
	3. **비밀번호 재설정 안내 다이얼로그 「나중에 변경」 자동 클릭** — `TfmSetUserPassConfirm` Delphi VCL custom-paint 다이얼로그는 element 식별 0건이지만 win32 backend + 좌표 click 으로 자동 클릭 가능: `& "D:\tools\pywinauto-mcp\venv\Scripts\python.exe" "D:\Work\CRMv2\tests\automation\dismiss-password-dialog.py" <App PID> click-left`.
	4. **홈화면 렌더링 도달 확인** — 다음 3 신호로 정의 (절차 2~3 의 WinForms 자동화는 본 단계까지 한정):
		- `MainWindowTitle="의사랑 CRM"` 변경
		- WebView2 자식 프로세스 up (App PID 의 `msedgewebview2` 자식 1건 이상)
		- `D:\YSR2000\YSRCRMv2\App\service_info.json` LastWriteTime 갱신 + `uri=http://localhost:<self-host-port>` 확보
	5. **Vite dev server 기동** — `apps/CRMv2.Node.App.UI/` 에서 `npm run dev` 백그라운드 (port 5173 strictPort). Vite proxy 의 `[build-20] OWIN proxy initial target` 로그에서 service_info.json target 확인.
	6. **Playwright MCP 로 UI 조작** (홈화면 도달 이후 모든 UI 조작의 유일 채널):
		- `browser_navigate http://localhost:5173/<route>` 로 변경 화면 진입
		- `browser_snapshot` 으로 DOM 트리·접근성 트리 확보 (요소 셀렉터 산출)
		- `browser_fill_form` / `browser_type` / `browser_select_option` 으로 사용자 시나리오 재현 (한글·특수문자·1000+ bytes 통합 payload 입력)
		- `browser_click` 으로 [저장] 버튼 클릭
		- `browser_network_requests` 로 송신 body 캡쳐 (필요 시 `browser_evaluate` 로 별도 fetch interceptor 설치 가능)
		- `browser_console_messages` 로 콘솔 에러 0 확인
	7. **BE log 동시 모니터링** — `D:\YSR2000\YSRCRMv2\App\logs\CRMv2.Net.App-YYYY-MM-DD.log` 의 `settings/save` 직후 entry 에서 `Unterminated string` `raw.Length=N` `fallback 적용` 등 silent 결함 로그 검출 필수.
	8. **GET round-trip** — `browser_evaluate("fetch('/api/.../get').then(r=>r.json())")` 또는 `Invoke-RestMethod` 로 BE 응답에 송신값이 1:1 반영됐는지 확인.
- **통합 payload 의무**: round-trip 검증 시 **사용자가 실제 채울 모든 필드 + 한글 + nested array** 를 포함한 1000+ bytes UTF-8 payload 사용. 짧은 단독 송신 (`{"send":{"hospitalName":"테스트"}}` 60 bytes) 만으로는 DBMS column-level truncation 결함을 절대 검출할 수 없다.
- 검증 실패 시 closer 로 진입하지 않고 본 sprint 계획 재검토 — 직전 자동 14/14 PASS 가 무의미한 신호임을 인지.

### 4. 결과 수집 및 업데이트

- `sprint/build/<작업자명>-<날짜>-<result>.md` 파일로 3에서 진행된 모든 스프린트의 결과보고와 토큰 사용 보고서를 취합하여 작성한다.
- `sprint/milestone.md` 의 구현 대상 항목에 개발 진척 상태 업데이트
	- 하위문서의 세부 항목에 스프린트 실행 결과의 제안/이슈사항을 착안사항란에 업데이트

### 5. 결과 업로드

- 작업 결과물을 현재 브랜치에 commit/push한다.