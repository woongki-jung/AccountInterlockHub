# 관리자 IP 접근 제어 공통 기능 정의

## 개요

- **기능 목적**: 관리자 웹·API 경로 진입 요청의 출발지 IP 를 허용 목록과 대조해 허용 IP 만 통과시키고 그 외를 차단한다. 인증(FN-002·003)보다 앞단에서 관리자 경로를 1차 방어한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항 "관리자 경로는 NestJS 단에서 IP 기반 접속 제한을 적용" / [`../../prd/devspec/infra.md`](../../prd/devspec/infra.md) §접근 제어.

---

## FN-001 관리자 IP 접근 제어

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 관리자 IP 접근 제어 |
| 분류 | POL |
| 사용 서비스 | SVC-001, SVC-002, SVC-003 |
| 호출 PROC | PROC-104 |
| 연관 정책 | [SEC-001](../policies/policy_SEC.md#sec-001-관리자-경로-ip-접근-제한)(01·02·03) |
| 참조 데이터 | 허용 IP 목록(운영 구성값, ENT 아님), [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | ADM-03 |

### 시그니처

```
function FN-001_guardAdminIp (
  sourceIp: string,       // 출발지 IP(프록시 환경은 원 출발지 판별값, build 확정)
  requestPath: string,    // 진입 경로(감사 대상 식별)
  allowList: string[],    // 허용 IP 목록(운영 구성값, SEC-001-02)
  env: 'prod' | 'dev',    // dev/local 은 비활성 가능(EXC-SEC-01)
): void
  throws IpBlockedError { code: EX-SEC-001, http: 403 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | sourceIp | string | Y | IPv4/IPv6 형식 | 출발지 IP |
| 입력 | requestPath | string | Y | - | 진입 경로(감사 target) |
| 입력 | allowList | string[] | Y | 운영 구성값(코드 하드코딩 금지) | 허용 IP·CIDR |
| 입력 | env | enum | Y | prod/dev | 환경 구분 |
| 출력 | (void) | - | - | 통과 시 반환, 차단 시 throw | 가드 결과 |

### 처리 흐름 (의사코드)

```
1. 환경 예외 처리 — SEC-001(EXC-SEC-01)
   if (env == 'dev' && allowList is empty) → return   // dev 비활성(로그인 인증 FN-002 는 유지)

2. IP 대조 — POL SEC-001-01 (validate)
   normalized = normalizeIp(sourceIp)
   if (!matchesAny(normalized, allowList))            // 정확 IP·CIDR 매칭
        FN-013_writeAudit({ eventType:'IP_BLOCK', actorType:'SYSTEM',
                            target: requestPath, result:'BLOCKED',
                            detail: maskIp(normalized) })   // SEC-001-03
        → throw IpBlockedError (403, EX-SEC-001)

3. 통과
   return   // 다음 가드(FN-002 로그인 / FN-003 세션)로 진행
```

> 허용 IP 목록 변경 자체는 운영 구성 변경 이벤트로 별도 감사 기록한다(SEC-001-02, 운영 절차).

### API 인터페이스

해당 없음 — 관리자 라우트 진입 가드(미들웨어/가드 계층)로, 독립 엔드포인트가 아니다. 관리자 API 전체(POST /api/admin/**)에 선적용된다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 403 | EX-SEC-001 | 허용 IP 목록 밖 접근 | "접근이 허용되지 않습니다." | SEC-001-01 위반, 차단 감사 기록(SEC-001-03) |
| 500 | EX-FN-999 | IP 판별·구성 로드 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-013 | 차단 시(단계 2) | 동기 | 감사 기록 실패는 차단 결정에 영향 없음(차단 우선) |

### 구현 가이드

- 가드는 관리자 라우트 진입점에 두고 인증 가드(FN-002·003)보다 앞단에 배치한다(SEC-001 → AUTH-001 순).
- 프록시 환경의 원 출발지 IP 판별 방식(X-Forwarded-For 신뢰 범위 등)은 build 단계에서 확정한다. 허용 목록은 운영 구성값으로 주입한다.
</content>
