# 서비스 대면 API 인증 공통 기능 정의

## 개요

- **기능 목적**: 발송처 대면 API(처리상태 확인 API-01·완료 확인 API-02)와 수신처 대면 API(완료 콜백 API-03)의 사전 공유 인증 수단(API 키 또는 HMAC 서명 헤더)을 검증해, 통과한 요청에만 응답한다. **연동 추적 키만으로 신뢰하지 않고**(위조 완료통지 차단, SEC-003-04), 인증 자격은 대면 주체별(발송처/수신처)로 분리 발급·검증한다(SEC-003-03). 인증 실패·서명 불일치·주체 불일치는 감사 로그에 기록하되 연동 추적 키·자격 값은 마스킹·미기록한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 5·6(처리상태 확인·완료 확인·완료 콜백 API) / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §3·4·5 접점 / 정책 SEC-003.
- **담당자 확정 대기**: 인증 수단 구체안(API 키/서명 알고리즘)은 기본안(SEC-003·EXC-SEC-03). 발송처 서명 검증 고도화는 후속 보완(SEC-008).

---

## FN-004 서비스 대면 API 인증

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 서비스 대면 API 인증 |
| 분류 | POL |
| 사용 서비스 | SVC-006, SVC-008, SVC-009 |
| 호출 PROC | PROC-301, PROC-302, PROC-303 |
| 연관 정책 | [SEC-003](../policies/policy_SEC.md#sec-003-서비스-대면-api-인증)(03·04·05) |
| 참조 데이터 | 사전 공유 자격(운영 구성값·비밀, ENT 아님), [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | API-01, API-02, API-03 |

### 시그니처

```
function FN-004_authenticateServiceApi (
  credential: string,          // Authorization/API-Key 헤더 값 또는 서명(로그 배제)
  requestBody: string,         // 서명 검증 대상(서명 방식일 때 canonical 원문)
  expectedActor: 'SERVICE_A' | 'SERVICE_B',  // 대면 주체(주체 분리 검증, SEC-003-03)
  trackingKey?: string,        // 감사 마스킹 대상(있으면)
  now: DateTime,
): ServiceCaller               // 인증된 호출 주체 식별(요청 제한 주체 기준)
  throws ApiAuthError { code: EX-SEC-003, http: 401 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | credential | string | Y | 로그 배제(SEC-005-06) | API 키 또는 HMAC 서명 헤더 |
| 입력 | requestBody | string | N | 서명 검증 대상 | 서명 방식일 때 canonical 원문 |
| 입력 | expectedActor | enum | Y | SERVICE_A/SERVICE_B | 대면 주체(주체 분리, SEC-003-03) |
| 입력 | trackingKey | string | N | 마스킹 후 감사 | 실패 감사 target(있으면) |
| 입력 | now | DateTime | Y | 서명 시간창 검증 | 재전송 방지(서명 방식) |
| 출력 | ServiceCaller | 식별자 | - | - | 요청 제한(FN-014) 주체 키 |

### 처리 흐름 (의사코드)

```
1. 자격 존재 확인 — SEC-003-04 (validate)
   if (credential is null or empty)
        → goto 5 (인증 실패)

2. 자격 검증 — SEC-003-04 (validate)
   caller = resolveCaller(credential)            // API 키 매칭 또는 서명 주체 조회(운영 구성값)
   if (caller is null)                           → goto 5
   if (서명 방식)
        expected = HMAC(requestBody, caller.secret)
        if (!constantTimeEquals(credential, expected)) → goto 5   // 상수 시간 비교(타이밍 공격 방지)
        if (abs(now - signatureTime) > 허용 시간창)      → goto 5   // 재전송 방지(서명 방식)

3. 주체 분리 검증 — SEC-003-03 (validate)
   if (caller.actor != expectedActor)            → goto 5
        // 발송처 자격으로 완료 콜백(API-03), 수신처 자격으로 발송처 대면 API(API-01·02) 호출 차단

4. 통과
   return caller     // 이후 FN-014 요청 제한 주체로 사용

5. 인증 실패 처리 — SEC-003-05 (audit)
   FN-013_writeAudit({ eventType:'API_AUTH_FAIL', actorType:'SERVICE',
                       target: FN-010_mask(trackingKey), result:'FAIL' })  // 연동 추적 키 마스킹·자격 미기록
   → throw ApiAuthError (401, EX-SEC-003)
```

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | GET /api/status/:trackingKey · POST /api/interlock/completion · POST /api/interlock/callback (진입 인증 가드) |
| HTTP 메서드 | 각 API 메서드(가드 선적용) |
| 인증 요구 | 사전 공유 API 키 또는 HMAC 서명 헤더(HTTPS 전제)·주체 분리(SEC-003-03) |
| 요청 DTO | Authorization/서명 헤더 + 각 API 요청 본문(연동 추적 키) |
| 응답 DTO (200) | 통과 시 다음 처리(FN-014 → 각 API 로직) 진행 |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-SEC-003 |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-SEC-003 | 자격 누락·불일치·서명 불일치·시간창 초과·주체 불일치 | "인증에 실패했습니다." | SEC-003-03/04, 실패 감사(연동 추적 키 마스킹·자격 미기록) |
| 500 | EX-FN-999 | 자격 조회·서명 검증 오류 | "잠시 후 다시 시도해주세요." | 자격 값 미기록, 감사 로그 필수 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-010 | 실패 감사(단계 5) | 동기 | 연동 추적 키 마스킹 후 기록 |
| FN-013 | 실패 시(단계 5) | 동기 | 감사 실패는 인증 결정에 영향 없음 |

### 구현 가이드

- 인증 수단은 전송 계층 보안(HTTPS) 위에 두고, 자격 값을 로그에 남기지 않는다(SEC-005-06). 비교는 상수 시간(constant-time) 비교로 타이밍 공격을 방지한다. 인증 자격은 운영 구성값/비밀(env `SERVICE_A/B_API_KEY·SECRET`)로 관리하고 접근 주소 구성(ENT-001)·DB 엔터티로 저장하지 않는다(SEC-003, spec-datas §엔터티 아님 목록).
- 주체 분리(SEC-003-03)는 완료 확인(API-02, expectedActor=SERVICE_A)·완료 콜백(API-03, expectedActor=SERVICE_B)·처리상태 확인(API-01, expectedActor=SERVICE_A)에서 각 PROC 가 기대 주체를 지정해 위조 완료통지·교차 호출을 차단한다. API 키/서명 알고리즘 구체안 확정 시 SEC-003 을 리비전하고 본 FN 의 `resolveCaller`·서명 검증 구현을 확정한다.
