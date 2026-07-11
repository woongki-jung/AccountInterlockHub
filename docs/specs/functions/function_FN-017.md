# 연동 완료 확인 판정 공통 기능 정의

## 개요

- **기능 목적**: 발송처 대면 연동 완료 확인 API(API-02)의 판정 단위 로직이다. **연동 추적 키 단독 스코프**의 연동 요청 일시 최신 이력 1건을 조회해, 그 이력의 완료 콜백 수신 여부로 처리완료를 판정하고 완료 판정 항목 3개만 응답한다. 읽기 전용이며 이력·처리상태를 갱신하지 않는다. `#214` 로 판정 스코프가 구 {연동 구성 식별자 + 사용자 키값}에서 **연동 추적 키 단독**으로 전환됐다 — 추적 키 원문·복호화 원문·회원 키는 응답에 포함하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "발송처가 연동 추적 키 기준으로 수신처의 처리완료 여부를 확인하는 API" / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §4 / 정책 BIZ-004·SEC-005.

---

## FN-017 연동 완료 확인 판정

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 연동 완료 확인 판정 |
| 분류 | POL |
| 사용 서비스 | SVC-008 |
| 호출 PROC | PROC-302 |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(10), [SEC-005](../policies/policy_SEC.md#sec-005-민감값-마스킹미기록)(04·05), [DATA-005-08](../policies/policy_DATA.md#data-005-연동이력-저장-최소항목)(EXC-DATA-11) |
| 참조 데이터 | [MDL-304](../datas/model_api.md) 완료 확인 응답, [MDL-303](../datas/model_api.md) 연동이력, [ENT-007](../datas/data_ENT-007.md) |
| 관련 IA 항목 | API-02 |

### 시그니처

```
function FN-017_checkCompletion (
  trackingKey: string,     // 연동 추적 키(발송처가 X 로부터 확보한 값)
): CompletionCheckResponse // MDL-304 (isCompleted·callbackReceivedAt·requestedAt)
  throws HistoryNotFoundError { code: EX-BIZ-005, http: 404 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | NotBlank, MaxLength(255) | 조회 조건(연동 추적 키) |
| 출력 | CompletionCheckResponse | MDL-304 | - | 판정 3항목만 | 추적 키 원문·회원 키·X 내용 필드 없음(SEC-005-05) |

### 처리 흐름 (의사코드)

```
   // 인증(FN-004, 발송처 자격)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-302 가 본 FN 호출 전 선수행

1. 스코프 해석 — FN-019, POL BIZ-004-10 (validate)
   res = FN-019_resolveHistoryScope(trackingKey, pendingOnly = false)
   if (res.target is null)
        → throw HistoryNotFoundError (404, EX-BIZ-005)
        // 스코프 내 이력 없음(보관 만료 삭제·미기록·복호화 이전 종료 포함)을 구별하지 않는 단일 404(존재 여부 비노출, EXC-DATA-11)

2. 완료 판정 — POL BIZ-004-10 (transform, BR-302)
   h = res.target                                   // 스코프 내 연동 요청 일시 최신 이력 1건
   response = {
       isCompleted:        h.callbackReceived,      // 완료 콜백 수신=완료 / 미수신=미완료(둘 다 200)
       callbackReceivedAt: h.callbackReceived ? iso8601(h.callbackReceivedAt) : null,
       requestedAt:        iso8601(h.requestedAt)   // 판정 대상 이력의 연동 요청 일시
   }
   // 읽기 전용 — 이력(ENT-007)·처리상태(ENT-004) 무갱신(API-01 의 결과 확인 갱신과 다름)

3. 감사 — POL OPS-002·SEC-005-04 (audit)
   FN-013_writeAudit({ eventType:'COMPLETION_CHECK', actorType:'SERVICE',
                       target: FN-010_mask(trackingKey), result:'SUCCESS',
                       detail: 'completed=' + response.isCompleted })   // 추적 키 앞2·뒤2 마스킹

4. 응답 반환 — POL SEC-005-05 (mask)
   return response   // 완료 판정 항목 3개만 — 추적 키 원문·복호화 원문·회원 키·구성 내부 식별자 미포함
```

> 완료(isCompleted=true)와 미완료(false)는 모두 200 정상 응답이다(BR-302). 404(EX-BIZ-005)는 판정 대상 이력을 특정할 수 없을 때만 반환한다. 본 조회는 멱등하며 재조회 제한이 없다.

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/interlock/completion |
| HTTP 메서드 | POST(읽기 전용 — 연동 추적 키를 요청 본문에 담아 질의 문자열 로깅 노출을 피함, SEC-005-04) |
| 인증 요구 | 사전 공유 발송처 자격(API 키/HMAC 서명, FN-004 expectedActor=SERVICE_A, SEC-003-03) |
| 요청 DTO | { trackingKey } (연동 추적 키 단독, FN-005 재검증 통과 후) |
| 응답 DTO (200) | MDL-304 완료 확인 응답(isCompleted·callbackReceivedAt·requestedAt) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-SEC-003/EX-OPS-001/EX-SEC-004/EX-SEC-005/EX-BIZ-005 |
| Rate Limiting | OPS-001 적용(분당 60회, FN-014, scope='completion') |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-SEC-003 | 인증 실패·서명 불일치·수신처 자격 사용 | "인증에 실패했습니다." | FN-004(주체 구분), 실패 감사(추적 키 마스킹) |
| 429 | EX-OPS-001 | 분당 60회 초과 | "잠시 후 다시 시도해주세요." | FN-014, scope='completion' |
| 400 | EX-SEC-004 | 필수 조건 누락·형식·길이 위반(주입은 파라미터 바인딩 방어) | "요청이 올바르지 않습니다." | FN-005 |
| 413 | EX-SEC-005 | 요청 본문 1MB 초과 | "요청이 너무 큽니다." | FN-005 |
| 404 | EX-BIZ-005 | 연동 추적 키 스코프 내 이력 없음(삭제·미기록·복호화 이전 종료 포함) | "확인 대상을 찾을 수 없습니다." | 구별 없이 단일 응답(존재 여부 비노출) |
| 500 | EX-FN-999 | 조회·판정 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-019 | 스코프 해석(단계 1) | 동기 | target=null 시 404(EX-BIZ-005) 매핑 |
| FN-010 | 감사 마스킹(단계 3) | 동기 | 추적 키 앞2·뒤2 마스킹 |
| FN-013 | 조회 감사(단계 3) | 동기 | 감사 실패는 응답에 영향 없음 |

> 인증(FN-004)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-302 가 본 FN 호출 전 선수행하는 진입 가드로, 본 FN 의 의존이 아니라 PROC 단계 의존이다(PROC-301↔FN-009 와 동일 구조).

### 구현 가이드

- 완료 판정 스코프(연동 추적 키·최신 건)는 콜백 대상 특정(FN-018)과 동일 정의를 FN-019 로 공유한다(BIZ-004 구현 가이드). 스코프 정의를 본 FN 에 중복 구현하지 않는다.
- 응답 DTO(MDL-304)에 연동 추적 키 원문·회원 키·configId 필드를 두지 않는다 — 마스킹 이전에 필드 자체를 배제한다(SEC-005-05). 감사·오류 로그의 추적 키는 FN-010 마스킹(앞2·뒤2)한다.
- 본 조회는 읽기 전용이다 — 이력·처리상태를 갱신하지 않는다. 삭제된(또는 미기록·복호화 이전 종료) 이력의 조회는 404 로 응답하고 삭제 사실을 별도 보관하지 않는다(EXC-DATA-11).
