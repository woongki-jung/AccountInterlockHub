# 처리 상태 데이터 정의

## 개요

- **데이터 목적**: 연동 요청 1건의 처리 추적을 위한 최소 상태를 **연동 추적 키**(전달 데이터 X 내부 지정 필드값·불투명 문자열) 기준으로 보관한다. 회원 키·복호화 원문·개인정보를 일절 저장하지 않으며(무저장 핵심), 발송처의 처리상태 조회(API-01)와 보관 배치(BAT-02)의 대상이 된다. `#214` 로 조회 키를 **허브 발급 요청 키값(UUID)에서 연동 추적 키(발송처 구성·허브 미발급)로 전환**했다(DATA-002-05).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항 "추적 키별 상태(처리 성공 여부·결과 확인 여부·처리일시·결과 확인일시)만 저장" · §수행 범위 7(상태 보관) / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §저장 대상 2·보관 정책 / IA [`../../prd/ia/IA.md`](../../prd/ia/IA.md) `BAT-01`·`API-01`·`BAT-02`.

---

## ENT-004 처리 상태

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 처리 상태 |
| 물리 테이블명 | TBL_INTERLOCK_PROCESS_STATUS |
| 분류 | 트랜잭션 |
| 관련 서비스 | SVC-005, SVC-006, SVC-007 |
| 보존 정책 | 하드 삭제(DATA-004-06). 결과 확인 건=결과 확인 일시+90일과 생성 일시+180일 중 먼저, 미확인 건=생성 일시+180일 절대 상한 경과 시 배치 삭제(소프트 삭제 미사용) |
| 개인정보 여부 | 비해당 (개인식별 컬럼·복호화 원문 원천 배제 — DATA-001-05·DATA-003-04) |
| CRUD 수행 PROC | C: PROC-401 / R: PROC-301·PROC-402 / U: PROC-301(결과 확인 갱신) / D: PROC-402(하드 삭제) |
| 관련 IA 항목 | BAT-01, API-01, BAT-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | uuid | - | NOT NULL | gen_random_uuid() | - | PK | 레코드 내부 식별자(허브 발급 surrogate — 비개인 운영 식별자, EXC-DATA-06). 노출·조회 키 아님 |
| tracking_key | varchar | 255 | NOT NULL | - | length(tracking_key) > 0 | - | **연동 추적 키**(전달 데이터 X 내부 지정 필드 원문·불투명 문자열, DATA-002). 조회·통지 기준 키. 비유니크(발송처 구성·재사용 방어) |
| config_id | uuid | - | NOT NULL | - | - | FK | 발송처 접근 주소 구성 참조(ENT-001.id, 개인정보 아님, EXC-DATA-06) |
| is_success | boolean | - | NOT NULL | - | - | - | 처리 성공 여부(true=수신처 B 전달 성공, false=전달 실패) |
| is_result_confirmed | boolean | - | NOT NULL | false | - | - | 결과 확인 여부(발송처 조회 성공 시 true) |
| processed_at | timestamptz | 3 | NOT NULL | - | - | - | 처리 일시(연동 실행 결과 확정 시각) |
| result_confirmed_at | timestamptz | 3 | NULL | NULL | - | - | 결과 확인 일시(미확인 시 NULL) |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 생성 일시(레코드 영속화 감사 + 보관 삭제 180일 절대 상한 기산) |

> **무결성 CHECK**: `(is_result_confirmed = true AND result_confirmed_at IS NOT NULL) OR (is_result_confirmed = false AND result_confirmed_at IS NULL)` — 결과 확인 여부와 확인 일시의 정합을 DB 레벨에서 강제(배치 삭제 기준 정확성 보장).
> **키 설계(`#214`)**: 허브는 자체 노출 키를 발급하지 않는다(DATA-002-05) — 조회 기준 키는 X 에서 추출한 **연동 추적 키(tracking_key)**다. 추적 키는 발송처가 요청별 고유로 구성함을 기대하나 허브가 유니크를 강제할 수 없어(불투명·재사용 방어) tracking_key 를 PK 로 두지 않고 내부 surrogate `id`(비개인 운영 식별자, EXC-DATA-06)를 PK 로 둔다. 처리상태는 연동 실행 결과 확정 시 요청 1건당 1행 생성하며, 동일 추적 키가 재사용되면 조회는 처리 일시 최신 1건을 반환한다(EXC-BIZ-12 준용).
> **무저장 경계**: 저장 항목은 연동 추적 키 + 상태 4항목(처리 성공 여부·결과 확인 여부·처리 일시·결과 확인 일시) + 비개인 운영 컬럼(id·config_id·created_at)으로 한정하며, 개인식별·복호화 원문·회원 키·암호값 컬럼을 원천 배제한다(DATA-001-05·DATA-003-04). 추적 키 외 응답·로그 노출 시 SEC-005-04 마스킹.

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-001 발송처 접근 주소 구성 | N:1 | config_id | NO ACTION | NO ACTION | 구성 참조. 구성은 소프트 삭제라 참조 유효 유지, 처리 상태는 배치가 독립 하드 삭제 |
| ENT-007 연동이력 | N:N(소프트 참조) | tracking_key 동일 값 공유(FK 없음) | 해당 없음 | 해당 없음 | 이중 추적 연결(BIZ-004-11) — 연동 추적 키 스코프로만 연결. 요청 1건당 상태 1·이력 1(둘 다 같은 추적 키). 생성 시점·삭제 기산 독립이라 강제 FK 미적용 |

> 연동 추적 키 스코프 연결은 ENT-006 의 actor_id 와 같은 **소프트 참조**다. 두 추적(처리상태=허브의 수신처 전달 성공, 연동이력=수신처 B 의 완료 콜백 수신)은 의미가 분리되며(BIZ-004-11), 동일 tracking_key 값 공유로만 연결한다. 동일 추적 키가 재사용되면 스코프 내 여러 상태·이력이 공존할 수 있어 1:1 을 강제하지 않는다.

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_PROCESS_STATUS | id | PK(b-tree) | 높음 | 내부 식별. PROC-401 INSERT |
| IX_STATUS_TRACKING | tracking_key, processed_at DESC | BTREE | 높음(tracking_key near-unique) | PROC-301 상태 조회·갱신(WHERE tracking_key=? ORDER BY processed_at DESC LIMIT 1, DATA-002-05) |
| IX_STATUS_RETENTION_CONFIRMED | result_confirmed_at | BTREE(부분: WHERE is_result_confirmed = true) | 중간 | PROC-402 결과 확인 건 삭제 대상 선정(WHERE is_result_confirmed=true AND result_confirmed_at < 기준, DATA-004-04 의 90일 기산) |
| IX_STATUS_RETENTION_CREATED | created_at | BTREE | 중간~높음 | PROC-402 180일 절대 상한 삭제 대상 선정(WHERE created_at < 기준 — 결과 확인/미확인 양 갈래 공통, DATA-004-04/05) |

> IX_STATUS_TRACKING 은 조회(API-01) 단건 조회 겸 재사용 시 처리 일시 최신 1건 선정을 지원한다. 결과 확인 건은 `min(result_confirmed_at + 90일, created_at + 180일)`, 미확인 건은 `created_at + 180일` 로 삭제하므로, 90일 갈래는 IX_STATUS_RETENTION_CONFIRMED(부분)가, 180일 절대 상한(양 갈래 공통)은 IX_STATUS_RETENTION_CREATED 가 지원한다(BR-401). config_id 는 조건절·정렬·조인에 쓰는 PROC 가 없어 인덱스를 신설하지 않는다(사용 PROC 0건 금지 규칙).
> **created_at ≈ processed_at**: 처리상태는 연동 실행 결과 확정 시점(DATA-003-05)에 생성되므로 created_at 과 processed_at 이 사실상 동일 시각이다 — 정책 DATA-004-04/05 의 "처리 일시 + 180일" 절대 상한을 created_at 기산으로 구현(등가). 오케스트레이터 spec 확정값(생성일시 기산·인덱스)을 반영.

### 데이터 생명주기

- **생성 조건**: PROC-401(처리상태 저장) · "상태 레코드 생성"·"상태 영속화 트랜잭션"에서 연동 실행 결과 확정 시 1건 INSERT. **복호화 성공 후**의 수신처 전달 성공·실패 모두 생성(EXC-DATA-03·EXC-BIZ-06). 복호화 이전 거부·복호화 실패는 추적 키가 없어 처리상태를 생성하지 않는다(감사 로그만, BIZ-002-07). tracking_key 는 복호화된 X 에서 추출한 값(PROC-203 → PROC-401).
- **수정 조건**: PROC-301(처리상태 확인 API) · "조회 성공 후 상태 갱신"에서 최초 조회 성공 시 is_result_confirmed=true·result_confirmed_at 갱신(BR-301, 멱등 — 재조회 시 미갱신, DATA-003-06). 완료 콜백(API-03)은 처리상태 4항목을 변경하지 않는다(BIZ-004-11).
- **삭제/보관 조건**: PROC-402(보관정책 배치) · "삭제 실행"에서 하드 삭제. 결과 확인 건=결과 확인 일시+90일과 생성 일시+180일 중 먼저 도래(DATA-004-04), 미확인 건=생성 일시+180일 절대 상한(DATA-004-05). 소프트 삭제·보관 플래그 미사용(DATA-004-06).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| DATA-001-05 | 개인식별·복호화 원문 컬럼 부재 | 스키마 설계(원천 배제) |
| DATA-002-05 | tracking_key = X 추출 추적 키(조회 키) | 응용 처리(PROC-203 추출·PROC-401 저장) |
| DATA-002-06 | tracking_key 불투명(무변형·무해석·무해시) | 응용 처리(원문 그대로 저장) |
| DATA-002-07 | tracking_key 형식(비어있지 않음·최대 길이 255) | 응용 검증(PROC-301 조회) + NOT NULL·CHECK·varchar(255) |
| DATA-003-04 | 저장 항목 한정(추적 키+4항목+운영 컬럼) | 스키마 설계 + 응용 검증 |
| DATA-003-05/06 | processed_at·result_confirmed_at 기록 시점 | 응용 처리(PROC-401·PROC-301) + CHECK 정합 |
| DATA-004-04/05/06 | 보관 90/180일 fallback·하드 삭제 | 응용 배치(PROC-402) + 인덱스 2종 |
| EXC-DATA-06 | 비개인 운영 컬럼(id·config_id·created_at) 저장 허용 | 스키마 설계(무저장 위배 아님) |
| SEC-005-02 | 조회 응답 4항목 한정 | 응용 마스킹(PROC-301, MDL-302) |
| SEC-005-04 | tracking_key 로그·응답 마스킹(앞2·뒤2) | 마스킹(로그 포맷터·응답 DTO) |

### 구현 가이드

- **PK 전략(확정·`#214`)**: 내부 surrogate `id`(uuid v4, gen_random_uuid())를 PK 로 둔다 — 연동 추적 키(tracking_key)는 발송처가 구성하는 불투명 값이라 허브가 전역 유니크를 강제할 수 없고(재사용 방어·EXC-BIZ-12), 요청별로 1행을 안정 저장하려면 surrogate 키가 필요하다. tracking_key 는 조회 키(비유니크·인덱스)로만 쓴다. 예측 불가성은 tracking_key 의 발송처 책임이며 허브는 값을 해석하지 않는다(DATA-002-06).
- **시간 파티셔닝 미채택(확정)**: ① 삭제 자격이 두 시각 컬럼(90일=result_confirmed_at, 180일=created_at)에 분산돼 단일 range 키로 표현할 수 없고, ② 일 배치의 1회 삭제량은 하루치 만료분으로 유계라 DELETE 로 충분하다. 일 삭제 대상이 수십만 행을 상시 초과하면 파티셔닝을 재평가한다(재검토 트리거). 공통 근거는 [`spec-datas.md`](spec-datas.md) §PostgreSQL 물리 설계·운영 전제.
- **청크 DELETE + autovacuum(확정)**: PROC-402 는 두 보존 인덱스로 대상을 선정하고 청크 단위 반복 삭제(예: `DELETE ... WHERE ctid IN (SELECT ctid ... LIMIT n)`, 청크 기본 5,000행)로 단일 트랜잭션 크기·잠금을 상한한다. dead tuple 회수는 autovacuum 위임 — 본 테이블은 스토리지 파라미터 `autovacuum_vacuum_scale_factor = 0.05`(기본안)로 하향한다.
- **fillfactor 미채택(확정)**: 행당 1회 갱신(PROC-301 결과 확인)이 있으나 갱신 컬럼(is_result_confirmed·result_confirmed_at)이 IX_STATUS_RETENTION_CONFIRMED 의 키·술어에 걸려 HOT 갱신이 성립하지 않는다 — fillfactor 하향의 실익이 없어 기본값(100)을 유지한다.
- 배치 삭제는 결과 확인·미확인 두 조건을 한 배치 실행 흐름에서 처리하고 청크 단위 커밋으로 멱등하게 설계한다(OPS-003-02) — 중단·재실행 시 잔여 대상만 다시 삭제된다. 삭제된 추적 키 조회는 PROC-301 에서 404 EX-DATA-003 으로 응답(EXC-DATA-02·EXC-DATA-04).
- **tracking_key 길이 상한 255(확정 기본안)**: 불투명 추적 식별자의 통상 길이를 수용하는 기본안 상한이며 담당자 조정 가능하다(DATA-002-07 스키마 상한 위임). 초과 입력은 조회 검증(SEC-004·DATA-002-07)에서 거부된다.
