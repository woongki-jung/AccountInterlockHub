# 관리자 로그인·세션 기능 정의

## 개요

- **정의 대상**: 관리자 계정 자격을 검증하고 세션을 발급·검증·파기하는 프로세스. 연속 실패 5회 시 계정을 10분 잠그고, 유휴 30분 초과 세션은 만료해 재인증을 유도한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §미결 "IP 제한 외 로그인 인증(계정·비밀번호 등)을 둘지는 spec 단계에서 확정" — 로그인 병행 확정 기본안 반영.

---

## PROC-103 관리자 로그인·세션

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 관리자 로그인·세션 |
| 분류 | RR |
| 그룹 | 관리자 / 접근 제어 |
| 트리거 유형 | 사용자 액션(SCR-001 로그인 제출·로그아웃) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | ADM-03 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-003 | 관리자 접근·로그인 |
| 정책(policy) | AUTH-001·AUTH-002·AUTH-003·OPS-002 | 인증·세션·잠금·감사 |
| 공통 기능(FN) | FN-002(인증·잠금)·FN-003(세션)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-103(계정)·MDL-104(세션) | 도메인 모델 |
| DB 엔터티(ENT) | ENT-005(계정)·ENT-006(감사). 세션은 앱 세션(비 ENT) | 조회·갱신·감사 대상 |
| 화면(SCR) | SCR-001 | 로그인 화면 |

### 진입점 및 진입 조건

- **진입점**: `POST /api/admin/auth/login`(로그인) · `POST /api/admin/auth/logout`(파기). SCR-001 [로그인] 제출.
- **진입 조건**: PROC-104 IP 게이트 통과. 로그인은 미인증 허용(자격 제출 목적), 로그아웃은 유효 세션 전제.
- **사전 검증**: { username, password } 스키마 재검증(FN-005). username NotBlank·MaxLength(64), password NotBlank.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | username | string | Y | 계정 ID(MaxLength 64) |
| 입력 | password | string | Y | 평문(검증 직후 폐기, 미저장) |
| 출력 | session | MDL-104 | - | Set-Cookie(HttpOnly·Secure) |
| 출력 | account | MDL-103 | - | { username }(passwordHash 배제) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음.
- **데이터 조회 대상**: ENT-005(username 조회, 잠금·해시·실패 카운트).
- **데이터 변경 대상(CRUD)**: ENT-005 UPDATE(실패 카운트·잠금·성공 리셋·last_login_at), ENT-006 INSERT(감사), 세션 저장소 put/remove.

### 실행 제약사항

- **트랜잭션 경계**: ENT-005 UPDATE 는 단건 트랜잭션. 세션 저장소는 앱 세션(DB 밖).
- **동시성 제어**: 실패 카운트 UPDATE 는 계정 행 단위. 잠금 판정은 locked_until 과 now 비교. 세션 식별자는 추측 불가 난수.
- **성능 요구**: 저빈도. 관리자 경로는 IP 제한(FN-001)으로 1차 보호되어 OPS-001 요청 제한 우선 대상 아님(EXC-OPS-01).
- **보안 요구**: 비밀번호 단방향 해시 대조(평문·해시 응답·로그 배제, FN-010), 계정 존재 여부 비노출(동일 실패 메시지), 세션 HttpOnly·Secure.

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 로그인 제출 트리거 → FE 검증 → 요청 DTO   (SCR-001)
  진입 트리거: SCR-001 [로그인] 버튼 제출
  사용 상태/폼: form = { username, password }, expired = queryParam('expired')
  진입 시(mount): if (expired=='1') → 세션 만료 Banner 표시
  검증 로직:
    if (trim(username).length==0 || len(username)>64) → 필드 에러 → 중단
    if (password.length==0)                           → 필드 에러 → 중단
  요청 DTO 변환: payload = { username: trim(form.username), password: form.password }
  호출 수단: mutation → POST /api/admin/auth/login (payload, {credentials:'include'})
  진행 중 UI: Loading — 버튼 Spinner + 폼 disabled

F2. 응답 수신 → 세션·전이
  onSuccess(res→{ data:{ username } } + Set-Cookie):
    navigate → SCR-002 목록(/admin/configs)   // 세션 쿠키는 FE 미접근(HttpOnly)
  onError(err):
    if (err.code=='EX-AUTH-001') → 인라인 에러 "로그인이 필요합니다."(존재 여부 비노출)
    else if (err.code=='EX-AUTH-003') → Banner "계정이 잠겼습니다. 잠시 후 시도해주세요."
    else if (err.code=='EX-SEC-001')  → 접근 차단 안내(서버 가드 차단)
    else → Banner "잠시 후 다시 시도해주세요."
  정책 적용 지점: 비밀번호 화면 항상 마스킹(AUTH-001-03), FE 는 존재 여부·잠금 미판단(서버 전담)

F3. 로그아웃 (SCR-002/004 헤더)
  진입 트리거: 로그아웃 클릭 → mutation → POST /api/admin/auth/logout
  onSuccess: navigate → SCR-001 로그인
```

#### BE 측 처리 (의사코드)

```
B1. 로그인 진입 → 인증·재검증
  엔드포인트: POST /api/admin/auth/login
  인증·인가: (선행) PROC-104 IP 게이트. 로그인은 미인증 허용
  입력 재검증: FN-005_validateInput({username,password}, schema, rawSize)
             위반 → 400 EX-SEC-004

B2. 자격 검증·잠금 — FN-002_authenticateAdmin(username, password, now)   [BR-105]
  계정 조회(AUTH-001-01):
    SELECT id, username, password_hash, is_active, failed_login_count, locked_until
    FROM TBL_ADMIN_ACCOUNT WHERE username = :username;   -- UQ_ADMIN_USERNAME
    if (row is null OR is_active=0) → 감사(LOGIN_FAIL) → 401 EX-AUTH-001 (존재 비노출)
  잠금 확인(AUTH-003-01):
    if (locked_until is not null AND locked_until > now) → 감사(LOGIN_LOCKED,BLOCKED) → 423 EX-AUTH-003
  비밀번호 대조(AUTH-001-03):
    if (!hashVerify(password, password_hash)):
        newCount = failed_login_count + 1
        if (newCount >= 5):  UPDATE TBL_ADMIN_ACCOUNT
            SET failed_login_count=:newCount, locked_until = DATEADD(minute,10,:now) WHERE id=:id;
        else:                UPDATE TBL_ADMIN_ACCOUNT
            SET failed_login_count=:newCount WHERE id=:id;
        FN-013_writeAudit(LOGIN_FAIL, ADMIN, username, FAIL)   -- AUTH-003-02
        → 401 EX-AUTH-001
  성공 처리(AUTH-003-02):
    UPDATE TBL_ADMIN_ACCOUNT
      SET failed_login_count=0, locked_until=NULL, last_login_at=:now WHERE id=:id;
    account = row → MDL-103 (password_hash 필드 제거)

B3. 세션 발급 — FN-003_issueSession(username, now)
  sessionId = secureRandomToken()
  session = { sessionId, username, issuedAt:now, lastActivityAt:now,
              expiresAt: now+30min, httpOnly:true, secure:true }   -- MDL-104
  sessionStore.put(sessionId, session)   // 앱 세션(비 ENT, build 저장소)
  Set-Cookie: sessionId (HttpOnly; Secure)

B4. 감사 → 응답
  FN-013_writeAudit(LOGIN_SUCCESS, ADMIN, username, SUCCESS)   -- OPS-002
  응답: FN-015_ok({ username }) + Set-Cookie

B5. 로그아웃 — FN-003_destroySession(sessionId)   (POST /api/admin/auth/logout)
  인증: PROC-104 게이트 + 유효 세션
  sessionStore.remove(sessionId)
  FN-013_writeAudit(LOGOUT, ADMIN, username, SUCCESS)
  응답: FN-015_ok({ success:true })
  정책 적용 지점: 세션 검증 가드(FN-003_verifySession)는 PROC-101/102/105/106 진입에도 재사용
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | SCR-001 form | { username, password } | 트림(username)·password 원문 |
| 요청→도메인 | BE 컨트롤러 | 자격 DTO | 인증 요청 | FN-005 검증 |
| ENT→도메인 | BE 리포지토리 | ENT-005 행 | MDL-103 | password_hash 제거·잠금 상태 매핑 |
| 도메인→ENT | BE 리포지토리 | 실패·성공 결과 | ENT-005 UPDATE | 카운트·locked_until·last_login_at |
| 도메인→응답 | BE 컨트롤러 | MDL-103·MDL-104 | { username } + Set-Cookie | passwordHash 배제·세션 쿠키 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 로그인 제출 | (사용자 입력) | FE 검증 + 자격 DTO 변환 | 자격 DTO |
| 2 | BE | 게이트·재검증 | 자격 DTO | PROC-104 IP + FN-005 | 검증된 자격 |
| 3 | BE | 자격 검증·잠금 | 검증된 자격 | FN-002 조회·잠금·해시(BR-105) | 인증된 계정 |
| 4 | BE | 세션 발급 | 인증된 계정 | FN-003 세션 생성·Set-Cookie | 세션 |
| 5 | BE | 감사·응답 | 세션 | FN-013 감사 + FN-015 응답 | { username }+쿠키 |
| 6 | FE | 응답 처리 | 응답 | SCR-002 이동 / 실패 안내 | (UI 전이) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-105 | 로그인 성공 / 실패 | 성공=세션 발급, 실패=카운트 누적(5회 잠금) | 세션 / 재시도 유도 |
| BR-106 | 세션 유효 / 유휴 30분 초과 | 유효=접근 허용, 만료=재인증 유도 | 통과 / 401 EX-AUTH-002(가드) |
| EX-AUTH-001 | 계정 미존재·비활성·비밀번호 불일치 | 진입 차단(존재 비노출) | 401 로그인이 필요합니다. |
| EX-AUTH-002 | 유휴 30분 초과 만료 | 세션 제거, 재인증 유도(오류 아님) | 401 다시 로그인해주세요. |
| EX-AUTH-003 | 5회 연속 실패 후 잠금 중 | 시도 거부 | 423 계정이 잠겼습니다. |
| EX-AUTH-004 | 비밀번호 복잡도 미달(설정·변경 시) | 설정 거부 | 422 비밀번호 규칙을 확인해주세요. |
| EX-SEC-004 | 자격 입력 형식 위반 | 요청 거부 | 400 입력 형식이 올바르지 않습니다. |
| EX-FN-999 | 해시·DB·세션 저장소 오류 | 감사, 오류 응답 | 500 잠시 후 다시 시도해주세요. |

> IP 차단(EX-SEC-001)은 선행 PROC-104 게이트에서 처리된다. EX-AUTH-004 는 계정 설정·비밀번호 변경 흐름(운영 프로비저닝)에서만 발생(MVP 로그인 화면 비대상).

### 실행 결과

- **정상 결과**: 세션 발급(HttpOnly·Secure 쿠키), ENT-005 성공 갱신, LOGIN_SUCCESS 감사. FE 는 SCR-002 이동.
- **실패 결과**: EX-AUTH-001/003·EX-SEC-004 엔벨로프 + 실패·잠금 감사. 5회째 실패 시 locked_until 설정.
- **후속 트리거**: 없음. 발급 세션은 PROC-101/102/105/106 진입 가드가 검증.

### 의존 프로세스

- **호출 관계**: 없음(FN 단위 로직만 호출).
- **선행 관계**: PROC-104(IP 게이트) 완료 전제.
- **이벤트 관계**: 없음.

### 구현 가이드

- 세션은 DB 엔터티가 아닌 애플리케이션 세션으로 관리한다(단일 App Service 기준, 스케일아웃 시 공유 저장소 전환 여지). sessionId 는 로그에 남기지 않는다(FN-010).
- 계정 존재 여부를 응답별로 구분 노출하지 않는다(동일 실패 메시지·응답 형태). 실패 카운트·잠금은 계정 단위 운영 상태로 개인정보를 포함하지 않는다.
- 진입 가드는 FN-001(IP, PROC-104) → FN-003(세션 검증) 순으로 배치한다. 만료는 오류가 아닌 정상 재인증 유도로 취급한다.
