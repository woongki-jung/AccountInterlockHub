# config-init-checklist-replacement (2026-07-03)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`CLAUDE.md`](../../../CLAUDE.md) — §워크스페이스 구성 체크리스트(체크리스트 파일 규정·매 응답 시작 시 확인 경고 규칙·항목 템플릿 5종) **삭제**, 짧은 §워크스페이스 구성 준비(준비는 사람이 `etc/init/` 로, 에이전트 측 정본은 project-bootstrap.md)로 교체.
	- 루트 `workspace-init-checklist.md` **삭제** + `.gitignore` 등재 제거 — PC 로컬 점검 파일 체계 폐기.
	- [`project-bootstrap.md`](../../../ai/strategies/project-bootstrap.md) — 서두의 "다른 PC 재구성 = CLAUDE.md 체크리스트" 분담을 "etc/init/ 의 PC 로컬 항목 재수행"으로, §7 의 workspace-init-checklist 재확인을 "etc/init/ 전 항목 체크 확인"으로 교체.
	- [`ai-pm.md`](../../../ai/strategies/ai-pm.md) §기동 절차 1 — 참조를 CLAUDE.md 체크리스트에서 project-bootstrap.md §4 로 교체.
	- `etc/init/` 보완(사람 전용) — README 에 §다른 PC 에서 재구성(PC 로컬 항목 목록), 01-pc 에 OS 환경변수 항목, 05-verify 의 로컬 체크리스트 생성 항목을 "앞 단계 재확인"으로 교체.
- **왜**: 담당자 지시(2026-07-03) — 기존 체크리스트 체계(CLAUDE.md 템플릿 + git 비관리 workspace-init-checklist.md)를 같은 날 신설한 `etc/init/` 준비 체크리스트로 **대체**. 준비 상태의 기록을 한 곳(etc/init, git 커밋)으로 일원화.
- **영향**: 매 응답 시작 시 체크리스트 경고 규칙이 사라진다 — 준비 누락 감지는 사람의 etc/init 완주 확인으로 대체. PC 로컬 상태는 별도 파일로 추적하지 않고, 다른 PC 재구성 시 etc/init 의 PC 로컬 항목을 재수행하는 방식으로 흡수. 환경변수 키 이름 목록(CLAUDE.md §환경변수 키 목록)은 유지.
- **관련 일감**: 없음(담당자 직접 요청 세션).
