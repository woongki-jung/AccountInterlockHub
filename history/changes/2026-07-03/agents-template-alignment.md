# agents-template-alignment (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`backend-developer.md`](../../../ai/agents/workflow-code-write/backend-developer.md)(225→82줄)·[`frontend-developer.md`](../../../ai/agents/workflow-code-write/frontend-developer.md)(177→90줄) — **재작성**: 구 프로젝트 고유값 전량 제거(스펙 ID 실값·전용 엔진 API·컴포넌트 문서명·`docs/prd/specification/**` 구 트리·특정 빌드 규약·프로그램 강제 분류·유령 비밀 키). 사양(`docs/specs/`)·개발사양(`docs/prd/devspec/`)·`CLAUDE.env.md` 참조로 대체. 일감 상태는 `진행` 유지+노트(상태 매핑 정합), IA history 는 doer 직접 갱신으로 정정.
	- [`spec.md`](../../../ai/agents/spec.md)·[`build.md`](../../../ai/agents/build.md)·[`qa.md`](../../../ai/agents/qa.md)(오케스트레이터) — IA 이력은 doer 가 entry 추가·오케스트레이터는 평가 상태만 갱신(이중 entry 제거), `사양` 일감 등록 주체 명시, Phase 담당 doer 지정(BE·FE 걸침 시 BE→FE 분할), 잠정 Pass 게이트 불인정, 배포 산출물 식별 정보 인계, Fail→`오류` 일감, 판정 마커 훼손 처리, 재개(일감 노트 기반)·doer 1회 재시도 규정, "인스톨러" 단계명→"배포 산출물".
	- [`code-reviewer.md`](../../../ai/agents/workflow-code-write/code-reviewer.md) — 「호출 주체·입력」 계약 신설, description 한 줄화, 반환 예시 스택 플레이스홀더화.
	- [`tester.md`](../../../ai/agents/workflow-qa/tester.md) — 임시 영역 `tmp/`→`works/<프로젝트식별자>-<이슈번호>/`, qa Fail 시 `오류` 일감 생성·연관, 증빙 = 일감 첨부.
	- [`test-planner.md`](../../../ai/agents/workflow-qa/test-planner.md) — 계획 정본 = Redmine 일감 설명·노트로 확정(잠정 위임 제거).
	- [`prd-reviewer.md`](../../../ai/agents/workflow-prd-review/prd-reviewer.md) — 구세대 "스킬 사용" 표현·prd-to-qa §2 참조 정정.
	- [`build-installer.md`](../../../ai/agents/workflow-publish/build-installer.md) — `docs/prd/specification/deploy/**` 구 트리 참조를 `docs/prd/devspec/infra.md` 로 교체, 4개 인스톨러·Debug/Release 고정 구조를 배포사양 정의(예시 프레이밍)로 일반화.
	- [`agents.md`](../../../ai/strategies/agents.md) — 디스패치 모델 표 "인스톨러"→"배포 산출물".
- **왜**: 표준 템플릿 관점 전수 분석(2026-07-03)에서 확인된 이식성 최대 리스크(developer doer 하드코딩)와 에이전트↔전략 불일치(IA 이력 이중 갱신·미정의 상태 사용·입력 계약 부재·구 트리 참조) 해소.
- **영향**: 전략 개정([`strategies-template-gap-remediation.md`](strategies-template-gap-remediation.md))과 한 묶음. 스킬·런타임은 [`skills-portability-normalization.md`](skills-portability-normalization.md)·[`scripts-ai-pm-runtime-hardening.md`](scripts-ai-pm-runtime-hardening.md).
- **관련 일감**: 없음(담당자 직접 요청 세션).
