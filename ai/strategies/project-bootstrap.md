# 프로젝트 부트스트랩 전략

본 문서는 이 워크스페이스를 **템플릿으로 복제해 새 프로젝트를 시작**할 때, 워크플로우 가동 전에 갖춰야 할 준비 전체의 절차와 설명을 정의하는 단일 출처다. 다른 PC 에서 같은 프로젝트를 재구성할 때도 본 문서의 PC 로컬 항목을 재수행한다(§다른 PC 재구성).

- **전제**: Windows PC(관리자 권한 사용 가능)·인터넷 연결, 프로젝트 git 원격 저장소(호스팅), 운영 중인 공용 Redmine 서비스(접속 가능 계정 — §3).
- **실행 주체**: 담당자가 주도한다. 도구 설치·외부 서비스 UI 조작(§1, §3-A)은 사람만 할 수 있고, Redmine 프로젝트 생성(§3-C)·작업세션 워크플로 적용(§4-A)·이전 산출물 정리(§2)·설정 파일 갱신 등은 세션(에이전트)에 위임할 수 있다.
- **진행 기록**: [`CLAUDE.local.md`](../../CLAUDE.local.md) §준비 체크리스트에 **수행 여부만** 체크한다(PC 별·git 비관리). 항목의 의미·수행 방법은 전부 본 문서가 가지며, 체크리스트에는 설명을 두지 않는다.

## 준비 체크리스트 양식

`CLAUDE.local.md` 생성 시(§2) 아래 양식을 그대로 §준비 체크리스트로 넣고, 항목을 완료할 때마다 체크한다. §1~§5 전 항목 체크 후 §준비 상태의 `준비완료` 를 `예` 로 바꾼다([`CLAUDE.md`](../../CLAUDE.md) §워크스페이스 구성 준비). §6 은 directing 산출물(프로그램 구성표)이 있어야 수행할 수 있는 지연 항목이라 준비완료 판정에 포함하지 않는다 — 첫 기능검증(build)·qa 착수 전까지 완료한다.

```
## 준비 체크리스트

수행 여부만 기록 — 항목 설명·수행 방법은 `ai/strategies/project-bootstrap.md` 해당 절.

- [ ] §1 PC 도구 (git·Node.js·Claude Code·npm install·OS 환경변수)
- [ ] §2 저장소 복제·origin 교체
- [ ] §2 CLAUDE.env.md 기본 골격 갱신
- [ ] §2 CLAUDE.local.md 생성
- [ ] §2 이전 산출물 정리·채움 지점 점검
- [ ] §3 Redmine 접속 정보 확보 (자격증명 기입)
- [ ] §3 Redmine MCP 등록·연결 확인
- [ ] §3 Redmine 프로젝트 생성 (운영·제품)
- [ ] §4 작업세션 트래커·워크플로 개방 (Redmine)
- [ ] §4 config.json·운영 상태 이슈 구성
- [ ] §4 ai-pm 세션 기동·왕복 확인
- [ ] §5 통합 검증·기동
- [ ] §6 TC 실행 환경 (검증 도구 MCP 설치·등록·연결 확인 — directing 후 지연 항목)
```

## 절차 요약

뒤 절은 앞 절 결과물을 전제한다 — 순서대로 진행한다(§6 만 예외 — directing 산출물 확정 후 수행).

| 순서 | 절 | 내용 | 완료 시 상태 |
|---|---|---|---|
| 1 | §1 PC 공통 환경 | 공통 도구 설치 | git·Node.js·Claude Code 가동 |
| 2 | §2 저장소·루트 설정 | 복제·origin 교체·루트 config·산출물 정리 | 새 프로젝트 저장소 + `CLAUDE.env.md`/`CLAUDE.local.md` 준비 |
| 3 | §3 Redmine 연결 | 공용 서비스 접속·MCP 등록·프로젝트 생성 | 작업 티켓 정본 연결 + MCP 가동 |
| 4 | §4 ai-pm | 작업세션 트래커·워크플로·config 구성 | Redmine 폴링 세션 가동 |
| 5 | §5 통합 검증·기동 | 연동 검증·기준선 커밋 | ai-pm 세션 가동 — directing 착수 가능 |
| 6 | §6 TC 실행 환경 | 검증 도구(MCP) 설치·등록·연결 검증 — directing 프로그램 구성표 확정 후 | 실동작 재현 기반 TC 실행 가능 |

## 1. PC 공통 환경

워크스페이스 운용에 필요한 도구를 PC 에 설치한다. 이미 구성된 PC 라면 확인 명령만 돌린다. 본 절 항목은 전부 **PC 로컬**이다.

- **git** — 설치 + 사용자 식별 설정. 확인 `git --version`, 설정 `git config --global user.name/user.email`.
- **Node.js** — Redmine MCP 서버·ai-pm 세션 MCP 큐레이션(`mcp-curate.js`) 실행용. **v20.6 이상** 권장(현 워크스페이스 검증 버전: v26). 설치는 https://nodejs.org LTS 또는 `winget install OpenJS.NodeJS.LTS`.
- **Claude Code CLI** — 에이전트 세션 실행 도구. `claude --version` + 로그인 상태 확인. 설치·로그인은 https://claude.com/claude-code 안내.
- **PowerShell** — 세션 래퍼(`ai/scripts/ai-pm-session.ps1`) 실행용. Windows 기본 탑재 — 실행 정책이 막혀 있으면 `-ExecutionPolicy Bypass` 로 호출한다.
- **npm 의존성 설치** — 루트 ai-pm 런타임은 외부 의존성이 없다(Redmine MCP·`mcp-curate.js` 는 단독 node). 앱(`apps/`) 의존성은 build 시 `npm run install:apps` 로 설치한다.
- **OS 환경변수** — `CLAUDE.local.md` §OS 환경변수에 정의된 항목이 있으면 설정(현재 정의 없음 — §2 이후 확인해도 된다).

## 2. 저장소·루트 설정

- **템플릿 복제·원격 교체** — 템플릿 저장소를 복제하고 새 프로젝트 저장소를 `origin` 으로 지정한다(`git remote set-url origin <새 저장소 URL>`). 기본 브랜치는 `main` — 승인 통과 기준선. 작업 브랜치·커밋·병합 운용은 [`git-flow.md`](git-flow.md).
- **`CLAUDE.env.md` 기본 골격 갱신** — 이전 프로젝트 값을 정리하고, 부트스트랩 시점에 확정 가능한 기본 값(`<PROJECT>`·`<WORK_ROOT>` 등 — `<REDMINE_PROJECT>` 는 §3-C 에서 확정)만 기입한다. **구체 프로그램 구성 변수**(설치 경로·실행 파일·소스 프로젝트명 등)는 여기서 채우지 않는다 — 프로젝트 초기 설정 과정에서 directing 수행 주체가 프로그램 구성표·개발사양 확정에 맞춰 변수로 추가·갱신한다([`stages/directing.md`](stages/directing.md) §산출물).
- **`CLAUDE.local.md` 생성** — git 비관리 비밀 저장소. [`CLAUDE.md`](../../CLAUDE.md) §환경변수 키 목록의 전 키 값을 입력한다(Redmine 값은 직접 기입; ai-pm 전용 Redmine 키를 쓰면 `ai/bots/ai-pm/.env` 에 두고 위치 안내만). §준비 상태(`준비완료: 아니오` 로 시작)와 §준비 체크리스트(본 문서 양식 복사)를 포함한다. 커밋·푸시·공유 금지, 키값을 메시지·로그·이슈 어디에도 노출하지 않는다.
- **이전 산출물 정리** — 템플릿에 남은 이전 프로젝트 산출물을 삭제한다: `docs/prd/`(PRD·IA·devspec)·`docs/specs/`·`docs/releases/`·`apps/`·`mockup/`·`history/<ia-code>.md`(및 `common.md`·`bak-*.md`). `history/changes/`(운영 문서 개정 이력)는 템플릿 자체의 이력이므로 유지한다. 새 산출물은 directing 첫 실행부터 생성된다 — 빈 스캐폴드를 미리 만들지 않는다([`doc-structure.md`](doc-structure.md) ⬦ 규약).
- **프로젝트별 채움 지점 점검** — qa 케이스 하위 지침(`ai/strategies/qa-execution/*.md`)의 "프로젝트별 채움" 절(도구·포트·셀렉터)은 directing 산출 확정 후 채우는 항목임을 확인한다(지금 비어 있는 게 정상). 에이전트·스킬 본문에 이전 프로젝트 고유 값이 남아 있지 않은지 확인한다 — 고유 값은 항상 `CLAUDE.env.md`·개발사양(`docs/prd/devspec/`) 참조여야 한다([`skills.md`](skills.md)·[`document-master-guide.md`](document-master-guide.md) §경로·이름 표기).

## 3. Redmine 연결

작업 티켓 정본([`work-tracking.md`](work-tracking.md))인 Redmine 은 **프로젝트 밖에서 이미 운영 중인 공용 서비스에 접속해 사용**한다 — 프로젝트마다 인스턴스를 새로 구축하지 않는다. 서비스 자체의 구축·트래커 구성·백업은 서비스 관리자 소관으로 준비 범위 밖이다. 운영 세부의 정본은 [`work-tracking-redmine.md`](work-tracking-redmine.md).

### A. 접속 정보 확보

- **자격증명 기입** — 서비스 관리자에게 서버 URL 과 API 키(admin 또는 전용 작업 계정)를 받아 `CLAUDE.local.md` §Redmine 자격증명(`REDMINE_BASE_URL`·`REDMINE_API_KEY`)에 기입한다.
- **서비스 구성 확인** — 서비스에 표준 트래커 5종(그룹·오류·기능·사양·검증)과 상태 6종이 구성돼 있는지 확인한다([`work-tracking.md`](work-tracking.md) 정본). 미비하면 서비스 관리자에게 구성을 요청한다(방법 참고: [`work-tracking-redmine.md`](work-tracking-redmine.md) §트래커 구성). 확인된 요소 id 가 [`work-tracking-redmine.md`](work-tracking-redmine.md) §요소 식별자 레퍼런스와 다르면 갱신한다.

### B. MCP 서버 등록

세션이 Redmine 을 조작하는 통로. 서버는 의존성 0 의 Node 단일 파일이다.

- **등록** — MCP 서버 파일(`redmine-mcp-server.mjs`)을 PC 로컬 위치에 두고 `claude mcp add redmine -s user -- node "<MCP 서버 파일 경로>"` 로 등록한다. 접속 값은 환경변수 `REDMINE_BASE_URL`·`REDMINE_API_KEY` 로 주입하거나 서버 파일과 같은 위치의 `.env`(외부 공유 금지)에 둔다([`work-tracking-redmine.md`](work-tracking-redmine.md) §접속).
- **연결 확인** — **새** Claude Code 세션에서 `/mcp` → `redmine ✔ connected`(등록은 실행 중 세션에 반영되지 않는다).

### C. 프로젝트 생성

생성 순서가 중요하다(도구 함정) — 정본 절차는 [`work-tracking-redmine.md`](work-tracking-redmine.md) §프로젝트 생성 표준 절차.

- **운영 프로젝트** — 워크스페이스 운영·메타 작업 추적용. 없으면 같은 절차로 생성한다.
- **제품 프로젝트** — 표준 절차 6단계: 생성 → 트래커 한정(그룹·사양·기능·오류·검증) → 멤버십 → 카테고리(IA 확정 후 지속 추가) → 배포버전 → 식별자를 `CLAUDE.env.md` `<REDMINE_PROJECT>` 에 기입.
- **저장 쿼리** — 진행 중 / 대기 / 완료·종결 보드 뷰 구성.
- (선택) **전용 작업 정체성** — 이슈 작성자·담당자를 admin 과 분리하려면 전용 사용자 생성 후 그 API 키를 세션 환경변수 `REDMINE_API_KEY` 로 주입([`work-tracking-redmine.md`](work-tracking-redmine.md) §접속 — 미설정 시 admin 폴백).

## 4. ai-pm 오케스트레이터 구성 (Redmine 작업세션)

ai-pm 은 Redmine 작업세션 이슈를 폴링해 담당자와 협업하는 단일 세션이다(Slack 미사용 — 2026-07-18 전환). 협업 구조·기동 절차의 정본은 [`ai-pm.md`](ai-pm.md)(소통·트리거 = Redmine).

### A. Redmine 준비 (작업세션 트래커·워크플로)

- **작업세션 트래커** — Redmine 에 일감 유형 `작업세션`(에이전트·담당자 소통 적재)이 있어야 한다. 없으면 관리 UI 로 추가한다.
- **워크플로 개방** — 작업세션 트래커는 **모든 역할이 모든 상태로 전이 가능**해야 한다(담당자·봇 누구나 차례를 넘김). `D:\redmine\agent\configure_worksession_workflow.rb` 를 rails runner 로 적용한다(멱등): `cat configure_worksession_workflow.rb | docker exec -i redmine bash -c 'export SECRET_KEY_BASE="$REDMINE_SECRET_KEY_BASE"; bin/rails runner -'`. 워크플로 설정은 REST 로 불가하므로 rails runner(로컬 Docker) 또는 관리 웹 UI 로만 가능하다.
- **트래커 활성화** — 감시 대상 프로젝트(운영·제품) 설정에서 작업세션 트래커를 활성화한다.
- **운영 상태 이슈** — 담당자가 운영 프로젝트에 상시 작업세션 이슈 1건(`[ai-pm] 운영 상태 …`)을 생성한다 — ai-pm 이 부팅·리셋·백로그·에러 공지를 여기 노트로 남긴다(봇은 이슈를 만들지 않는다).

### B. 워크스페이스 파일 기입

- **`config.json` 갱신** — `ai/bots/ai-pm/config.json` 에 `exec_machine`(봇 실행 장비 MachineName `$env:COMPUTERNAME`)·`redmine_projects`(감시 프로젝트 식별자 배열)·`ops_status_issue`(위 운영 상태 이슈 번호)를 기입한다.
- **봇 정의 확인** — `ai/bots/ai-pm/ai-pm.md` frontmatter 의 `exec machine`·`model`·`effort` 를 확인한다.
- (선택) **전용 Redmine 정체성** — `ai/bots/ai-pm/.env.example` 을 `.env` 로 복사(git 비관리)해 `REDMINE_BASE_URL`·`REDMINE_API_KEY` 기입 → 세션 래퍼가 자식 Redmine MCP 에 주입한다. 미기입 시 MCP 서버 기본 admin 키로 폴백(봇 = admin).
- **Redmine MCP 등록 확인** — 세션이 Redmine MCP 로 폴링·회신하므로 user 스코프 등록(§3-B)이 되어 있어야 한다. 래퍼가 기동 시 `mcp-curate.js` 로 Redmine 전용 큐레이션을 만들어 `--strict-mcp-config` 로 로드한다.

키·토큰을 메시지·로그·커밋 어디에도 노출하지 않는다. `.env` 는 `.gitignore` 로 커밋이 차단되어 있다.

### C. 기동 확인

- **세션 기동** — `ai/scripts/ai-pm-session.ps1` 실행 → 지정 장비 확인 후 Redmine MCP 큐레이션으로 ai-pm 세션 기동, 워치독(폴링 하트비트 감시) 동반.
- **부팅 알림 확인** — 운영 상태 이슈(`ops_status_issue`)에 '세션 기동/초기화 완료' 노트가 올라오는지 확인.
- **왕복 확인** — 감시 프로젝트에 작업세션 이슈를 하나 만들고(담당자) 노트로 지시 → ai-pm 이 폴링해 접수 노트 + 상태 `진행` 으로 응답하는지 확인.

## 5. 통합 검증·기동

앞 절 결과물이 함께 동작하는지 확인하고 운영을 시작한다. 여기까지 완료되면 directing 착수 가능 상태다.

- **체크리스트 재확인** — `CLAUDE.local.md` §준비 체크리스트의 §1~§4 항목이 전부 체크됐는지 확인한다.
- **Redmine 연동 검증** — 새 Claude Code 세션에서 Redmine MCP 로 현재 사용자 조회(`get_current_user`)가 의도한 정체성(admin 또는 전용 계정)으로 응답하는지 확인한다.
- **ai-pm 세션 기동** — `ai/scripts/ai-pm-session.ps1` 실행 → 지정 장비 확인 후 Redmine MCP 큐레이션으로 ai-pm 세션 시작. 운영 상태 이슈에 기동 알림이 오르고, 작업세션 이슈 지시에 ai-pm 이 응답하는지 확인한다([`ai-pm.md`](ai-pm.md) §기동 절차).
- **git 기준선 확정** — 준비 과정의 변경(루트 설정·산출물 정리)을 커밋하고 `origin/main` 에 푸시한다 — 이 커밋이 새 프로젝트의 시작 기준선이다.
- **준비완료 플래그 설정** — `CLAUDE.local.md` §준비 상태의 `준비완료` 를 `예` 로 갱신한다 — 이후 세션의 준비 미완료 안내가 꺼진다([`CLAUDE.md`](../../CLAUDE.md) §워크스페이스 구성 준비). PC 마다 그 PC 의 `CLAUDE.local.md` 에 설정한다.
- **directing 착수** — ai-pm 작업세션 이슈 대화로 첫 방향 정의 작업을 시작한다([`base-workflow.md`](base-workflow.md)).

### 문제가 있을 때

- **Redmine MCP 미연결** — 등록 후 세션을 새로 열었는지, 접속 값(`REDMINE_BASE_URL`·`REDMINE_API_KEY`)이 유효한지 확인(§3-B).
- **ai-pm 세션 미기동/즉시 종료** — `config.json` `exec_machine` 이 현재 장비와 일치하는지, MCP 큐레이션(Redmine)이 성공했는지 콘솔 로그로 확인한다(§4-B·C).
- **봇이 이슈 변경을 못 잡음** — `config.json` `redmine_projects` 에 해당 프로젝트가 있는지, 작업세션 트래커가 그 프로젝트에 활성인지, Redmine MCP 연결(§3-B) 상태를 확인한다.

## 6. TC 실행 환경 (검증 도구 MCP)

검증 TC 를 **실제 동작 재현**으로 실행하기 위한 검증 도구(MCP 서버)를 갖춘다. 설치·등록·연결 검증·식별자 수집의 절차 정본은 [`qa-execution/tools-setup.md`](qa-execution/tools-setup.md) — 본 절은 시점·주체·완료 기준만 정의한다.

- **시점** — §1~§5 와 달리 directing 산출물인 **프로그램 구성표**가 있어야 필요한 도구를 정할 수 있다([`qa-execution.md`](qa-execution.md) §케이스 선택). directing 확정 후 착수해 첫 기능검증(build)·qa 착수 전까지 완료한다. 준비완료 플래그(§5)와는 독립이다.
- **주체** — 도구 설치·검사 도구 준비·식별자 수집은 사람(담당자)이 수행하고, MCP 등록·연결 검증은 세션에 위임할 수 있다.
- **완료 기준** — 프로그램 구성표의 각 프로그램에 대해 담당 MCP 가 연결 상태이고 [`tools-setup.md`](qa-execution/tools-setup.md) §연결 검증 체크리스트가 전부 성공하면 §준비 체크리스트의 §6 항목을 체크한다.

## 다른 PC 재구성

같은 프로젝트를 다른 PC 에서 재구성할 때는 **PC 로컬 항목**만 다시 수행한다. 그 PC 의 `CLAUDE.local.md` 를 새로 만들면서 §준비 체크리스트도 새로 시작한다.

- §1 전체 — 도구 설치·`npm install`·OS 환경변수.
- §2 의 `CLAUDE.local.md` 생성 — git 비관리라 PC 마다 필요(§준비 상태 플래그·§준비 체크리스트 포함).
- §3 의 접속 정보 기입(`CLAUDE.local.md` 재생성분)·MCP 서버 등록 — PC 로컬. 공용 서비스·프로젝트는 그대로라 재구축·재생성 불필요.
- §4-C 의 `.env` 토큰 파일 — git 비관리. 앱은 재생성 불필요, 기존 토큰 재사용.
- §4-C 의 실행 장비 지정 — 봇 실행 장비를 그 PC 로 옮기면 `config.json` 의 `exec_machine` 과 봇 정의 frontmatter 를 새 MachineName 으로 갱신·커밋한다(git 관리 — 전 PC 에 공유되어 이전 장비의 기동이 차단된다). 옮기지 않으면 그대로 둔다([`ai-pm.md`](ai-pm.md) §운영 모델).
- §6 의 도구 설치·MCP 등록·연결 검증 — PC 로컬(식별자 수집 결과는 문서로 공유되므로 재수집 불필요).
