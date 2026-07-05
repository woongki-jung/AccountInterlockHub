# 민감값 마스킹·응답 필드 선별 공통 기능 정의

## 개요

- **기능 목적**: 로그·감사·오류 응답·조회 응답에 실리는 민감값(회원 키·인증 자격·요청 키값)을 앞2·뒤2자만 노출하고 나머지를 마스킹한다. 처리상태 조회 응답에는 상태 4항목만 담고 회원 키·개인정보·구성 참조를 배제한다. 응답 DTO 변환·로그 포맷터 계층의 공통 유틸리티다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §데이터 원칙(개인정보 최소 노출) / 정책 SEC-005·DATA-001-03.

---

## FN-010 민감값 마스킹·응답 필드 선별

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 민감값 마스킹·응답 필드 선별 |
| 분류 | DAT |
| 사용 서비스 | SVC-002, SVC-005, SVC-006 (및 감사 기록 횡단) |
| 호출 PROC | PROC-102, PROC-203, PROC-301 (및 FN-013 감사) |
| 연관 정책 | [SEC-005](../policies/policy_SEC.md#sec-005-민감값-마스킹)(01·02), [DATA-001-03](../policies/policy_DATA.md#data-001-회원-키-무저장개인정보-최소화) |
| 참조 데이터 | [MDL-302](../datas/model_api.md) 조회 응답, [MDL-401](../datas/model_common.md) 감사 로그 |
| 관련 IA 항목 | 공통 |

### 시그니처

```
function FN-010_mask (
  value: string | null,   // 회원 키·자격·요청 키값 등 민감값
): string | null          // 앞2·뒤2 노출, 나머지 마스킹

function FN-010_selectStatusResponse (
  status: ProcessStatus,  // MDL-301 (도메인)
): ProcessStatusResponse  // MDL-302 (상태 4항목 + 요청 키값 에코, configId·회원 키 배제)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | value | string\|null | N | - | 마스킹 대상 민감값 |
| 입력 | status | MDL-301 | Y | - | 응답 선별 대상 상태 |
| 출력 | (masked) | string\|null | - | 앞2·뒤2만 | 마스킹 결과 |
| 출력 | ProcessStatusResponse | MDL-302 | - | 4항목만 | 회원 키·configId 미포함 |

### 처리 흐름 (의사코드)

```
마스킹 — mask, POL SEC-005-01·DATA-001-03 (mask)
1. if (value is null)                 → return null
2. if (len(value) <= 4)               → return repeat('*', len(value))   // 전면 마스킹
3. return value[0..2] + repeat('*', len(value)-4) + value[len-2..len]    // 앞2·뒤2 노출

응답 필드 선별 — selectStatusResponse, POL SEC-005-02 (mask)
1. return {
       requestKey:        status.requestKey,        // 조회 대상 에코
       isSuccess:         status.isSuccess,
       isResultConfirmed: status.isResultConfirmed,
       processedAt:       iso8601(status.processedAt),
       resultConfirmedAt: iso8601(status.resultConfirmedAt)   // null 허용
   }
   // configId·회원 키·개인정보 필드 미포함(SEC-005-02)
```

> 관리자 연동 구성 조회 응답의 서비스 A/B 주소는 설정 데이터로 마스킹 대상이 아니다(EXC-SEC-05). 마스킹은 민감값(회원 키·자격·요청 키값)에만 적용한다.

### API 인터페이스

해당 없음 — 응답 DTO 변환·로그 포맷터 계층의 공통 유틸리티다. FN-013(감사)·PROC-102·203·301 이 응답·로그 생성 시 호출한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| (없음) | - | 순수 변환(예외 없음) | - | 입력이 null 이어도 안전 반환 |

### 의존 기능

없음(leaf) — 순수 문자열·필드 변환만 수행한다.

### 구현 가이드

- 마스킹·필드 선별은 응답 DTO 변환·로그 포맷터 계층에서 일괄 적용한다. 조회 응답 DTO 에 회원 키·configId 필드를 두지 않는다(SEC-005-02).
- 회원 키 원문·인증 자격을 로그·감사·응답에 남기지 않는다. 마스킹 규칙(앞2·뒤2)은 기본안이며 로그 정책 세부는 build 확정이다.
</content>
