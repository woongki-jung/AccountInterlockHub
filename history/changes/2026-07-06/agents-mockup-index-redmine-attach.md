# agents-mockup-index-redmine-attach (2026-07-06)

> 개정한 운영 문서의 변경 경위. 본문 정본은 해당 문서.

- **무엇**:
	- [`mockup-builder.md`](../../../ai/agents/workflow-mockup/mockup-builder.md) 3단계 — "인덱스 및 매핑 작성"을 **"인덱스·내비게이션 및 매핑 작성"으로 확장**: 목업 열람 허브 `mockup/index.html`(흐름별 화면 카드)과 모든 화면 공통 내비게이션 바(전 화면 상호 이동, 현재 화면 강조)를 표준 산출로 규정하고, `INDEX.md`(추적·매핑 문서)와의 병존 역할을 명시. 5단계 완료 보고 반환물에 `index.html` 추가.
	- [`mockup-builder.md`](../../../ai/agents/workflow-mockup/mockup-builder.md) — **신설 섹션 "Redmine 목업 일감 등록·첨부"**: 목업 html(허브 `index.html` 포함)·`INDEX.md` 를 spec 그룹 하위 목업 일감에 첨부로 미러링하고, **내용 갱신 시 해당 파일의 구 첨부를 삭제해 파일당 최신 1건만 유지**하는 정책을 명문화. 첨부 REST 절차는 work-tracking-redmine 참조로 위임.
	- [`work-tracking-redmine.md`](../../../ai/strategies/work-tracking-redmine.md) §이슈 조작 — **첨부(업로드·삭제) REST 절차 bullet 추가**: 2단계 업로드(`POST /uploads.json?filename=` → `PUT /issues/<id>.json` 의 uploads 배열)와 삭제(`DELETE /attachments/<id>.json`), 바이너리 업로드는 MCP 가 아닌 REST 직접 호출로 수행함을 명기.
- **왜**: 담당자 목업 피드백(Slack #account-interlock-hub, 2026-07-06) — (a) 로그인/사용자/관리자 화면이 서로 연결되지 않아 "모든 페이지를 오갈 수 있는 인덱스 형태" 요청, (b) 목업 페이지를 Redmine 일감에 등록하고 내용 변경 시 기존 첨부를 지워 최신만 남기며, 이 등록 지침을 이후에도 적용되도록 spec 지침에 반영 요청.
- **영향**: 목업 산출 표준이 `index.html` 허브 + 공통 내비 + 목업 일감 첨부(파일당 최신만 유지)로 확장된다. 단일 출처 배치 = 목업 산출 owner 인 **mockup-builder**(정책 정본) + **work-tracking-redmine**(첨부 REST 절차). `stages/spec.md`·`work-tracking.md` 본문은 정책 텍스트 이중화를 피하기 위해 미개정(계층상 전략→doer 하향 참조 회피).
- **관련 일감**: `accountinterlockhub#32`(목업), `accountinterlockhub#24`(spec 그룹).
