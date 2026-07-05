# 공통 도메인 데이터 모델 정의

## 개요

- **모델 목적**: 전 서비스가 횡단으로 공유하는 공통 모델을 정의한다. 감사 로그(MDL-401) — 관리자 인증·구성 변경·IP 차단·API 인증 실패·전달 실패·배치 실행 등 운영 이벤트의 기록 모델.
- **관련 서비스**: 전 SVC(공통).

> 감사 로그는 회원 키·개인정보를 포함하지 않으며 기록 전 SEC-005 마스킹을 거친다(OPS-002-02·DATA-001-03).

---

## MDL-401 감사 로그 항목

### 기본 정보

| 항목 | 내용 |
|------|------|
| 모델명 | 감사 로그 항목(AuditLogEntry) |
| 분류 | 공통(COM) |
| 사용 서비스 | 전 SVC(SVC-001·003·005·006·007 등) |
| 매핑 엔터티 | ENT-006 |
| 사용 PROC | PROC-101, PROC-103, PROC-104, PROC-105, PROC-106, PROC-203, PROC-301, PROC-402 |
| 용도 | 도메인 모델(기록) |
| 관련 IA 항목 | 공통 |

### 속성 정의

| 속성명 | 데이터 타입 | 필수 | 기본값 | 유효성 규칙 | 마스킹 규칙 | 설명 |
|--------|-----------|------|--------|-------------|-------------|------|
| eventType | string | Y | - | 정의된 코드값 | - | 이벤트 유형(LOGIN_SUCCESS·CONFIG_CREATE·IP_BLOCK·API_AUTH_FAIL·DELIVERY_FAIL·BATCH_RUN 등) |
| actorType | enum('ADMIN','SERVICE','SYSTEM','BATCH') | Y | - | 허용값 | - | 행위자 유형 |
| actorId | string \| null | N | null | MaxLength(64) | 자격·회원 키 시 마스킹 | 행위자 식별(관리자 username·서비스 식별) |
| target | string \| null | N | null | MaxLength(200) | 요청 키값·회원 키 마스킹 | 대상 식별(구성 코드·요청 키값 등) |
| result | enum('SUCCESS','FAIL','BLOCKED','INFO') | Y | - | 허용값 | - | 처리 결과 |
| detail | string \| null | N | null | MaxLength(1000) | 개인정보·회원 키 배제·마스킹 | 부가 상세 |
| occurredAt | string(ISO8601) | Y | - | - | - | 발생 시각 |

### 엔터티 매핑 (PROC 데이터 변환 흐름과 정합)

| 모델 속성 | 엔터티(ENT) | 엔터티 속성 | 변환 지점 | 변환 규칙 |
|-----------|-------------|-------------|-----------|-----------|
| eventType | ENT-006 | event_type | 도메인→ENT | 코드 상수 매핑 |
| actorType | ENT-006 | actor_type | 도메인→ENT | 허용값 매핑 |
| actorId | ENT-006 | actor_id | 도메인→ENT | 마스킹 후 기록(자격·회원 키 원문 배제) |
| target | ENT-006 | target | 도메인→ENT | 요청 키값 등 마스킹 후 기록 |
| result | ENT-006 | result | 도메인→ENT | 허용값 매핑 |
| detail | ENT-006 | detail | 도메인→ENT | SEC-005 마스킹 후 기록 |
| occurredAt | ENT-006 | occurred_at | 도메인→ENT | 발생 시각 기록 |

### 사용처

| SVC 코드 | 기능 | 용도 (요청/응답/도메인) | 사용 PROC | 비고 |
|----------|------|------------------------|----------|------|
| SVC-001 | 구성 변경 감사 | 도메인 | PROC-101 | 등록·수정·삭제·경고 |
| SVC-003 | 인증 감사 | 도메인 | PROC-103, PROC-104 | 로그인·잠금·IP 차단 |
| SVC-005 | 전달 감사 | 도메인 | PROC-203 | 전달 실패 기록 |
| SVC-006 | API 인증 감사 | 도메인 | PROC-301 | 인증 실패(요청 키값 마스킹) |
| SVC-007 | 배치 감사 | 도메인 | PROC-402 | 배치 실행 결과 |

### 구현 가이드

- 감사 로그는 append-only 로 기록하며 수정하지 않는다. 기록 직전 SEC-005 마스킹을 일괄 적용하고 event_type·actor_type·result 코드값을 애플리케이션 상수로 통일한다.
- 회원 키·인증 자격 원문을 detail·target 에 남기지 않는다(DATA-001-03·OPS-002-02). MDL-402(배치 결과)의 요약은 본 모델의 detail 로 유입된다.
