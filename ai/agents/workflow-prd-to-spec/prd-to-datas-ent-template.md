# 개별 데이터 정의 문서 — DB 엔터티 템플릿

본 문서는 [prd-to-datas.md](prd-to-datas.md) §4-2 개별 데이터 정의 문서(`docs/specs/datas/data_<entity-code>.md`)를 작성할 때 따라야 할 상세 형식을 정의한다.
각 엔터티별로 아래 구조를 채워 `docs/specs/datas/data_<entity-code>.md` 파일을 생성한다.

용어 약어 — ENT는 DB 엔터티 정의서 코드, SVC는 서비스 시나리오, POL은 정책, PROC는 기능구현 프로세스 정의서, DDL은 데이터 정의 언어, CHECK 제약은 컬럼값 범위 제약, PK는 기본 키, FK는 외래 키, UK는 유일 키를 의미한다.

아래 속성 정의 예시는 **작성 수준을 보이기 위한 것** — 문법·타입은 채택 DBMS 에 맞춰 옮겨 쓴다. 예시의 특정 DBMS 고유 문법(`gen_random_uuid()`·`TIMESTAMPTZ`·`GIN` 등)을 그대로 강제하지 않는다.

```markdown
# [엔터티명] 데이터 정의

## 개요
- **데이터 목적**: 이 엔터티가 관리하려는 데이터의 역할 및 필요성
- **관련 PRD 요구사항**: PRD 내 관련 섹션 및 원문 인용

---

## [ENT 코드] [엔터티명]

### 기본 정보
| 항목 | 내용 |
|------|------|
| 엔터티명 | 엔터티 이름 |
| 물리 테이블명 | 예: TBL_<도메인>_<엔터티> |
| 분류 | 마스터 / 트랜잭션 / 이력 / 코드 등 |
| 관련 서비스 | 이 데이터를 사용하는 SVC 코드 |
| 보존 정책 | 보존 기간 및 삭제 방식 (관련 정책 코드) |
| 개인정보 여부 | 해당 / 비해당 (해당 시 처리 기준 명시) |
| CRUD 수행 PROC | 본 ENT 에 변경을 가하는 PROC 코드 (CRUD 별로 명시) |
| 관련 IA 항목 | 본 사양이 속한 IA 노드의 `ia-code`(들). 횡단 사양은 `공통` (정본 [`../../strategies/ia.md`](../../strategies/ia.md) §참조 규약) |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | UUID | - | NOT NULL | gen_random_uuid() | - | PK | 고유 식별자 |
| status | VARCHAR | 20 | NOT NULL | 'PENDING' | IN ('PENDING','ACTIVE','DELETED') | - | 상태 플래그 |
| amount | NUMERIC | 15,2 | NOT NULL | 0 | >= 0 | - | 금액 |
| deleted_at | TIMESTAMPTZ | - | NULL | NULL | - | - | 소프트 삭제 시각 (감사 컬럼 created_at·updated_at 동일 패턴) |

> **필수 명시 항목**: 데이터 타입 / 길이·precision / NULL 허용 / 기본값 / CHECK 제약 / 키(PK·FK·UK).
> 길이·precision 미적용 타입(BOOLEAN·TIMESTAMPTZ 등)은 `-` 로 표기.

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-xxx | 1:N | entity_id | RESTRICT / CASCADE | RESTRICT / CASCADE | 관계 설명 |

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| idx_<table>_<col> | column_a, column_b | UNIQUE / BTREE / GIN | 높음 / 중간 / 낮음 | PROC-xxx B2 사전 조회 (WHERE column_a=?, ORDER BY column_b DESC) |

> **카디널리티 추정**: 컬럼 고유 값 분포에 따른 추정 — 높음(near-unique) / 중간(수십~수백 그룹) / 낮음(소수 코드값).
> **조회 패턴**: 본 인덱스를 사용하는 PROC 의사코드의 SQL 쿼리(WHERE / ORDER BY / JOIN) 인용. 인덱스 사용 PROC 가 0건이면 인덱스 신설 사유 재검토.

### 데이터 생명주기
- **생성 조건**: 어떤 PROC 의 어느 단계에서 INSERT 되는지 (PROC 코드 + 단계명).
- **수정 조건**: 어떤 항목이 어떤 조건에서 UPDATE 되는지 (PROC 코드 + 단계명 + 변경 컬럼).
- **삭제/보관 조건**: 소프트 삭제 / 하드 삭제 / 아카이브 기준 (PROC 코드 + 단계명).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| <그룹>-NNN-RR | 적용 대상 | 적용 위치 |

### 구현 가이드
- 개발자가 이 엔터티를 구현할 때 참고할 핵심 사항 (DDL 변환·인덱스 빌드·마이그레이션 순서).
- 관련 기술 패턴 (특정 ORM·DBMS 강제 금지).
```

> 변경이력(DDL 변경·영향 컬럼/인덱스/마이그레이션 포함)은 본문에 인라인 표로 두지 않는다 — 영향 IA 노드의 이력([`../../strategies/ia-history.md`](../../strategies/ia-history.md))으로 위임한다.
