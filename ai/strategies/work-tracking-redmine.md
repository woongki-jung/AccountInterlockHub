# 업무 티켓 Redmine 운영

[`work-tracking.md`](work-tracking.md) 정책을 **공용 Redmine 서비스**(프로젝트 밖에서 운영 중인 인스턴스 — [`project-bootstrap.md`](project-bootstrap.md) §3)로 실행하기 위한 **운영 세부**(접속·식별자·프로젝트 생성·도구 함정)를 정의한다. 정책·상태 어휘·이슈 양식은 부모 문서가 정본이고, 본 문서는 그것을 Redmine 에 매는 방법만 다룬다.

## 접속

- 서버 URL·관리자 키·세션 API 키는 git 비관리 [`CLAUDE.local.md`](../../CLAUDE.local.md) §Redmine 자격증명 단일 출처.
- 세션은 Redmine MCP 도구(`mcp__redmine__*`)로 작용한다. 서버 본체는 저장소에 있다 — [`ai/scripts/redmine-mcp-server.mjs`](../scripts/redmine-mcp-server.mjs)(의존성 0 Node 단일 파일). 등록 절차는 [`project-bootstrap.md`](project-bootstrap.md) §3-B.
- MCP 서버는 환경변수 `REDMINE_API_KEY`·`REDMINE_BASE_URL` 을 최우선으로 읽고, 없으면 서버 파일과 같은 위치의 `.env`(admin)로 폴백한다.
- **작업 정체성**: 메인 세션 env `REDMINE_API_KEY` 가 있으면 그 정체성으로 작동한다(이슈 작성자·담당자가 그 계정). 미설정 시 admin 폴백(프로젝트·사용자 생성 등 관리자 동작 포함).

## 요소 식별자 레퍼런스

인스턴스 **실측값**(2026-07-26 REST 조회 기준. 재구축·변경 시 본 절 갱신). 정책 이름은 [`work-tracking.md`](work-tracking.md) 가 정본이며, **Redmine 표시명이 정책 이름과 다르다** — 아래 대응표대로 읽는다(응답에 영어 이름이 오는 것은 정상).

- **트래커** (Redmine 표시명 = id → 정책 이름):

	| id | Redmine 표시명 | 정책 이름 | 비고 |
	|---|---|---|---|
	| 1 | `Defect` | 오류 | |
	| 2 | `Feature` | 기능 | |
	| 4 | `Common` | 그룹 | |
	| 5 | `검증` | 검증 | 제품 프로젝트에만 활성 |
	| 6 | `사양` | 사양 | |
	| 7 | `작업세션` | 작업세션 | |
	| 8 | `Report` | report | 3개 프로젝트 전부 활성(2026-07-26). 🔴 **등록은 3단계**(§트래커 구성) |

	id 3 은 결번이다(기본 트래커 삭제 흔적). 신규 프로젝트 활성 목록은 §프로젝트 생성 표준 절차 2번.

- **상태** (Redmine 표시명 = id → 정책 이름): `New`=1(신규) · `In Progress`=2(진행) · `Resolved`=3(해결) · **`Needs Feedback`=4(보류)** · `Closed`=5(완료·닫힘) · `Rejected`=6(거절·닫힘). 정책 상태 어휘 6종([`work-tracking.md`](work-tracking.md) §상태 어휘)이 여기에 1:1 로 대응한다.
	- **`보류` → `Needs Feedback`=4** — 인스턴스에 `보류` 라는 이름의 상태는 없고 id 7 은 결번이다. 정책의 보류(외부 응답 대기·Block·명시적 이월)를 **`Needs Feedback`(4)에 맨다** — "응답을 기다린다"는 뜻이 정책 용법과 같고, 열린 상태라 응답 후 `진행` 복귀도 성립한다(담당자 결정 2026-07-26). **`status_id: 7` 은 절대 보내지 않는다** — REST 는 422, MCP `update_issue` 는 실패를 성공으로 삼켜 상태가 조용히 그대로 남는다(§도구 함정).
	- `Confirmed`=8 · `Assigned`=9 는 정책 미사용이다(Redmine 기본 잔존). 정책 어휘를 이 둘로 확장하지 않는다.
	- 전이 가능성은 2026-07-26 실측으로 확인했다 — 표본 트래커(작업세션·사양·기능·오류·그룹) 전부에서 열린 상태끼리 6종 전면 전이가 허용된다. 개별 건의 실제 허용 목록은 아래 §전이 사전 확인으로 조회한다.
- **역할**: 관리자=3, 개발자=4, 보고자=5, 뷰어=6.
- **우선순위**: 낮음=1, 보통=2(기본), 높음=3, 긴급=4, 즉시=5.
- **프로젝트**: `ai-workgroup-ops`=4(워크스페이스 운영·메타) · `accountinterlockhub`=5(제품, 범주 18건) · `smoke-test`=3(점검용). 제품 프로젝트 식별자 정본은 [`CLAUDE.env.md`](../../CLAUDE.env.md) `<REDMINE_PROJECT>`.
- **범주(카테고리)·배포버전(버전)**: 프로젝트별 객체라 고정 id 가 없다 — 생애주기 내내 REST 로 지속 추가한다(카테고리 = IA 노드(leaf), [`work-tracking.md`](work-tracking.md); 버전 = 배포 로드맵).
- **이슈 커스텀 필드** `Sprint`=1(문자형)이 인스턴스에 존재하나, 현 모델은 단계·묶음을 트래커·상위 이슈·메타 머리말로 표현하므로 필수가 아니다.

## 트래커 구성 (admin 전용)

트래커·커스텀 필드·상태·워크플로·역할·우선순위는 admin 전용이라 REST 로 만들 수 없다(§도구 함정). **서비스 관리자의 1회 작업**(프로젝트 준비 범위 밖)으로, 서비스 호스트(Docker)에서 `rails runner` 로 구성한다(admin UI 대체):

```
docker exec -e SECRET_KEY_BASE_DUMMY=1 redmine bin/rails runner /tmp/<script>.rb
```

- `SECRET_KEY_BASE_DUMMY=1`: `docker exec` 는 이미지 entrypoint 를 우회해 secret_key_base 가 비어 부팅이 실패하므로 임시 시크릿으로 부팅한다(DB 작업엔 실제 값 불필요).
- 스크립트는 `docker cp` 로 컨테이너에 넣고 경로를 인자로 준다. Git Bash 는 `/tmp/...` 인자를 Windows 경로로 변환하므로 `MSYS_NO_PATHCONV=1` 로 변환을 막는다.
- 현 트래커 세트(그룹·오류·기능·사양·검증·작업세션·report)는 구성 완료 상태다. 새 트래커 추가 시 전 프로젝트 활성 + 기존 트래커의 워크플로 전이를 복사한다.
- **`Report` 트래커 — 활성화 완료(2026-07-26)**: 작업 보고 정책([`work-tracking.md`](work-tracking.md) §작업 보고)이 요구하는 트래커(`Report`=8)가 **3개 프로젝트(`ai-workgroup-ops`·`accountinterlockhub`·`smoke-test`) 전부에 활성**이다(REST 실측). 전이도 열린 상태 6종 전면 개방으로 확인됐다.
	- 🔴 **생성 요청의 `status_id` 는 무시된다** — `tracker_id: 8` 로 POST 하면서 `status_id: 5` 를 함께 보내도 이슈가 **`Needs Feedback`(4)으로 떨어진다**(실측 2026-07-26·2026-08-01). MCP `create_issue` 를 쓰면 생성 후 교정·재검증까지 서버가 처리하므로 1회 호출로 닫힌 상태가 된다(`corrected: true` 로 표시). `redmine_request` 로 직접 POST 할 때만 **① POST → ② PUT `status_id: 5` → ③ GET `closed_on` 실측** 3단계를 손으로 수행한다. 닫지 못하면 **열린 하위가 남아 부모(작업세션 이슈·루프 그룹 일감)를 닫을 수 없다** — report 일감은 등록과 동시에 닫히는 것이 전제다([`work-tracking.md`](work-tracking.md) §계층·연관).
	- **프로젝트 활성은 REST 로도 된다** — `PUT /projects/<id>.json` 에 `{"project":{"tracker_ids":[...]}}`. **치환 의미라 기존 목록을 전부 포함해** 보낸다(빠뜨린 트래커는 그 프로젝트에서 사라진다). 트래커 자체의 신규 생성·워크플로 전이 복사는 여전히 admin 전용이라 아래 스크립트를 쓴다.
	- **실행본**: [`ai/scripts/redmine-create-report-tracker.rb`](../scripts/redmine-create-report-tracker.rb) — 멱등이며 이미 있는 `Report`(8)를 **대소문자 무시로 찾아 재사용**한다. 서비스 호스트(Redmine 컨테이너가 도는 장비)에서 실행하며, 이 워크스페이스가 도는 PC 일 필요는 없다. **위 활성화는 REST 로 처리했으므로 이 스크립트의 미실행 상태는 유지된다** — 워크플로 전이를 명시 생성해야 할 때 실행한다.

## 프로젝트 생성 표준 절차

프로젝트 부트스트랩([`project-bootstrap.md`](project-bootstrap.md))에서 제품 Redmine 프로젝트를 1회 생성한다. 도구 함정 때문에 순서가 중요하다:

1. **프로젝트 생성** — `create_project`(name·identifier·is_public=false).
2. **트래커 한정** — `redmine_request` PUT `/projects/<id>.json` 본문 `{"project":{"tracker_ids":[4,6,2,1,5,7,8]}}`(그룹·사양·기능·오류·검증·작업세션·report). create_project 는 기본 트래커만 켜므로 명시한다.
3. **멤버십** — 작업 정체성(또는 admin)을 멤버로 추가. POST `/projects/<id>/memberships.json` `{"membership":{"user_id":<id>,"role_ids":[3]}}`(관리자 역할). admin 키 운영 시 생략 가능.
4. **범주(카테고리)** — IA leaf(노드)가 확정되는 대로 추가(카테고리 = IA 노드). POST `/projects/<id>/issue_categories.json` `{"issue_category":{"name":"<IA 노드>"}}`.
5. **배포버전(버전)** — 최초 배포 로드맵 버전 1개 이상. POST `/projects/<id>/versions.json` `{"version":{"name":"<배포버전>"}}`. 이슈 `fixed_version_id` 지정 시 Redmine 로드맵에 잡힌다.
6. **식별자 등록** — 생성한 identifier 를 [`CLAUDE.env.md`](../../CLAUDE.env.md) `<REDMINE_PROJECT>` 에 기입.

- 범주·배포버전은 생성 시점에 고정되지 않는다 — 4·5 엔드포인트로 생애주기 내내 추가한다.

## 이슈 조작

- **생성**: 정확한 트래커·상태 제어가 필요하므로 `redmine_request` POST `/issues.json` 본문 `{"issue":{"project_id","tracker_id","status_id","assigned_to_id","category_id","fixed_version_id","parent_issue_id"(하위 이슈),"description",...}}` 를 쓴다(MCP `create_issue` 는 트래커·상태를 무시 — §도구 함정).
- **연관 추가**: POST `/issues/<id>/relations.json` `{"relation":{"issue_to_id":<대상 이슈>,"relation_type":"relates"}}` — build·qa 일감 → 참조 `사양` 일감.
- **노트·상태·담당자 변경**: MCP `update_issue`(`notes`·`status_id`·`assigned_to_id`) 또는 `redmine_request` PUT `/issues/<id>.json`.

### 전이 사전 확인 (`allowed_statuses`)

상태를 바꾸기 전에 **그 전이가 지금 가능한지 읽기 전용으로 확인**할 수 있다 — `GET /issues/<id>.json?include=allowed_statuses` 는 그 이슈에 **현재 실제로 적용 가능한 상태 목록**을 준다(호출 계정 역할·워크플로·하위 일감 상태를 모두 반영한 결과).

- **닫으려는데 `Closed` 가 목록에 없으면 열린 하위 일감이 있다는 뜻이다.** Redmine 이 열린 하위를 가진 부모에서 닫힘 상태를 후보에서 빼기 때문이다(§도구 함정 "열린 하위"). 하위를 먼저 닫고 다시 조회한다.
- 목록에 없는 상태를 그대로 PUT 하면 조용히 무시된다(§도구 함정). **닫기·보류 전환 전에는 먼저 이 조회로 확인하는 것을 기본 순서로 삼는다** — 실패 후 되돌리는 것보다 싸다.
- 조회 결과에 `allowed_statuses` 키가 아예 없으면 구버전 인스턴스다 — 그때만 종전 방식(전이 후 `GET` 으로 `status`·`closed_on` 실측)으로 폴백한다.
- **첨부(업로드·삭제)**: 2단계 REST — ① `POST /uploads.json?filename=<이름>`(Content-Type `application/octet-stream`, 파일 바이너리 본문) → 반환 `token`, ② `PUT /issues/<id>.json` 본문 `{"issue":{"uploads":[{"token":<토큰>,"filename":<이름>,"content_type":<MIME>}]}}`. 기존 첨부 삭제는 `DELETE /attachments/<id>.json`. MCP `redmine_request` 는 JSON 본문만 보내므로 바이너리 업로드는 REST(curl 등) 직접 호출로 수행한다.

## 저장 쿼리 (보드 뷰)

자주 보는 뷰를 Redmine 저장 쿼리로 만들어 담당자와 공유한다 — 진행 중(open, updated desc) / 대기(신규) / 완료·종결(closed, 최근순). 프로젝트·담당자·카테고리·트래커 필터를 조합해 단계별 뷰도 구성한다.

## 도구 함정 (Redmine MCP)

- **생성 요청의 `status_id` 는 Redmine 이 무시한다**(실측 2026-08-01: `tracker_id: 8` + `status_id: 5` 로 POST → `Needs Feedback`(4) 로 떨어짐. `tracker_id` 는 반영된다). MCP `create_issue` 는 **생성 후 PUT 으로 교정하고 GET 으로 재검증**해 결과에 `corrected`·`verified` 를 싣는다 → 지정대로 만들려면 이 도구를 쓴다. `redmine_request` 로 직접 POST 할 때만 3단계(POST → PUT `status_id` → GET 실측)를 손으로 수행한다.
- **상태 전이 거부는 PUT 응답에 드러나지 않는다** — `notes`+`status_id` 를 함께 보냈는데 Redmine 이 전이만 거부해도 PUT 자체는 성공한다(노트만 남고 상태는 그대로). MCP `update_issue` 는 **PUT 직후 GET 으로 실측 검증**해, 어긋나면 `ok:false` + `warning` + `allowed_statuses` 로 노출한다 → 이 도구를 쓰면 조용히 넘어가지 않는다. `redmine_request` 로 직접 PUT 할 때는 여전히 응답을 믿지 말고 `GET /issues/<id>.json` 의 `status`·`closed_on` 으로 확인한다. 특히 `해결`→`완료`(닫힘).
- **열린 하위가 있으면 부모 close 가 거부된다** → 종결은 **하위 먼저, 부모 나중** 순서로 수행한다(위 함정과 겹치면 부모가 안 닫힌 채 성공으로 보인다). 닫기 전에 §전이 사전 확인으로 `Closed` 가 후보에 있는지 보면 이 상황을 미리 잡을 수 있다.
- **`create_project` 는 기본 트래커만 활성** → §프로젝트 생성 표준 절차 2번으로 보완.
- **admin 화면 전용(REST 생성 불가)**: 커스텀 필드·트래커·상태·워크플로 전이·역할·우선순위 → 이 객체들에 의존하지 않는 설계를 유지한다.
- PUT/DELETE 성공 시 응답 본문이 비어 있다(HTTP 204).
- **REST 생성 가능**: 프로젝트·이슈·카테고리·버전·사용자(응답에 api_key 포함)·멤버십·노트·관계(relations).
