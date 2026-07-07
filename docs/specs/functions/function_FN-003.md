# 관리자 세션 관리·검증 공통 기능 정의

## 개요

- **기능 목적**: 인증된 관리자 세션을 발급·검증·파기한다. 세션 발급은 추측 불가 난수 식별자를 HttpOnly·Secure 로 전달하고, 마지막 활동 후 유휴 30분 초과 시 만료해 재인증을 요구한다. 관리자 API 전체의 진입 가드로 재사용된다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항(관리자 접근 제어) / [`../../prd/devspec/infra.md`](../../prd/devspec/infra.md) §접근 제어.
- **담당자 확정 대기 (Q1)**: 세션 유휴(30분)는 기본안 수치. 세션 저장소(단일/공유)는 build 확정.

---

## FN-003 관리자 세션 관리·검증

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 관리자 세션 관리·검증 |
| 분류 | POL |
| 사용 서비스 | SVC-001, SVC-002, SVC-003 |
| 호출 PROC | PROC-101, PROC-102, PROC-103, PROC-105, PROC-106 |
| 연관 정책 | [AUTH-002](../policies/policy_AUTH.md#auth-002-관리자-세션-관리)(01·02·03), [AUTH-001-01](../policies/policy_AUTH.md#auth-001-관리자-로그인-인증) |
| 참조 데이터 | [MDL-104](../datas/model_admin.md) 관리자 세션(앱 세션·무 ENT), [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | ADM-03 |

> 세션 검증 가드(verifySession)는 로그인·세션 관리(PROC-103)뿐 아니라 관리자 보호 요청 전반(PROC-101 등록·편집, PROC-102 조회, PROC-105 활성 전환, PROC-106 삭제)의 공통 진입 가드로 재사용된다.

### 시그니처

```
function FN-003_issueSession (
  username: string,       // 인증 통과 계정(FN-002 반환)
  now: DateTime,
): AdminSession           // MDL-104 (sessionId·issuedAt·expiresAt·HttpOnly·Secure)

function FN-003_verifySession (
  sessionId: string,      // 요청 쿠키의 세션 식별자
  now: DateTime,
): AdminSession           // 유효 세션(lastActivityAt 갱신)
  throws UnauthenticatedError { code: EX-AUTH-001, http: 401 }
        | SessionExpiredError { code: EX-AUTH-002, http: 401 }

function FN-003_destroySession (
  sessionId: string,      // 로그아웃 대상
): void
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | username | string | Y | - | 세션 소유 계정 |
| 입력 | sessionId | string | Y | 추측 불가 난수 | 세션 식별자(로그 배제) |
| 입력 | now | DateTime | Y | UTC | 유휴 판정 기준 |
| 출력 | AdminSession | MDL-104 | - | - | 발급·검증된 세션 |

### 처리 흐름 (의사코드)

```
발급 — issueSession, AUTH-002-02 (transform)
1. sessionId = secureRandomToken()          // 추측 불가 난수
   session = { sessionId, username, issuedAt: now,
               lastActivityAt: now, expiresAt: now + 30min,
               httpOnly: true, secure: true }
2. sessionStore.put(sessionId, session)      // 앱 세션(비 ENT, build 저장소)
3. return session                            // Set-Cookie(HttpOnly·Secure)

검증 — verifySession, AUTH-001-01·AUTH-002-01 (validate)
1. session = sessionStore.get(sessionId)
   if (session is null)                       → throw UnauthenticatedError (401, EX-AUTH-001)
2. if (now - session.lastActivityAt > 30min)  // 유휴 만료
        sessionStore.remove(sessionId)
        → throw SessionExpiredError (401, EX-AUTH-002)   // 오류 아닌 재인증 유도(EXC-AUTH-02)
3. session.lastActivityAt = now               // 활동 갱신
   session.expiresAt = now + 30min
   sessionStore.put(sessionId, session)
4. return session

파기 — destroySession, AUTH-002-03 (audit)
1. sessionStore.remove(sessionId)             // 즉시 파기
2. FN-013_writeAudit({ eventType:'LOGOUT', actorType:'ADMIN',
                       actorId: session.username, result:'SUCCESS' })
```

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/admin/auth/logout (파기) · 관리자 API 전체(검증 가드) |
| HTTP 메서드 | POST(logout) / 전 관리자 요청(검증) |
| 인증 요구 | IP 통과(FN-001) + 유효 세션 |
| 요청 DTO | 세션 쿠키(sessionId) |
| 응답 DTO (200) | logout: { success:true } / 검증 통과: 다음 처리 진행 |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-AUTH-001/002 |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-AUTH-001 | 세션 미존재·미인증 | "로그인이 필요합니다." | AUTH-001-01, 로그인 페이지 유도 |
| 401 | EX-AUTH-002 | 유휴 30분 초과 만료 | "다시 로그인해주세요." | 오류 아닌 재인증 유도(EXC-AUTH-02) |
| 500 | EX-FN-999 | 세션 저장소 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-013 | 파기 시(destroySession) | 동기 | 감사 실패는 파기 결정에 영향 없음 |

### 구현 가이드

- 세션은 DB 엔터티가 아닌 애플리케이션 세션으로 관리한다(단일 App Service 기준, 스케일아웃 시 공유 저장소 전환 여지). sessionId 는 로그에 남기지 않는다(FN-010).
- 진입 가드는 FN-001(IP) → FN-003(세션 검증) 순으로 배치한다. 만료는 오류가 아닌 정상 재인증 유도로 취급한다.
