# 데이터 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 의 DB 엔터티(ENT) 정의 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 3순위)이며, 방향 근거는 [`../../prd/PRD.md`](../../prd/PRD.md), 개발사양 [`../../prd/devspec/database.md`](../../prd/devspec/database.md), 선행 정책 [`../policies/spec-policies.md`](../policies/spec-policies.md)·서비스 [`../services/spec-services.md`](../services/spec-services.md) 다. 서비스 데이터 모델(MDL)은 [`spec-models.md`](spec-models.md) 가 관리한다.

## 데이터 모델 설계 원칙·기본 방향

- **무저장 우선(DATA-001)**: 회원 고유 키·개인정보를 어떤 테이블에도 영속 컬럼으로 두지 않는다. 회원 키는 서비스 B 전달 시 메모리에서만 경유한다(ENT 매핑 없음 — MDL-201·MDL-204 전송 전용). **유일 예외**는 사용자 키값 파라미터가 지정된 구성의 연동이력(ENT-007.user_key) — PRD 확정 예외(EXC-DATA-07)로 저장소 1곳·항목 상한 내로 한정한다.
- **최소 상태(DATA-003·DATA-005)**: 처리 상태(ENT-004)는 요청 키값·구성 참조·상태 4항목·생성 감사로, 연동이력(ENT-007)은 지정 사용자 키값·구성 참조·요청 키값 참조·요청 일시·콜백 수신 여부/일시·생성 감사로 한정하고 개인식별 컬럼을 원천 배제한다.
- **불투명 키(DATA-002)**: 처리 추적 기준 키는 허브 발급 불투명 UUID v4(요청 키값)다. 회원 키를 키로 쓰지 않는다. 연동이력도 요청 키값을 PK 로 쓰며(1건 보장), 지정 사용자 키값은 조회 스코프 컬럼일 뿐 키가 아니다.
- **삭제 정책 이원화**: 설정·자격 데이터는 소프트 삭제(ENT-001 deleted_at)·비활성(ENT-005 is_active), 처리 상태(ENT-004)·연동이력(ENT-007)은 하드 삭제(DATA-004-03·DATA-006-03), 감사 로그(ENT-006)는 append-only.
- **DBMS**: PostgreSQL 기준 타입 표기(uuid·varchar(n)·text·timestamptz·boolean·bigint). 운영 Azure Database for PostgreSQL / 개발·로컬 별도 PostgreSQL 서버. 특정 ORM 강제 없음.
- **감사·무결성**: 중요 마스터는 created_at/by·updated_at/by. FK·NOT NULL·UNIQUE·CHECK 로 DB 레벨 무결성을 적극 활용한다.

## 엔터티 코드 체계

- 코드: `ENT-nnn` (마스터·트랜잭션·이력 무관 통합 순번). 물리 테이블명은 `TBL_<도메인>_<엔터티>`.
- 컬럼: snake_case. 상태 플래그는 boolean, 시각은 timestamptz(3, UTC 저장 권장).

## 엔터티 분류·목록

| ENT 코드 | 엔터티명 | 물리 테이블명 | 분류 | 개인정보 | 관련 IA | 하위 문서 |
|----------|----------|---------------|------|----------|---------|-----------|
| ENT-001 | 연동 구성 | TBL_INTERLOCK_CONFIG | 마스터 | 비해당 | ADM-01, ADM-02 | [data_ENT-001.md](data_ENT-001.md) |
| ENT-002 | 연동 구성 동의 항목 | TBL_INTERLOCK_CONSENT_ITEM | 마스터(자식) | 비해당 | ADM-01, USR-01 | [data_ENT-002.md](data_ENT-002.md) |
| ENT-003 | 연동 구성 전달 파라미터 | TBL_INTERLOCK_PARAMETER | 마스터(자식) | 비해당 | ADM-01, USR-01, USR-02 | [data_ENT-003.md](data_ENT-003.md) |
| ENT-004 | 처리 상태 | TBL_INTERLOCK_PROCESS_STATUS | 트랜잭션 | 비해당 | BAT-01, API-01, BAT-02 | [data_ENT-004.md](data_ENT-004.md) |
| ENT-005 | 관리자 계정 | TBL_ADMIN_ACCOUNT | 마스터 | 비해당 | ADM-03 | [data_ENT-005.md](data_ENT-005.md) |
| ENT-006 | 감사 로그 | TBL_AUDIT_LOG | 이력 | 비해당 | 공통 | [data_ENT-006.md](data_ENT-006.md) |
| ENT-007 | 연동이력 | TBL_INTERLOCK_HISTORY | 트랜잭션(이력) | 비해당(간주 — 불투명 키값 원문, SEC-005 마스킹 강제) | BAT-03, API-02, API-03, BAT-02 | [data_ENT-007.md](data_ENT-007.md) |

- **허용 IP 목록은 엔터티가 아니다** — 운영 구성 값으로 관리한다(SEC-001-02, 코드 하드코딩·전용 테이블 금지).

## 엔터티 관계 요약

| 부모 | 자식 | 관계 유형 | FK 컬럼 | ON DELETE | 카디널리티 |
|------|------|-----------|---------|-----------|-----------|
| ENT-001 | ENT-002 | 1:N | ENT-002.config_id | CASCADE | 구성 1 : 동의 항목 N(소수) |
| ENT-001 | ENT-003 | 1:N | ENT-003.config_id | CASCADE | 구성 1 : 파라미터 N(소수) |
| ENT-001 | ENT-004 | 1:N | ENT-004.config_id | NO ACTION | 구성 1 : 처리 상태 N(다수) |
| ENT-001 | ENT-007 | 1:N | ENT-007.config_id | NO ACTION | 구성 1 : 연동이력 N(다수 — 지정 구성만 생성) |
| ENT-003 | ENT-001 | 1:0..1(지정 참조) | ENT-001.user_key_param_id | RESTRICT | 파라미터 1 : 지정 구성 0..1(사용자 키값 파라미터 지정, BIZ-001-07) |
| ENT-004 | ENT-007 | 1:0..1(소프트 참조) | request_key 동일 값 공유(FK 없음) | 해당 없음 | 요청 1건 : 상태 1·이력 최대 1(DATA-005-04). 생성 시점·삭제 기산 독립이라 강제 FK 미적용 |
| ENT-005 | ENT-006 | 참조(비강제) | actor_id ← username | 해당 없음 | 계정 1 : 로그 N(소프트 참조) |

- **FK 그래프**: ENT-002·ENT-003·ENT-004·ENT-007 → ENT-001(config_id). ENT-001.user_key_param_id → ENT-003(지정 참조 — 부모↔자식 상호 참조나 소프트 삭제·NULL 허용으로 운용 문제 없음, [`data_ENT-001.md`](data_ENT-001.md)). ENT-006·ENT-007(request_key)은 강제 FK 없음(소프트 참조).
- **ON DELETE 이원화**: 정의 자식(ENT-002·003)은 CASCADE(부모 소프트 삭제라 실발생 드묾, 안전망). 트랜잭션 자식(ENT-004·007)은 NO ACTION — 배치가 독립 하드 삭제하므로 부모 삭제 연쇄를 차단해 조기 삭제 방지. 지정 참조(user_key_param_id)는 RESTRICT — 지정 유지 상태의 파라미터 삭제를 DB 가 차단.

## 엔터티 간 주요 의존관계

1. ENT-001(구성)이 최상위 마스터 — ENT-002·003(정의 자식)과 ENT-004·007(트랜잭션)이 참조. 구성의 user_key_param_id(ENT-003 지정 참조)가 ENT-007 기록 여부와 API-02/03 대상 여부를 결정한다(BIZ-004-05).
2. ENT-004(처리 상태)는 ENT-001 을 참조하되 생명주기는 독립(생성 PROC-401, 삭제 PROC-402 배치).
3. ENT-007(연동이력)은 ENT-001 을 참조하고 ENT-004 와 request_key 동일 값으로만 연결된다(소프트 참조 — 이중 추적 분리, BIZ-004-06). 생명주기 독립(생성 PROC-403, 완료 기록 PROC-303, 삭제 PROC-402 배치).
4. ENT-005(관리자 계정)는 독립 마스터 — 인증·잠금 상태 자족. ENT-006 이 행위자로 소프트 참조.
5. ENT-006(감사 로그)은 전 도메인 횡단 — 강제 FK 없이 append-only 로 모든 운영 이벤트를 수렴.

## 인덱스 전략 (조회 패턴별 카디널리티)

| 인덱스명 | ENT | 대상 컬럼 | 유형 | 카디널리티 | 주 사용 PROC |
|----------|-----|-----------|------|-----------|--------------|
| UQ_CONFIG_CODE | ENT-001 | config_code (부분 deleted_at IS NULL) | UNIQUE | 높음 | PROC-101 고유성·PROC-102·PROC-201 |
| IX_CONFIG_LIST | ENT-001 | is_active, created_at DESC (부분) | BTREE | 낮음~중간 | PROC-102 목록·필터·정렬 |
| IX_CONSENT_CONFIG | ENT-002 | config_id, display_order | BTREE | 중간 | PROC-201 동의 화면·PROC-101·102 |
| IX_PARAM_CONFIG | ENT-003 | config_id, display_order | BTREE | 중간 | PROC-201·PROC-203·PROC-101·102 |
| PK_PROCESS_STATUS | ENT-004 | request_key | PK(b-tree) | 높음 | PROC-301 조회·갱신·PROC-401 |
| IX_STATUS_RETENTION_PENDING | ENT-004 | processed_at (부분 미확인) | BTREE | 중간 | PROC-402 미완료 삭제(DATA-004-02) |
| IX_STATUS_RETENTION_CONFIRMED | ENT-004 | result_confirmed_at (부분 확인) | BTREE | 중간 | PROC-402 완료 삭제(DATA-004-01) |
| UQ_ADMIN_USERNAME | ENT-005 | username | UNIQUE | 높음 | PROC-103 로그인 조회 |
| PK_AUDIT_LOG | ENT-006 | id (identity) | PK(b-tree) | 높음 | 전 감사 기록 PROC INSERT |
| PK_INTERLOCK_HISTORY | ENT-007 | request_key | PK(b-tree) | 높음 | PROC-403 생성 1건 보장(DATA-005-04) |
| IX_HISTORY_SCOPE | ENT-007 | config_id, user_key, requested_at DESC | BTREE | 높음 | PROC-302 완료 판정·PROC-303 콜백 특정({구성+키값} 스코프 최신 건) |
| IX_HISTORY_RETENTION_RECEIVED | ENT-007 | callback_received_at (부분 수신) | BTREE | 중간 | PROC-402 수신 건 삭제(DATA-006-01) |
| IX_HISTORY_RETENTION_PENDING | ENT-007 | requested_at (부분 미수신) | BTREE | 중간 | PROC-402 미수신 건 삭제(DATA-006-02) |

- **인덱스 신설 기준 준수**: 모든 신설 인덱스는 조건절·정렬·조인·유니크에 쓰는 PROC 가 1개 이상 실재한다(신규 PROC-302·303·403 포함 — 프로세스 도메인에 실재). ENT-004.config_id·ENT-006 시각/유형 인덱스·ENT-001.user_key_param_id·ENT-007.config_id 단독 인덱스는 사용 PROC 0건이라 신설하지 않고 후속 PROC 확정 시 도입한다.
- **부분 인덱스 활용**: 소프트 삭제(ENT-001)·상태 분기(ENT-004)는 PostgreSQL 부분 인덱스(partial index, WHERE 절)로 선택도·크기를 최적화한다.
- **커버링(INCLUDE) 미채택**: ENT-004 는 PK 단건 조회 직후 갱신이 따르는 고변경 패턴(PROC-301)이라 가시성 맵이 자주 무효화돼 index-only scan 의 실익이 없다 — INCLUDE 컬럼을 두지 않는다.
- **BRIN 미채택(현행)**: 현행 조회 패턴은 등가·부분 범위 조회라 부분 B-tree 가 적합하다. BRIN 은 ENT-006 보존 삭제 도입 시의 후보로만 남긴다([`data_ENT-006.md`](data_ENT-006.md) §구현 가이드).

## PostgreSQL 물리 설계·운영 전제

spec 수준에서 확정하는 물리 설계 결정과 운영 전제다. 엔터티별 상세(수치·삭제 설계)는 각 ENT 문서 §구현 가이드가 갖는다.

- **힙 저장 전제**: PostgreSQL 테이블은 힙 저장이며 클러스터드 인덱스가 없다 — 물리 저장 순서를 설계 근거로 삼지 않고, 순서 보장은 인덱스와 ORDER BY 로만 확보한다.
- **UUID v4 PK 유지(확정)**: 불투명 키(DATA-002)의 예측 불가성은 보안 속성이라 시간순 UUID(uuidv7 등)로 바꾸지 않는다 — 타임스탬프 노출·랜덤 비트 축소에 더해 정책(DATA-002)·API 계약·TC(UUID v4 형식 검증) 연쇄 변경을 유발하며, PostgreSQL 16 은 네이티브 uuidv7() 미지원(Azure Database for PostgreSQL 확장 제약 포함). 랜덤 삽입 분산(페이지 분할·점유율 저하)은 ENT-004·ENT-007 이 90일 하드 삭제로 크기 유계, 그 외 uuid PK 엔터티(ENT-001·002·003·005)는 소규모 마스터라 수용한다. B-tree deduplication(PG13+)이 갱신에 따른 버전 팽창을 완화한다.
- **대량 삭제·autovacuum**: ENT-004·ENT-007 보존 삭제는 시간 파티셔닝 없이 청크 DELETE 로 확정한다(배제 근거·청크 수치·재검토 트리거는 [`data_ENT-004.md`](data_ENT-004.md)·[`data_ENT-007.md`](data_ENT-007.md) §구현 가이드 — 동일 접근). dead tuple 회수는 autovacuum 위임 — 고변경 테이블(ENT-004·ENT-007)만 테이블 단위 스토리지 파라미터(`autovacuum_vacuum_scale_factor = 0.05` 기본안)를 하향 조정하고 나머지는 전역 기본값을 쓴다.
- **통계 관리**: ANALYZE 는 autovacuum(autoanalyze)에 위임하고 수동 ANALYZE 를 상시 운영 절차로 두지 않는다. 배치 대량 삭제 직후 플랜 열화가 관측될 때에 한해 대상 테이블 ANALYZE 를 운영 수단으로 사용한다.

## ENT ↔ MDL 매핑 요약

| ENT | 매핑 MDL | 비고 |
|-----|----------|------|
| ENT-001 | MDL-101(도메인), MDL-102(목록 응답) | 구성 마스터 ↔ 도메인·요약 |
| ENT-002 | MDL-101(동의 항목 하위) | 구성 도메인에 포함 |
| ENT-003 | MDL-101(파라미터 하위) | 구성 도메인에 포함 |
| ENT-004 | MDL-301(도메인), MDL-302(조회 응답) | 응답은 4항목만(SEC-005-02) |
| ENT-005 | MDL-103(관리자 계정) | 세션(MDL-104)은 ENT 매핑 없음(앱 세션) |
| ENT-006 | MDL-401(감사 로그) | append 기록 |
| ENT-007 | MDL-303(도메인), MDL-304(완료 판정 응답 — 부분) | 콜백 요청(MDL-305)은 대상 특정 조건으로 참조(저장 유입 없음) |
| (없음) | MDL-201·MDL-204 | 회원 키 전송 전용(무저장, ENT 매핑 없음). MDL-204 는 configCode·requestKey 동봉(콜백 회신 계약) |
| (없음) | MDL-202·MDL-203·MDL-402 | 값·결과·요약 전이 모델(§spec-models.md). MDL-402 는 처리상태·연동이력 각각 집계 |

## 담당자 확정 대기·보류

- **감사 로그 보존 삭제 수단(OPS-002-03)**: 1년 보존 초과분 삭제 배치·PROC 는 MVP 미정의. 도입 시 spec 리비전으로 삭제 PROC·시각 인덱스를 함께 채번한다 — 물리 방향(occurred_at BRIN 또는 월별 range 파티셔닝)은 확정([`data_ENT-006.md`](data_ENT-006.md) §구현 가이드).
- **관리자 계정 프로비저닝**: ENT-005 INSERT 는 운영 수동 절차로, 별도 화면·PROC 미정의(SVC-003·Q1). 계정 관리 기능 확정 시 CRUD PROC 채번.
- **활성/비활성 상태 모델(ENT-001.is_active)**: 기본 활성 여부·전환 규칙은 담당자 확정 대기(SVC-002).
- **연동이력 기본안(Q5, `accountinterlockhub#33`)**: ENT-007 의 user_key 원문 저장(DATA-005-03·EXC-DATA-09)과 보관 90일·기산 이원화(DATA-006·EXC-DATA-10, 통계 목적 장기 보관 여부 포함)는 확정 기본안으로 설계했다 — 담당자 회신 시 보존 정책·부분 인덱스·컬럼(해시 저장 전환 등)을 리비전한다. user_key 길이 상한 512 는 본 정의서 확정 기본안(EXC-DATA-08 위임).
- **기본안 수치(정책 연계)**: 보관 90일(DATA-004·DATA-006)·잠금 임계치(AUTH-003)·해시 알고리즘·본문 상한(SEC-004) 등은 정책 기본안을 따르며 확정 시 관련 컬럼·CHECK 를 리비전한다.
