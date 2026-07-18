# strategies-ai-pm-redmine-based (2026-07-18)

> ai-pm 오케스트레이터를 Slack 기반 → **Redmine 작업세션 폴링 기반**으로 전면 전환. Slack 완전 제거. 본문 정본은 `ai-pm.md`.

- **무엇**:
  - `ai/strategies/ai-pm.md` — 전면 재작성. 트리거 = Redmine 폴링(단일 통로), 소통 = 작업세션 이슈 노트/상태, **상태 = 차례(턴)** 모델, **§Slack→Redmine 매핑**(채널=프로젝트·이슈=스레드·댓글=스레드 메시지) 신설. **봇은 댓글만 · 이슈(스레드) 생성은 담당자만 · 메인채널 브로드캐스트 금지**. 운영 연속성(폴링 마커 `last-processed`·하트비트 `last-poll`·자가 웨이크 폴링 루프·정체 워치독·MCP 큐레이션·부팅 알림), 기동 절차, 세션 리셋 모두 Redmine 기반으로 개정.
  - `ai/bots/ai-pm/ai-pm.md` — 봇 정의 재작성(Redmine 전용 페르소나·처리 절차, Slack/post.js 제거).
  - `ai/scripts/ai-pm-session.ps1` — 재작성. app.js 기동·app.js 생존 워치독 제거, 워치독 = 폴링 하트비트(`_session/last-poll`) 정체 감지, MCP 큐레이션·모델/effort·재기동 루프 유지. **UTF-8 BOM**(PS 5.1 한글 스크립트 필수).
  - `ai/bots/ai-pm/` — `_slack/` 제거(app.js·post.js·config.json·.env·runtime.log·last-event), `mcp-curate.js` 상위 이동, `config.json` 재작성(`exec_machine`·`redmine_projects`·`ops_status_issue`), `.env.example`(Redmine 전용), `_session/last-processed` 초기화·스테일 런타임 제거. `.gitignore`(_slack/last-event 제거)·`package.json`(`@slack/bolt` dep·`start:ai-pm` script 제거) 정리.
  - 상위 문서 정합 — `CLAUDE.md`(§ai-pm 실행모드·운용 전략·환경변수 키 목록), `CLAUDE.local.md`(체크리스트 §4·자격증명), `work-tracking.md`(생애주기·소통 통로), `project-bootstrap.md`(§4 Slack→ai-pm Redmine 오케스트레이터·§1·§5), `stages/`(directing·spec·build·qa), `delivery.md`·`doc-structure.md`.
  - Redmine — 작업세션 트래커(id7) 워크플로 4역할×전상태 개방(별도 이력 [[configure_worksession_workflow]]), dogfooding 추적 이슈 **#405**·운영 상태 이슈 **#406** 생성.

- **왜**: 담당자 지시(2026-07-18) — "슬랙 봇 오케스트레이터를 레드마인 베이스로 변경". Slack Socket Mode 런타임(app.js·runtime.log tail)에 구조적 취약점(tail→처리 공백·MCP 기동 블로킹·워치독 stall 반복·터미널 입력 대기)이 누적. 소통·작업 기록 정본이 이미 Redmine 이므로 트리거·소통까지 Redmine 작업세션으로 통합해 단일 실패원(Slack 런타임)을 제거. Slack→Redmine 매핑과 규칙(봇=댓글만, 이슈 생성=사람)은 담당자 지침.

- **영향**: ai-pm 운영 전반(전략·봇·런타임·부트스트랩·티켓 생애주기). 담당자 결정: 규칙 "이슈(스레드) 생성은 사람만" = **ai-pm 소통 layer 한정**(서브에이전트의 산출 일감 생성은 work-tracking 대로 유지). 정합·정적 검증(래퍼 파싱·config 파싱·mcp-curate·워크플로 전이)까지 수행 — **세션 실기동 검증은 담당자 확인 후**. 커밋은 미수행(main, git-flow 브랜치 분기 예정).

- **관련 일감**: 작업세션 #405(전환 추적)·#406(운영 상태). 워크플로(운영 문서·런타임) 개선이라 별도 제품 일감 없음.
