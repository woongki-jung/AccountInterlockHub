# 처리 상태 데이터 정의

## 개요

- **데이터 목적**: 연동 요청 1건의 처리 추적을 위한 최소 상태를 요청 키값 기준으로 보관한다. 회원 키·개인정보를 일절 저장하지 않으며(무저장 핵심), 서비스 A 의 처리상태 조회(API-01)와 보관 배치(BAT-02)의 대상이 된다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항 "요청 키값별 상태(처리 성공 여부·결과 확인 여부·처리일시·결과 확인일시)만 저장" / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §저장 대상 2·보관 정책 / IA [`../../prd/ia/IA.md`](../../prd/ia/IA.md) `BAT-01`·`API-01`·`BAT-02`.

---

## ENT-004 처리 상태

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 처리 상태 |
| 물리 테이블명 | TBL_INTERLOCK_PROCESS_STATUS |
| 분류 | 트랜잭션 |
| 관련 서비스 | SVC-005, SVC-006, SVC-007 |
| 보존 정책 | 하드 삭제(DATA-004-03). 완료 건=결과 확인 일시+90일, 미완료 건=처리 일시+90일 경과 시 배치 삭제(소프트 삭제 미사용) |
| 개인정보 여부 | 비해당 (개인식별 컬럼 원천 배제 — DATA-001-02·DATA-003-01) |
| CRUD 수행 PROC | C: PROC-401 / R: PROC-301·PROC-402 / U: PROC-301(결과 확인 갱신) / D: PROC-402(하드 삭제) |
| 관련 IA 항목 | BAT-01, API-01, BAT-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| request_key | uuid | - | NOT NULL | - | - | PK | 요청 키값(허브 발급 불투명 UUID v4, DATA-002). 회원 키와 무관 |
| config_id | uuid | - | NOT NULL | - | - | FK | 연동 구성 참조(ENT-001.id, 개인정보 아님) |
| is_success | boolean | - | NOT NULL | - | - | - | 처리 성공 여부(true=전달 성공, false=실패·거부 미전달) |
| is_result_confirmed | boolean | - | NOT NULL | false | - | - | 결과 확인 여부(서비스 A 조회 성공 시 true) |
| processed_at | timestamptz | 3 | NOT NULL | - | - | - | 처리 일시(연동 실행 결과 확정 시각) |
| result_confirmed_at | timestamptz | 3 | NULL | NULL | - | - | 결과 확인 일시(미확인 시 NULL) |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 레코드 생성 일시(영속화 감사) |

> **무결성 CHECK**: `(is_result_confirmed = true AND result_confirmed_at IS NOT NULL) OR (is_result_confirmed = false AND result_confirmed_at IS NULL)` — 결과 확인 여부와 확인 일시의 정합을 DB 레벨에서 강제(배치 삭제 기준 정확성 보장).
> **개인정보·회원 키 컬럼 없음** — 저장 항목은 요청 키값·구성 참조·상태 4항목·생성 감사로 한정하며 그 외 컬럼을 추가하지 않는다(DATA-001-02·DATA-003-01). 마스킹 불요(민감 필드 부재).

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-001 연동 구성 | N:1 | config_id | NO ACTION | NO ACTION | 구성 참조. 구성은 소프트 삭제라 참조 유효 유지, 처리 상태는 배치가 독립 하드 삭제 |

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_PROCESS_STATUS | request_key | PK·UNIQUE(b-tree) | 높음 | PROC-301 상태 조회·갱신(WHERE request_key=?), PROC-401 INSERT 중복 방지 |
| IX_STATUS_RETENTION_PENDING | processed_at | BTREE(부분: WHERE is_result_confirmed = false) | 중간 | PROC-402 미완료 삭제 대상 선정(WHERE is_result_confirmed=false AND processed_at < 기준, DATA-004-02) |
| IX_STATUS_RETENTION_CONFIRMED | result_confirmed_at | BTREE(부분: WHERE is_result_confirmed = true) | 중간 | PROC-402 완료 삭제 대상 선정(WHERE is_result_confirmed=true AND result_confirmed_at < 기준, DATA-004-01) |

> 두 부분 인덱스(partial index)는 배치의 완료/미완료 두 갈래(BR-401) 범위 삭제를 각각 지원한다. config_id 는 조건절·정렬·조인에 쓰는 PROC 가 없어 인덱스를 신설하지 않는다(사용 PROC 0건 금지 규칙).

### 데이터 생명주기

- **생성 조건**: PROC-401(처리상태 저장) · "상태 레코드 생성"·"상태 영속화 트랜잭션"에서 연동 실행 결과 확정 시 1건 INSERT. 전달 성공·실패·거부(미전달) 모두 생성(EXC-DATA-03·EXC-BIZ-06). 요청 키값 발급은 PROC-201(진입).
- **수정 조건**: PROC-301(처리상태 확인 API) · "조회 성공 후 상태 갱신"에서 최초 조회 성공 시 is_result_confirmed=true·result_confirmed_at 갱신(BR-301, 멱등 — 재조회 시 미갱신).
- **삭제/보관 조건**: PROC-402(보관정책 배치) · "삭제 실행"에서 하드 삭제. 완료 건=result_confirmed_at+90일, 미완료 건=processed_at+90일 경과 대상(DATA-004-01/02). 소프트 삭제·보관 플래그 미사용(DATA-004-03).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| DATA-001-02 | 개인식별 컬럼 부재 | 스키마 설계(원천 배제) |
| DATA-002-01 | request_key = 불투명 UUID | 응용 발급(PROC-201) + PK UNIQUE |
| DATA-003-01 | 저장 항목 한정(4항목+요청 키값+구성 참조) | 스키마 설계 + 응용 검증 |
| DATA-003-02/03 | processed_at·result_confirmed_at 기록 시점 | 응용 처리(PROC-401·PROC-301) + CHECK 정합 |
| DATA-004-01/02/03 | 보관 기간·하드 삭제 | 응용 배치(PROC-402) + 인덱스 |
| SEC-005-02 | 조회 응답 4항목 한정 | 응용 마스킹(PROC-301, MDL-302) |

### 구현 가이드

- request_key 는 랜덤 UUID v4 이므로 PK 를 b-tree 로 둔다. PostgreSQL 은 힙 저장이므로 배치 범위 삭제(PROC-402)의 지역성은 processed_at·result_confirmed_at 부분 인덱스로 뒷받침한다. 추가 물리 배치(대량 삭제용 파티셔닝 등)는 build 에서 확정한다.
- 배치 삭제는 완료·미완료 두 조건을 한 트랜잭션 흐름에서 처리하고 멱등하게 설계한다(OPS-003-02). 삭제된 요청 키값 조회는 PROC-301 에서 404 EX-DATA-003 으로 응답(EXC-DATA-04).
- **주의**: config_id·created_at 은 후행 정책(DATA-003-01)의 명시 4항목 목록에는 없으나 무저장 원칙 위배가 아닌 비개인 운영 컬럼이다. spec 교차검증에서 DATA-003 명시 항목을 config 참조·생성 감사 포함으로 리비전 정합할 것(§담당자 확정 대기 연계).
