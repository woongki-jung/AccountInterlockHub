# strategies-ai-pm-processing-continuity (2026-07-09)

> ai-pm 처리 루프 지속(tail→처리 공백) 재발방지. 본문 정본은 해당 문서.

- **무엇**:
  - `ai/strategies/ai-pm.md` — **§운영 연속성 (처리 루프 지속)** 신설. 근본 원인(대화형 세션이 한 턴 후 유휴로 들어가고, app.js 가 `runtime.log` 에 남기는 신규 이벤트가 세션을 자동으로 깨우지 않음)과 3층 방어를 정의: ① 세션 자가 웨이크 루프(`/loop` 자가 페이싱·ScheduleWakeup 재예약), ② 웨이크 시 `last-processed` 마커 이후 백로그 전수 드레인, ③ 워치독 처리 정체 감지·세션 강제 웨이크(하드 백스톱). 처리 마커 `_slack/last-event`·`_session/last-processed` 정의. §기동 절차 3·§런타임 구성 요소도 갱신.
  - `ai/bots/ai-pm/ai-pm.md` — §처리 절차: 부팅 즉시 자가 웨이크 루프 수립(0), 마커 이후 전수 스캔(1), 사이클 종료 시 마커 갱신·다음 틱 예약(8) 반영.
  - `ai/bots/ai-pm/_slack/app.js` — 세션에 보일 이벤트(mention·DM·channel) 로깅 시 `_slack/last-event` 에 그 `ts` 기록(`markLastEvent`).
  - `ai/scripts/ai-pm-session.ps1` — 워치독 heredoc(`$watchdogSource`)에 처리 정체 감지 추가: `last-event > last-processed` 적체가 `StallThresholdSec`(기본 300s) 지속되면 `.restart` + 세션 강제 종료로 재기동 유도. 쿨다운(`StallCooldownSec` 기본 600s)·1시간 3회 재기동 캡으로 루프 방지. 마커 경로 변수·워치독 기동 인자 추가.
  - `.gitignore` — `ai/bots/ai-pm/_slack/last-event` 제외(런타임 상태; `_session/` 는 기존 제외).

- **왜**: qa 완료 보고 후 ai-pm 세션이 유휴로 들어간 뒤 담당자 메시지 2건(06:19·06:48)이 `runtime.log` 에만 쌓이고 처리되지 않음(담당자가 터미널 직접 입력으로 겨우 깨움). 연동·토큰·수신은 정상 — 원인은 **tail→처리 공백**(세션이 새 로그를 다시 읽을 계기가 없어 멈춤). 이 구조적 공백을 재발방지.

- **영향**: `ai-pm.md`(전략)·`ai-pm.md`(봇)·`app.js`·`ai-pm-session.ps1`·`.gitignore`. 마커 파일 2종 신설(`_slack/last-event`·`_session/last-processed`, git 비관리). 워치독은 app.js 생존 감시에 '처리 생존' 감시가 더해짐. **적용은 런타임 전체 재기동 시 반영**(새 watchdog 소스·app.js·세션 부팅 동작이 재기동으로 로드됨) — in-flight qa 작업 종료 후 유휴 시점에 적용. 근본 대안(이벤트 구동 재아키텍처)은 별도 과제로 분리 권장.

- **관련 일감**: (등록 예정 — ai-pm 세션 통해 Redmine 반영)
