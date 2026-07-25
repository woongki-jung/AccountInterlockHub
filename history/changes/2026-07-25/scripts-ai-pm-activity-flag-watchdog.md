# scripts-ai-pm-activity-flag-watchdog (2026-07-25)

> ai-pm 워치독이 **작업 중인 세션을 10분 만에 강제 종료**하던 결함 제거. 판정 근거를 '하트비트 정체 + `inflight` 카운트' 추론에서 **세션이 스스로 선언하는 활동 상태 플래그(`_session/activity`)** 로 교체하고, 유휴·응답대기에서만 회수하도록 개정. 담당자 지시·결정 2026-07-25.

- **무엇**: `ai/scripts/ai-pm-session.ps1` 워치독 재작성 + 그 계약을 담은 전략·봇 정의·설정 개정.
  - **플래그 신설** — `_session/activity`(1행 = `working`|`awaiting`|`idle`, 2행 = 자유 메모, 신선도는 파일 mtime). 래퍼가 세션 기동 직전 `working` baseline 을 쓰고, 이후 갱신은 세션 책임이다. 세션은 턴 착수마다·장시간 작업 착수 **전에** `working` 을 갱신하고, **종료 직전 반드시 `idle`·`awaiting` 으로 전환**한다(신규 불변식).
  - **워치독 판정 교체** — `idle`·`awaiting` 이면 유예(기본 60초) 후 프로세스 회수(`.restart` 없음 → 래퍼가 워처 대기로 복귀). `working` 이면 **경과 시간과 무관하게 개입하지 않는다.** 상태 미선언(파일 부재·판독 실패)도 개입하지 않고 경고만 남긴다 — fail-safe 방향을 '회수'에서 **'작업 보존'** 으로 반전.
  - **시간 기반 강제 재기동 폐지** — `StallThresholdSec`·`StallCooldownSec`·1시간 3회 백오프·`.restart` 설정 경로를 워치독에서 제거했다. `working` 갱신이 `work_warn_sec`(기본 45분)을 넘으면 `watchdog.log` 에 **경고만** 남기고 회수·재기동은 하지 않는다.
  - **`last-poll` 폐지** — 폴링 하트비트를 걷어내고 `activity` 로 단일화했다(신호 2개가 서로 모순되던 구조 제거). 워치독은 `state.json` 을 더 읽지 않는다.
  - **설정** — `config.json` 에 `activity_reap_grace_sec`(60)·`work_warn_sec`(2700) 추가.
- **왜**: 워치독이 `last-poll` 정체(≥10분) 시 `inflight` 카운트로 유휴/작업중을 **추론**했는데, `inflight[]` 는 *디스패치한 서브에이전트만* 담는다. 세션이 직접 수행하는 장시간 작업(directing 퍼실리테이션·대형 노트 작성·문서 일괄 반영·main 병합)은 `inflight` 가 0 이고, 직전 개정([`strategies-ai-pm-session-completion-heartbeat`](strategies-ai-pm-session-completion-heartbeat.md))이 "`inflight` 비면 `last-poll` touch 중단"을 규정했으므로 하트비트도 정체한다 → 워치독이 `inflight ≤ 0` 분기의 '유휴 회수'로 들어가 **작업 중 세션을 10분에 강제 종료**했다. 더불어 `Get-InflightCountWd` 가 판독 실패 시 0 을 반환해 실패가 회수(kill)로 기울었다. 직전 개정이 "재발 시 작업 중 세션을 죽이지 않는 백스톱을 후속 검토"로 미룬 항목이 그대로 재발한 것이며, 근본 원인은 **세션의 실제 상태를 외부에서 추론한 것**이다. 세션이 자기 상태를 선언하게 하면 추론이 사라진다(담당자 지시).
- **영향**:
  - `ai/scripts/ai-pm-session.ps1` — 워치독 heredoc 전면 재작성, `Set-Activity` 헬퍼·baseline 3지점(래퍼 기동·워처 감지 기동·`.restart` 재기동), 워치독 기동 인자 교체. `$lastPollFile`·`$lastProcessedFile`(폐지된 마커) 선언 제거.
  - `ai/strategies/ai-pm.md` — §세션 상태(`activity` 신설·`last-poll` 폐지 명시·`inflight` 와의 구분), §운영 연속성 ①(틱 갱신·종료 조건·질의후 `awaiting`), **§운영 연속성 ③ 전면 재작성**(제목 '처리 정체 감지·자가치유 백스톱' → '유휴 세션 회수'), §런타임 구성 요소, §글로벌 운영 원칙(소통 통로).
  - `ai/bots/ai-pm/ai-pm.md` — 처리절차 0(기동 직후 `working` 선언)·6(질의 후 `awaiting`)·9(사이클 종료 시 `idle`·`awaiting` 전환, 작업 중 `working` 유지).
  - `ai/bots/ai-pm/config.json` — 워치독 설정 2건 + `_comment_watchdog`.
  - **런타임 변경 → 반영에 재기동 필요.** 워치독 본문 정본은 래퍼의 heredoc 이고 래퍼가 기동 시 `_session/watchdog.ps1` 을 다시 쓰지만, **이미 가동 중인 워치독 프로세스는 옛 본문으로 계속 돈다**(래퍼가 재사용). 적용하려면 기존 워치독 프로세스를 종료한 뒤 래퍼를 재기동해야 한다.
  - **검증 한계** — 개정은 macOS 세션에서 수행해 PowerShell 실행 검증을 하지 못했다(런타임 장비 = `WOONGS-WORK`). 지정 장비에서 첫 기동 시 `watchdog.log` 의 `start (... activity=...)` 줄과 유휴 회수 로그를 확인해야 한다.
- **수용한 한계**: `working` 을 선언한 세션이 실제로 hang 하면 자동 복구되지 않는다(경고 로그만). 담당자 결정 2026-07-25 — 정상 작업을 오살할 위험보다 수동 개입을 택함. 세션이 종료 직전 상태 전환을 빠뜨리면 워처가 블록되므로, 그 전환을 전략·봇 정의 양쪽에 불변식으로 명문화했다.
- **관련 일감**: (없음 — 담당자 세션 직접 요청) · 증상: 2026-07-25 작업 중 세션 강제 종료 재발.
