# 발송처 접근 주소 구성 데이터 정의

## 개요

- **데이터 목적**: 연동 관리자가 발송처별로 등록하는 **접근 주소 구성** 1건의 마스터 설정을 영속화한다. 사용자가 진입한 **접근 주소 고유 ID 가 곧 발송처 구분값(발송처 식별자)**이며(BIZ-001-11), 사용자 접근·동의 화면·연동 실행(허브 복호화·수신처 B 서버-서버 전달)이 모두 본 엔터티를 전제·참조한다. `#214` 로 입력이 단일 암호화 JSON(encX·encY)으로 바뀌어 **전달 파라미터 정의·사용자 키값 파라미터 exactly-one 지정(`#33`, 구 ENT-003·user_key_param_id)을 폐기**했다 — 수신처에 넘길 회원 키와 연동 추적 키는 발송처가 전달 데이터 X 안에 담아 전달하며, 허브는 저장하지 않는다(EXC-BIZ-14·DATA-001·DATA-002).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 1 "관리자 — 발송처 접근 주소 구성: 발송처별 접근 주소를 생성(고유 ID 부여)하고, 그 주소에 수신처(서비스 B) 전달 주소와 사용자 노출 동의 항목을 설정한다. 접근한 주소(고유 ID)가 요청처(발송처) 구분값이 된다" / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §저장 대상 1(발송처 접근 주소 구성) / IA [`../../prd/ia/IA.md`](../../prd/ia/IA.md) `ADM-01`·`ADM-02`.

---

## ENT-001 발송처 접근 주소 구성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 발송처 접근 주소 구성 |
| 물리 테이블명 | TBL_INTERLOCK_CONFIG |
| 분류 | 마스터 |
| 관련 서비스 | SVC-001, SVC-002, SVC-004, SVC-005 |
| 보존 정책 | 무기한(설정 데이터). 소프트 삭제(deleted_at). 개인정보 아님 |
| 개인정보 여부 | 비해당 (설정 데이터 — 수신처 B 주소·고유 ID 는 마스킹 대상 아님, EXC-SEC-05) |
| CRUD 수행 PROC | C: PROC-101 / R: PROC-102·PROC-201·PROC-203 / U: PROC-101·PROC-105 / D: PROC-106(소프트) |
| 관련 IA 항목 | ADM-01, ADM-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | uuid | - | NOT NULL | gen_random_uuid() | - | PK | 구성 고유 식별자(내부 참조 키) |
| config_code | varchar | 64 | NOT NULL | - | length(config_code) > 0 | UK(부분) | **접근 주소 고유 ID = 발송처 식별자**(고유·불변, BIZ-001-10·11). 사용자가 진입한 접근 주소(고유 ID)가 발송처 구분값 |
| config_name | varchar | 100 | NOT NULL | - | length(config_name) > 0 | - | 구성명(표시용) |
| service_b_delivery_url | varchar | 2048 | NOT NULL | - | LIKE 'http://%' OR LIKE 'https://%' | - | 수신처 B 전달 주소(서버-서버 POST 대상, BIZ-001-09·BIZ-003-02·SEC-007-01) |
| service_b_http_method | varchar | 10 | NOT NULL | 'POST' | IN ('GET','POST','PUT','PATCH') | - | 수신처 B 전달 방식(HTTP 메서드) |
| is_active | boolean | - | NOT NULL | true | - | - | 활성 여부(성과 지표 "활성 연동 구성 수" 근거) |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 생성 일시(감사) |
| created_by | varchar | 64 | NOT NULL | - | - | - | 생성자 관리자 계정(ENT-005.username) |
| updated_at | timestamptz | 3 | NULL | NULL | - | - | 최종 수정 일시(감사) |
| updated_by | varchar | 64 | NULL | NULL | - | - | 최종 수정자 관리자 계정 |
| deleted_at | timestamptz | 3 | NULL | NULL | - | - | 소프트 삭제 시각(NULL=유효) |

> config_code 는 **접근 주소 고유 ID**(발송처 식별자·업무 고유 키), id 는 내부 참조 키(자식·트랜잭션의 FK 대상)로 분리한다 — 삭제·재등록 시 참조 안정성을 위해 내부 id 를 FK 로 쓴다. 접근 URL 은 `허브 접근 주소(config_code) + encX·encY 파라미터`로 구성되며, **발송처키·암호값(encX·encY)·전달 파라미터 정의는 구성에 저장하지 않는다**(DATA-001·SEC-002·EXC-BIZ-14).
> **폐기(`#214`)**: 구 `service_a_entry_url`(서비스 A 호출 주소)·`user_key_param_id`(사용자 키값 파라미터 지정 참조)는 제거했다 — 진입 경로는 접근 주소 고유 ID 자체이고, 회원 키·추적 키는 발송처가 X 안에 담는다. 서버 대면 API 인증 자격(API Key/HMAC 시크릿)은 **운영 구성값**으로 관리하며 본 엔터티에 저장하지 않는다(SEC-003, [`spec-datas.md`](spec-datas.md) §엔터티 아님 목록).

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-002 동의 항목 | 1:N | ENT-002.config_id | CASCADE | NO ACTION | 구성 정의의 자식(동의 항목) |
| ENT-004 처리 상태 | 1:N | ENT-004.config_id | NO ACTION | NO ACTION | 트랜잭션 자식. 독립 생명주기(배치 하드 삭제)로 CASCADE 금지 |
| ENT-007 연동이력 | 1:N | ENT-007.config_id | NO ACTION | NO ACTION | 트랜잭션 자식. 독립 생명주기(배치 하드 삭제)로 CASCADE 금지(ENT-004 와 동일) |

> ENT-001 은 소프트 삭제(deleted_at)라 물리 삭제가 발생하지 않으므로 ENT-002 의 CASCADE 는 안전망 성격이다. ENT-004·ENT-007 은 무저장·하드 삭제 대상이라 부모 삭제 연쇄를 차단(NO ACTION)해 조기 삭제를 방지한다.
> **순환 FK 제거(`#214`)**: 구 user_key_param_id ↔ ENT-003 상호 참조는 파라미터 정의 폐기로 함께 제거됐다 — 편집 트랜잭션의 순환 FK 대응 순서 제약이 사라져 자식(ENT-002) 교체가 단순화됐다(§구현 가이드).

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_INTERLOCK_CONFIG | id | PK(b-tree) | 높음 | PROC-101 INSERT/UPDATE, FK 조인 대상 |
| UQ_CONFIG_CODE | config_code | UNIQUE(부분: WHERE deleted_at IS NULL) | 높음 | PROC-101 고유성 사전 조회(WHERE config_code=?), PROC-102 상세, PROC-201 진입 시 활성 구성(접근 주소) 조회, PROC-203 전달 대상 결정 |
| IX_CONFIG_LIST | is_active, created_at DESC | BTREE(부분: WHERE deleted_at IS NULL) | 낮음~중간 | PROC-102 목록 조회·필터·정렬(WHERE is_active=? ORDER BY created_at DESC) |

> UQ_CONFIG_CODE 는 부분 유니크 인덱스(partial unique, WHERE deleted_at IS NULL)로, 소프트 삭제된 접근 주소 고유 ID 의 재사용을 허용하되 유효 구성 간 고유성을 보장한다(BIZ-001-10·EXC-BIZ-02). 사용자 진입(PROC-201)·전달 대상 결정(PROC-203)이 config_code 로 활성 구성을 특정하는 주 경로다.

### 데이터 생명주기

- **생성 조건**: PROC-101(접근 주소 구성 등록·편집) · "고유 ID 부여·DB 접근·출력 생성" 단계에서 신규 등록 시 INSERT. 필수(수신처 B 주소·동의 항목)·URL·고유성 검증 통과가 선행(BIZ-001-08/09/10/04). 접근 주소 고유 ID(config_code)는 등록 시 1회 부여(자동 생성 또는 관리자 지정)하고 이후 불변(BIZ-001-11).
- **수정 조건**: PROC-101 편집 시 config_name·수신처 B 주소·method·자식(동의 항목) UPDATE(updated_at/by 갱신). 접근 주소 고유 ID(config_code)는 불변. PROC-105 · "활성/비활성 전환"(BR-103) 시 is_active UPDATE.
- **삭제/보관 조건**: PROC-106 · "삭제"(BR-104) 시 deleted_at 설정(소프트 삭제). 물리 삭제는 수행하지 않으며 감사 로그(OPS-002)에 기록한다.

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| BIZ-001-08 | 필수 항목(수신처 B 전달 주소·동의 항목) 누락 거부 | 응용 검증(PROC-101) + NOT NULL |
| BIZ-001-09 | service_b_delivery_url http/https 절대 URL | 응용 검증(PROC-101) + CHECK(LIKE http/https) |
| BIZ-001-10 | config_code(접근 주소 고유 ID) 고유성 | DB 무결성(UQ_CONFIG_CODE 부분 유니크) + 응용 사전 조회 |
| BIZ-001-11 | 접근 주소 고유 ID 1회 부여·불변·발송처 식별자 | 응용 가공(PROC-101 부여) + 편집 시 불변 처리 |
| BIZ-001-04 | 동의 항목 1개 이상 | 응용 검증(PROC-101, 자식 카운트 — ENT-002) |
| BIZ-003-02 | service_b_delivery_url = 전달 대상 한정 | 응용 검증(PROC-203, 구성 외 주소 전달 금지) |
| SEC-004-01/02 | 전 입력 컬럼 길이·형식·주입 방어 | 응용 검증(DTO) + 파라미터 바인딩 |
| EXC-SEC-05 | 수신처 B URL·고유 ID 마스킹 예외 | 마스킹 제외(설정 데이터) |
| EXC-BIZ-14 | 전달 파라미터 정의·발송처키·암호값 미저장 | 스키마 설계(컬럼 부재) |
| OPS-002-04 | 등록·수정·삭제 감사 | 감사(PROC-101 등록·편집·PROC-105 활성 전환·PROC-106 삭제) |

### 구현 가이드

- id 는 uuid PK(기본값 gen_random_uuid())로 확정한다 — 본 엔터티는 소규모 마스터(구성 수십~수백 건 규모)라 랜덤 UUID PK 의 B-tree 삽입 분산 영향이 무시 가능해 추가 물리 튜닝(fillfactor·파티셔닝 등)을 두지 않는다(공통 근거 [`spec-datas.md`](spec-datas.md) §PostgreSQL 물리 설계·운영 전제). config_code(접근 주소 고유 ID) UNIQUE 는 부분 인덱스(partial index)로 소프트 삭제와 양립시킨다.
- 필수(수신처 B 주소·동의 항목)·URL·고유성 검증은 화면에 의존하지 않고 서버단(PROC-101)에서 재수행한다. 자식(ENT-002)은 부모 구성과 동일 트랜잭션에서 등록·편집한다.
- 편집 시 자식 항목은 전량 교체(delete-and-reinsert) 또는 증분 갱신 중 build 단계에서 택일하되, 부모 updated_at/by 를 함께 갱신한다. `#214` 로 순환 FK(구 user_key_param_id)가 제거돼 전량 교체 시 별도 지정 참조 정합 순서(NULL 초기화→재지정)가 불필요해졌다.
- 접근 주소 고유 ID(config_code)의 자동 생성/관리자 지정 방식·형식은 화면 도메인과 정합되게 확정한다(BIZ-001-11). 발송처키·암호값·서명 검증 키는 어떤 컬럼에도 저장하지 않는다(DATA-001·SEC-002, 서명 검증 키 등록은 보안 후속 보완 SEC-008).
