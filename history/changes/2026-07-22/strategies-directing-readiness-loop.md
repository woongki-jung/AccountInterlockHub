# strategies-directing-readiness-loop (2026-07-22)

> directing 을 "담당자 참여 준비 단계"로, spec-build-qa 를 "하나의 제품개발 루프"로 재정의하고, directing 의 완료를 루프 진입 준비도로 게이트화한 개정. spec·build·qa 개정([`strategies-spec-completion-loop`](strategies-spec-completion-loop.md)·[`strategies-build-qa-completion-loop`](strategies-build-qa-completion-loop.md))의 후속. 본문 정본은 각 문서.

- **무엇** (D-1~D-4):
	- **D-1 루프 진입 준비도 게이트 + 요구사항 세분화 루프** — prd-reviewer 를 directing 종료 준비도 게이트로 재사용(ai-pm 이 반복 호출), spec 진입은 재확인으로 경량화. 나아가 **요구사항을 최대 수준으로 세분화하는 루프**를 도입: prd-reviewer 재검토(적합도 평가 + 고도화 제안)→담당자 협의 반영을 **새 세분화·결함·제안이 안 나올 때(수렴)까지 또는 담당자 판단까지** 반복. 세분화 경계는 요구사항·방향·서비스 기능단위(IA leaf)까지이며 세부 구현(API·데이터 모델·화면)은 spec 소관으로 제외.
	- **D-2 핸드오프 완비 게이트** — 완료 기준에 방향 정의서 외 4산출물 완비 편입: IA(기능단위) 확정·프로그램 구성표 확정·필요 devspec 작성·CLAUDE.env.md 갱신(해당 없으면 명시 생략).
	- **D-3 루프 피드백 재진입·역방향 전파** — 루프가 방향 결함을 피드백하면 directing 부분 재착수(국소 갱신) + 갱신이 영향을 주는 IA 노드·사양·구현·TC 를 역방향 전파로 표시해 재핸드오프.
	- **D-4 directing/루프 경계 명문화 + 회귀 카운터 인간협의 정합** — base-workflow 에 "directing=준비 / spec-build-qa=하나의 제품개발 루프" 경계 명문화, directing 회귀는 기계적 3회 상한 예외(수렴·담당자 합의까지 인간협의)로 정합. 착수 입력(:14 담당자 중단까지)과 검증(:22 최대 3회)의 상충 해소.
- **왜**: 업무 프로세스 개정 점검(2026-07-22 담당자 요청)의 마지막 단계. 담당자 프레이밍("directing=준비, spec-build-qa=하나의 루프")을 반영해, directing 을 제품 루프처럼 doer·커버리지 매트릭스로 다루는 대신 **핸드오프 품질·루프 진입 준비도**를 게이트하는 방향으로 개정. 담당자 합의가 주관적이라 루프 진입 즉시 되튕기던(spec 진입 게이트 → directing 회귀) 헛걸음을 directing 에서 앞당겨 해소하고, 요구사항 세분화 수준을 극대화하는 수렴 루프를 명시.
- **영향**:
	- `ai/strategies/base-workflow.md` §개요(경계 명문화·회귀 카운터 directing 예외), §단계별 지침 directing 요약 — D-1·D-4.
	- `ai/strategies/stages/directing.md` §핵심 활동 2·3, §실행 주체, §완성도(완료) 기준, §다음 단계 이행 조건 — D-1·D-2·D-3.
	- `ai/agents/workflow-prd-review/prd-reviewer.md` frontmatter·서두·§게이트 판정 — directing 종료 게이트·세분화 엔진·spec 진입 재확인으로 역할 재정의.
	- `ai/agents/spec.md` §흐름 2, `ai/strategies/stages/spec.md` §핵심 활동 1 — 진입 게이트를 재확인으로(directing 통과분 경량 재확인).
	- `ai/strategies/ai-pm.md` §단계 연결 directing — 세분화·준비도 평가에 prd-reviewer 호출 정합.
	- 새 배선: directing 이 prd-reviewer 를 유일 평가 doer 로 사용(방향 작성은 ai-pm 직접). directing 핸드오프(PRD·IA·프로그램구성표·devspec·env) → 제품 루프 입력.
- **관련 일감**: (없음 — 담당자 세션 직접 요청)
