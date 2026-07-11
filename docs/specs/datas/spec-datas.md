# 데이터 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 의 DB 엔터티(ENT) 정의 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 3순위)이며, 방향 근거는 [`../../prd/PRD.md`](../../prd/PRD.md), 개발사양 [`../../prd/devspec/database.md`](../../prd/devspec/database.md), 선행 정책 [`../policies/spec-policies.md`](../policies/spec-policies.md)·서비스 [`../services/spec-services.md`](../services/spec-services.md) 다. 서비스 데이터 모델(MDL)은 [`spec-models.md`](spec-models.md) 가 관리한다.

> **2026-07-11 `#214` 개정**: 핵심 연동 플로우를 단일 암호화 JSON(encX/encY)·허브 복호화·수신처 서버-서버 전달·**연동 추적 키**(전달 데이터 X 내부 필드) 기반 추적으로 재정의했다. 저장 대상은 **① 발송처 접근 주소 구성(ENT-001·002) ② 처리 상태(ENT-004) ③ 연동이력(ENT-007) + 관리자 계정(ENT-005)·감사 로그(ENT-006)** 로 한정한다. 구 '전달 파라미터 정의(ENT-003)·사용자 키값 exactly-one 지정(`#33`)·허브 발급 요청 키값 UUID·지정 사용자 키값 원문 저장(EXC-DATA-07)'을 폐기했다. ENT 코드는 유지하되 의미를 갱신했고, **ENT-003 은 결번(재사용 금지)**이다. 후행 도메인(functions/screens/processes/qa)은 v0.1.0 상태이며 PROC 등 후행 코드는 예약 채번(실재 확인은 교차검증 시점).

## 데이터 모델 설계 원칙·기본 방향

- **무저장 우선(DATA-001)**: 발송처 암호값(encX·encY)·복호화 원문(전달 데이터 X)·사용자 생년월일·발송처키·복원 키를 **어떤 테이블·컬럼에도 두지 않는다** — 연동 실행 시점 메모리에서만 다루고 수신처 전달 후 폐기한다(DATA-001-04). 이들은 비영속 MDL(접근 컨텍스트 MDL-201·복호화 원문 MDL-204)로만 표현한다. 저장은 발송처 접근 주소 구성(설정)·처리 상태·연동이력으로 한정한다(DATA-001-05).
- **불투명 추적 키(DATA-002)**: 처리 추적·조회·통지 기준 키는 발송처가 전달 데이터 X 내부에 넣은 **연동 추적 키**(불투명 문자열 원문)다 — 허브는 자체 노출 키를 발급하지 않고(구 요청 키값 UUID 폐기), X 에서 추출한 추적 키를 처리상태(ENT-004.tracking_key)·연동이력(ENT-007.tracking_key)·서비스 대면 API 의 조회 키로 쓴다. 값을 해석·변형·복호화·해시하지 않는다(DATA-002-06). 저장은 무저장 원칙의 정합 예외(운영 추적용 불투명 식별자, EXC-DATA-07)다.
- **최소 상태(DATA-003·DATA-005)**: 처리 상태(ENT-004)는 추적 키·상태 4항목(처리 성공 여부·결과 확인 여부·처리 일시·결과 확인 일시)·생성 감사로, 연동이력(ENT-007)은 추적 키·구성 참조·요청 일시·콜백 수신 여부/일시·생성 감사로 한정하고 개인식별·복호화 원문·회원 키 컬럼을 원천 배제한다(DATA-001-05·DATA-005-06).
- **surrogate PK(추적 키 비유니크)**: 연동 추적 키는 발송처 구성 값이라 허브가 유니크를 강제할 수 없고 재사용을 방어해야 하므로(BIZ-004-09 "미수신 이력 복수" 전제), ENT-004·ENT-007 은 **내부 surrogate uuid `id` 를 PK 로, tracking_key 를 비유니크 조회 인덱스 컬럼**으로 둔다(비개인 운영 식별자, EXC-DATA-06/08). 조회·판정은 스코프 내 시각 최신 1건 규칙(EXC-BIZ-12)으로 단일화한다.
- **삭제 정책 이원화**: 설정·자격 데이터는 소프트 삭제(ENT-001 deleted_at)·비활성(ENT-005 is_active), 처리 상태(ENT-004)·연동이력(ENT-007)은 하드 삭제(DATA-004-06·DATA-006-06), 감사 로그(ENT-006)는 append-only.
- **보관 fallback(DATA-004·DATA-006)**: 처리 상태·연동이력은 **결과 확인/콜백 수신 후 90일과 생성 후 180일 중 먼저 도래**하는 시점에 삭제하고, 미확인/미수신 건은 생성 후 180일 절대 상한을 적용한다(오케스트레이터 spec 확정값). 생성일시(created_at) 컬럼과 결과확인일시·수신일시 부분 인덱스가 배치 삭제를 지원한다.
- **DBMS**: PostgreSQL 16 기준 타입 표기(uuid·varchar(n)·text·timestamptz·boolean·bigint). 운영 Azure Database for PostgreSQL / 개발·로컬 별도 PostgreSQL 서버. 특정 ORM 강제 없음.
- **감사·무결성**: 중요 마스터는 created_at/by·updated_at/by. FK·NOT NULL·UNIQUE·CHECK 로 DB 레벨 무결성을 적극 활용한다.

## 엔터티 코드 체계

- 코드: `ENT-nnn` (마스터·트랜잭션·이력 무관 통합 순번). 물리 테이블명은 `TBL_<도메인>_<엔터티>`. **ENT-003 은 `#214` 로 폐기·결번**(재사용 금지).
- 컬럼: snake_case. 상태 플래그는 boolean, 시각은 timestamptz(3, UTC 저장 권장).

## 엔터티 분류·목록

| ENT 코드 | 엔터티명 | 물리 테이블명 | 분류 | 개인정보 | 관련 IA | 하위 문서 |
|----------|----------|---------------|------|----------|---------|-----------|
| ENT-001 | 발송처 접근 주소 구성 | TBL_INTERLOCK_CONFIG | 마스터 | 비해당 | ADM-01, ADM-02 | [data_ENT-001.md](data_ENT-001.md) |
| ENT-002 | 발송처 접근 주소 구성 동의 항목 | TBL_INTERLOCK_CONSENT_ITEM | 마스터(자식) | 비해당 | ADM-01, USR-01 | [data_ENT-002.md](data_ENT-002.md) |
| ~~ENT-003~~ | ~~연동 구성 전달 파라미터~~ | ~~TBL_INTERLOCK_PARAMETER~~ | 폐기(결번) | — | — | **`#214` 폐기** — 입력이 단일 암호화 JSON 으로 전환(EXC-BIZ-14), 재사용 금지 |
| ENT-004 | 처리 상태 | TBL_INTERLOCK_PROCESS_STATUS | 트랜잭션 | 비해당 | BAT-01, API-01, BAT-02 | [data_ENT-004.md](data_ENT-004.md) |
| ENT-005 | 관리자 계정 | TBL_ADMIN_ACCOUNT | 마스터 | 비해당 | ADM-03 | [data_ENT-005.md](data_ENT-005.md) |
| ENT-006 | 감사 로그 | TBL_AUDIT_LOG | 이력 | 비해당 | 공통 | [data_ENT-006.md](data_ENT-006.md) |
| ENT-007 | 연동이력 | TBL_INTERLOCK_HISTORY | 트랜잭션(이력) | 비해당(연동 추적 키=불투명 문자열, SEC-005-04 마스킹) | BAT-03, API-02, API-03, BAT-02 | [data_ENT-007.md](data_ENT-007.md) |

- **엔터티가 아닌 저장값(운영 구성값)** — 아래는 DB 엔터티가 아니라 운영 구성값·비밀 저장소로 관리한다(코드 하드코딩·전용 테이블 금지).
  - **허용 IP 목록**(SEC-001-02): 관리자 경로 IP 제한 목록.
  - **서비스 대면 API 인증 자격**(SEC-003): 발송처/수신처 대면 API Key·HMAC 시크릿. 주체별 분리(SEC-003-03)이며 **비밀 값 원문을 DB 엔터티로 저장하지 않는다**(운영 구성값/비밀 관리 — env `SERVICE_A/B_API_KEY·SECRET`, build 확정). 접근 주소 구성(ENT-001)에도 두지 않는다.
  - **발송처키·서명 검증 키**: 발송처키는 발송처 보관(허브 미저장, SEC-002), 서명 검증 키 등록은 보안 후속 보완 항목(SEC-008).

## 엔터티 관계 요약

| 부모 | 자식 | 관계 유형 | FK 컬럼 | ON DELETE | 카디널리티 |
|------|------|-----------|---------|-----------|-----------|
| ENT-001 | ENT-002 | 1:N | ENT-002.config_id | CASCADE | 구성 1 : 동의 항목 N(소수) |
| ENT-001 | ENT-004 | 1:N | ENT-004.config_id | NO ACTION | 구성 1 : 처리 상태 N(다수) |
| ENT-001 | ENT-007 | 1:N | ENT-007.config_id | NO ACTION | 구성 1 : 연동이력 N(다수) |
| ENT-004 | ENT-007 | N:N(소프트 참조) | tracking_key 동일 값 공유(FK 없음) | 해당 없음 | 요청 1건 : 상태 1·이력 1(같은 추적 키). 추적 키 재사용 시 스코프 내 다건 공존 |
| ENT-005 | ENT-006 | 참조(비강제) | actor_id ← username | 해당 없음 | 계정 1 : 로그 N(소프트 참조) |

- **FK 그래프**: ENT-002·ENT-004·ENT-007 → ENT-001(config_id). ENT-006·ENT-007·ENT-004(tracking_key 공유)는 강제 FK 없음(소프트 참조). **`#214` 로 ENT-003 및 ENT-001.user_key_param_id 순환 FK 는 제거됐다.**
- **ON DELETE 이원화**: 정의 자식(ENT-002)은 CASCADE(부모 소프트 삭제라 실발생 드묾, 안전망). 트랜잭션 자식(ENT-004·007)은 NO ACTION — 배치가 독립 하드 삭제하므로 부모 삭제 연쇄를 차단해 조기 삭제 방지.
- **추적 키 소프트 참조**: ENT-004↔ENT-007 은 강제 FK 없이 연동 추적 키(tracking_key) 동일 값 공유로만 연결한다(이중 추적 의미 분리 — 처리상태=허브의 전달 성공, 연동이력=수신처 완료 콜백 수신, BIZ-004-11).

## 엔터티 간 주요 의존관계

1. ENT-001(발송처 접근 주소 구성)이 최상위 마스터 — ENT-002(정의 자식)와 ENT-004·007(트랜잭션)이 참조한다. 접근 주소 고유 ID(config_code)가 발송처 식별자이며 사용자 진입·전달 대상 결정의 기준이다(BIZ-001-11).
2. ENT-004(처리 상태)는 ENT-001 을 참조하되 생명주기는 독립(생성 PROC-401, 삭제 PROC-402 배치). 조회 키는 연동 추적 키(비유니크·surrogate PK).
3. ENT-007(연동이력)은 ENT-001 을 참조하고 ENT-004 와 tracking_key 동일 값으로만 연결된다(소프트 참조 — 이중 추적 분리, BIZ-004-11). 생명주기 독립(생성 PROC-403 복호화 성공 후, 완료 기록 PROC-303 콜백, 삭제 PROC-402 배치).
4. ENT-005(관리자 계정)는 독립 마스터 — 인증·잠금 상태 자족. ENT-006 이 행위자로 소프트 참조.
5. ENT-006(감사 로그)은 전 도메인 횡단 — 강제 FK 없이 append-only 로 모든 운영 이벤트(복호화 시도·전달 결과·완료 콜백 포함, 암호값·원문·PII 미포함)를 수렴.

## 인덱스 전략 (조회 패턴별 카디널리티)

| 인덱스명 | ENT | 대상 컬럼 | 유형 | 카디널리티 | 주 사용 PROC |
|----------|-----|-----------|------|-----------|--------------|
| UQ_CONFIG_CODE | ENT-001 | config_code (부분 deleted_at IS NULL) | UNIQUE | 높음 | PROC-101 고유성·PROC-102·PROC-201 진입·PROC-203 전달 대상 |
| IX_CONFIG_LIST | ENT-001 | is_active, created_at DESC (부분) | BTREE | 낮음~중간 | PROC-102 목록·필터·정렬 |
| IX_CONSENT_CONFIG | ENT-002 | config_id, display_order | BTREE | 중간 | PROC-201 동의 화면·PROC-101·102 |
| PK_PROCESS_STATUS | ENT-004 | id (surrogate) | PK(b-tree) | 높음 | PROC-401 INSERT |
| IX_STATUS_TRACKING | ENT-004 | tracking_key, processed_at DESC | BTREE | 높음 | PROC-301 조회·갱신(추적 키 최신 1건) |
| IX_STATUS_RETENTION_CONFIRMED | ENT-004 | result_confirmed_at (부분 확인) | BTREE | 중간 | PROC-402 결과 확인 건 90일 삭제(DATA-004-04) |
| IX_STATUS_RETENTION_CREATED | ENT-004 | created_at | BTREE | 중간~높음 | PROC-402 180일 절대 상한 삭제(DATA-004-04/05) |
| UQ_ADMIN_USERNAME | ENT-005 | username | UNIQUE | 높음 | PROC-103 로그인 조회 |
| PK_AUDIT_LOG | ENT-006 | id (identity) | PK(b-tree) | 높음 | 전 감사 기록 PROC INSERT |
| PK_INTERLOCK_HISTORY | ENT-007 | id (surrogate) | PK(b-tree) | 높음 | PROC-403 INSERT |
| IX_HISTORY_TRACKING | ENT-007 | tracking_key, requested_at DESC | BTREE | 높음 | PROC-302 완료 판정·PROC-303 콜백 특정(추적 키 스코프 최신 1건) |
| IX_HISTORY_RETENTION_RECEIVED | ENT-007 | callback_received_at (부분 수신) | BTREE | 중간 | PROC-402 수신 건 90일 삭제(DATA-006-04) |
| IX_HISTORY_RETENTION_CREATED | ENT-007 | created_at | BTREE | 중간~높음 | PROC-402 180일 절대 상한 삭제(DATA-006-04/05) |

- **인덱스 신설 기준 준수**: 모든 신설 인덱스는 조건절·정렬·조인·유니크에 쓰는 PROC 가 1개 이상 실재한다(후행 PROC-301·302·303·402 예약 채번 인용 — 실재 확인 교차검증 시점). ENT-004·ENT-007 의 config_id 단독 인덱스는 사용 PROC 0건이라 신설하지 않는다(완료 판정·콜백이 tracking_key 단독 스코프로 전환돼 config_id 조건 조회가 사라짐 — `#214`). ENT-006 시각/유형 인덱스도 사용 PROC 0건이라 후속 PROC 확정 시 도입한다.
- **부분 인덱스 활용**: 소프트 삭제(ENT-001)·상태 분기(ENT-004·ENT-007 보존)는 PostgreSQL 부분 인덱스(partial index, WHERE 절)로 선택도·크기를 최적화한다. 180일 절대 상한 인덱스(created_at)는 결과 확인/미확인(수신/미수신) 양 갈래 공통이라 부분이 아닌 전체 인덱스다.
- **추적 키 조회 인덱스**: IX_STATUS_TRACKING·IX_HISTORY_TRACKING 은 (tracking_key, 시각 DESC) 복합으로, 추적 키 단건 조회 겸 재사용 시 최신 1건 선정(EXC-BIZ-12)을 함께 지원한다.
- **커버링(INCLUDE) 미채택**: ENT-004 는 조회 직후 갱신이 따르는 고변경 패턴(PROC-301)이라 index-only scan 의 실익이 없다.
- **BRIN 미채택(현행)**: 현행 조회 패턴은 등가·부분 범위 조회라 부분/복합 B-tree 가 적합하다. BRIN 은 ENT-006 보존 삭제 도입 시의 후보로만 남긴다([`data_ENT-006.md`](data_ENT-006.md) §구현 가이드).

## PostgreSQL 물리 설계·운영 전제

spec 수준에서 확정하는 물리 설계 결정과 운영 전제다. 엔터티별 상세(수치·삭제 설계)는 각 ENT 문서 §구현 가이드가 갖는다.

- **힙 저장 전제**: PostgreSQL 테이블은 힙 저장이며 클러스터드 인덱스가 없다 — 물리 저장 순서를 설계 근거로 삼지 않고, 순서 보장은 인덱스와 ORDER BY 로만 확보한다.
- **surrogate uuid PK 유지(확정·`#214`)**: ENT-004·ENT-007 은 연동 추적 키가 발송처 구성 값(불투명·재사용 방어)이라 tracking_key 를 PK 로 강제할 수 없어 내부 surrogate uuid `id`(gen_random_uuid())를 PK 로 둔다 — 요청별 1행을 안정 저장하고 추적 키 재사용을 수용한다. 랜덤 UUID 삽입 분산(페이지 분할·점유율 저하)은 ENT-004·ENT-007 이 180일 하드 삭제로 크기 유계라 수용하고, 그 외 uuid PK 엔터티(ENT-001·002·005)는 소규모 마스터라 수용한다. PostgreSQL 16 은 네이티브 uuidv7() 미지원(Azure Database for PostgreSQL 확장 제약 포함)이라 시간순 UUID 로 바꾸지 않는다. B-tree deduplication(PG13+)이 갱신에 따른 버전 팽창을 완화한다.
- **대량 삭제·autovacuum**: ENT-004·ENT-007 보존 삭제는 시간 파티셔닝 없이 청크 DELETE 로 확정한다(배제 근거·청크 수치·재검토 트리거는 [`data_ENT-004.md`](data_ENT-004.md)·[`data_ENT-007.md`](data_ENT-007.md) §구현 가이드 — 삭제 자격이 두 시각 컬럼에 분산돼 단일 range 키 표현 불가). dead tuple 회수는 autovacuum 위임 — 고변경 테이블(ENT-004·ENT-007)만 테이블 단위 스토리지 파라미터(`autovacuum_vacuum_scale_factor = 0.05` 기본안)를 하향 조정하고 나머지는 전역 기본값을 쓴다.
- **통계 관리**: ANALYZE 는 autovacuum(autoanalyze)에 위임하고 수동 ANALYZE 를 상시 운영 절차로 두지 않는다. 배치 대량 삭제 직후 플랜 열화가 관측될 때에 한해 대상 테이블 ANALYZE 를 운영 수단으로 사용한다.

## ENT ↔ MDL 매핑 요약

| ENT | 매핑 MDL | 비고 |
|-----|----------|------|
| ENT-001 | MDL-101(도메인), MDL-102(목록 응답) | 접근 주소 구성 마스터 ↔ 도메인·요약 |
| ENT-002 | MDL-101(동의 항목 하위) | 구성 도메인에 포함 |
| ENT-004 | MDL-301(도메인), MDL-302(조회 응답) | 응답은 4항목만(SEC-005-02). tracking_key ↔ MDL-202 |
| ENT-005 | MDL-103(관리자 계정) | 세션(MDL-104)은 ENT 매핑 없음(앱 세션) |
| ENT-006 | MDL-401(감사 로그) | append 기록 |
| ENT-007 | MDL-303(도메인), MDL-304(완료 판정 응답 — 부분) | tracking_key ↔ MDL-202. 콜백 요청(MDL-305)은 추적 키 조회 조건(저장 유입 없음) |
| (없음) | MDL-201·MDL-204 | **비영속(무저장)** — MDL-201 접근 컨텍스트(encX·encY·생년월일), MDL-204 복호화 원문 X(회원 키·추적 키 등). ENT 매핑 없음(메모리 전용) |
| (없음) | MDL-202·MDL-203·MDL-402 | MDL-202 연동 추적 키(ENT-004·007 의 tracking_key 로 유입)·MDL-203 동의 결과(증빙 미저장)·MDL-402 배치 요약(처리상태·연동이력 각각 집계) |

## 담당자 확정 대기·보류

- **연동이력 장기 보관(EXC-DATA-09, `accountinterlockhub#33`)**: 보관 상한 90/180일 fallback·기산은 처리상태 준용의 spec 확정 기본값이며, 사용량·성공률 통계 목적의 장기 보관 여부는 담당자 확정 대기다. 확정 시 보존 정책·부분 인덱스·집계 항목(MDL-402)을 리비전한다.
- **연동 추적 키 길이 상한(255)**: ENT-004·ENT-007 의 tracking_key varchar(255) 는 본 정의서 확정 기본안이며 담당자 조정 가능하다(DATA-002-07 스키마 상한 위임). 발송처가 더 긴 추적 키를 구성하면 상향한다.
- **보관 상한 fallback(DATA-004·DATA-006)**: 결과 확인/수신 후 90일·생성 후 180일·일 배치 주기는 오케스트레이터 spec 확정 기본값이며 담당자 조정 가능하다(EXC-DATA-05).
- **감사 로그 보존 삭제 수단(OPS-002-03)**: 1년 보존 초과분 삭제 배치·PROC 는 MVP 미정의. 도입 시 spec 리비전으로 삭제 PROC·시각 인덱스를 함께 채번한다 — 물리 방향(occurred_at BRIN 또는 월별 range 파티셔닝)은 확정([`data_ENT-006.md`](data_ENT-006.md) §구현 가이드).
- **관리자 계정 프로비저닝**: ENT-005 INSERT 는 운영 수동 절차로, 별도 화면·PROC 미정의(SVC-003·Q1). 계정 관리 기능 확정 시 CRUD PROC 채번.
- **활성/비활성 상태 모델(ENT-001.is_active)**: 기본 활성 여부·전환 규칙은 담당자 확정 대기(SVC-002).
- **서비스 대면 API 인증 자격 저장 수단(SEC-003)**: 비밀 값 원문은 운영 구성값/비밀 관리(env)로 두고 DB 엔터티로 저장하지 않는다(build 확정). 구체 알고리즘(API 키/HMAC) 확정 시 정책·구현을 리비전한다(EXC-SEC-03).
- **기본안 수치(정책 연계)**: 잠금 임계치(AUTH-003)·해시 알고리즘·본문 상한(SEC-004)·요청 제한(OPS-001) 등은 정책 기본안을 따르며 확정 시 관련 컬럼·CHECK 를 리비전한다.
