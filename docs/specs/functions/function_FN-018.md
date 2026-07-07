# 완료 콜백 대상 특정·완료 기록 공통 기능 정의

## 개요

- **기능 목적**: 서비스 B 대면 완료 콜백 API(API-03)의 대상 특정·완료 기록 단위 로직이다. {연동 구성 식별자 + 사용자 키값} 스코프의 완료 콜백 미수신 이력 중 연동 요청 일시 최신 1건을 특정해, 완료 콜백 수신 여부=수신·수신 일시를 연동이력에만 기록한다. 처리상태(ENT-004) 4항목은 어떤 경우에도 변경하지 않는다. 스코프에 미수신 이력이 없고 완료 이력만 있는 재통지는 오류가 아니라 멱등 성공으로 처리한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "서비스 B가 정보연계 처리를 완료하고 전달받은 키값 기준으로 완료를 허브에 통지(콜백)하는 API" / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §5 / 정책 BIZ-004·DATA-005. 2026-07-06 요구 추가(`accountinterlockhub#33`).

---

## FN-018 완료 콜백 대상 특정·완료 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 완료 콜백 대상 특정·완료 기록 |
| 분류 | POL |
| 사용 서비스 | SVC-009 |
| 호출 PROC | PROC-303(예약 — 내부 PROC-403) |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(03·05·06), [DATA-005](../policies/policy_DATA.md#data-005-연동이력-저장-최소항목)(01·04), [SEC-005](../policies/policy_SEC.md#sec-005-민감값-마스킹)(01) |
| 참조 데이터 | [MDL-305](../datas/model_api.md) 완료 콜백 요청, [MDL-303](../datas/model_api.md) 연동이력, [ENT-007](../datas/data_ENT-007.md) |
| 관련 IA 항목 | API-03, BAT-03 |

### 시그니처

```
function FN-018_recordCompletionCallback (
  callback: CompletionCallbackRequest,   // MDL-305 (configCode·userKey)
  now: DateTime,                         // 완료 콜백 수신 일시
): void                                  // 성공(완료 기록 또는 멱등)은 200, 대상 미특정은 throw
  throws CallbackTargetNotFoundError { code: EX-BIZ-006, http: 404 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | callback.configCode | string | Y | NotBlank, MaxLength(64) | 전달 페이로드(MDL-204)로 수령한 구성 식별자 회신 |
| 입력 | callback.userKey | string | Y | NotBlank, MaxLength(512) | 전달받은 키값(= 지정 사용자 키값) |
| 입력 | now | DateTime | Y | UTC | callback_received_at |
| 출력 | (void) | - | - | - | 완료 기록/멱등 성공 시 반환(200) |

### 처리 흐름 (의사코드)

```
   // 인증(FN-004, 서비스 B 자격)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-303 이 본 FN 호출 전 선수행

1. 스코프 해석(미수신 최신) — FN-019, POL BIZ-004-03·BIZ-004-05 (validate)
   res = FN-019_resolveHistoryScope(callback.configCode, callback.userKey, pendingOnly = true)
   if (!res.eligible)                                 // 구성 미존재·미지정 구성
        FN-013_writeAudit({ eventType:'CALLBACK_TARGET_MISS', actorType:'SERVICE',
                            target: callback.configCode, result:'FAIL',
                            detail:'userKey=' + FN-010_mask(callback.userKey) })
        → throw CallbackTargetNotFoundError (404, EX-BIZ-006)

2. 대상 분기 — POL BR-303·EXC-BIZ-10 (transform)
   if (res.target is null)
        if (res.anyInScope)                            // 미수신 없음·완료 이력만 존재 = 재통지
             FN-013_writeAudit({ eventType:'CALLBACK_IDEMPOTENT', actorType:'SERVICE',
                                 target: callback.configCode, result:'INFO',
                                 detail:'userKey=' + FN-010_mask(callback.userKey) })
             return                                     // 멱등 성공(상태 변경 없음, EXC-BIZ-10)
        else                                            // 스코프 내 이력 자체 없음
             FN-013_writeAudit({ eventType:'CALLBACK_TARGET_MISS', actorType:'SERVICE',
                                 target: callback.configCode, result:'FAIL',
                                 detail:'userKey=' + FN-010_mask(callback.userKey) })
             → throw CallbackTargetNotFoundError (404, EX-BIZ-006)

3. 완료 기록 — POL BIZ-004-03·DATA-005, PROC-403 (transform)
   n = UPDATE TBL_INTERLOCK_HISTORY
       SET callback_received = true, callback_received_at = :now
       WHERE request_key = :res.target.requestKey AND callback_received = false;   // 동시성 가드(ROW_COUNT)
   if (n = 0)                                           // 동시 콜백이 먼저 기록 — 멱등 성공
        FN-013_writeAudit({ eventType:'CALLBACK_IDEMPOTENT', actorType:'SERVICE',
                            target: callback.configCode, result:'INFO' })
        return
   // 처리상태(ENT-004) 4항목은 변경하지 않는다(BIZ-004-06) — 본 UPDATE 는 연동이력만 대상

4. 감사 — POL OPS-002·SEC-005-01 (audit)
   FN-013_writeAudit({ eventType:'CALLBACK_RECORDED', actorType:'SERVICE',
                       target: callback.configCode, result:'SUCCESS',
                       detail:'userKey=' + FN-010_mask(callback.userKey)
                              + ', requestKey=' + res.target.requestKey })

5. 반환
   return   // 호출 PROC-303 은 성공 엔벨로프(FN-015) 200 응답
```

> 완료 콜백 수신은 연동이력에만 반영한다 — 처리상태 4항목(성공 여부·결과 확인 여부·처리 일시·결과 확인 일시)을 변경하지 않는다(BIZ-004-06). API-01 의 "처리 성공"(허브→서비스 B 전달 성공)과 본 API 의 "처리완료"(서비스 B 완료 콜백 수신)는 의미가 분리되며, 두 추적은 요청 키값 참조로만 연결한다(DATA-005-04).

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/interlock/callback |
| HTTP 메서드 | POST |
| 인증 요구 | 사전 공유 서비스 B 자격(API 키/서명, FN-004 expectedActor=SERVICE_B, SEC-003-03) |
| 요청 DTO | MDL-305 완료 콜백 요청({ configCode, userKey }) — FN-005 재검증 통과 후 |
| 응답 DTO (200) | 공통 성공 엔벨로프(FN-015): 완료 기록 또는 멱등 성공 |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-SEC-003/EX-OPS-001/EX-SEC-004/EX-SEC-005/EX-BIZ-006 |
| Rate Limiting | OPS-001 적용(분당 60회, FN-014, scope='callback') |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-SEC-003 | 인증 실패·서명 불일치·서비스 A 자격 사용 | "인증에 실패했습니다." | FN-004(주체 구분), 실패 감사(키값 마스킹) |
| 429 | EX-OPS-001 | 분당 60회 초과 | "잠시 후 다시 시도해주세요." | FN-014, scope='callback' |
| 400 | EX-SEC-004 | 필수 항목 누락·허용 문자 위반·주입 패턴 | "요청이 올바르지 않습니다." | FN-005 |
| 413 | EX-SEC-005 | 요청 본문 1MB 초과 | "요청이 너무 큽니다." | FN-005 |
| 404 | EX-BIZ-006 | 구성 미존재·미지정 구성·스코프 내 이력 없음 | "통지 대상을 찾을 수 없습니다." | 재통지(완료 이력만 존재)는 404 아님 — 멱등 성공(EXC-BIZ-10) |
| 500 | EX-FN-999 | 특정·기록 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

> 재통지 콜백(스코프 내 미수신 이력 없음·완료 이력만 존재)은 오류(404)가 아니라 멱등 성공(200)으로 처리한다(BR-303·EXC-BIZ-10). 대상 미특정(구성 미존재·미지정·스코프 내 이력 자체 없음)만 404(EX-BIZ-006)다.

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-019 | 대상 특정(단계 1) | 동기 | eligible=false·target=null 시 404/멱등 분기 |
| FN-010 | 감사 마스킹(단계 1·2·4) | 동기 | userKey 원문 배제 |
| FN-013 | 대상 미특정·멱등·기록 감사(단계 1·2·3·4) | 동기 | 감사 실패는 기록 결과에 영향 없음 |

> 인증(FN-004)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-303 이 본 FN 호출 전 선수행하는 진입 가드다(PROC-301↔FN-009 와 동일 구조).

### 구현 가이드

- 대상 특정 스코프({연동 구성 식별자 + 사용자 키값}·미수신 최신 건)는 완료 판정(FN-017)과 동일 정의를 FN-019 로 공유한다(BIZ-004 구현 가이드). 스코프 정의를 본 FN 에 중복 구현하지 않는다.
- 완료 기록 UPDATE 는 `WHERE ... AND callback_received = false` 로 동시성 가드를 두어 재통지·동시 콜백을 멱등하게 흡수한다(ROW_COUNT=0 → 멱등 성공). 처리상태(ENT-004)를 갱신하는 어떤 문장도 두지 않는다(BIZ-004-06).
- 감사·오류 응답에 전달받은 키값 원문을 남기지 않는다(SEC-005-01 마스킹). 인증은 서비스 B 자격만 통과시킨다(SEC-003-03 — 서비스 A 자격 거부, FN-004).
- 콜백 미수신 건의 정리는 보관 배치(FN-011)의 연동 요청 일시 기산 삭제(DATA-006-02)로 처리하며, 별도 콜백 대기 타임아웃 정책은 MVP 범위 밖이다.
