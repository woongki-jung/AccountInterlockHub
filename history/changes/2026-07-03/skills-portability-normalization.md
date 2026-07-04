# skills-portability-normalization (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`check-dev-environments/SKILL.md`](../../../ai/skills/check-dev-environments/SKILL.md) — **전면 재작성**: 구 프로젝트 하드코딩(외부 API 주소 3종·Sybase/postgreSQL 호스트·포트·"본 프로젝트는 ~없음" 판단문) 제거. 점검 대상 값은 개발사양(`docs/prd/devspec/`)·`CLAUDE.env.md` 조회로 대체, 해당 사양 부재 시 "해당 없음" 판정 규칙 신설. 오탈자(실해→실패, playwrite→playwright) 정정.
	- [`make-prd-requirements/SKILL.md`](../../../ai/skills/make-prd-requirements/SKILL.md)·[`make-prd-specifications/SKILL.md`](../../../ai/skills/make-prd-specifications/SKILL.md) — 삭제된 `start-spec.md` 참조를 현행 `ai/agents/spec.md` 로, 미존재 `figma-generate-design` 위임 제거, 스킬 폴더 기준 상대 링크 전수 교정. make-prd-specifications 의 산출 위치를 `docs/prd/devspec/`(database·external-apis·infra) + PRD §프로그램 구성표로 정렬(구 `docs/prd/specification/` 트리 폐기).
	- [`writing-plans/SKILL.md`](../../../ai/skills/writing-plans/SKILL.md) — 미설치 외부 플러그인(superpowers:*) REQUIRED 지정을 "설치 환경에서만, 미설치 시 본문 절차 직접 수행"으로 완화. 계획 산출 경로 `docs/plans/` 를 doc-structure §작업 실행 산출(정본 = Redmine 일감, 파일은 `works/`)로 정렬.
- **왜**: 표준 템플릿 관점 전수 분석(2026-07-03) — 스킬 본문의 제품 하드코딩([`skills.md`](../../../ai/strategies/skills.md) 정책 위반)과 구조 재편 미반영 dangling 참조 해소.
- **영향**: 전략·에이전트 개정과 한 묶음 — [`strategies-template-gap-remediation.md`](strategies-template-gap-remediation.md)·[`agents-template-alignment.md`](agents-template-alignment.md).
- **관련 일감**: 없음(담당자 직접 요청 세션).
