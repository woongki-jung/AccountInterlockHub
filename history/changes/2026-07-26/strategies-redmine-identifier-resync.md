# strategies-redmine-identifier-resync (2026-07-26)

> Redmine 인스턴스를 REST 로 실측해 §요소 식별자를 갱신했다. 문서값이 여러 곳에서 실제와 달랐고, 그중 **`보류` 상태 부재**는 정책이 쓰는 상태 어휘에 대응 객체가 없는 실운영 결함이다. 담당자 지시("레드마인 구성을 다시 확인해서 트래커 ID를 갱신") 2026-07-26.

- **무엇**: `trackers`·`issue_statuses`·`roles`·`issue_priorities`·`projects`·프로젝트별 활성 트래커를 REST 조회해 [`work-tracking-redmine.md`](../../../ai/strategies/work-tracking-redmine.md) §요소 식별자를 실측값으로 교체했다.

  - **`Report` 트래커는 이미 생성돼 있었다 (id=8)** — 문서는 "미생성"으로 적고 있었다. 다만 **3개 프로젝트 전부에 미활성**이라 아직 쓸 수 없다(그 상태로 `tracker_id: 8` POST → 422 `Tracker is not included in the list`). §트래커 구성의 미완 항목을 "생성"에서 **"활성화"** 로 다시 썼고, 남은 작업을 활성화·워크플로 보정·문서 정리 셋으로 분해했다.
  - **트래커 표시명이 정책 이름과 다르다** — `Defect`=1(오류) · `Feature`=2(기능) · `Common`=4(그룹). 문서는 정책 이름만 적어 두어, 에이전트가 REST 응답의 영어 이름을 보고 다른 객체로 오인할 여지가 있었다. **id ↔ 표시명 ↔ 정책 이름 3열 대응표**로 교체했다. id 3 은 결번(기본 트래커 삭제 흔적).
  - **⚠️ `보류` 상태가 인스턴스에 없다** — 문서는 `보류=7` 로 적었으나 **id 7 은 결번**이다. 실제 상태는 `New`=1 · `In Progress`=2 · `Resolved`=3 · `Needs Feedback`=4 · `Closed`=5 · `Rejected`=6 · `Confirmed`=8 · `Assigned`=9 다. 정책은 보류를 게이트 결함·회귀 소진·Block 처리의 종착 상태로 쓰는데 매핑 대상이 없다.
  - **프로젝트 실측** — `smoke-test`=3 · `ai-workgroup-ops`=4 · `accountinterlockhub`=5(범주 18건). 문서는 운영 프로젝트만 식별자로 적고 id 가 없었다. `검증`(5)은 제품 프로젝트에만 활성인데 이는 의도와 부합해 그대로 뒀다.
  - **§프로젝트 생성 표준 절차 2번** `tracker_ids` `[4,6,2,1,5,7]` → `[4,6,2,1,5,7,8]`(report 포함, 조건부 문구 제거).
  - **스크립트 버그 수정** — [`redmine-create-report-tracker.rb`](../../../ai/scripts/redmine-create-report-tracker.rb) 가 `Tracker.find_by(name: 'report')` 로 정확 일치 조회를 했다. 실제 이름은 `Report` 라 **못 찾고 같은 뜻의 트래커를 하나 더 만들었을 것이다.** `LOWER(name) =` 비교로 바꿔 기존 것을 재사용하게 했고, 스크립트 성격을 "생성"에서 "준비(확보·활성·전이 보장)"로 정정했다. 실행 후 안내도 id 8 일치 여부 분기·실동작 실측 지시로 교체했다.
- **왜**: 문서의 식별자 절이 언제 채워진 값인지 알 수 없는 상태로 굳어 있었고, 그 사이 인스턴스가 바뀌었다(Report 트래커 추가, 상태 세트 상이). 식별자는 에이전트가 REST 호출에 그대로 박아 쓰는 값이라 틀리면 조용한 실패로 이어진다 — 특히 `update_issue` 는 상태 전이 거부를 성공으로 삼키므로(§도구 함정) 없는 상태 id 를 보내면 아무 일도 일어나지 않은 채 성공으로 보인다.
- **영향**:
  - `ai/strategies/work-tracking-redmine.md` — §요소 식별자 **전면 교체**(트래커 대응표·상태 실측·보류 부재 경고·프로젝트 id), §트래커 구성 미완 항목 재작성, §프로젝트 생성 표준 절차 2번 `tracker_ids`.
  - `ai/scripts/redmine-create-report-tracker.rb` — 대소문자 무시 조회로 중복 생성 차단, 머리말·후속 안내 정정.
  - **정책 무변경** — [`work-tracking.md`](../../../ai/strategies/work-tracking.md) 의 상태 어휘·보고 정책 자체는 손대지 않았다(아래 미결 참조).
- **`보류` 매핑 확정 — `Needs Feedback`=4 (담당자 결정 2026-07-26, 2안 채택)**: 상태를 신설하지 않고 기존 상태에 맨다(admin 작업 0). "응답을 기다린다"는 뜻이 정책 용법(외부 응답 대기·Block·명시적 이월)과 같고, 열린 상태라 응답 후 `진행` 복귀도 성립한다.
  - **정책 어휘는 그대로 둔다** — 옵션 2 는 어휘 변경이 아니라 **매핑 변경**이다. 정책은 계속 `보류` 라는 말을 쓰고, 그것이 어느 Redmine id 인지만 [`work-tracking-redmine.md`](../../../ai/strategies/work-tracking-redmine.md) §요소 식별자가 갖는다. 그래서 `보류` 를 쓰는 28개 문서를 훑지 않았다 — 정책 이름의 정본은 [`work-tracking.md`](../../../ai/strategies/work-tracking.md), 매핑의 정본은 redmine 문서라는 기존 분리를 그대로 활용했다.
  - **전이 가능성 실측** — 표본 트래커(작업세션·사양·기능·오류·그룹) 전부에서 `Needs Feedback`(4) 이 열린 상태로부터 전이 가능함을 확인한 뒤 확정했다(문서만 고치고 실동작을 확인하지 않는 것을 피했다).
  - `work-tracking.md` §상태 어휘 아래에 "표시명·id 는 redmine 문서가 단일 출처, 보류=`Needs Feedback`=4" 안내 1문단을 추가했다.
- **부수 발견 — `allowed_statuses` 로 전이 사전 확인**: `GET /issues/<id>.json?include=allowed_statuses` 가 **그 이슈에 지금 실제로 적용 가능한 상태 목록**을 준다(역할·워크플로·하위 일감 상태 반영). 조사 중 `Common`(그룹) #469 에서 `Closed` 가 후보에 없는 것을 발견했는데, 워크플로 제약이 아니라 **열린 하위 일감 때문에 Redmine 이 닫힘 상태를 제외한 것**이었다 — 즉 이 조회 하나로 "열린 하위 때문에 부모를 못 닫는다"는 기존 함정을 **사전에** 잡을 수 있다. §전이 사전 확인 절을 신설하고 §도구 함정의 해당 항목에서 이 절을 가리키게 했다. 종전의 "PUT 후 GET 으로 실측" 은 구버전 폴백으로 남겼다.
- **미완**: `Report`(8) 활성화 스크립트는 **아직 실행되지 않았다.** 담당자가 Redmine 도커 호스트에서 1회 실행한다.
- **관련 일감**: (없음 — 담당자 세션 직접 요청)
