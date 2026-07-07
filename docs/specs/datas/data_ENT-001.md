# 연동 구성 데이터 정의

## 개요

- **데이터 목적**: 연동 관리자가 등록하는 서비스 A↔서비스 B 연동 1건의 마스터 설정을 영속화한다. 사용자 동의 화면·연동 실행·서비스 B 전달·처리 상태 저장이 모두 본 엔터티를 전제·참조한다. 사용자 키값 파라미터 지정(user_key_param_id)은 필수(정확히 1개 — BIZ-001-07)이며, 정상 등록 구성은 항상 지정을 가져 연동이력 기록·완료 확인·완료 콜백의 대상이 된다(BIZ-004).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "관리자 — 연동 구성 관리: 서비스 A의 호출 주소·전달 파라미터, 사용자 노출 동의 항목, 완료 시 서비스 B로 전달할 주소값 설정. 전달 파라미터 중 **사용자 키값 파라미터를 명시적으로 지정**할 수 있어야 한다" / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §저장 대상 1(연동 구성).

---

## ENT-001 연동 구성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 연동 구성 |
| 물리 테이블명 | TBL_INTERLOCK_CONFIG |
| 분류 | 마스터 |
| 관련 서비스 | SVC-001, SVC-002, SVC-004, SVC-005, SVC-008·SVC-009(구성 실재·지정 여부 사전 검증) |
| 보존 정책 | 무기한(설정 데이터). 소프트 삭제(deleted_at). 개인정보 아님 |
| 개인정보 여부 | 비해당 (설정 데이터 — 서비스 A/B 주소는 마스킹 대상 아님, EXC-SEC-05) |
| CRUD 수행 PROC | C: PROC-101 / R: PROC-102·PROC-201·PROC-203·PROC-302·PROC-303 / U: PROC-101·PROC-105 / D: PROC-106(소프트) |
| 관련 IA 항목 | ADM-01, ADM-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | uuid | - | NOT NULL | gen_random_uuid() | - | PK | 구성 고유 식별자(내부) |
| config_code | varchar | 64 | NOT NULL | - | length(config_code) > 0 | UK(부분) | 구성 식별자(업무 코드, BIZ-001-03 고유) |
| config_name | varchar | 100 | NOT NULL | - | length(config_name) > 0 | - | 구성명(표시용) |
| service_a_entry_url | varchar | 2048 | NOT NULL | - | LIKE 'http://%' OR LIKE 'https://%' | - | 서비스 A 호출(진입) 주소(BIZ-001-02) |
| service_b_delivery_url | varchar | 2048 | NOT NULL | - | LIKE 'http://%' OR LIKE 'https://%' | - | 서비스 B 전달 주소(BIZ-001-02·BIZ-003-02) |
| service_b_http_method | varchar | 10 | NOT NULL | 'POST' | IN ('GET','POST','PUT','PATCH') | - | 서비스 B 전달 방식(HTTP 메서드) |
| user_key_param_id | uuid | - | NULL | NULL | - | FK | 사용자 키값 파라미터 지정(ENT-003.id 참조, 필수·정확히 1개 — BIZ-001-07). 물리 NULL 허용은 삽입·전량 교체 트랜잭션 내 과도상태(순환 FK 대응)만을 위한 것이며, 커밋 상태에서는 항상 지정 1개가 존재한다(응용 검증이 강제). NULL 잔존(미지정)은 방어적 케이스로만 다룬다(BIZ-004-05) |
| is_active | boolean | - | NOT NULL | true | - | - | 활성 여부(성과 지표 "활성 연동 구성 수" 근거) |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 생성 일시(감사) |
| created_by | varchar | 64 | NOT NULL | - | - | - | 생성자 관리자 계정(ENT-005.username) |
| updated_at | timestamptz | 3 | NULL | NULL | - | - | 최종 수정 일시(감사) |
| updated_by | varchar | 64 | NULL | NULL | - | - | 최종 수정자 관리자 계정 |
| deleted_at | timestamptz | 3 | NULL | NULL | - | - | 소프트 삭제 시각(NULL=유효) |

> config_code 는 업무 고유 키, id 는 내부 참조 키(FK 대상)로 분리한다 — 삭제·재등록 시 참조 안정성을 위해 내부 id 를 FK 로 쓴다.
> user_key_param_id 는 전달 파라미터 정의(ENT-003)에 대한 **참조 저장**이다(값 복제 금지 — BIZ-001 구현 가이드). 단일 컬럼이므로 "구성당 최대 1개"가 구조적으로 보장되고, 여기에 응용 검증(BIZ-001-07)이 "정확히 1개 필수(0개 금지)"를 더해 **exactly-one** 을 이룬다. 지정 여부 판정(BIZ-004-05 방어 분기, PROC-302·303 사전 검증)이 구성 행 단독 조회로 끝난다.

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-002 동의 항목 | 1:N | ENT-002.config_id | CASCADE | NO ACTION | 구성 정의의 자식(동의 항목) |
| ENT-003 전달 파라미터 | 1:N | ENT-003.config_id | CASCADE | NO ACTION | 구성 정의의 자식(전달 파라미터) |
| ENT-003 전달 파라미터(지정 참조) | N:1 (필수 — BIZ-001-07 정확히 1개) | user_key_param_id | RESTRICT | NO ACTION | 사용자 키값 파라미터 지정(구성당 정확히 1개). 물리 컬럼은 NULL 허용(삽입 과도상태·순환 FK 대응)이나 커밋 상태에서는 항상 지정 1개. 지정 유지 상태의 해당 파라미터 행 삭제를 DB 가 차단(RESTRICT — BIZ-001-07 응용 검증의 안전망) |
| ENT-004 처리 상태 | 1:N | ENT-004.config_id | NO ACTION | NO ACTION | 트랜잭션 자식. 독립 생명주기(배치 하드 삭제)로 CASCADE 금지 |
| ENT-007 연동이력 | 1:N | ENT-007.config_id | NO ACTION | NO ACTION | 트랜잭션 자식. 독립 생명주기(배치 하드 삭제)로 CASCADE 금지(ENT-004 와 동일) |

> ENT-001 은 소프트 삭제(deleted_at)라 물리 삭제가 발생하지 않으므로 CASCADE 는 안전망 성격이다. ENT-004·ENT-007 은 무저장·하드 삭제 대상이라 부모 삭제 연쇄를 차단(NO ACTION)해 조기 삭제를 방지한다.
> user_key_param_id ↔ ENT-003.config_id 는 상호 참조(부모↔자식 순환)지만, ENT-001 물리 삭제가 사실상 없고(소프트 삭제) 지정 컬럼이 NULL 허용이라 운용 상 문제가 없다 — 편집 트랜잭션 순서는 §구현 가이드 참조.

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_INTERLOCK_CONFIG | id | PK(b-tree) | 높음 | PROC-101 INSERT/UPDATE, FK 조인 대상 |
| UQ_CONFIG_CODE | config_code | UNIQUE(부분: WHERE deleted_at IS NULL) | 높음 | PROC-101 고유성 사전 조회(WHERE config_code=?), PROC-102 상세, PROC-201 활성 구성 조회 |
| IX_CONFIG_LIST | is_active, created_at DESC | BTREE(부분: WHERE deleted_at IS NULL) | 낮음~중간 | PROC-102 목록 조회·필터·정렬(WHERE is_active=? ORDER BY created_at DESC) |

> UQ_CONFIG_CODE 는 부분 유니크 인덱스(partial unique, WHERE deleted_at IS NULL)로, 소프트 삭제된 구성 코드의 재사용을 허용하되 유효 구성 간 고유성을 보장한다(BIZ-001-03·EXC-BIZ-02).

### 데이터 생명주기

- **생성 조건**: PROC-101(연동 구성 등록·편집) · "DB 접근·출력 생성" 단계에서 신규 등록 시 INSERT. 필수·URL·동의 항목·고유성 검증 통과가 선행(BIZ-001).
- **수정 조건**: PROC-101 편집 시 config_name·URL·method·자식 항목 UPDATE(updated_at/by 갱신). PROC-105 · "활성/비활성 전환"(BR-103) 시 is_active UPDATE.
- **삭제/보관 조건**: PROC-106 · "삭제"(BR-104) 시 deleted_at 설정(소프트 삭제). 물리 삭제는 수행하지 않으며 감사 로그(OPS-002)에 기록한다.

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| BIZ-001-01 | config_name·service_a_entry_url·service_b_delivery_url·자식 항목 필수 | 응용 검증(PROC-101) + NOT NULL |
| BIZ-001-02 | service_a_entry_url·service_b_delivery_url URL 형식 | 응용 검증(PROC-101) + CHECK(LIKE http/https) |
| BIZ-001-03 | config_code 고유성 | DB 무결성(UQ_CONFIG_CODE 부분 유니크) + 응용 사전 조회 |
| BIZ-001-07 | user_key_param_id 지정(필수·실재·정확히 1개 — 0개/2개↑ 422) | 응용 검증(PROC-101) + FK(RESTRICT)·단일 컬럼 구조 |
| BIZ-004-05 | (방어) user_key_param_id 미지정 구성의 API-02/03 대상 제외 | 응용 검증(PROC-302·303 — 사전 확인) |
| SEC-004-01/02 | 전 입력 컬럼 길이·형식·주입 방어 | 응용 검증(DTO) + 파라미터 바인딩 |
| EXC-SEC-05 | service_a/b URL 마스킹 예외 | 마스킹 제외(설정 데이터) |
| OPS-002-01 | 등록·수정·삭제 감사 | 감사(PROC-101 등록·편집·PROC-105 활성 전환·PROC-106 삭제) |

### 구현 가이드

- id 는 uuid PK(기본값 gen_random_uuid())로 확정한다 — 본 엔터티는 소규모 마스터(구성 수십~수백 건 규모)라 랜덤 UUID PK 의 B-tree 삽입 분산 영향이 무시 가능해 추가 물리 튜닝(fillfactor·파티셔닝 등)을 두지 않는다(공통 근거 [`spec-datas.md`](spec-datas.md) §PostgreSQL 물리 설계·운영 전제). config_code UNIQUE 는 부분 인덱스(partial index)로 소프트 삭제와 양립시킨다.
- URL·필수·고유성 검증은 화면에 의존하지 않고 서버단(PROC-101)에서 재수행한다. 자식(ENT-002·ENT-003)은 부모 구성과 동일 트랜잭션에서 등록·편집한다.
- 편집 시 자식 항목은 전량 교체(delete-and-reinsert) 또는 증분 갱신 중 build 단계에서 택일하되, 부모 updated_at/by 를 함께 갱신한다. **전량 교체를 택하면** 지정 참조(RESTRICT) 때문에 동일 트랜잭션 안에서 `user_key_param_id NULL 초기화 → 자식 교체 → 재지정(신규 행 id)` 순서를 지키거나 FK 를 DEFERRABLE 로 선언한다(택일은 build 단계).
- user_key_param_id 에는 별도 인덱스를 두지 않는다 — 이 컬럼을 조건절·정렬·조인에 쓰는 PROC 가 없고(지정 여부 판정은 PK·config_code 조회 행에서 확인), RESTRICT 역참조 조회는 소규모 마스터라 순차 스캔으로 충분하다(사용 PROC 0건 신설 금지 규칙).
