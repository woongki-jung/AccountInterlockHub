# agents-product-loop-orchestrator (2026-07-23)

> spec→build→qa 제품개발 루프 전체를 제어하는 상위 오케스트레이터(제품 루프 오케스트레이터)를 신설하고, ai-pm 을 directing/제품 루프 둘로 분기하도록 개정. spec/build/qa/directing 완료 루프 개정([`strategies-spec-completion-loop`](../2026-07-22/strategies-spec-completion-loop.md)·[`strategies-build-qa-completion-loop`](../2026-07-22/strategies-build-qa-completion-loop.md)·[`strategies-directing-readiness-loop`](../2026-07-22/strategies-directing-readiness-loop.md))의 후속. 본문 정본은 각 문서.

- **무엇**: spec·build·qa 를 개별 디스패치하던 구조를, 상위 **제품 루프 오케스트레이터**가 하나의 루프로 제어하도록 재편.
	- **신규 에이전트** `ai/agents/product-loop.md`(model opus·effort max) — 재진입형 시퀀서. 디스패치 시 Redmine(그룹 일감+단계 일감) 상태로 루프 위치를 판독해 한 레그씩 전진. 흐름: 상태 판독 → 단계 오케스트레이터 하위 호출 → 핸드오프(커버리지 체인) 검증 → 하이브리드 전이 → 피드백 라우팅 → 정리. 단계 오케스트레이터(spec/build/qa)는 불가침(순서·전이·핸드오프·피드백만 관장).
	- **하이브리드 승인**(Q1) — spec→build·build→qa 는 핸드오프 검증 후 자동 전이, 체크포인트(qa 배포 판정·main 병합)에서만 담당자 승인.
	- **루프 내부 자동 회귀**(Q2) — qa Fail→build·build 사양결함→spec 회귀를 오케스트레이터가 자동 편성(담당자 보고), 방향 결함만 directing 으로 에스컬레이션.
	- **단일 창구**(Q3) — spec/build/qa 어느 진입점이든 제품 루프 오케스트레이터 경유, ai-pm 은 directing/루프 둘로만 분기.
	- **트리거 내용 판단**(Q4) — ai-pm 이 요청 내용으로 directing(방향설정·신규·방향변경)/제품 루프(사양·구현·검증) 분류.
	- **단일 루프 브랜치**(git-flow) — 제품 루프 1사이클 = `loop/<이슈>-<주제>` 1개, spec·build·qa 레그는 이 브랜치에 commit, main 병합은 체크포인트(배포 판정) 승인에서만(main=승인 기준선 유지).
- **왜**: spec-build-qa 를 "하나의 제품개발 루프"로 재정의(directing=준비)한 뒤, 그 루프 전체 흐름을 제어하는 상위 오케스트레이터가 없어 단계 전이·핸드오프·피드백이 담당자 수동 개입에 전적으로 의존했다. 담당자 요청(2026-07-23)으로 상위 오케스트레이터를 신설해 루프를 자율화하되, 안전을 위해 배포 판정·main 병합은 체크포인트 승인으로 남겼다. 재진입형으로 설계해 ai-pm 에서 해소한 컨텍스트 누적 문제를 피한다.
- **영향**:
	- `ai/agents/product-loop.md`(신규) — 제품 루프 오케스트레이터 정의.
	- `ai/strategies/base-workflow.md` §단계 진행 모델 — 제품 루프 오케스트레이션·하이브리드 전이·자동 피드백·단일 창구.
	- `ai/strategies/ai-pm.md` §단계 연결 — directing/제품 루프 분기, 제품 루프 오케스트레이터 1개 디스패치, 루프 브랜치.
	- `ai/strategies/agents.md` §모델 정책·§실행 규칙·§디스패치 모델·§등록 카탈로그 — product-loop 등록.
	- `ai/strategies/stages/spec.md`·`build.md`·`qa.md` §다음 단계 이행 조건 — 자동 전이(spec→build·build→qa)·체크포인트(qa 배포 판정)·루프 내부 자동 회귀 반영.
	- `ai/strategies/git-flow.md` §브랜치·§병합 — 단일 루프 브랜치·체크포인트 병합.
	- `ai/strategies/work-tracking.md` §계층·연관 — 그룹 일감 = 루프 우산.
	- 후속 확인: `ai/bots/ai-pm/ai-pm.md`(봇 페르소나)는 전략 문서를 정본으로 참조하므로 하드코딩된 단계 디스패치 서술이 있으면 정합 필요(미커밋 2계층 세트와 함께 점검).
- **관련 일감**: (없음 — 담당자 세션 직접 요청)
