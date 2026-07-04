# strategies-template-gap-remediation (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`work-tracking.md`](../../../ai/strategies/work-tracking.md) — §단계 산출 일감 상태 매핑 신설(사양·기능·검증 일감의 신규→진행→해결→완료 전이 기준, Fail/Block/이월 처리), qa Fail→`오류` 일감 생성 규칙(§계층·연관), 승인 증적(일감 노트 정본) 규칙 추가.
	- [`doc-structure.md`](../../../ai/strategies/doc-structure.md) — §작업 실행 산출 확정(정본 = Redmine 일감, 임시 = `works/<프로젝트식별자>-<이슈번호>/`), 트리에 `devspec/`·`releases/`·`works/`·`wiki/` 추가.
	- [`base-workflow.md`](../../../ai/strategies/base-workflow.md) — 회귀 시도 횟수의 일감 노트 기록, directing 주체를 ai-pm 으로 통일, 배포 산출물 표현 추상화(인스톨러 전제 제거), delivery.md 연결.
	- [`stages/build.md`](../../../ai/strategies/stages/build.md)·[`stages/qa.md`](../../../ai/strategies/stages/qa.md) — 배포 산출물 필수화·식별 정보(버전·경로·commit) 인계 규격, qa 재빌드 금지, 잠정 Pass 게이트 불인정, 품질 게이트 기본 기준(높음 100%·전체 95%·Fail 0), Fail→오류 일감, 릴레이 참조.
	- [`stages/directing.md`](../../../ai/strategies/stages/directing.md) — 산출물에 개발사양(`docs/prd/devspec/` — external-apis·database·infra) 신설, 시효 지난 잠정 문구 제거.
	- [`stages/spec.md`](../../../ai/strategies/stages/spec.md) — 잠정 경로 문구 정리, 릴레이 참조.
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) — §질의·승인 릴레이 신설(중간 보고 종료 → ai-pm 릴레이 → 일감 노트 증적 → 재디스패치 재개), 단계 연결의 "후속 정의" 시효 문구 정리.
	- [`qa-execution.md`](../../../ai/strategies/qa-execution.md)·[`qa-execution/desktop-ui.md`](../../../ai/strategies/qa-execution/desktop-ui.md) — 적용 범위 분리(qa·최종 게이트 = 배포 산출물 / build Phase별 기능검증 = 직접 빌드 허용), 케이스 바인딩을 "doer 공통 + 케이스 문서 로드"로 확정.
	- [`agents.md`](../../../ai/strategies/agents.md) — 검토 협의에 릴레이 배선.
	- [`work-tracking-redmine.md`](../../../ai/strategies/work-tracking-redmine.md) — 의견=4 상태 미사용 명시, "프로젝트 정의 단계" 용어를 프로젝트 부트스트랩으로 교체.
	- [`document-master-guide.md`](../../../ai/strategies/document-master-guide.md) — 트리 그림 예외(doc-structure 1개 허용)·부모 정본 명시 허용 규칙 완화.
	- [`skills.md`](../../../ai/strategies/skills.md) — "복원 자료·추후 다듬기" 경위 서술 제거, 고유 값 금지 정책만 현재형으로.
	- **신설**: [`delivery.md`](../../../ai/strategies/delivery.md)(git 운용·버전/릴리스·배포 실행·유지보수/핫픽스 경로·역방향 전파), [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md)(템플릿 복제→새 프로젝트 초기화 절차·교체 대상 전 목록).
- **왜**: 표준 템플릿 관점 전수 분석(2026-07-03)에서 확인된 정합 결함(인스톨러 build↔qa 모순, 판정↔상태 매핑 위임 공백, 중간 산출물 위치 잠정, 승인 게이트 미배선)과 표준 워크플로우 공백(릴리스·git·핫픽스·부트스트랩)을 해소.
- **영향**: 루트 [`CLAUDE.md`](../../../CLAUDE.md)(신규 전략 2종 배선)·[`CLAUDE.env.md`](../../../CLAUDE.env.md)·`.gitignore`(`works/`) 함께 개정(경위는 [`config-bootstrap-wiring.md`](config-bootstrap-wiring.md)). 에이전트·스킬·런타임 정렬은 같은 날 별도 entry(agents-·skills-·scripts- 파일) 참조.
- **관련 일감**: 없음(담당자 직접 요청 세션).
