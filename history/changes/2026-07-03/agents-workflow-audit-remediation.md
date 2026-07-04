# agents-workflow-audit-remediation (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- **build 게이트 순서 재구성** — [`stages/build.md`](../../../ai/strategies/stages/build.md) §핵심 활동 3·4, [`build.md`](../../../ai/agents/build.md) 흐름 3·4: 배포 산출물을 먼저 빌드하고 **그 산출물(사용자 동일 환경)로 최종 런타임 게이트**를 수행하도록 순서 교정([`qa-execution.md`](../../../ai/strategies/qa-execution.md) §적용 범위와의 모순 해소). build 계획 단계에 qa-execution **케이스 확정·tester 전달**과 작업 브랜치 확인 추가.
	- **오케스트레이터 3종 배선** — [`spec.md`](../../../ai/agents/spec.md)·[`build.md`](../../../ai/agents/build.md)·[`qa.md`](../../../ai/agents/qa.md): doer 질의·승인 대기 종료 시 오케스트레이터도 중간 보고로 종료(릴레이 전파), 게이트 치명 시 "담당 채널 보고" → `보류`+중간 보고(릴레이) 교체, 사양 결함 판명 → spec 재착수 분기(build), 사양 갱신 건의 역방향 전파(spec 정리), 작업 브랜치(`<단계>/<주제>`) 확인·생성 책임, 회귀 시도 횟수 일감 노트 기록, IA 보완 주체(도메인 doer) 지정, qa 핫픽스 축약 범위 입력·검증 일감 등록 주체(test-planner) 명시·환경 구성 보강(기동·baseline 1회 + `check-dev-environments` 스킬)·report-template 카탈로그 분리·"사양 미정의 TC = spec 보완 제안" 정정.
	- **git 커밋 게이트 범위 명확화** — [`delivery.md`](../../../ai/strategies/delivery.md) §git 운용: 작업 브랜치 내 커밋 = 승인된 단계 디스패치의 위임 범위, **main 병합·원격 push = 담당자 요청·승인 시에만**. [`backend-developer.md`](../../../ai/agents/workflow-code-write/backend-developer.md)·[`frontend-developer.md`](../../../ai/agents/workflow-code-write/frontend-developer.md)에 동일 단서.
	- **spec doer 7종 정합** — 완료 보고 시 일감 상태 `진행` 유지(해결 전이는 교차검증 후 오케스트레이터 몫) 문장 공통 추가, 선행 doer 5종의 후행(PROC) 참조 체크에 "초회 예약 채번 허용·실재 확인은 교차검증 시점" 한정.
	- **prd-to-process.md** — 존재 불가 선행 입력 "QA 정의서" 한정어(7순위 후행), 목록 문서 "기능 변경 이력" 항목 삭제(이력 인라인 금지 정합), 용어 약어 줄·체크 기호(⬜)·헤딩 레벨·채번 라벨·오타·생성물 템플릿의 ai/ 역참조 제거·들여쓰기 정리.
	- **prd-to-datas.md 분할** — 322줄(300 제한 초과) → 255줄. ENT 산출 템플릿을 신규 하위 템플릿 [`prd-to-datas-ent-template.md`](../../../ai/agents/workflow-prd-to-spec/prd-to-datas-ent-template.md)(76줄)로 분기, "Phase 5" 구 용어 정정, DBMS 예시 면책 추가.
	- **계약·수치 정합** — [`build-installer.md`](../../../ai/agents/workflow-publish/build-installer.md) 보고 형식에 **기준 commit** 필드 추가(qa 인계 3요소 완성)·오류 표 .NET 예시 프레이밍, [`report-template.md`](../../../ai/agents/workflow-qa/report-template.md) 품질 게이트 수치를 정본(높음 100%·전체 95%·미해소 Fail 0)으로 교체·TC 사양 경로 `docs/specs/qa/` 정정, [`spec-reviewer.md`](../../../ai/agents/workflow-prd-to-spec/spec-reviewer.md) 참조 앵커·항목 수 표기 정정, [`prd-reviewer.md`](../../../ai/agents/workflow-prd-review/prd-reviewer.md) "게이트 정본" → "평가 정본" 한정·질의 릴레이 배선·오타(잠조) 정정, [`prd-to-functions.md`](../../../ai/agents/workflow-prd-to-spec/prd-to-functions.md) 그래프 표현 제거, [`prd-to-qa.md`](../../../ai/agents/workflow-prd-to-spec/prd-to-qa.md) "TC 사양 정의(실행 아님)" 경계 문장.
- **왜**: 2026-07-03 `ai/agents/` 전수 감사(5그룹 병렬 분석) — 높음 4(게이트 순서 모순·케이스 미전달·QA 정의서 순환 입력·이력 인라인 모순)·중간 13·낮음 약 22건 발견, 담당자 승인으로 전량 반영.
- **검증**: 전 파일 300줄 이하(분할 후 322→255+76), 잔재 패턴 grep 0건, 신규 템플릿 상호 링크 유효.
- **영향**: 전략 3종(stages/build·delivery·— qa-execution 은 무변경 기준선)·오케스트레이터 3종·doer 14종·하위 템플릿 2종(1 신설). 직전 개정 [`agents-template-alignment.md`](agents-template-alignment.md) 의 후속 감사.
- **관련 일감**: 없음(담당자 직접 요청 세션).
