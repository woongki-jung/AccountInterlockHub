# strategies-ai-pm-exec-machine (2026-07-05)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) §운영 모델 — **실행 장비 지정 사양 신설**: ai-pm 세션·Slack 런타임은 지정 실행 장비에서만 기동하며, 지정 값의 단일 출처는 `config.json` 의 `exec_machine`(MachineName). §기동 절차 2(지정 장비에서 실행·불일치 시 중단)와 §런타임 구성 요소의 config.json 설명(실행 장비 항목)도 갱신.
	- `ai/bots/ai-pm/_slack/config.json` — `exec_machine: WOONGS-WORK` 추가(현 지정 실행 장비).
	- `ai/bots/ai-pm/ai-pm.md` frontmatter — `exec machine: WOONGS-WORK` 추가.
	- [`ai-pm-session.ps1`](../../../ai/scripts/ai-pm-session.ps1) — 기동 가드 추가: `exec_machine` 과 이 PC 의 `$env:COMPUTERNAME` 을 대조해 미지정·불일치면 throw 로 기동 중단.
	- [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) §4-C — config.json·봇 정의 기입 항목에 실행 장비 추가. §다른 PC 재구성 — 실행 장비 이전 시 `exec_machine` 갱신·커밋 항목 추가.
	- `package.json` **신설**(루트 config) — 저장소 기준선에 부재했던 npm 설정 복원: `start:ai-pm` 스크립트와 `@slack/bolt` 의존성(Slack 런타임 실행 전제).
- **왜**: 담당자 지시(2026-07-05) — PC `WOONGS-WORK` 를 슬랙 봇 실행 장비로 지정. 복제 워크스페이스를 가진 여러 PC 환경에서 단일 세션 원칙(동일 워크스페이스 중복 기동 금지)을 장비 수준에서 강제하기 위해 실행 위치 지정 사양을 도입.
- **영향**:
	- 다른 PC 에서 `ai-pm-session.ps1` 를 실행하면 기동이 즉시 차단된다. 실행 장비 이전은 `exec_machine` 갱신·커밋으로만 가능(전 PC 공유).
	- 부트스트랩 §4-C·§다른 PC 재구성 절차에 실행 장비 기입·이전 단계가 포함된다.
- **관련 일감**: 없음 (담당자 직접 지시 세션).
