# agents-qa-guide-adoption (2026-07-04)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`ai/agents/workflow-prd-to-spec/prd-to-qa.md`](../../../ai/agents/workflow-prd-to-spec/prd-to-qa.md) — ① TC ID 채번을 IA 기준(`{ia-code}_{NNN}` + 횡단 식별자 `SCEN_`·`MIG_`)으로 교체(§4단계·§6-1·출력 형식·체크리스트) ② 개별 TC 파일 조직을 IA leaf/영역 단위 + `공통` 폴더 + 300줄 분할로 규정(§6-2) ③ 시나리오 TC 작성 기준 신설(§4-1 — 페르소나·비즈니스 목적, 단계별 검증 쌍, 기능단위 TC 중복 금지) ④ 데이터 이관 TC 작성 기준 신설(§4-2 — 대상 정리표 SSOT, 정합/흐름 TC 분리) ⑤ 시드 데이터 카탈로그 산출 요구 추가(§3단계 — 시드 수단 4종·확인 방법 컬럼) ⑥ 미확정 정책의 미해소 항목 카탈로그 등재 규정 신설(§4-3 — spec-qa.md "사양 미해소 항목(Block 예정)", 행 삭제 금지) ⑦ TC 템플릿 판정 기준에 5종 판정 참조 문구 정합.
	- [`ai/agents/workflow-qa/report-template.md`](../../../ai/agents/workflow-qa/report-template.md) — "도메인별 집계" → "IA 영역별 집계(`ia-code` 기준, `공통` 행 포함)", Phase별 결과·실패 상세의 도메인 표기 → IA 노드, 잠정 Pass(🔵🟣) 섹션에 환경 정비 시 회귀 우선순위 상향 원칙 추가.
	- [`ai/agents/workflow-qa/test-planner.md`](../../../ai/agents/workflow-qa/test-planner.md) — TC 소속 분류·ID 체계를 IA 기준(`ia-code`)으로 명시, 계획 양식 "TC 대상 범위" 표와 보고·메모리 항목의 도메인 용어를 IA 영역/노드로 정합.
	- [`ai/agents/workflow-prd-to-spec/prd-to-qa-tc-template.md`](../../../ai/agents/workflow-prd-to-spec/prd-to-qa-tc-template.md) **신설** — prd-to-qa §6-2 인라인 TC 템플릿 블록을 하위 템플릿 파일로 분리(개정으로 본문이 300줄을 초과해 document-master-guide §길이·구조 적용, 같은 폴더의 ent/logic 템플릿 분리 관례 준용). 전제 조건에 시드 경로 키워드 병기 규칙 추가.
	- [`ai/strategies/agents.md`](../../../ai/strategies/agents.md) — 등록 카탈로그의 템플릿·하위 리소스 나열에 prd-to-datas-ent-template·prd-to-qa-tc-template 추가.
- **왜**: 실무 QA 운영 경험에서 추출한 범용 TC 작성·결과보고 가이드(`etc/qa-guide/` — 사람 참고용)를 표준 워크플로우의 IA 좌표계([`ia.md`](../../../ai/strategies/ia.md))에 동기화한 뒤, 그중 에이전트 실행에 필요한 규정(TC 사양서 작성·QA 결과보고)을 지침으로 편입하기 위함. 특히 test-planner 가 소비하는 "사양 미해소 플래그"의 생산 책임이 어느 지침에도 없던 공백을 prd-to-qa §4-3 으로 해소.
- **영향**: prd-to-qa ↔ test-planner 간 미해소 카탈로그 인계 배선 신설(§4-3 → test-planner §1단계). TC ID·파일 경로 규약 변경은 신규 프로젝트 산출물부터 적용(기존 산출물 소급 없음). tester.md 는 판정 5종·증빙 규정이 이미 정합해 무변경. 참고 원본: `etc/qa-guide/`(에이전트 참조 제외 폴더 — 지침 반영분이 실행 정본).
- **관련 일감**: 없음 (Redmine 미구축 상태).
