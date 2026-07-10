# scripts-ai-pm-mcp-curation (2026-07-10)

> ai-pm 세션 기동 블로킹(MCP 초기화) 해결 + 부팅 실행 알림. 본문 정본은 해당 문서.

- **무엇**:
  - `ai/scripts/ai-pm-session.ps1` — 세션 기동 시 `mcp-curate.js` 로 **Redmine 전용** MCP 설정(`_session/ai-pm.mcp.json`)을 만들고 `--strict-mcp-config --mcp-config` 로 claude 를 기동한다. 인증 필요한 claude.ai 커넥터(Figma·Google)·Playwright MCP 등 다른 MCP 소스를 전부 무시.
  - `ai/bots/ai-pm/_slack/mcp-curate.js` (신규) — `~/.claude.json` 에서 redmine MCP 서버만 추려 지정 경로에 기록(node/JSON.parse — PS 5.1 `ConvertFrom-Json` 은 대용량 `.claude.json` 에서 실패하므로 node 사용).
  - `ai/strategies/ai-pm.md` — §운영 연속성에 **'기동 블로킹 회피(MCP 큐레이션)'**·**'부팅 실행 알림'** 절 추가, §런타임 구성요소에 `mcp-curate.js` 항목.
  - `ai/bots/ai-pm/ai-pm.md` — §처리 절차 step 0 에 부팅 시 감시 메인 채널에 '세션 기동/초기화 완료' 실행 알림을 `post.js` 로 무조건 1회 게시 추가.

- **왜**: 인증 필요한 claude.ai 커넥터·Playwright MCP 가 detached 세션의 MCP 초기화를 붙잡아 세션이 **첫 턴에 도달하지 못하고 무한 멈춤**(스피너·CPU 정지·transcript 부재) → 수신·발신 전무, 리셋 후 실행알림 미발신. A/B 검증: 전체 MCP=수 시간 멈춤 / `--strict-mcp-config`(MCP 없음)·redmine-only=**8초 정상 부팅**. 큐레이션 적용 후 세션은 CPU 를 소비하며 정상 부팅(멈춤 해소 확인).

- **영향**: `ai-pm-session.ps1`·`mcp-curate.js`(신규)·`ai-pm.md`(전략·봇). 큐레이트 설정 `_session/ai-pm.mcp.json` 은 런타임 생성(git 비관리, `_session/` 기존 제외). 서브에이전트가 Playwright 등 다른 MCP 를 쓰는 것은 하위 세션 별도 구성 소관. **운영 참고**: 가시 창 `Start-Process`(세션 래퍼 포그라운드 기동)는 샌드박스 해제가 필요할 수 있음.

- **관련 일감**: 없음 — 워크플로(운영 문서·런타임) 개선이라 Redmine 미등록.
