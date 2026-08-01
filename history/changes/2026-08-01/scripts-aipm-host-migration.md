# scripts-aipm-host-migration (2026-08-01)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- `ai/scripts/redmine-mcp-server.mjs` **신규** — Redmine MCP 서버를 워크스페이스 내부에 재작성(의존성 0 Node 단일 파일·stdio JSON-RPC, 도구 9종: `get_current_user`·`list_issues`·`get_issue`·`create_issue`·`update_issue`·`update_journal`·`create_project`·`upload_attachment`·`redmine_request`). 자격은 환경변수 우선·서버 파일 옆 `.env` 폴백.
	- `ai/bots/ai-pm/config.json` `exec_machine`·`ai/bots/ai-pm/ai-pm.md` frontmatter `exec machine` — `WOONGS-WORK` → `CLAUDE-HOMEBOOK` (지정 실행 장비 이전).
	- `ai/scripts/ai-pm-session.ps1` 워처 판정 ② — 작업세션 이슈 상태 비교를 `'신규'`·`'의견'` 에서 인스턴스 실측 표시명 `'New'` 로 교정.
	- `ai/strategies/project-bootstrap.md` §3-B·§다른 PC 재구성 — MCP 서버 파일의 위치를 "PC 로컬"에서 "저장소 포함"으로 갱신하고 서버 이름 제약(`redmine`)을 명시.
- **왜**:
	- 메인 작업 장비를 이 PC 로 옮기면서 실행 환경을 점검한 결과, 구 MCP 서버 파일이 이 PC 에 없고(구 장비 로컬 경로에만 존재) `~/.claude.json` 에 `redmine` 등록도 없어 ai-pm 세션이 Redmine 에 전혀 닿지 못하는 상태였다. 서버를 저장소에 두어 PC 재구성 시 파일 확보 문제가 재발하지 않게 했다.
	- 워처 판정 ②는 한국어 정책 이름과 비교하고 있었으나 인스턴스가 반환하는 상태 표시명은 영문이라 **항상 거짓**이었다. 노트 없이 본문만으로 생성된 작업세션 이슈가 세션을 깨우지 못하는 공백이 있었다.
- **영향**:
	- `ai/scripts/redmine-mcp-server.mjs`(신규) · `ai/scripts/ai-pm-session.ps1` · `ai/bots/ai-pm/config.json` · `ai/bots/ai-pm/ai-pm.md` · `ai/strategies/project-bootstrap.md`.
	- git 비관리 산출(커밋 제외): `ai/scripts/.env`(admin 폴백 자격) · `ai/bots/ai-pm/.env`(봇 계정 `aipm` 자격) · `ai/bots/ai-pm/_session/state.json`(워터마크 3799 시드 — 이전 이력 재드레인 방지).
	- `exec_machine` 변경으로 **구 장비(WOONGS-WORK)에서는 래퍼 기동이 차단**된다(단일 세션 보장).
	- 미반영(후속 대상): `ai/strategies/work-tracking-redmine.md` §도구 함정 ①②는 구 서버의 구현 특성이라 새 서버에서 해소됐다(실측 확인) — 문서는 아직 구 기준이다. `ai/strategies/ai-pm.md` §작업세션 운용 상태표의 `의견` 은 인스턴스에 없는 상태다.
- **검증**: 서버를 stdio 로 직접 구동해 11개 항목 통과 — 핸드셰이크·도구 목록·자격 우선순위(폴백=admin / env 주입=`aipm`)·`smoke-test` 이슈 생애주기(생성→노트+전이→노트 치환→`allowed_statuses`→종결 `closed_on` 실측)·거부되는 전이 검출·REST 오류 전달. `claude mcp list` → `redmine √ Connected`, `mcp-curate.js` → `OK`.
- **관련 일감**: 없음(운영 준비 작업).
