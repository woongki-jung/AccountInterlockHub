# 완료 콜백 대상 특정·완료 기록 공통 기능 정의

## 개요

- **기능 목적**: 수신처 대면 완료 콜백 API(API-03)의 대상 특정·완료 기록 단위 로직이다. **연동 추적 키 단독 스코프**의 완료 콜백 미수신 이력 중 연동 요청 일시 최신 1건을 특정해, 완료 콜백 수신 여부=수신·수신 일시를 연동이력에만 기록한다. 처리상태(ENT-004) 4항목은 어떤 경우에도 변경하지 않는다(BIZ-004-11). 스코프에 미수신 이력이 없고 완료 이력만 있는 재통지는 오류가 아니라 멱등 성공으로 처리한다. `#214` 로 대상 특정 스코프가 구 {연동 구성 식별자 + 사용자 키값}에서 **연동 추적 키 단독**으로 전환됐다(MDL-305 = trackingKey 단독).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "수신처가 정보연계 완료를 전달받은 추적 키 기준으로 허브에 통지(콜백)하는 API" / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §5 / 정책 BIZ-004·DATA-005.

---

## FN-018 완료 콜백 대상 특정·완료 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 완료 콜백 대상 특정·완료 기록 |
| 분류 | POL |
| 사용 서비스 | SVC-009 |
| 호출 PROC | PROC-303(PROC-403 내부) |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(09·11), [DATA-005](../policies/policy_DATA.md#data-005-연동이력-저장-최소항목)(05·08), [SEC-005-04](../policies/policy_SEC.md#sec-005-민감값-마스킹미기록) |
| 참조 데이터 | [MDL-305](../datas/model_api.md) 완료 콜백 요청, [MDL-303](../datas/model_api.md) 연동이력, [ENT-007](../datas/data_ENT-007.md) |
| 관련 IA 항목 | API-03, BAT-03 |

### 시그니처

```
function FN-018_recordCompletionCallback (
  callback: CompletionCallbackRequest,   // MDL-305 (trackingKey 단독)
  now: DateTime,                         // 완료 콜백 수신 일시
): void                                  // 완료 기록/멱등 성공은 200, 대상 미특정은 throw
  throws CallbackTargetNotFoundError { code: EX-BIZ-006, http: 404 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | callback.trackingKey | string | Y | NotBlank, MaxLength(255) | 전달 페이로드(X)로 수령한 연동 추적 키 회신 |
| 입력 | now | DateTime | Y | UTC | callback_received_at |
| 출력 | (void) | - | - | - | 완료 기록/멱등 성공 시 반환(200) |

### 처리 흐름 (의사코드)

```
   // 인증(FN-004, 수신처 자격)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-303 이 본 FN 호출 전 선수행

1. 스코프 해석(미수신 최신) — FN-019, POL BIZ-004-09 (validate)
   res = FN-019_resolveHistoryScope(callback.trackingKey, pendingOnly = true)

2. 대상 분기 — POL BR-303·EXC-BIZ-10 (transform)
   if (res.target is null)
        if (res.anyInScope)                            // 미수신 없음·완료(수신) 이력만 존재 = 재통지
             FN-013_writeAudit({ eventType:'CALLBACK_IDEMPOTENT', actorType:'SERVICE',
                                 target: FN-010_mask(callback.trackingKey), result:'INFO' })
             return                                     // 멱등 성공(상태 변경 없음, EXC-BIZ-10)
        else                                            // 스코프 내 이력 자체 없음
             FN-013_writeAudit({ eventType:'CALLBACK_TARGET_MISS', actorType:'SERVICE',
                                 target: FN-010_mask(callback.trackingKey), result:'FAIL' })
             → throw CallbackTargetNotFoundError (404, EX-BIZ-006)

3. 완료 기록 — POL BIZ-004-09·DATA-005, PROC-403 (transform)
   n = UPDATE TBL_INTERLOCK_HISTORY
       SET callback_received = true, callback_received_at = :now
       WHERE id = :res.target.id AND callback_received = false;   // surrogate id 대상·동시성 가드(ROW_COUNT)
   if (n = 0)                                           // 동시 콜백이 먼저 기록 — 멱등 성공
        FN-013_writeAudit({ eventType:'CALLBACK_IDEMPOTENT', actorType:'SERVICE',
                            target: FN-010_mask(callback.trackingKey), result:'INFO' })
        return
   // 처리상태(ENT-004) 4항목은 변경하지 않는다(BIZ-004-11) — 본 UPDATE 는 연동이력만 대상

4. 감사 — POL OPS-002·SEC-005-04 (audit)
   FN-013_writeAudit({ eventType:'CALLBACK_RECORDED', actorType:'SERVICE',
                       target: FN-010_mask(callback.trackingKey), result:'SUCCESS' })

5. 반환
   return   // 호출 PROC-303 은 성공 엔벨로프(FN-015) 200 응답
```

> 완료 콜백 수신은 연동이력에만 반영한다 — 처리상태 4항목(성공 여부·결과 확인 여부·처리 일시·결과 확인 일시)을 변경하지 않는다(BIZ-004-11). API-01 의 "처리 성공"(허브→수신처 B 전달 성공)과 본 API 의 "처리완료"(수신처 B 완료 콜백 수신)는 의미가 분리되며, 두 추적은 연동 추적 키 공유로만 연결한다(DATA-005-08).

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/interlock/callback |
| HTTP 메서드 | POST |
| 인증 요구 | 사전 공유 수신처 자격(API 키/HMAC 서명, FN-004 expectedActor=SERVICE_B, SEC-003-03) |
| 요청 DTO | MDL-305 완료 콜백 요청({ trackingKey }) — FN-005 재검증 통과 후 |
| 응답 DTO (200) | 공통 성공 엔벨로프(FN-015): 완료 기록 또는 멱등 성공 |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-SEC-003/EX-OPS-001/EX-SEC-004/EX-SEC-005/EX-BIZ-006 |
| Rate Limiting | OPS-001 적용(분당 60회, FN-014, scope='callback') |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-SEC-003 | 인증 실패·서명 불일치·발송처 자격 사용 | "인증에 실패했습니다." | FN-004(주체 구분), 실패 감사(추적 키 마스킹) |
| 429 | EX-OPS-001 | 분당 60회 초과 | "잠시 후 다시 시도해주세요." | FN-014, scope='callback' |
| 400 | EX-SEC-004 | 필수 항목 누락·형식·길이 위반(주입은 파라미터 바인딩 방어) | "요청이 올바르지 않습니다." | FN-005 |
| 413 | EX-SEC-005 | 요청 본문 1MB 초과 | "요청이 너무 큽니다." | FN-005 |
| 404 | EX-BIZ-006 | 연동 추적 키 스코프 내 이력 없음 | "통지 대상을 찾을 수 없습니다." | 재통지(완료 이력만 존재)는 404 아님 — 멱등 성공(EXC-BIZ-10) |
| 500 | EX-FN-999 | 특정·기록 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

> 재통지 콜백(스코프 내 미수신 이력 없음·완료 이력만 존재)은 오류(404)가 아니라 멱등 성공(200)으로 처리한다(BR-303·EXC-BIZ-10). 대상 미특정(스코프 내 이력 자체 없음)만 404(EX-BIZ-006)다.

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-019 | 대상 특정(단계 1) | 동기 | target=null·anyInScope 로 404/멱등 분기 |
| FN-010 | 감사 마스킹(단계 2·4) | 동기 | 추적 키 앞2·뒤2 마스킹 |
| FN-013 | 대상 미특정·멱등·기록 감사(단계 2·3·4) | 동기 | 감사 실패는 기록 결과에 영향 없음 |

> 인증(FN-004)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-303 이 본 FN 호출 전 선수행하는 진입 가드다(PROC-301↔FN-009 와 동일 구조).

### 구현 가이드

- 대상 특정 스코프(연동 추적 키·미수신 최신 건)는 완료 판정(FN-017)과 동일 정의를 FN-019 로 공유한다(BIZ-004 구현 가이드). 스코프 정의를 본 FN 에 중복 구현하지 않는다.
- 완료 기록 UPDATE 는 surrogate `id` 대상 + `AND callback_received = false` 로 동시성 가드를 두어 재통지·동시 콜백을 멱등하게 흡수한다(ROW_COUNT=0 → 멱등 성공). 처리상태(ENT-004)를 갱신하는 어떤 문장도 두지 않는다(BIZ-004-11).
- 감사·오류 응답에 전달받은 추적 키 원문을 남기지 않는다(SEC-005-04 마스킹). 인증은 수신처 자격만 통과시킨다(SEC-003-03 — 발송처 자격 거부, FN-004). `#214` 로 구 configCode·userKey 2항목 회신은 폐기되고 연동 추적 키 단독으로 대상을 특정한다(MDL-305).
- 콜백 미수신 건의 정리는 보관 배치(FN-011)의 연동 요청 일시 기산 삭제(DATA-006-05)로 처리하며, 별도 콜백 대기 타임아웃 정책은 MVP 범위 밖이다.
