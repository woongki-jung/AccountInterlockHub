# bots-ai-pm-slack-post-helper (2026-07-09)

> ai-pm Slack 발신 경로를 전용 헬퍼로 고정한 개정 경위. 본문 정본은 해당 문서·코드.

- **무엇**:
  - `ai/bots/ai-pm/_slack/post.js` 신규 추가 — `@slack/web-api` 기반 발신 헬퍼(`chat.postMessage`·`chat.update`). 본문을 UTF-8 파일에서 `[string]` 그대로 읽어 전송, 성공 시 `{ok,channel,ts}` 를 stdout 에 출력.
  - `ai/strategies/ai-pm.md` §런타임 구성 요소에 `post.js`(발신) 항목 추가, `app.js` 를 "수신 전용" 으로 명시.
  - `ai/strategies/ai-pm.md` §글로벌 운영 원칙의 "한글 페이로드" 항목을 "발신은 반드시 `post.js` 로" 로 개정 — 셸 인라인 JSON 조립 금지와 호출 예시 명문화.
- **왜**: ai-pm 이 접수 확인 메시지 대신 PowerShell 객체 원데이터(`{"value":"...","PSPath":...,"ReadCount":1}`)를 Slack 에 게시하는 결함 발견. 원인은 발신 지침이 "임시 파일 → `--data-binary` curl" 까지만 규정하고 JSON 조립을 세션 즉흥에 맡긴 것 — `Get-Content <파일> | ConvertTo-Json` 이 문자열에 붙는 ETS 노트 속성(PSPath·PSChildName·ReadCount 등)까지 직렬화해 `text` 자리를 오염시켰다. 발신을 node 헬퍼로 고정해 한글 인코딩 손상·ETS 누출 두 함정을 원천 차단한다.
- **영향**: `app.js`(수신)와 `post.js`(발신) 역할 분리. 발신 시 curl+인라인 JSON 관행 폐기. 런타임 의존성은 기존 `@slack/bolt@4`(전이 의존 `@slack/web-api`)로 충족되어 추가 설치 불필요.
- **관련 일감**: (해당 없음 — 운영 결함 즉시 보정)
