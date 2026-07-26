# strategies-report-tracker-activation (2026-07-26)

> `Report`(8) 트래커를 3개 프로젝트 전부에 활성화하고 문서의 "미완" 표기를 걷어냈다. 활성화 자체는 제품 루프 오케스트레이터가 2개 프로젝트에 먼저 수행했고(`#469` j3712), 남은 `ai-workgroup-ops` 와 문서 반영을 ai-pm 이 마무리했다. 함께 발견된 **등록 시 `status_id` 무시** 함정을 3단계 절차로 명문화했다.

- **무엇**:
	- **활성화 완료** — `smoke-test`(3)·`accountinterlockhub`(5)는 오케스트레이터가, **`ai-workgroup-ops`(4)는 ai-pm 이** `PUT /projects/ai-workgroup-ops.json` `tracker_ids:[1,2,4,6,7,8]` 로 활성화했다. 3개 프로젝트 전부 `Report`=8 포함을 REST 로 재확인했다.
	- 🔴 **등록 절차를 3단계로 명문화** — `tracker_id: 8` POST 에 `status_id: 5` 를 실어도 **무시되고 `Needs Feedback`(4)으로 떨어진다**(오케스트레이터 일회용 이슈 왕복 실측). **① POST → ② PUT `status_id: 5` → ③ GET `closed_on` 실측**으로 고쳐 적었다.
	- [`work-tracking-redmine.md`](../../../ai/strategies/work-tracking-redmine.md) §요소 식별자 트래커 표 id 8 행의 "전 프로젝트 미활성 — 현재 사용 불가" 제거, §트래커 구성의 미완 항목을 완료 항목으로 재작성, 현 트래커 세트 열거에 report 추가.
	- **프로젝트 활성이 REST 로 가능하다는 사실을 문서화** — 종전 서술은 admin `rails runner` 만 경로로 제시했다. 다만 `tracker_ids` 는 **치환**이라 기존 목록을 전부 실어야 한다는 경고를 함께 달았다.
- **왜**: 문서가 "어느 프로젝트에도 활성화되지 않아 아직 쓸 수 없다"고 단정하고 있어, 레그 report·세션 report 를 남겨야 하는 주체가 **시도조차 하지 않고 우회할 근거**가 됐다. 실제로는 이미 2/3 이 열려 있었다. 또 `status_id` 무시 함정을 모르면 report 일감이 열린 채 남아 **부모 이슈를 닫지 못하는** 조용한 실패가 난다 — 이는 [`work-tracking.md`](../../../ai/strategies/work-tracking.md) §계층·연관이 전제하는 "등록과 동시에 완료" 를 깨뜨린다.
- **영향**:
	- `ai/strategies/work-tracking-redmine.md` — §요소 식별자 트래커 표 1행, §트래커 구성 미완 항목 → 완료 항목 재작성.
	- **정책 무변경** — `work-tracking.md` §작업 보고의 2계층(레그·세션) 구조는 손대지 않았다.
	- **스크립트 무변경·미실행 유지** — `redmine-create-report-tracker.rb` 는 활성화를 REST 로 처리했으므로 실행하지 않았다. 워크플로 전이를 명시 생성해야 할 때를 위해 남긴다.
- **검증**: 3개 프로젝트 `include=trackers` REST 재조회로 `Report`=8 포함 확인. `ai-workgroup-ops` 는 기존 트래커(작업세션·사양·Defect·Feature·Common)가 그대로 유지되고 **`검증`(5) 미포함 상태도 의도대로 보존**됨을 확인했다(제품 프로젝트 전용).
- **관련 일감**: `#469`(제품 루프 그룹 — 오케스트레이터 발견·선행 활성) · `#467`(작업세션).
