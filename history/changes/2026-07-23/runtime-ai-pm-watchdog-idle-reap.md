# runtime-ai-pm-watchdog-idle-reap (2026-07-23)

> ai-pm 세션 래퍼의 워치독이 **작업을 마치고 유휴로 들어간 세션을 hang 으로 오판**해 반복 강제 재기동(→1시간 3회 초과 backoff→봇 사망)하던 결함을 수정. 하트비트 정체 시 `state.json` 의 in-flight 로 분기해, in-flight 0(완료 유휴)은 `.restart` 없이 회수(워처 복귀)하고 in-flight>0(진짜 hang)만 재기동한다. 2계층 운영 개정([`strategies-ai-pm-two-tier-watcher`](../2026-07-19/strategies-ai-pm-two-tier-watcher.md))의 런타임 후속.

- **무엇**: `ai/scripts/ai-pm-session.ps1` 의 워치독(`$watchdogSource` heredoc) 정체 처리 로직을 in-flight 인지형으로 교체.
	- 워치독 param 에 `-StateFile` 추가, `Get-InflightCountWd`(state.json in-flight 건수, 실패 시 0) 신설. 래퍼는 워치독 기동 인자에 `-StateFile "$stateFile"` 전달.
	- 하트비트 정체(age ≥ StallThresholdSec) 감지 시:
		- **in-flight 0** → **유휴 세션 회수**: 세션 프로세스만 종료하고 `.restart` 를 걸지 않는다 → 래퍼가 `& claude` 반환 후 워처 대기(토큰 0)로 복귀. backoff 카운트(`$stallCount`)에도 넣지 않는다(정상 회수 ≠ 결함).
		- **in-flight > 0** → 기존 동작: `.restart` + 강제 종료 + backoff 카운트(1시간 3회 초과 시 담당자 확인).
- **왜**: 2계층 설계는 "세션이 유휴가 되면 스스로 종료하고 워처가 인계"인데, **헤드리스 `claude` 프로세스는 유휴가 돼도 프로세스가 살아만 있고(입력 대기) 하트비트를 멈춘다**. 기존 워치독은 이를 hang 으로 보고 `.restart`+종료 → 래퍼 즉시 재기동 → 새 세션도 할 일 없어 유휴 → 재종료의 **churn** 을 일으켰고, 1시간 3회 초과 backoff("담당자 확인 필요")에 걸려 결국 봇이 죽었다(2026-07-23 재부팅 후 실사례: 세션 churn + 비서 스케줄 태스크 6개와 겹쳐 "여러 세션 동시 실행"으로 관측됨). in-flight 는 세션이 실제 작업 중인지의 신뢰 신호이므로, 유휴 회수와 진짜 hang 을 이걸로 가른다.
- **영향**:
	- `ai/scripts/ai-pm-session.ps1`(런타임 래퍼) — 워치독 정체 처리 분기. 래퍼는 기동 시 이 heredoc 으로 `_session/watchdog.ps1` 을 재생성하므로, 재기동해야 실반영된다(2026-07-23 21:11 재기동으로 반영·검증 완료: churn 소거·워처 대기 정상).
	- 정책 문서 변경 없음 — 런타임을 기존 2계층 의도([`ai-pm.md`](../../../ai/strategies/ai-pm.md) §운영 모델·§운영 연속성 ③)에 **일치**시키는 수정이다.
	- **알려진 한계(별개)**: 래퍼가 `& claude` 에서 블록되므로, 세션 완료 후 유휴 회수(최대 StallThresholdSec=600s)까지 워처가 폴링하지 못하는 사이클 직후 지연창이 남는다. churn 과 무관하며 후속 개선 여지(유휴 회수 임계 하향 등).
- **관련 일감**: (없음 — 담당자 세션 직접 요청)
