# 감사 로그 데이터 정의

## 개요

- **데이터 목적**: 관리자 인증·연동 구성 변경·IP 차단·API 인증 실패·연동 전달 실패·배치 실행 등 운영 이벤트의 감사 추적 기록을 보관한다. 회원 키·개인정보를 포함하지 않으며(마스킹 적용), 최소 1년 보존한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항(운영·추적) / [`../../prd/devspec/infra.md`](../../prd/devspec/infra.md) §미결(로깅·모니터링) / 정책 [`../policies/policy_OPS.md`](../policies/policy_OPS.md) OPS-002.

---

## ENT-006 감사 로그

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 감사 로그 |
| 물리 테이블명 | TBL_AUDIT_LOG |
| 분류 | 이력(append-only) |
| 관련 서비스 | 전 SVC(공통) |
| 보존 정책 | 최소 1년 보존(OPS-002-03, 기본안). 무저장 원칙 대상 아님(개인정보 미포함). 보존 삭제 수단은 MVP 미정의 — 도입 시 spec 리비전으로 채번 |
| 개인정보 여부 | 비해당 (회원 키·개인정보 배제·마스킹 — OPS-002-02·SEC-005) |
| CRUD 수행 PROC | C: PROC-101·PROC-103·PROC-104·PROC-105·PROC-106·PROC-203·PROC-301·PROC-402 / R·U·D: MVP 미정의(append-only, 읽기·보존 삭제 PROC 후속) |
| 관련 IA 항목 | 공통 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | bigint | - | NOT NULL | GENERATED ALWAYS AS IDENTITY | - | PK | 로그 순번(append 순서) |
| event_type | varchar | 50 | NOT NULL | - | length(event_type) > 0 | - | 이벤트 유형 코드(예: LOGIN_SUCCESS·CONFIG_CREATE·IP_BLOCK·API_AUTH_FAIL·DELIVERY_FAIL·BATCH_RUN) |
| actor_type | varchar | 20 | NOT NULL | - | IN ('ADMIN','SERVICE','SYSTEM','BATCH') | - | 행위자 유형 |
| actor_id | varchar | 64 | NULL | NULL | - | - | 행위자 식별(관리자 username 또는 서비스 식별. SYSTEM·BATCH 는 NULL). 소프트 참조(ENT-005.username) |
| target | varchar | 200 | NULL | NULL | - | - | 대상 식별(구성 코드·요청 키값(마스킹) 등) |
| result | varchar | 20 | NOT NULL | - | IN ('SUCCESS','FAIL','BLOCKED','INFO') | - | 처리 결과 |
| detail | varchar | 1000 | NULL | NULL | - | - | 부가 상세(SEC-005 마스킹 적용, 회원 키·개인정보 배제) |
| occurred_at | timestamptz | 3 | NOT NULL | now() | - | - | 이벤트 발생 시각 |

> event_type 은 코드값이며 확장 가능하므로 CHECK 목록으로 고정하지 않고 애플리케이션 상수로 관리한다. actor_id·target·detail 은 기록 전 SEC-005 마스킹을 거친다(회원 키·자격 앞2·뒤2만 노출).

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-005 관리자 계정 | 참조(비강제) | actor_id ← username | 해당 없음 | 해당 없음 | actor_id 는 FK 없는 소프트 참조 — 서비스·시스템·배치 행위자 포함, 계정 비활성 후에도 로그 영속 |

> 감사 로그는 FK 강제 참조를 두지 않는다(행위자 다양성·로그 영속성). 무결성보다 기록 보존을 우선한다.

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_AUDIT_LOG | id | PK(b-tree, identity) | 높음 | append-only 삽입 순서. 전 감사 기록 PROC 의 INSERT 대상 |

> 시각·유형·행위자 기준 조회/보존 삭제 인덱스(예: IX_AUDIT_OCCURRED(occurred_at))는 이를 SELECT/DELETE 하는 PROC 가 MVP 에 없어 신설하지 않는다(사용 PROC 0건 금지). 감사 조회·1년 보존 삭제 PROC 확정 시 함께 신설한다.

### 데이터 생명주기

- **생성 조건**: 각 PROC 의 "커밋 후 감사 로그"·"차단 후 감사 로그"·"인증 실패 감사 로그"·"배치 종료 감사 로그" 단계에서 INSERT — PROC-101(구성 변경), PROC-103(로그인·잠금), PROC-104(IP 차단), PROC-105(활성 전환), PROC-106(삭제), PROC-203(전달 실패), PROC-301(API 인증 실패), PROC-402(배치 실행)(OPS-002-01).
- **수정 조건**: 없음(append-only, 불변 기록).
- **삭제/보관 조건**: 최소 1년 보존(OPS-002-03). MVP 는 자동 삭제 배치를 정의하지 않으며(처리 상태 배치 PROC-402 와 별개), 도입 시 spec 리비전으로 삭제 배치·PROC 를 채번한다(방향은 §구현 가이드, 대기 관리는 [`spec-datas.md`](spec-datas.md) §담당자 확정 대기).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| OPS-002-01 | 감사 대상 이벤트 기록 | 응용 감사(각 PROC) |
| OPS-002-02 | 시각·행위자·행위·대상·결과 구성, 개인정보 배제 | 스키마 설계 + 응용 가공 |
| OPS-002-03 | 최소 1년 보존 | 운영/보존 관리 |
| SEC-005-01 | actor_id·target·detail 마스킹 | 마스킹(기록 전) |
| DATA-001-03 | 회원 키 원문 배제 | 마스킹 + 스키마 설계 |

### 구현 가이드

- 감사 로그는 애플리케이션 로그와 분리 가능한 채널로 남기고, 기록 직전 SEC-005 마스킹을 일괄 적용한다. event_type·actor_type·result 코드값은 애플리케이션 상수로 통일한다.
- id 는 bigint GENERATED ALWAYS AS IDENTITY PK — 단조 증가 키라 B-tree 최우측 append 삽입으로 PostgreSQL 에 이미 최적인 패턴이다. 힙의 물리 저장 순서는 보장 대상이 아니므로 시간 순 조회가 필요하면 ORDER BY id(또는 occurred_at)로 논리적으로 보장한다.
- 보존 삭제(OPS-002-03) 도입 시 1순위 후보는 **occurred_at BRIN 인덱스 또는 월별 range 파티셔닝**이다(spec 방향 확정) — append-only 라 occurred_at 과 물리 저장 순서의 상관도가 1에 가까워 BRIN 이 최소 비용으로 유효하다. 사용 PROC 확정 전에는 어떤 인덱스도 신설하지 않는다(사용 PROC 0건 금지 규칙 유지).
