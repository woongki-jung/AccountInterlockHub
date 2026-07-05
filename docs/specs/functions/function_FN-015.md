# 공통 응답·에러 엔벨로프 공통 기능 정의

## 개요

- **기능 목적**: 전 API 의 성공·실패 응답을 통일된 엔벨로프로 구성하는 공통 기능이다. 성공은 `data`, 실패는 `error{code·message·details}` 구조로 감싸 프런트엔드·서비스 A 가 일관된 형식으로 응답을 처리하게 한다. EX 코드 체계·사용자 메시지 매핑의 단일 진입점이다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §제공 가치(처리 추적·투명성) — 일관된 API 응답 계약.

---

## FN-015 공통 응답·에러 엔벨로프

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 공통 응답·에러 엔벨로프 |
| 분류 | CRS |
| 사용 서비스 | 전 SVC(API 노출 전체) |
| 호출 PROC | 전 API PROC(PROC-101·102·103·201·202·301) |
| 연관 정책 | (공통 규칙) — EX 코드는 각 정책·서비스 정의서 인용 |
| 참조 데이터 | 전 응답 DTO(MDL-101·102·202·302 등), EX 코드 카탈로그([spec-functions.md](spec-functions.md)) |
| 관련 IA 항목 | 공통 |

### 시그니처

```
function FN-015_ok<T> (
  data: T,                // 응답 DTO(MDL)
): SuccessEnvelope<T>     // { success: true, data }

function FN-015_fail (
  code: string,           // EX-<도메인>-<순번>
  httpStatus: number,     // 4xx/5xx
  details?: FieldError[], // 필드별 오류(검증 실패 시)
): ErrorEnvelope          // { success: false, error: { code, message, details } }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | data | T(MDL) | Y | - | 성공 응답 페이로드 |
| 입력 | code | string | Y | EX-* 형식 | 에러 식별자 |
| 입력 | httpStatus | number | Y | 4xx/5xx | HTTP 상태 |
| 입력 | details | FieldError[] | N | - | 필드별 오류 배열 |
| 출력 | SuccessEnvelope | 구조 | - | { success, data } | 성공 엔벨로프 |
| 출력 | ErrorEnvelope | 구조 | - | { success, error } | 실패 엔벨로프 |

### 처리 흐름 (의사코드)

```
성공 — ok
1. return { success: true, data }

실패 — fail
1. message = EX_MESSAGE_MAP[code]              // EX 코드 → 사용자 메시지(정책·서비스 정의 인용)
   if (message is null) message = EX_MESSAGE_MAP['EX-FN-999']   // 미매핑은 일반 오류
2. body = { success: false,
            error: { code, message, details: details ?? null } }
3. setHttpStatus(httpStatus)
4. return body                                  // 자격·회원 키·스택트레이스 미포함
```

> EX 코드 → 사용자 메시지 매핑은 [spec-functions.md §에러(EX) 코드 카탈로그](spec-functions.md)의 코드 체계를 단일 출처로 삼는다. 신규 시스템 오류는 EX-FN-999(500)로 통일한다.

### API 인터페이스

해당 없음 — 전 API 응답 직렬화 계층(예외 필터·인터셉터)의 공통 유틸리티다. 각 PROC 의 "응답 반환" 단계에서 호출된다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | EX-FN-999 | 미분류 시스템 오류(전 FN 공통 폴백) | "잠시 후 다시 시도해주세요." | 스택트레이스·내부 정보 응답 배제 |

- 본 FN 은 예외를 throw 하지 않고 모든 EX 를 엔벨로프로 직렬화한다. EX-FN-999 는 미매핑·미분류 오류의 공통 종착 코드다.

### 의존 기능

없음(leaf) — 순수 응답 구성만 수행한다. 민감값이 포함될 수 있는 details 는 호출부에서 FN-010 마스킹을 거친 값만 전달한다.

### 구현 가이드

- 성공/실패 엔벨로프를 NestJS 인터셉터·예외 필터 계층에서 일괄 적용해 각 핸들러가 도메인 DTO 만 반환하도록 한다. 에러 응답에 스택트레이스·내부 경로·자격 값을 노출하지 않는다.
- API 버전 프리픽스(`/api/v1`)는 MVP 미도입이며 도입 시 본 엔벨로프와 함께 build 에서 확정한다. 페이지네이션·정렬·필터 파라미터 규약은 목록 API(MDL-102) 확정 시 본 규칙에 편입한다.
</content>
