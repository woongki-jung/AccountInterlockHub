# 연동이력 데이터 정의

## 개요

- **데이터 목적**: 연동 요청 1건에 대해 **연동 추적 키**(전달 데이터 X 내부 지정 필드값·불투명 문자열) 기준으로 연동 요청~완료 콜백까지의 추적 이력을 보관한다. 연동 완료 확인 API(API-02)의 판정 근거·완료 콜백 API(API-03)의 기록 대상이다. `#214` 로 저장·조회 기준을 **{구성 + 지정 사용자 키값 원문}에서 연동 추적 키 단독**으로 전환했다 — **회원 키·복호화 원문·개인정보를 저장하지 않으며**, 추적 키는 개인정보 원문이 아닌 불투명 식별자다(DATA-005-06/07·DATA-002-06). 구 EXC-DATA-07(사용자 키값 원문 저장 PRD 예외)은 `#214` 로 폐기됐다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 8 "연동이력 저장: 연동 추적 키 기준으로 연동 요청~완료 콜백까지의 이력을 저장하고, 6의 API 근거 데이터로 사용" / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §저장 대상 3(연동이력)·보관 정책 / IA [`../../prd/ia/IA.md`](../../prd/ia/IA.md) `BAT-03`·`API-02`·`API-03`·`BAT-02`.

---

## ENT-007 연동이력

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 연동이력 |
| 물리 테이블명 | TBL_INTERLOCK_HISTORY |
| 분류 | 트랜잭션(이력) |
| 관련 서비스 | SVC-005(생성), SVC-008(판정 조회), SVC-009(완료 기록), SVC-007(보관 삭제) |
| 보존 정책 | 하드 삭제(DATA-006-06). 콜백 수신 건=수신 일시+90일과 생성 일시+180일 중 먼저(DATA-006-04), 미수신 건=생성 일시+180일 절대 상한(DATA-006-05) — 처리상태 규칙 준용 확정 기본안(EXC-DATA-09, `accountinterlockhub#33`) |
| 개인정보 여부 | 비해당 — 연동 추적 키는 발송처가 개인정보 원문이 아닌 불투명 문자열로 구성함을 전제하며 허브는 해석·변형하지 않는다(DATA-002-06·EXC-DATA-12). 로그·감사·응답 노출 시 SEC-005-04 마스킹 |
| CRUD 수행 PROC | C: PROC-403(PROC-203 복호화 성공 후 내부) / R: PROC-302·PROC-303·PROC-402 / U: PROC-403(PROC-303 완료 기록 내부) / D: PROC-402(하드 삭제) |
| 관련 IA 항목 | BAT-03, API-02, API-03, BAT-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | uuid | - | NOT NULL | gen_random_uuid() | - | PK | 레코드 내부 식별자(허브 발급 surrogate — 비개인 운영 식별자, EXC-DATA-08). 노출·조회 키 아님 |
| tracking_key | varchar | 255 | NOT NULL | - | length(tracking_key) > 0 | - | **연동 추적 키**(전달 데이터 X 내부 지정 필드 원문·불투명 문자열, DATA-002·DATA-005-07). 완료 판정·콜백 특정 스코프 키. 비유니크(발송처 구성·재사용 방어) |
| config_id | uuid | - | NOT NULL | - | - | FK | 발송처 접근 주소 구성 참조(ENT-001.id, 개인정보 아님, DATA-005-05) |
| requested_at | timestamptz | 3 | NOT NULL | - | - | - | 연동 요청 일시(복호화 성공·이력 생성 시각). 스코프 내 최신 건 선정(BIZ-004-09/10) 기준 |
| callback_received | boolean | - | NOT NULL | false | - | - | 완료 콜백 수신 여부(true=수신처 B 정보연계 완료 통지 수신) |
| callback_received_at | timestamptz | 3 | NULL | NULL | - | - | 완료 콜백 수신 일시(미수신 시 NULL). 수신 건 삭제 90일 기산(DATA-006-04) |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 생성 일시(영속화 감사 + 보관 삭제 180일 절대 상한 기산 — 비개인 운영 컬럼, EXC-DATA-08) |

> **무결성 CHECK**: `(callback_received = true AND callback_received_at IS NOT NULL) OR (callback_received = false AND callback_received_at IS NULL)` — 수신 여부와 수신 일시의 정합을 DB 레벨에서 강제(완료 판정·배치 삭제 기산 정확성 보장, ENT-004 와 동일 패턴).
> **저장 항목 상한(DATA-005-05)** — {연동 추적 키, 연동 구성(접근 주소) 참조, 연동 요청 일시, 완료 콜백 수신 여부, 완료 콜백 수신 일시} 5항목 + 비개인 운영 컬럼(id·created_at, EXC-DATA-08)으로 한정한다. **회원 키·복호화 원문(전달 데이터 X 내용)·암호값·생년월일·개인식별 컬럼을 두지 않는다**(DATA-005-06). 연동 추적 키는 X 에서 추출한 불투명 문자열 원문 그대로 저장하고 해석·변형·해시하지 않는다(DATA-005-07·DATA-002-06).
> **키 설계(`#214`)**: 구 request_key(허브 발급 UUID PK)·user_key(지정 사용자 키값 varchar(512) 원문)를 폐기했다. 조회 기준 키는 tracking_key 이며, 발송처가 요청별 고유로 구성함을 기대하나 허브가 유니크를 강제할 수 없어(불투명·재사용 방어, BIZ-004-09 "미수신 이력 복수" 전제) tracking_key 를 PK 로 두지 않고 내부 surrogate `id` 를 PK 로 둔다.

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-001 발송처 접근 주소 구성 | N:1 | config_id | NO ACTION | NO ACTION | 구성 참조. 구성은 소프트 삭제라 참조 유효 유지, 이력은 배치가 독립 하드 삭제(ENT-004 와 동일 이유로 CASCADE 금지) |
| ENT-004 처리 상태 | N:N(소프트 참조) | tracking_key 동일 값 공유(FK 없음) | 해당 없음 | 해당 없음 | 이중 추적 연결(BIZ-004-11·DATA-005-08) — 연동 추적 키 스코프로만 연결. 강제 FK 불가: 이력(복호화 성공 후 생성)과 상태(전달 종료 후 생성)의 생성 시점·삭제 기산이 독립 |

> 연동 추적 키 스코프 연결은 ENT-006 의 actor_id 와 같은 **소프트 참조**다. 두 추적(처리상태=허브의 수신처 전달 성공, 연동이력=수신처 B 의 완료 콜백 수신)은 의미가 분리되며(BIZ-004-11), 동일 tracking_key 값 공유로만 연결한다. 동일 추적 키가 재사용되면 스코프 내 여러 이력이 공존할 수 있어(BIZ-004-09) 1:1 을 강제하지 않는다.

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_INTERLOCK_HISTORY | id | PK(b-tree) | 높음 | 내부 식별. PROC-403 이력 생성 INSERT |
| IX_HISTORY_TRACKING | tracking_key, requested_at DESC | BTREE | 높음(tracking_key near-unique) | PROC-302 완료 판정(WHERE tracking_key=? ORDER BY requested_at DESC LIMIT 1, BIZ-004-10), PROC-303 콜백 대상 특정(WHERE tracking_key=? AND callback_received=false ORDER BY requested_at DESC LIMIT 1, BIZ-004-09) |
| IX_HISTORY_RETENTION_RECEIVED | callback_received_at | BTREE(부분: WHERE callback_received = true) | 중간 | PROC-402 수신 건 삭제 대상 선정(WHERE callback_received=true AND callback_received_at < 기준, DATA-006-04 의 90일 기산) |
| IX_HISTORY_RETENTION_CREATED | created_at | BTREE | 중간~높음 | PROC-402 180일 절대 상한 삭제 대상 선정(WHERE created_at < 기준 — 수신/미수신 양 갈래 공통, DATA-006-04/05) |

> IX_HISTORY_TRACKING 하나로 완료 판정(PROC-302, 스코프 최신 1건)과 콜백 특정(PROC-303, 스코프 내 미수신 최신 1건)을 함께 지원한다 — 두 조회는 동일 스코프 정의(연동 추적 키)를 공유하고(BIZ-004 구현 가이드) 스코프당 행 수가 소수라 미수신 전용 부분 인덱스의 실익이 없다(callback_received 필터는 인덱스 스캔 후 적용). 수신 건은 `min(callback_received_at + 90일, created_at + 180일)`, 미수신 건은 `created_at + 180일` 로 삭제하므로, 90일 갈래는 IX_HISTORY_RETENTION_RECEIVED(부분)가, 180일 절대 상한(양 갈래 공통)은 IX_HISTORY_RETENTION_CREATED 가 지원한다(BR-402). config_id 는 조건절·정렬·조인에 쓰는 PROC 가 없어 인덱스를 신설하지 않는다(사용 PROC 0건 금지 규칙).
> **created_at ≈ requested_at**: 연동이력은 복호화 성공 직후 수신처 전달에 앞서 생성되므로(BIZ-004-07) created_at 과 requested_at 이 사실상 동일 시각이다 — 정책 DATA-006-04/05 의 "연동 요청 일시 + 180일" 절대 상한을 created_at 기산으로 구현(등가). 오케스트레이터 spec 확정값(생성일시 기산·인덱스)을 반영.

### 데이터 생명주기

- **생성 조건**: PROC-403(연동이력 기록, PROC-203 복호화 실행 내부) · "이력 영속화 트랜잭션"에서 **복호화 성공으로 연동 추적 키를 확보한 직후·수신처 전달에 앞서** 1건 INSERT(BIZ-004-07) — X 에서 추출한 추적 키를 tracking_key 로, 접근 주소 구성 참조를 config_id 로, 복호화 성공 시각을 requested_at 으로 기록. 복호화된 X 에 추적 키 필드가 없거나 공백이면 연동 자체가 거부되어 생성되지 않는다(BIZ-004-08, 400 EX-BIZ-008). 복호화 이전 거부·복호화 실패는 추적 키가 없어 생성하지 않는다(EXC-BIZ-11). 전달 실패 건도 이력은 생성·유지한다(EXC-BIZ-11).
- **수정 조건**: PROC-303(완료 콜백 API) · "완료 기록"(내부 PROC-403)에서 tracking_key 스코프의 미수신 최신 1건에 callback_received=true·callback_received_at 기록(BIZ-004-09). 재통지(스코프 내 완료 이력만 존재)는 갱신 없이 멱등 성공(EXC-BIZ-10). 처리상태(ENT-004)는 변경하지 않는다(BIZ-004-11).
- **삭제/보관 조건**: PROC-402(보관정책 배치) · "삭제 실행"에서 하드 삭제. 수신 건=수신 일시+90일과 생성 일시+180일 중 먼저 도래(DATA-006-04), 미수신 건=생성 일시+180일 절대 상한(DATA-006-05). 소프트 삭제·보관 플래그 미사용(DATA-006-06). 삭제분 조회는 404 로 응답(EXC-DATA-11).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| DATA-005-05 | 저장 항목 상한(5항목 + 운영 컬럼) | 스키마 설계(컬럼 한정) |
| DATA-005-06 | 회원 키·복호화 원문·개인식별 컬럼 부재 | 스키마 설계(원천 배제) |
| DATA-005-07 | tracking_key 원문 저장(무변형·무해석·무해시) | 응용 처리(PROC-403) |
| DATA-005-08 | 요청 1건당 1건·추적 키로 처리상태 연결 | 응용 처리(PROC-403) + 소프트 참조 |
| DATA-006-04/05/06 | 보관 90/180일 fallback·하드 삭제 | 응용 배치(PROC-402) + 인덱스 2종 |
| DATA-002-06/07 | 추적 키 불투명·형식(비어있지 않음·최대 길이 255) | 응용 처리(무변형) + NOT NULL·CHECK·varchar(255) |
| BIZ-004-07/08 | 생성 조건(복호화 성공 후)·추적 키 필드 완결성 | 응용 검증(PROC-203) + NOT NULL·CHECK(length>0) |
| BIZ-004-09/10 | 콜백 특정·완료 판정 스코프(최신 건) | 응용 조회(PROC-303·PROC-302) + IX_HISTORY_TRACKING |
| BIZ-004-11 | 처리상태 불변경(이중 추적 분리) | 응용 처리(PROC-303) — ENT-004 와 소프트 참조만 |
| EXC-DATA-08 | 비개인 운영 컬럼(id·created_at) 저장 허용 | 스키마 설계(무저장 위배 아님) |
| SEC-005-04 | tracking_key 로그·감사·응답 마스킹(앞2·뒤2) | 응용 마스킹(PROC-302·303, MDL-304 필드 배제) |

### 구현 가이드

- **PK 전략(확정·`#214`)**: 내부 surrogate `id`(uuid v4, gen_random_uuid())를 PK 로 둔다 — 연동 추적 키(tracking_key)는 발송처가 구성하는 불투명 값이라 허브가 전역 유니크를 강제할 수 없고, BIZ-004-09 가 "동일 추적 키의 미수신 이력이 복수" 인 경우를 명시 처리하므로 tracking_key 당 다행 저장이 가능해야 한다. 따라서 tracking_key 를 PK 로 두지 않고 조회 키(비유니크·인덱스)로 쓴다. 완료 판정·콜백 특정은 스코프 내 requested_at 최신 1건 규칙(BIZ-004-09/10·EXC-BIZ-12)으로 단일화한다.
- **시간 파티셔닝 미채택(확정)**: ENT-004 와 동일 근거 — ① 삭제 기산이 두 시각 컬럼(수신=callback_received_at, 절대 상한=created_at)에 분산, ② 일 삭제량이 하루치 만료분으로 유계라 DELETE 로 충분. 일 삭제 대상이 수십만 행을 상시 초과하면 재평가한다. 공통 근거는 [`spec-datas.md`](spec-datas.md) §PostgreSQL 물리 설계·운영 전제.
- **청크 DELETE + autovacuum**: PROC-402 는 두 보존 인덱스로 대상을 선정하고 청크 단위 반복 삭제(`DELETE ... WHERE ctid IN (SELECT ctid ... LIMIT n)`, 청크 기본 5,000행)로 처리상태와 같은 배치 흐름에서 수행한다(DATA-006 구현 가이드·OPS-003). 본 테이블도 스토리지 파라미터 `autovacuum_vacuum_scale_factor = 0.05`(기본안)로 하향한다(ENT-004 와 동일 접근).
- **fillfactor 기본 유지**: 행당 최대 1회 갱신(콜백 기록)의 대상 컬럼(callback_received·callback_received_at)이 IX_HISTORY_RETENTION_RECEIVED 의 키·술어에 걸려 HOT 갱신이 성립하지 않는다 — 하향 실익이 없어 기본값(100)을 유지한다(ENT-004 와 동일 판단).
- **tracking_key 길이 상한 255(확정 기본안)**: 불투명 추적 식별자의 통상 길이를 수용하는 기본안 상한이며 담당자 조정 가능하다(DATA-002-07 스키마 상한 위임). ENT-004.tracking_key 와 동일 상한. 초과 입력은 조회 검증(SEC-004·DATA-002-07)에서 거부된다.
- **마스킹 강제**: tracking_key 는 본 테이블 밖(로그·감사·오류 응답)에 원문을 남기지 않고(SEC-005-04 앞2·뒤2 마스킹), 완료 확인 응답(MDL-304)에는 필드 자체를 두지 않는다(SEC-005-05). 회원 키·복호화 원문은 본 테이블에 애초 존재하지 않는다(DATA-005-06).
