# 업무 티켓 Redmine 운영

[`work-tracking.md`](work-tracking.md) 정책을 **공용 Redmine 서비스**(프로젝트 밖에서 운영 중인 인스턴스 — [`project-bootstrap.md`](project-bootstrap.md) §3)로 실행하기 위한 **운영 세부**(접속·식별자·프로젝트 생성·도구 함정)를 정의한다. 정책·상태 어휘·이슈 양식은 부모 문서가 정본이고, 본 문서는 그것을 Redmine 에 매는 방법만 다룬다.

## 접속

- 서버 URL·관리자 키·세션 API 키는 git 비관리 [`CLAUDE.local.md`](../../CLAUDE.local.md) §Redmine 자격증명 단일 출처.
- 세션은 Redmine MCP 도구(`mcp__redmine__*`)로 작용한다. MCP 서버는 환경변수 `REDMINE_API_KEY`·`REDMINE_BASE_URL` 을 최우선으로 읽고, 없으면 서버 기본 `.env`(admin)로 폴백한다.
- **작업 정체성**: 메인 세션 env `REDMINE_API_KEY` 가 있으면 그 정체성으로 작동한다(이슈 작성자·담당자가 그 계정). 미설정 시 admin 폴백(프로젝트·사용자 생성 등 관리자 동작 포함).

## 요소 식별자 레퍼런스

인스턴스 현재값(재구축·변경 시 본 절 갱신). 트래커·상태의 정책 이름은 [`work-tracking.md`](work-tracking.md) 가 정본.

- **트래커**: 오류=1, 기능=2, 그룹=4, 검증=5, 사양=6.
- **상태**: 신규=1, 진행=2, 해결=3, 의견=4, 완료=5(닫힘), 거절=6(닫힘), 보류=7. (의견=4 는 정책 미사용 레거시 — 상태 어휘 정본은 [`work-tracking.md`](work-tracking.md) 6종.)
- **역할**: 관리자=3, 개발자=4, 보고자=5, 뷰어=6.
- **우선순위**: 낮음=1, 보통=2(기본), 높음=3, 긴급=4, 즉시=5.
- **운영 프로젝트**: `ai-workgroup-ops`(워크스페이스 운영·메타). 제품 프로젝트 식별자는 [`CLAUDE.env.md`](../../CLAUDE.env.md) `<REDMINE_PROJECT>`.
- **범주(카테고리)·배포버전(버전)**: 프로젝트별 객체라 고정 id 가 없다 — 생애주기 내내 REST 로 지속 추가한다(카테고리 = IA 노드(leaf), [`work-tracking.md`](work-tracking.md); 버전 = 배포 로드맵).
- **이슈 커스텀 필드** `Sprint`=1(문자형)이 인스턴스에 존재하나, 현 모델은 단계·묶음을 트래커·상위 이슈·메타 머리말로 표현하므로 필수가 아니다.

## 트래커 구성 (admin 전용)

트래커·커스텀 필드·상태·워크플로·역할·우선순위는 admin 전용이라 REST 로 만들 수 없다(§도구 함정). **서비스 관리자의 1회 작업**(프로젝트 준비 범위 밖)으로, 서비스 호스트(Docker)에서 `rails runner` 로 구성한다(admin UI 대체):

```
docker exec -e SECRET_KEY_BASE_DUMMY=1 redmine bin/rails runner /tmp/<script>.rb
```

- `SECRET_KEY_BASE_DUMMY=1`: `docker exec` 는 이미지 entrypoint 를 우회해 secret_key_base 가 비어 부팅이 실패하므로 임시 시크릿으로 부팅한다(DB 작업엔 실제 값 불필요).
- 스크립트는 `docker cp` 로 컨테이너에 넣고 경로를 인자로 준다. Git Bash 는 `/tmp/...` 인자를 Windows 경로로 변환하므로 `MSYS_NO_PATHCONV=1` 로 변환을 막는다.
- 현 트래커 세트(그룹·오류·기능·사양·검증)는 구성 완료 상태다. 새 트래커 추가 시 전 프로젝트 활성 + 기존 트래커의 워크플로 전이를 복사한다.

## 프로젝트 생성 표준 절차

프로젝트 부트스트랩([`project-bootstrap.md`](project-bootstrap.md))에서 제품 Redmine 프로젝트를 1회 생성한다. 도구 함정 때문에 순서가 중요하다:

1. **프로젝트 생성** — `create_project`(name·identifier·is_public=false).
2. **트래커 한정** — `redmine_request` PUT `/projects/<id>.json` 본문 `{"project":{"tracker_ids":[4,6,2,1,5]}}`(그룹·사양·기능·오류·검증). create_project 는 기본 트래커만 켜므로 명시한다.
3. **멤버십** — 작업 정체성(또는 admin)을 멤버로 추가. POST `/projects/<id>/memberships.json` `{"membership":{"user_id":<id>,"role_ids":[3]}}`(관리자 역할). admin 키 운영 시 생략 가능.
4. **범주(카테고리)** — IA leaf(노드)가 확정되는 대로 추가(카테고리 = IA 노드). POST `/projects/<id>/issue_categories.json` `{"issue_category":{"name":"<IA 노드>"}}`.
5. **배포버전(버전)** — 최초 배포 로드맵 버전 1개 이상. POST `/projects/<id>/versions.json` `{"version":{"name":"<배포버전>"}}`. 이슈 `fixed_version_id` 지정 시 Redmine 로드맵에 잡힌다.
6. **식별자 등록** — 생성한 identifier 를 [`CLAUDE.env.md`](../../CLAUDE.env.md) `<REDMINE_PROJECT>` 에 기입.

- 범주·배포버전은 생성 시점에 고정되지 않는다 — 4·5 엔드포인트로 생애주기 내내 추가한다.

## 이슈 조작

- **생성**: 정확한 트래커·상태 제어가 필요하므로 `redmine_request` POST `/issues.json` 본문 `{"issue":{"project_id","tracker_id","status_id","assigned_to_id","category_id","fixed_version_id","parent_issue_id"(하위 이슈),"description",...}}` 를 쓴다(MCP `create_issue` 는 트래커·상태를 무시 — §도구 함정).
- **연관 추가**: POST `/issues/<id>/relations.json` `{"relation":{"issue_to_id":<대상 이슈>,"relation_type":"relates"}}` — build·qa 일감 → 참조 `사양` 일감.
- **노트·상태·담당자 변경**: MCP `update_issue`(`notes`·`status_id`·`assigned_to_id`) 또는 `redmine_request` PUT `/issues/<id>.json`.

## 저장 쿼리 (보드 뷰)

자주 보는 뷰를 Redmine 저장 쿼리로 만들어 담당자와 공유한다 — 진행 중(open, updated desc) / 대기(신규) / 완료·종결(closed, 최근순). 프로젝트·담당자·카테고리·트래커 필터를 조합해 단계별 뷰도 구성한다.

## 도구 함정 (Redmine MCP)

- **`create_issue` 가 `tracker_id`·`status_id` 무시**(priority·assignee 는 반영) → `redmine_request` 로 생성하거나 생성 후 PUT 으로 교정.
- **`create_project` 는 기본 트래커만 활성** → §프로젝트 생성 표준 절차 2번으로 보완.
- **admin 화면 전용(REST 생성 불가)**: 커스텀 필드·트래커·상태·워크플로 전이·역할·우선순위 → 이 객체들에 의존하지 않는 설계를 유지한다.
- PUT/DELETE 성공 시 응답 본문이 비어 있다(HTTP 204).
- **REST 생성 가능**: 프로젝트·이슈·카테고리·버전·사용자(응답에 api_key 포함)·멤버십·노트·관계(relations).
