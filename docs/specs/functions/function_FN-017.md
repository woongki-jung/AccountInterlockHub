# 연동 완료 확인 판정 공통 기능 정의

## 개요

- **기능 목적**: 서비스 A 대면 연동 완료 확인 API(API-02)의 판정 단위 로직이다. {연동 구성 식별자 + 사용자 키값} 복합 스코프의 연동 요청 일시 최신 이력 1건을 조회해, 그 이력의 완료 콜백 수신 여부로 처리완료를 판정하고 완료 판정 항목 3개만 응답한다. 읽기 전용이며 이력·처리상태를 갱신하지 않는다. 지정 사용자 키값 원문·전달 파라미터는 응답에 포함하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "서비스 A가 그 키값 기준으로 서비스 B의 처리완료 여부를 확인하는 API" / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §4 / 정책 BIZ-004·SEC-005. 2026-07-06 요구 추가(`accountinterlockhub#33`).

---

## FN-017 연동 완료 확인 판정

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 연동 완료 확인 판정 |
| 분류 | POL |
| 사용 서비스 | SVC-008 |
| 호출 PROC | PROC-302(예약) |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(04·05), [SEC-005](../policies/policy_SEC.md#sec-005-민감값-마스킹)(03·01), [DATA-006](../policies/policy_DATA.md#data-006-연동이력-보관삭제)(EXC-DATA-11) |
| 참조 데이터 | [MDL-304](../datas/model_api.md) 완료 확인 응답, [MDL-303](../datas/model_api.md) 연동이력, [ENT-007](../datas/data_ENT-007.md) |
| 관련 IA 항목 | API-02 |

### 시그니처

```
function FN-017_checkCompletion (
  configCode: string,      // 연동 구성 식별자(진입 계약과 동일 값)
  userKey: string,         // 서비스 A 가 전달했던 지정 사용자 키값
): CompletionCheckResponse // MDL-304 (isCompleted·callbackReceivedAt·requestedAt)
  throws HistoryNotFoundError { code: EX-BIZ-005, http: 404 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | configCode | string | Y | NotBlank, MaxLength(64) | 조회 조건(구성 식별자) |
| 입력 | userKey | string | Y | NotBlank, MaxLength(512) | 조회 조건(지정 사용자 키값) |
| 출력 | CompletionCheckResponse | MDL-304 | - | 판정 3항목만 | userKey·parameters 필드 없음(SEC-005-03) |

### 처리 흐름 (의사코드)

```
   // 인증(FN-004, 서비스 A 자격)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-302 가 본 FN 호출 전 선수행

1. 스코프 해석 — FN-019, POL BIZ-004-04·BIZ-004-05 (validate)
   res = FN-019_resolveHistoryScope(configCode, userKey, pendingOnly = false)
   if (!res.eligible OR res.target is null)
        → throw HistoryNotFoundError (404, EX-BIZ-005)
        // 구성 미존재·미지정 구성·스코프 내 이력 없음(보관 만료 삭제·미기록 포함)을 구별하지 않는 단일 404(존재 여부 비노출, EXC-DATA-11)

2. 완료 판정 — POL BIZ-004-04 (transform, BR-302)
   h = res.target                                   // 스코프 내 연동 요청 일시 최신 이력 1건
   response = {
       isCompleted:        h.callbackReceived,      // 완료 콜백 수신=완료 / 미수신=미완료(둘 다 200)
       callbackReceivedAt: h.callbackReceived ? iso8601(h.callbackReceivedAt) : null,
       requestedAt:        iso8601(h.requestedAt)   // 판정 대상 이력의 연동 요청 일시
   }
   // 읽기 전용 — 이력(ENT-007)·처리상태(ENT-004) 무갱신(API-01 의 결과 확인 갱신과 다름)

3. 감사 — POL OPS-002·SEC-005-01 (audit)
   FN-013_writeAudit({ eventType:'COMPLETION_CHECK', actorType:'SERVICE',
                       target: configCode, result:'SUCCESS',
                       detail: 'userKey=' + FN-010_mask(userKey) + ', completed=' + response.isCompleted })

4. 응답 반환 — POL SEC-005-03 (mask)
   return response   // 완료 판정 항목 3개만 — 지정 사용자 키값 원문·전달 파라미터·구성 내부 식별자 미포함
```

> 완료(isCompleted=true)와 미완료(false)는 모두 200 정상 응답이다(BR-302). 404(EX-BIZ-005)는 판정 대상 이력을 특정할 수 없을 때만 반환한다. 본 조회는 멱등하며 재조회 제한이 없다.

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/interlock/completion |
| HTTP 메서드 | POST(읽기 전용 — 지정 사용자 키값을 요청 본문에 담아 질의 문자열 로깅 노출을 피함, SEC-005-01) |
| 인증 요구 | 사전 공유 서비스 A 자격(API 키/서명, FN-004 expectedActor=SERVICE_A, SEC-003-03) |
| 요청 DTO | { configCode, userKey } (FN-005 재검증 통과 후) |
| 응답 DTO (200) | MDL-304 완료 확인 응답(isCompleted·callbackReceivedAt·requestedAt) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-SEC-003/EX-OPS-001/EX-SEC-004/EX-SEC-005/EX-BIZ-005 |
| Rate Limiting | OPS-001 적용(분당 60회, FN-014, scope='completion') |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 401 | EX-SEC-003 | 인증 실패·서명 불일치·서비스 B 자격 사용 | "인증에 실패했습니다." | FN-004(주체 구분), 실패 감사(키값 마스킹) |
| 429 | EX-OPS-001 | 분당 60회 초과 | "잠시 후 다시 시도해주세요." | FN-014, scope='completion' |
| 400 | EX-SEC-004 | 필수 조건 누락·허용 문자 위반·주입 패턴 | "요청이 올바르지 않습니다." | FN-005 |
| 413 | EX-SEC-005 | 요청 본문 1MB 초과 | "요청이 너무 큽니다." | FN-005 |
| 404 | EX-BIZ-005 | 구성 미존재·미지정 구성·스코프 내 이력 없음(삭제·미기록 포함) | "확인 대상을 찾을 수 없습니다." | 세 경우 구별 없이 단일 응답(존재 여부 비노출) |
| 500 | EX-FN-999 | 조회·판정 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-019 | 스코프 해석(단계 1) | 동기 | 구성 미존재·이력 없음 시 404(EX-BIZ-005) 매핑 |
| FN-010 | 감사 마스킹(단계 3) | 동기 | userKey 원문 배제 |
| FN-013 | 조회 감사(단계 3) | 동기 | 감사 실패는 응답에 영향 없음 |

> 인증(FN-004)·요청 제한(FN-014)·입력 검증(FN-005)은 PROC-302 가 본 FN 호출 전 선수행하는 진입 가드로, 본 FN 의 의존이 아니라 PROC 단계 의존이다(PROC-301↔FN-009 와 동일 구조).

### 구현 가이드

- 완료 판정 스코프({연동 구성 식별자 + 사용자 키값}·최신 건)는 콜백 대상 특정(FN-018)과 동일 정의를 FN-019 로 공유한다(BIZ-004 구현 가이드). 스코프 정의를 본 FN 에 중복 구현하지 않는다.
- 응답 DTO(MDL-304)에 userKey·parameters·configId 필드를 두지 않는다 — 마스킹 이전에 필드 자체를 배제한다(SEC-005-03). 감사·오류 로그의 키값은 FN-010 마스킹(앞2·뒤2)한다.
- 본 조회는 읽기 전용이다 — 이력·처리상태를 갱신하지 않는다. 삭제된(또는 미기록) 이력의 조회는 404 로 응답하고 삭제 사실을 별도 보관하지 않는다(EXC-DATA-11).
