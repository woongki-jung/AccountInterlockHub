# 관리자 로그인 인증·계정 잠금 공통 기능 정의

## 개요

- **기능 목적**: 관리자 계정 ID·비밀번호를 검증하고, 연속 실패 누적 시 계정을 한시 잠근다. 인증 성공 시 세션 발급(FN-003)으로 이어진다. 비밀번호는 단방향 해시로만 대조하며 평문·해시를 응답·로그에 노출하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §미결 "IP 제한 외 로그인 인증" / [`../../prd/devspec/infra.md`](../../prd/devspec/infra.md) §접근 제어.
- **담당자 확정 대기 (Q1)**: 로그인 인증 병행은 확정 기본안. 잠금 임계치(5회)·잠금 시간(10분)·비밀번호 복잡도(8자·4종)는 기본안 수치.

---

## FN-002 관리자 로그인 인증·계정 잠금

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 관리자 로그인 인증·계정 잠금 |
| 분류 | POL |
| 사용 서비스 | SVC-003 |
| 호출 PROC | PROC-103 |
| 연관 정책 | [AUTH-001](../policies/policy_AUTH.md#auth-001-관리자-로그인-인증)(01·02·03), [AUTH-003](../policies/policy_AUTH.md#auth-003-로그인-실패-계정-잠금)(01·02) |
| 참조 데이터 | [ENT-005](../datas/data_ENT-005.md) 관리자 계정, [MDL-103](../datas/model_admin.md) 계정, [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | ADM-03 |

### 시그니처

```
function FN-002_authenticateAdmin (
  username: string,       // 로그인 계정 ID (NotBlank, MaxLength 64)
  password: string,       // 평문 비밀번호(검증 직후 폐기, 미저장)
  now: DateTime,          // 잠금·시각 판정 기준
): AdminAccount           // MDL-103 (passwordHash 제외 반환)
  throws AccountLockedError    { code: EX-AUTH-003, http: 423 }
        | InvalidCredentialError { code: EX-AUTH-001, http: 401 }

function FN-002_validatePasswordComplexity (
  password: string,       // 설정·변경 시 복잡도 검증(운영 프로비저닝·변경)
): void
  throws WeakPasswordError { code: EX-AUTH-004, http: 422 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | username | string | Y | NotBlank, MaxLength(64) | 계정 ID |
| 입력 | password | string | Y | 평문(로그 배제) | 검증 후 폐기 |
| 입력 | now | DateTime | Y | UTC | 잠금 판정 기준 |
| 출력 | AdminAccount | MDL-103 | - | passwordHash 미포함 | 인증된 계정 도메인 |

### 처리 흐름 (의사코드)

```
1. 계정 조회 — AUTH-001-01 (validate)
   SELECT id, username, password_hash, is_active, failed_login_count, locked_until
   FROM TBL_ADMIN_ACCOUNT WHERE username = :username;
   if (row is null OR is_active = 0)
        FN-002_recordFailAudit(username, 'LOGIN_FAIL')   // 존재 여부 비노출
        → throw InvalidCredentialError (401, EX-AUTH-001)

2. 잠금 상태 확인 — POL AUTH-003-01 (validate)
   if (locked_until is not null AND locked_until > now)
        FN-013_writeAudit({ eventType:'LOGIN_LOCKED', actorType:'ADMIN',
                            actorId: username, result:'BLOCKED' })
        → throw AccountLockedError (423, EX-AUTH-003)

3. 비밀번호 대조 — AUTH-001-01/03 (validate)
   if (!hashVerify(password, row.password_hash))         // 단방향 해시 비교
        newCount = failed_login_count + 1
        if (newCount >= 5)                                 // 임계치(기본안)
             UPDATE TBL_ADMIN_ACCOUNT
             SET failed_login_count = newCount, locked_until = now + 10min
             WHERE id = row.id;
        else
             UPDATE TBL_ADMIN_ACCOUNT SET failed_login_count = newCount WHERE id = row.id;
        FN-013_writeAudit({ eventType:'LOGIN_FAIL', actorType:'ADMIN',
                            actorId: username, result:'FAIL' })   // AUTH-003-02
        → throw InvalidCredentialError (401, EX-AUTH-001)

4. 성공 처리 — AUTH-003-02 (transform·audit)
   UPDATE TBL_ADMIN_ACCOUNT
   SET failed_login_count = 0, locked_until = null, last_login_at = now
   WHERE id = row.id;
   FN-013_writeAudit({ eventType:'LOGIN_SUCCESS', actorType:'ADMIN',
                       actorId: username, result:'SUCCESS' })

5. 반환(자격 배제)
   account = row → MDL-103 (passwordHash 필드 제거, FN-010 배제 규칙)
   return account   // 호출 PROC 는 FN-003 으로 세션 발급
```

> `validatePasswordComplexity`: 8자 이상 + 영대문자·소문자·숫자·특수문자 각 1자 이상 미충족 시 EX-AUTH-004(AUTH-001-02). MVP 계정 생성은 운영 수동 프로비저닝이라 변경 흐름에서만 호출(예약).

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/admin/auth/login |
| HTTP 메서드 | POST |
| 인증 요구 | IP 통과(FN-001) 전제, Public 자격 제출 |
| 요청 DTO | { username, password } (SEC-004 재검증, FN-005) |
| 응답 DTO (200) | { username } + Set-Cookie 세션(FN-003) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-AUTH-001/003/004 |
| Rate Limiting | 관리자 경로는 IP 제한(FN-001)으로 1차 보호(OPS-001 우선 대상 아님, EXC-OPS-01) |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-AUTH-001 | 계정 미존재·비활성·비밀번호 불일치 | "로그인이 필요합니다." | 존재 여부 비노출(동일 응답) |
| 423 | EX-AUTH-003 | 5회 연속 실패 후 잠금 중 | "계정이 잠겼습니다. 잠시 후 시도해주세요." | locked_until 미도래까지 거부 |
| 422 | EX-AUTH-004 | 비밀번호 복잡도 미달(설정·변경 시) | "비밀번호 규칙을 확인해주세요." | AUTH-001-02 |
| 500 | EX-FN-999 | 해시·DB 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-003 | 인증 성공 후(PROC 단계) | 동기 | 세션 발급 실패 시 EX-FN-999 |
| FN-010 | 반환·감사(단계 5) | 동기 | passwordHash 배제·자격 마스킹 |
| FN-013 | 실패·잠금·성공(단계 1~4) | 동기 | 감사 실패는 인증 결정에 영향 없음 |

### 구현 가이드

- 비밀번호는 검증된 단방향 해시(솔트 포함)로 대조한다(특정 라이브러리 강제 없음). 평문·해시를 응답·로그에 남기지 않는다(FN-010 배제).
- 실패 카운트·잠금은 계정 단위 운영 상태로 개인정보를 포함하지 않는다(무저장 원칙의 운영 예외). 계정 존재 여부를 응답으로 구분 노출하지 않는다.
