# 요청 제한 (Rate Limiting) 공통 기능 정의

## 개요

- **기능 목적**: 서비스 대면 API(처리상태 확인·완료 확인·완료 콜백)와 사용자 진입·생년월일 재입력 재시도에 대해 출발지(또는 인증 주체) 기준 분당 60회를 초과하는 요청을 거부한다. 사용자 진입 제한은 생년월일 전수대입·재시도 남용의 1차 억제 수단이다(SEC-008·EXC-OPS-04, 본인확인 잠금 아님). 제한 초과 이벤트는 감사 로그에 기록한다. 관리자 경로는 IP 제한(FN-001)으로 1차 보호되어 본 제한의 우선 대상이 아니다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §성과 지표(안정적 처리)·시스템 제약 / 정책 OPS-001.
- **담당자 확정 대기**: 분당 60회 임계치는 기본안(EXC-OPS-01).

---

## FN-014 요청 제한 (Rate Limiting)

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 요청 제한 (Rate Limiting) |
| 분류 | CRS |
| 사용 서비스 | SVC-004, SVC-006, SVC-008, SVC-009 |
| 호출 PROC | PROC-201, PROC-301, PROC-302, PROC-303 |
| 연관 정책 | [OPS-001](../policies/policy_OPS.md#ops-001-요청-제한-rate-limiting)(01·02) |
| 참조 데이터 | 요청 카운터(런타임·비 ENT), [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | API-01, API-02, API-03, USR-01 |

### 시그니처

```
function FN-014_checkRateLimit (
  subject: string,        // 출발지 IP 또는 인증 주체(FN-004 caller)
  scope: string,          // 대상 경로 스코프(entry / status / completion / callback)
  now: DateTime,
  limitPerMin: number,    // 분당 임계치(기본안 60)
): void
  throws RateLimitExceededError { code: EX-OPS-001, http: 429 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | subject | string | Y | - | 출발지·인증 주체 키 |
| 입력 | scope | string | Y | - | 경로 스코프 |
| 입력 | now | DateTime | Y | UTC | 윈도우 판정 |
| 입력 | limitPerMin | number | Y | 기본안 60 | 분당 임계치 |
| 출력 | (void) | - | - | 통과 시 반환 | 제한 결과 |

### 처리 흐름 (의사코드)

```
1. 카운터 증가·판정 — POL OPS-001-01 (validate)
   key = scope + ':' + subject
   count = counter.increment(key, windowExpiry = 1min)   // 진입점 미들웨어 카운터
   if (count > limitPerMin)
        FN-013_writeAudit({ eventType:'RATE_LIMIT', actorType:'SERVICE',
                            target: scope, result:'BLOCKED' })   // OPS-001-02
        → throw RateLimitExceededError (429, EX-OPS-001)

2. 통과
   return   // 다음 처리(FN-005·007·009 등)로 진행
```

> 관리자 경로는 IP 제한(SEC-001·FN-001)으로 1차 보호되어 본 제한의 우선 대상이 아니다(EXC-OPS-01). 요청 제한은 사용자 진입·생년월일 재시도(PROC-201)·서비스 대면 API(PROC-301 처리상태·PROC-302 완료 확인·PROC-303 완료 콜백)에 적용한다.

### API 인터페이스

해당 없음 — 진입점 미들웨어 계층의 공통 가드다. 사용자 진입(GET /interlock/entry)·처리상태 확인(GET /api/status/:trackingKey)·완료 확인(POST /api/interlock/completion)·완료 콜백(POST /api/interlock/callback) 진입 시 선적용되며 독립 엔드포인트가 아니다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 429 | EX-OPS-001 | 분당 60회(기본안) 초과 | "잠시 후 다시 시도해주세요." | 제한 초과 감사(OPS-001-02) |
| 500 | EX-FN-999 | 카운터 저장소 오류 | "잠시 후 다시 시도해주세요." | 폴백 정책 build 확정 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-013 | 제한 초과(단계 1) | 동기 | 감사 실패는 제한 결정에 영향 없음 |

### 구현 가이드

- 요청 제한 카운터는 진입점 미들웨어에서 처리하고, 단일 App Service 기준으로 구성하되 스케일아웃 시 공유 카운터(예: 분산 캐시) 전환 여지를 둔다(build 상세). 임계치(분당 60회)는 기본안이며 확정 시 OPS-001 을 리비전한다.
- 서비스 대면 API 는 인증 주체(FN-004 caller) 기준, 사용자 진입은 출발지 IP 기준으로 카운트한다.
