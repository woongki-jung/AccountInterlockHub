# 연동이력 추적 키 스코프 조회 공통 기능 정의

## 개요

- **기능 목적**: 완료 확인(API-02)과 완료 콜백(API-03)이 공유하는 대상 이력 해석을 단일 소스로 제공한다. **연동 추적 키 단독 스코프**의 연동 요청 일시 최신 이력 1건(또는 미수신 최신 1건)을 조회해 반환한다. `#214` 로 판정 스코프가 구 {연동 구성 식별자 + 사용자 키값}에서 **연동 추적 키 단독**으로 전환됐고, 구성 지정 여부 검증(구 BIZ-004-05)이 폐기됐다 — 완료 판정과 콜백 대상 특정은 동일 스코프 정의를 공유하므로 본 FN 이 그 정의의 단일 구현이다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 6 "발송처가 연동 추적 키 기준으로 수신처의 처리완료 여부를 확인" / 정책 BIZ-004.

---

## FN-019 연동이력 추적 키 스코프 조회

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 연동이력 추적 키 스코프 조회 |
| 분류 | DAT |
| 사용 서비스 | SVC-008, SVC-009 |
| 호출 PROC | PROC-302, PROC-303 |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(09·10), [DATA-002-06](../policies/policy_DATA.md#data-002-연동-추적-키-취급불투명성) |
| 참조 데이터 | [MDL-303](../datas/model_api.md) 연동이력, [ENT-007](../datas/data_ENT-007.md) |
| 관련 IA 항목 | API-02, API-03 |

### 시그니처

```
function FN-019_resolveHistoryScope (
  trackingKey: string,     // 연동 추적 키(스코프 키 — 완료 판정·콜백 특정 공유)
  pendingOnly: boolean,    // true=미수신 최신 1건(콜백 특정) / false=스코프 최신 1건(완료 판정)
): HistoryScopeResolution
  // HistoryScopeResolution = {
  //   target:     InterlockHistory | null,   // MDL-303 — 조건 최신 1건(없으면 null)
  //   anyInScope: boolean           // 추적 키 스코프에 이력이 1건이라도 존재(콜백 재통지 멱등 판정용)
  // }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | NotBlank, MaxLength(255) | 연동 추적 키(등가 매칭 조건) |
| 입력 | pendingOnly | boolean | Y | - | 조회 갈래 선택 |
| 출력 | target | MDL-303 \| null | - | 최신 1건 | 조건 만족 최신 이력 |
| 출력 | anyInScope | boolean | - | - | 추적 키 스코프 내 이력 존재 여부 |

### 처리 흐름 (의사코드)

```
1. 스코프 최신 1건 조회 — POL BIZ-004-09/10 (validate)
   if (pendingOnly)
        target = SELECT * FROM TBL_INTERLOCK_HISTORY
                 WHERE tracking_key = :trackingKey AND callback_received = false
                 ORDER BY requested_at DESC LIMIT 1;      // 콜백 특정(BIZ-004-09), IX_HISTORY_TRACKING
   else
        target = SELECT * FROM TBL_INTERLOCK_HISTORY
                 WHERE tracking_key = :trackingKey
                 ORDER BY requested_at DESC LIMIT 1;      // 완료 판정(BIZ-004-10), IX_HISTORY_TRACKING

2. 스코프 내 이력 존재 여부 판정 — (콜백 멱등용)
   if (target is not null)          anyInScope = true
   else if (pendingOnly)                                          // 미수신 없음 → 완료(수신) 이력만 있는지 확인
        anyInScope = EXISTS(SELECT 1 FROM TBL_INTERLOCK_HISTORY
                            WHERE tracking_key = :trackingKey);    // IX_HISTORY_TRACKING
   else                             anyInScope = false            // 최신 조회가 곧 존재 판정(추가 조회 불필요)

3. 반환
   return { target: target ? map(ENT-007 행 → MDL-303) : null, anyInScope }
```

> 스코프 정의(연동 추적 키·최신 건)는 완료 확인(FN-017)과 콜백 특정(FN-018)이 동일하게 공유한다 — 본 FN 이 그 정의의 단일 소스다(BIZ-004 구현 가이드). 삭제 이력의 자연 배제(하드 삭제분은 조회 0건)는 본 FN 안에서 처리하고, 호출자는 target·anyInScope 두 값만으로 각자의 404(EX-BIZ-005/006)·멱등 분기를 결정한다. `#214` 로 구성 실재·지정 여부 사전 검증(구 eligible)은 폐기됐다 — 추적 키 단독 스코프라 구성 조회 없이 추적 키 등가 매칭만 수행한다.

### API 인터페이스

해당 없음 — 완료 확인(FN-017)·완료 콜백(FN-018)이 호출하는 내부 조회 단위 로직이다. 서비스 대면 엔드포인트는 각 FN·PROC 가 노출한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| (없음) | - | 스코프 내 이력 없음 | - | 예외 대신 target=null 반환(호출자가 404 매핑) |
| 500 | EX-FN-999 | 조회 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 필수 |

> 본 FN 은 도메인 404(EX-BIZ-005/006)를 직접 throw 하지 않는다 — 존재 여부 비노출 정책상 두 API 가 각자의 코드로 단일 404 를 반환하도록 판단 재료(target·anyInScope)만 넘긴다.

### 의존 기능

없음(leaf) — DB 조회·모델 매핑만 수행한다. 감사·마스킹은 호출 FN(FN-017·018)이 담당한다.

### 구현 가이드

- 조회는 IX_HISTORY_TRACKING(tracking_key, requested_at DESC)로 최신 1건을 O(1)에 근접해 획득한다([ENT-007](../datas/data_ENT-007.md) §인덱스). 추적 키 스코프당 행 수가 소수라(재사용 시에만 다건) 미수신 전용 부분 인덱스 없이 동일 인덱스로 두 갈래를 지원한다.
- anyInScope 는 pendingOnly 이고 target 이 null 인 경로(재통지 후보)에서만 추가 EXISTS 조회를 수행하고, 그 외에는 target 유무로 즉시 판정해 불필요한 조회를 피한다.
- 완료 판정·콜백 특정이 동일 스코프를 공유하도록 본 FN 을 단일 진입점으로 두고, 스코프 정의 변경 시 본 FN 만 수정한다. 추적 키 재사용에 대비해 연동 요청 일시 최신 1건을 tiebreaker 로 둔다(EXC-BIZ-12).
