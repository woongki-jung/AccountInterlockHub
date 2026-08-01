# strategies-redmine-vocab-tool-traps (2026-08-01)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- `ai/strategies/ai-pm.md` §작업세션 운용 — 상태표에서 **`의견` 행 삭제**(인스턴스에 없는 상태). 담당자 사용법·워처 판정 규칙 ②·§처리 대상 식별 1 의 `신규`/`의견` 표기를 `신규` 로 정리하고, 정책 이름↔Redmine 표시명(영문) 대응의 정본이 `work-tracking-redmine.md` §요소 식별자임을 상태표 아래에 명시.
	- `ai/bots/ai-pm/ai-pm.md` §트리거·처리 규칙·§이슈 운용 — 같은 `의견` 표기 정리.
	- `ai/strategies/work-tracking-redmine.md` §접속 — MCP 서버 본체 위치(`ai/scripts/redmine-mcp-server.mjs`)와 `.env` 폴백 위치를 명시. §도구 함정 ①② 를 새 서버 실측 기준으로 재작성. §트래커 구성 Report 등록 절차를 `create_issue` 자동 교정 기준으로 갱신.
	- `.gitignore` — playwright-mcp 실행 산출(`.playwright-mcp/`) 제외 추가.
- **왜**:
	- `의견` 은 정책 문서에만 있고 인스턴스에는 없는 상태였다(id 7 은 결번). 워처 판정·담당자 사용법이 존재하지 않는 상태를 전제해 실제로는 죽은 조건이었다.
	- §도구 함정 ①② 는 구 MCP 서버의 구현 특성을 Redmine 의 특성처럼 기술하고 있었다. 실측(2026-08-01)으로 갈라 보면 — `tracker_id` 무시는 **구 서버 버그**(원시 REST 는 반영), 생성 시 `status_id` 무시는 **Redmine 동작**(`tracker_id: 8` + `status_id: 5` → `Needs Feedback`(4)). 새 서버는 후자를 생성 후 교정·재검증으로 흡수하고, 상태 전이 거부도 GET 실측으로 드러낸다.
- **영향**:
	- `ai/strategies/ai-pm.md` · `ai/bots/ai-pm/ai-pm.md` · `ai/strategies/work-tracking-redmine.md` · `.gitignore`.
	- 워처 코드는 선행 개정([`scripts-aipm-host-migration`](scripts-aipm-host-migration.md))에서 이미 `'New'` 비교로 교정됐다 — 본 개정은 그 코드와 문서를 맞춘다.
	- git 비관리 갱신: `CLAUDE.local.md` §준비 체크리스트를 현행 부트스트랩 양식으로 교체(§1~§6, ai-pm 왕복 확인만 미완)·`준비완료: 예`·폐지된 Slack 토큰 2종 삭제.
- **검증**: `smoke-test` 프로젝트 실측 — 원시 REST 생성 #511 → `Needs Feedback`(4) / MCP `create_issue` 생성 #512 → `Closed`(5), `corrected: true`. playwright-mcp 는 전역 설치(v0.0.78) 후 페이지 title 조회로 연결 확인. ai-pm 래퍼는 기동 → 워처 활성(봇 계정 user 24) → `.stop` 정상 종료까지 확인.
- **관련 일감**: 없음(운영 준비 작업).
