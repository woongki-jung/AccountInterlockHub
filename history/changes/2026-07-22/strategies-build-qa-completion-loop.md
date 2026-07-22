# strategies-build-qa-completion-loop (2026-07-22)

> build·qa 단계의 완성도 점검·자체보완·완료 루프를 각 단계 목적에 맞춰 정밀화한 개정. spec 개정([`strategies-spec-completion-loop`](strategies-spec-completion-loop.md))과 같은 렌즈로 분석하되 단계별 성숙도 차이를 반영. 본문 정본은 각 문서.

- **무엇**:
	- **build (B1~B4)**:
		- **B1 구현 커버리지 게이트** — 완료 기준에 "확정 사양 → 구현 Phase 편성 미커버 0" 추가(code-reviewer 는 편성된 Phase 내부만 보므로 스테이지 레벨 편성 누락은 게이트 부재였음). 계획 단계에서 사양↔Phase 매핑, 정리 단계에서 `사양×Phase×기능검증` 커버리지 매트릭스 산출 → qa 인계.
		- **B2 실 Pass 수렴 출구** — build 환경에서 실 Pass 원천 불가 항목(외부 의존 등)을 무한 회귀시키지 않고 사유·해소조건과 함께 qa 이월 또는 담당자 보류로 종결(해당 Phase `해결`+이월 노트).
		- **B3 Suggestion 종결** — code-reviewer Suggestion(수정 의무 없음)을 범위 내·저비용이면 자체보완/그 외 담당자·후속 이월로 분류 종결(spec E 와 동형).
		- **B4 회귀 카운터 정합** — `build.md` 오류처리(3회 반복→중단·정리 이행)를 base-workflow 일반화(진전 조기중단·자가판정 금지)와 정합, 처분(중단→정리 보고)은 유지.
	- **qa (Q1~Q3, 경량 — qa 는 이미 누락 0 정합식·정량 게이트·명시 이월을 보유한 성숙 단계)**:
		- **Q1 회귀 의미 명확화** — qa 의 '회귀'는 자체 수정이 아니라 Fail→`오류` 일감→외부(build/spec) 수정→qa 재검증(축약 범위)의 교차단계 루프임을 명시(spec 개정이 base-workflow 에 넣은 회귀 카운터 일반화의 qa 의미 확정).
		- **Q2 구현↔검증 대조** — test-planner 가 build 인계 커버리지 매트릭스를 대조해 "구현됐으나 검증 TC 없는 Phase"(구현↔검증 공백)를 식별, spec 보완 제안으로 등재(TC 임의 추가 금지 유지). 완료 기준에 편입.
		- **Q3 baseline 게이트화** — 0단계 환경 baseline 미확보를 완료 기준/차단(전체 Block·전건 이월)으로 명시.
- **왜**: 업무 프로세스 개정 점검(2026-07-22 담당자 요청)에서 spec 에 이어 build·qa 를 같은 렌즈로 점검. build 는 spec 과 같은 "결함 0 ≠ 누락 0" 구멍(B1)과 실 Pass 불가 항목 출구 부재(B2)가 있었고, qa 는 이미 성숙해 spec 개정이 유발한 회귀 의미 정합(Q1)과 B1 최대안이 새로 연 구현↔검증 대조(Q2)를 중심으로 가볍게 정렬. "완전 동일 복제가 아니라 단계 목적에 맞춘 개정" 원칙을 따름.
- **영향**:
	- `ai/strategies/stages/build.md` §핵심 활동 1·3, §완성도(완료) 기준 — B1·B2·B3 반영.
	- `ai/agents/build.md` §흐름 5, §오류 처리 — B1·B2·B3·B4 반영.
	- `ai/strategies/stages/qa.md` §완성도(완료) 기준 — Q1·Q2·Q3 반영.
	- `ai/agents/qa.md` §입력, §흐름 1, §완료 기준 — Q1·Q2·Q3 반영.
	- `ai/strategies/base-workflow.md` §개요 3 — 회귀 카운터에 qa 의미 주석 추가(Q1).
	- build→qa 인계 배선 신설: build 커버리지 매트릭스 → qa 구현↔검증 대조 입력.
- **관련 일감**: (없음 — 담당자 세션 직접 요청)
