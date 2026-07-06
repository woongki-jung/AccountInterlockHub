# 관리자 계정 데이터 정의

## 개요

- **데이터 목적**: 관리자 경로 로그인 인증(AUTH-001)·세션·계정 잠금(AUTH-003)을 위한 관리자 계정을 보관한다. 비밀번호는 단방향 해시로만 저장하며, 계정 식별자·인증 상태는 개인정보가 아닌 운영 자격 데이터다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §미결·확인 필요 "IP 제한 외 로그인 인증" / [`../../prd/devspec/infra.md`](../../prd/devspec/infra.md) §접근 제어 / IA [`../../prd/ia/IA.md`](../../prd/ia/IA.md) `ADM-03`.
- **담당자 확정 대기 (Q1)**: 로그인 인증 도입은 확정 기본안이다. 비밀번호 복잡도·잠금 임계치·세션 유휴 수치는 기본안이며 확정 시 정책 리비전한다.

---

## ENT-005 관리자 계정

### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔터티명 | 관리자 계정 |
| 물리 테이블명 | TBL_ADMIN_ACCOUNT |
| 분류 | 마스터 |
| 관련 서비스 | SVC-003 |
| 보존 정책 | 운영 자격 데이터. 비활성화는 is_active 로 처리(소프트 삭제 컬럼 미도입) |
| 개인정보 여부 | 비해당 (운영 계정 자격 — 회원 개인정보 아님. 단 password_hash 는 단방향 해시·비노출) |
| CRUD 수행 PROC | C: 운영 수동 프로비저닝(별도 PROC 없음) / R·U: PROC-103(인증·잠금·비밀번호 변경) / D: 없음(is_active 비활성) |
| 관련 IA 항목 | ADM-03 |

### 속성 정의

| 속성명 | 데이터 타입 | 길이/precision | NULL | 기본값 | CHECK 제약 | 키 | 설명 |
|--------|-----------|----------------|------|--------|-----------|----|------|
| id | uuid | - | NOT NULL | gen_random_uuid() | - | PK | 계정 고유 식별자 |
| username | varchar | 64 | NOT NULL | - | length(username) > 0 | UK | 로그인 계정 ID(AUTH-001) |
| password_hash | varchar | 255 | NOT NULL | - | - | - | 단방향 해시(솔트 포함, AUTH-001-03). 평문·가역 저장 금지 |
| is_active | boolean | - | NOT NULL | true | - | - | 계정 활성 여부(비활성 시 로그인 거부) |
| failed_login_count | INT | - | NOT NULL | 0 | failed_login_count >= 0 | - | 연속 로그인 실패 횟수(AUTH-003-01) |
| locked_until | timestamptz | 3 | NULL | NULL | - | - | 계정 잠금 해제 시각(NULL=미잠금) |
| last_login_at | timestamptz | 3 | NULL | NULL | - | - | 마지막 로그인 성공 시각 |
| created_at | timestamptz | 3 | NOT NULL | now() | - | - | 생성 일시(감사) |
| created_by | varchar | 64 | NULL | NULL | - | - | 생성자(프로비저닝 주체, 운영 절차) |
| updated_at | timestamptz | 3 | NULL | NULL | - | - | 최종 수정 일시(비밀번호 변경 등) |
| updated_by | varchar | 64 | NULL | NULL | - | - | 최종 수정자 |

> 비밀번호는 검증된 단방향 해시 알고리즘으로 저장한다(특정 라이브러리 강제 없음). varchar(255) 는 bcrypt·argon2 등 해시 문자열 여유 길이다.

### 관계 정의

| 대상 엔터티 | 관계 유형 | FK 컬럼 | ON DELETE | ON UPDATE | 설명 |
|-------------|-----------|---------|-----------|-----------|------|
| ENT-006 감사 로그 | 참조(비강제) | ENT-006.actor_id ← username | 해당 없음 | 해당 없음 | 감사 로그의 행위자 식별은 username 소프트 참조(FK 미설정 — 서비스·시스템 행위자 포함·로그 영속성 보장) |

> ENT-005 는 다른 엔터티를 FK 로 참조하지 않는다. 감사 로그의 actor_id 는 FK 제약 없는 소프트 참조다.

### 인덱스 정의

| 인덱스명 | 대상 컬럼 | 유형 | 카디널리티 추정 | 조회 패턴 (인용 PROC) |
|----------|-----------|------|-----------------|----------------------|
| PK_ADMIN_ACCOUNT | id | PK | 높음 | 내부 식별 |
| UQ_ADMIN_USERNAME | username | UNIQUE | 높음 | PROC-103 로그인 계정 조회(WHERE username=?), 계정 중복 방지 |

### 데이터 생명주기

- **생성 조건**: MVP 범위에서 운영 수동 프로비저닝(seed·운영 스크립트)으로 INSERT. 별도 계정 관리 화면·PROC 를 강제하지 않는다(SVC-003 사용자 정의, 담당자 확정 대기).
- **수정 조건**: PROC-103 · "로그인 시도 검증"에서 실패 시 failed_login_count 증가·locked_until 설정, 성공 시 카운트 리셋·last_login_at·잠금 해제 UPDATE. 비밀번호 변경 시 password_hash·updated_at/by UPDATE(AUTH-001-02).
- **삭제/보관 조건**: 물리 삭제를 두지 않는다. 계정 비활성은 is_active=false 로 처리(로그인 거부).

### 연관 정책 (policy)

| 정책 코드 | 적용 컬럼/제약 | 적용 위치 (DB 무결성 / 응용 검증 / 마스킹) |
|-----------|----------------|------------------------------------------|
| AUTH-001-01 | username·password_hash·is_active 인증 | 응용 검증(PROC-103) |
| AUTH-001-02 | 비밀번호 복잡도(8자·4종) | 응용 검증(PROC-103, 설정·변경 시) |
| AUTH-001-03 | password_hash 단방향·비노출 | 응용 가공(해시) + 마스킹(로그 배제) |
| AUTH-003-01 | failed_login_count·locked_until 잠금 | 응용 처리(PROC-103) |
| SEC-005-01 | 인증 자격 로그 마스킹 | 마스킹(로그 포맷터) |

### 구현 가이드

- 로그인은 세션 기반으로 처리하며(세션 자체는 ENT 아님 — MDL-104 애플리케이션 세션), 인증 실패·성공·잠금·해제는 감사 로그(ENT-006, OPS-002)에 기록한다.
- 실패 카운트·잠금 상태는 계정 단위 운영 상태이며 개인정보를 포함하지 않는다(무저장 원칙의 운영 예외). 잠금 판정은 locked_until 과 현재 시각 비교로 수행한다.
