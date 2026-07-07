# 연동이력 데이터 정의

## 개요

- **데이터 목적**: 사용자 키값 파라미터가 지정된 구성의 연동 요청 1건에 대해, 지정 사용자 키값 기준으로 연동 요청~완료 콜백까지의 추적 이력을 보관한다. 연동 완료 확인 API(API-02)의 판정 근거·완료 콜백 API(API-03)의 기록 대상이며, 무저장 원칙의 PRD 확정 예외(EXC-DATA-07)로 지정 사용자 키값 원문을 저장하는 유일한 저장소다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 7 "연동이력 저장: 지정된 사용자 키값 파라미터 값을 기준으로 연동 요청~완료 콜백까지의 이력을 저장하고, 6의 API 제공 근거 데이터로 사용" / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §저장 대상 3(연동이력)·보관 정책 / IA [`../../prd/ia/IA.md`](../../prd/ia/IA.md) `BAT-03`·`API-02`·`API-03`·`BAT-02`.

---

## ENT-007 연동이력

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 연동이력 |
| 물리 테이블명 | TBL_INTERLOCK_HISTORY |
| 분류 | 트랜잭션(이력) |
| 관련 서비스 | SVC-004(생성), SVC-008(판정 조회), SVC-009(완료 기록), SVC-007(보관 삭제) |
| 보존 정책 | 하드 삭제(DATA-006-03). 콜백 수신 건=수신 일시+90일(DATA-006-01), 미수신 건=연동 요청 일시+90일(DATA-006-02) — 처리상태 규칙 준용 확정 기본안(EXC-DATA-10, `accountinterlockhub#33`) |
| 개인정보 여부 | 비해당(간주) — 지정 사용자 키값은 서비스 A 가 전달한 불투명 문자열 원문으로 허브는 해석·변형하지 않는다(DATA-005-03·EXC-DATA-07). 단 회원 식별 값이므로 로그·감사·응답에서 SEC-005 마스킹·미포함을 강제한다 |
| CRUD 수행 PROC | C: PROC-403(PROC-201 진입 내부) / R: PROC-302·PROC-303·PROC-402 / U: PROC-403(PROC-303 완료 기록 내부) / D: PROC-402(하드 삭제) |
| 관련 IA 항목 | BAT-03, API-02, API-03, BAT-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| request_key | uuid | - | NOT NULL | - | - | PK | 요청 키값 참조(진입 시 발급 값, DATA-002). 처리상태(ENT-004) 건과의 연결 키(DATA-005-04) — 소프트 참조(FK 없음) |
| config_id | uuid | - | NOT NULL | - | - | FK | 연동 구성 참조(ENT-001.id, 개인정보 아님) |
| user_key | varchar | 512 | NOT NULL | - | length(user_key) > 0 | - | 지정 사용자 키값 — 서비스 A 전달 원문 그대로(무변형, DATA-005-03). 완료 판정·콜백 특정 스코프의 절반 |
| requested_at | timestamptz | 3 | NOT NULL | - | - | - | 연동 요청 일시(진입 처리 시각). 스코프 내 최신 건 선정(BIZ-004-03/04)·미수신 건 삭제 기산(DATA-006-02) 기준 |
| callback_received | boolean | - | NOT NULL | false | - | - | 완료 콜백 수신 여부(true=서비스 B 정보연계 완료 통지 수신) |
| callback_received_at | timestamptz | 3 | NULL | NULL | - | - | 완료 콜백 수신 일시(미수신 시 NULL). 수신 건 삭제 기산(DATA-006-01) |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 레코드 생성 일시(영속화 감사 — 비개인 운영 컬럼, EXC-DATA-08) |

> **무결성 CHECK**: `(callback_received = true AND callback_received_at IS NOT NULL) OR (callback_received = false AND callback_received_at IS NULL)` — 수신 여부와 수신 일시의 정합을 DB 레벨에서 강제(완료 판정·배치 삭제 기산 정확성 보장, ENT-004 와 동일 패턴).
> **저장 항목 상한(DATA-005-01)** — {지정 사용자 키값, 연동 구성 참조, 요청 키값 참조, 연동 요청 일시, 완료 콜백 수신 여부, 완료 콜백 수신 일시} 6항목 + 비개인 운영 컬럼(created_at, EXC-DATA-08)으로 한정한다. 지정 사용자 키값 외의 전달 파라미터 원문·회원 정보·개인식별 컬럼을 두지 않는다(DATA-005-02).

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-001 연동 구성 | N:1 | config_id | NO ACTION | NO ACTION | 구성 참조. 구성은 소프트 삭제라 참조 유효 유지, 이력은 배치가 독립 하드 삭제(ENT-004 와 동일 이유로 CASCADE 금지) |
| ENT-004 처리 상태 | 1:1(소프트 참조) | request_key(동일 값 공유, FK 없음) | 해당 없음 | 해당 없음 | 이중 추적 연결(DATA-005-04·BIZ-004-06). 강제 FK 불가 — 이력(진입 시점 생성)이 상태(실행 종료 시점 생성)보다 선행하고, 보관 삭제 기산점이 서로 달라 생명주기가 독립 |

> 요청 키값 참조는 ENT-006 의 actor_id 와 같은 **소프트 참조**다. 두 추적(처리상태=허브의 전달 성공, 연동이력=서비스 B 의 완료 콜백 수신)은 의미가 분리되며(BIZ-004-06), 동일 request_key 값 공유로만 연결한다.

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_INTERLOCK_HISTORY | request_key | PK(b-tree) | 높음 | PROC-403 이력 생성 INSERT 중복 방지 — 연동 요청 1건당 최대 1건 보장(DATA-005-04) |
| IX_HISTORY_SCOPE | config_id, user_key, requested_at DESC | BTREE | 높음(config_id 낮음 × user_key 높음) | PROC-302 완료 판정(WHERE config_id=? AND user_key=? ORDER BY requested_at DESC LIMIT 1, BIZ-004-04), PROC-303 콜백 대상 특정(WHERE config_id=? AND user_key=? AND callback_received=false ORDER BY requested_at DESC LIMIT 1, BIZ-004-03) |
| IX_HISTORY_RETENTION_RECEIVED | callback_received_at | BTREE(부분: WHERE callback_received = true) | 중간 | PROC-402 수신 건 삭제 대상 선정(WHERE callback_received=true AND callback_received_at < 기준, DATA-006-01) |
| IX_HISTORY_RETENTION_PENDING | requested_at | BTREE(부분: WHERE callback_received = false) | 중간 | PROC-402 미수신 건 삭제 대상 선정(WHERE callback_received=false AND requested_at < 기준, DATA-006-02) |

> IX_HISTORY_SCOPE 하나로 완료 판정(PROC-302, 스코프 전체)과 콜백 특정(PROC-303, 스코프 내 미수신)을 함께 지원한다 — 두 조회는 동일 스코프 정의를 공유하고(BIZ-004 구현 가이드) 스코프당 행 수가 소수라 미수신 전용 부분 인덱스의 실익이 없다. 보관 삭제 두 부분 인덱스(partial index)는 배치의 수신/미수신 두 갈래(BR-402)를 각각 지원한다(ENT-004 보존 인덱스와 동일 패턴).

### 데이터 생명주기

- **생성 조건**: PROC-201(이용 동의 진입) · "진입 처리·이력 생성" 단계(내부 PROC-403 · "이력 영속화 트랜잭션")에서 **사용자 키값 파라미터가 지정된 구성**의 진입 시 1건 INSERT(BIZ-004-01) — 지정 파라미터의 값을 원문 추출해 user_key 로, 진입 시각을 requested_at 으로 기록. 미지정 구성은 기록하지 않는다(BIZ-004-05). 지정 파라미터 값 누락·공백은 진입 자체가 거부되어 생성되지 않는다(BIZ-004-02, 400 EX-BIZ-007).
- **수정 조건**: PROC-303(완료 콜백 API) · "콜백 대상 특정·완료 기록" 단계(내부 PROC-403)에서 {config_id + user_key} 스코프의 미수신 최신 1건에 callback_received=true·callback_received_at 기록(BIZ-004-03). 재통지(스코프 내 완료 이력만 존재)는 갱신 없이 멱등 성공(EXC-BIZ-10). 처리상태(ENT-004)는 변경하지 않는다(BIZ-004-06). 동의 거부·전달 실패 건도 이력을 삭제·변경하지 않고 미수신 상태로 유지한다(EXC-BIZ-11).
- **삭제/보관 조건**: PROC-402(보관정책 배치) · "삭제 실행"에서 하드 삭제. 수신 건=callback_received_at+90일(DATA-006-01), 미수신 건=requested_at+90일(DATA-006-02). 소프트 삭제·보관 플래그 미사용(DATA-006-03). 삭제 사실은 별도 보관하지 않으며 삭제분 조회는 404 로 응답한다(EXC-DATA-11).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| DATA-005-01 | 저장 항목 상한(6항목 + 운영 컬럼) | 스키마 설계(컬럼 한정) |
| DATA-005-02 | 전달 파라미터 원문·개인식별 컬럼 부재 | 스키마 설계(원천 배제) |
| DATA-005-03 | user_key 원문 저장(무변형·무해석) | 응용 처리(PROC-403) — EXC-DATA-09 확정 기본안 |
| DATA-005-04 | request_key 1건 고유·처리상태 연결 | DB 무결성(PK) + 응용 처리 |
| DATA-006-01/02/03 | 보관 90일 이원 기산·하드 삭제 | 응용 배치(PROC-402) + 부분 인덱스 2종 |
| BIZ-004-01/02 | 생성 조건(지정 구성)·값 완결성 | 응용 검증(PROC-201) + NOT NULL·CHECK(length>0) |
| BIZ-004-03/04 | 콜백 특정·완료 판정 스코프(최신 건) | 응용 조회(PROC-303·PROC-302) + IX_HISTORY_SCOPE |
| BIZ-004-05 | 미지정 구성 미기록·API 대상 밖 | 응용 검증(ENT-001.user_key_param_id 사전 확인) |
| BIZ-004-06 | 처리상태 불변경(이중 추적 분리) | 응용 처리(PROC-303) — ENT-004 와 소프트 참조만 |
| DATA-001-01·EXC-DATA-07 | 회원 키 저장의 유일 허용 예외(본 저장소 1곳) | 스키마 설계 + 응용 처리 |
| SEC-005-01/03 | user_key 로그 마스킹(앞2·뒤2)·응답 미포함 | 응용 마스킹(PROC-302·303, MDL-304 필드 배제) |

### 구현 가이드

- **PK 전략**: request_key 는 진입 시 발급된 UUID v4 값을 그대로 쓰므로 DB 기본값(gen_random_uuid())을 두지 않는다(ENT-004 와 동일). 랜덤 UUID 의 B-tree 삽입 분산은 90일 하드 삭제로 크기가 유계라 수용한다 — 공통 근거는 [`spec-datas.md`](spec-datas.md) §PostgreSQL 물리 설계·운영 전제.
- **시간 파티셔닝 미채택**: ENT-004 와 동일 근거 — ① PK(request_key) 전역 유니크(DATA-005-04 1건 보장)가 파티션 키 포함 강제와 충돌, ② 삭제 기산이 두 시각 컬럼(수신=callback_received_at, 미수신=requested_at)에 분산, ③ 일 삭제량이 하루치 만료분으로 유계. 일 삭제 대상이 수십만 행을 상시 초과하면 재평가한다.
- **청크 DELETE + autovacuum**: PROC-402 는 두 부분 인덱스로 대상을 선정하고 청크 단위 반복 삭제(`DELETE ... WHERE ctid IN (SELECT ctid ... LIMIT n)`, 청크 기본 5,000행)로 처리상태와 같은 배치 흐름에서 수행한다(DATA-006 구현 가이드·OPS-003). 본 테이블도 스토리지 파라미터 `autovacuum_vacuum_scale_factor = 0.05`(기본안)로 하향한다(ENT-004 와 동일 접근).
- **fillfactor 기본 유지**: 행당 최대 1회 갱신(콜백 기록)의 대상 컬럼(callback_received·callback_received_at)이 두 부분 인덱스의 키·술어에 걸려 HOT 갱신이 성립하지 않는다 — 하향 실익이 없어 기본값(100)을 유지한다(ENT-004 와 동일 판단).
- **user_key 길이 상한 512(확정)**: 불투명 원문(해시 hex·암호문 base64 등)의 통상 길이를 수용하는 기본안 상한이다 — EXC-DATA-08 이 스키마 상세 확정을 본 문서에 위임. 초과 입력은 진입 검증(SEC-004)에서 거부되므로 저장 시점 절단이 발생하지 않는다.
- **마스킹 강제**: user_key 는 본 테이블 밖(로그·감사·오류 응답)에 원문을 남기지 않고(SEC-005-01 앞2·뒤2 마스킹), 완료 확인 응답(MDL-304)에는 필드 자체를 두지 않는다(SEC-005-03).
