# 민감값 마스킹·응답 필드 선별 공통 기능 정의

## 개요

- **기능 목적**: 로그·감사·오류 응답에 실리는 민감값(연동 추적 키·인증 자격)을 앞2·뒤2자만 노출하고 나머지를 마스킹한다(SEC-005-04). 처리상태 조회 응답에는 상태 4항목 + 추적 키 에코만 담고 회원 키·개인정보·구성 참조를 배제한다(SEC-005-02). 암호값(encX·encY)·생년월일·복호화 원문 X·회원 키·발송처키·복원 키는 마스킹이 아니라 **전량 미기록**이므로(SEC-005-06) 로그·감사·응답 생성 전에 원천 배제하며 본 FN 에 전달하지 않는다. 응답 DTO 변환·로그 포맷터 계층의 공통 유틸리티다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §데이터 원칙(개인정보 최소 노출) / 정책 SEC-005·DATA-001.

---

## FN-010 민감값 마스킹·응답 필드 선별

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 민감값 마스킹·응답 필드 선별 |
| 분류 | DAT |
| 사용 서비스 | SVC-005, SVC-006, SVC-008, SVC-009 (및 감사 기록 횡단) |
| 호출 PROC | PROC-203, PROC-301, PROC-302, PROC-303 (및 FN-013 감사) |
| 연관 정책 | [SEC-005](../policies/policy_SEC.md#sec-005-민감값-마스킹미기록)(02·04·06), [DATA-001-06](../policies/policy_DATA.md#data-001-무저장개인정보-최소화) |
| 참조 데이터 | [MDL-302](../datas/model_api.md) 조회 응답, [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | 공통 |

### 시그니처

```
function FN-010_mask (
  value: string | null,   // 연동 추적 키·인증 자격 등 마스킹 대상 민감값
): string | null          // 앞2·뒤2 노출, 나머지 마스킹(SEC-005-04)

function FN-010_selectStatusResponse (
  status: ProcessStatus,  // MDL-301 (도메인)
): ProcessStatusResponse  // MDL-302 (상태 4항목 + 연동 추적 키 에코, configId·회원 키 배제)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | value | string\|null | N | 추적 키·자격만(암호값·원문 미전달) | 마스킹 대상 민감값 |
| 입력 | status | MDL-301 | Y | - | 응답 선별 대상 상태 |
| 출력 | (masked) | string\|null | - | 앞2·뒤2만 | 마스킹 결과 |
| 출력 | ProcessStatusResponse | MDL-302 | - | 4항목 + 추적 키 에코 | 회원 키·configId 미포함 |

### 처리 흐름 (의사코드)

```
마스킹 — mask, POL SEC-005-04·DATA-001-06 (mask)
1. if (value is null)                 → return null
2. if (len(value) <= 4)               → return repeat('*', len(value))   // 전면 마스킹
3. return value[0..2] + repeat('*', len(value)-4) + value[len-2..len]    // 앞2·뒤2 노출

응답 필드 선별 — selectStatusResponse, POL SEC-005-02 (mask)
1. return {
       trackingKey:       status.trackingKey,       // 조회 대상 에코(발송처 자신의 값, 응답 노출 / 로그는 마스킹)
       isSuccess:         status.isSuccess,
       isResultConfirmed: status.isResultConfirmed,
       processedAt:       iso8601(status.processedAt),
       resultConfirmedAt: iso8601(status.resultConfirmedAt)   // null 허용
   }
   // configId·회원 키·개인정보 필드 미포함(SEC-005-02)
```

> 암호값(encX·encY)·생년월일·복호화 원문 X·회원 키·발송처키·복원 키는 **전량 미기록**(SEC-005-06)이므로 로그·감사·응답 생성 경로에서 원천 배제하고 본 FN 에 전달하지 않는다 — 마스킹(앞2·뒤2) 대상은 연동 추적 키·인증 자격뿐이다(SEC-005-04). 관리자 접근 주소 구성 조회 응답의 수신처 B 전달 주소·고유 ID 는 설정 데이터로 마스킹 대상이 아니다(EXC-SEC-05).

### API 인터페이스

해당 없음 — 응답 DTO 변환·로그 포맷터 계층의 공통 유틸리티다. FN-013(감사)·PROC-203·301·302·303 이 응답·로그 생성 시 호출한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| (없음) | - | 순수 변환(예외 없음) | - | 입력이 null 이어도 안전 반환 |

### 의존 기능

없음(leaf) — 순수 문자열·필드 변환만 수행한다.

### 구현 가이드

- 마스킹·필드 선별은 응답 DTO 변환·로그 포맷터 계층에서 일괄 적용한다. 조회 응답 DTO 에 회원 키·configId 필드를 두지 않는다(SEC-005-02). 완료 확인 응답(MDL-304)에는 연동 추적 키 원문 필드 자체를 두지 않는다(SEC-005-05, FN-017).
- 연동 추적 키·인증 자격을 로그·감사·오류 응답에 남길 때만 마스킹(앞2·뒤2)을 적용하고, 암호값·생년월일·복호화 원문·회원 키는 애초 로그·감사·응답에 싣지 않는다(SEC-005-06 전량 미기록). 마스킹 규칙(앞2·뒤2)은 기본안이며 로그 정책 세부는 build 확정이다.
