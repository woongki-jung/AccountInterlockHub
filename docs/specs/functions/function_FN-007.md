# 요청 키값 발급·검증 공통 기능 정의

## 개요

- **기능 목적**: 서비스 A 진입 시 회원 키와 수학적 연관이 없는 불투명 UUID v4 요청 키값을 자체 발급하고, 진입 컨텍스트(구성 참조·회원 키·파라미터)를 비영속 메모리에만 연결한다. 처리상태 조회 시에는 요청 키값의 UUID 형식을 검증한다. 회원 키를 요청 키값으로 쓰지 않는다(역추적 불가).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §데이터 원칙(무저장·요청 키값) / 정책 DATA-002·DATA-001.
- **담당자 확정 대기 (Q2·신규 해석)**: 요청 키값 = 허브 발급 UUID v4. 진입 컨텍스트 일시 저장 수단·TTL 은 build 확정(무저장 정합).

---

## FN-007 요청 키값 발급·검증

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 요청 키값 발급·검증 |
| 분류 | POL |
| 사용 서비스 | SVC-004, SVC-006 |
| 호출 PROC | PROC-201(발급), PROC-301(검증) |
| 연관 정책 | [DATA-002](../policies/policy_DATA.md#data-002-요청-키값-발급불투명성)(01·02·03·04), [DATA-001-01](../policies/policy_DATA.md#data-001-회원-키-무저장개인정보-최소화) |
| 참조 데이터 | [MDL-202](../datas/model_user.md) 요청 키값, [MDL-201](../datas/model_user.md) 진입 요청(메모리 경유) |
| 관련 IA 항목 | USR-01, API-01 |

### 시그니처

```
function FN-007_issueRequestKey (
  entry: EntryRequest,    // MDL-201 (configCode·memberKey·parameters, 메모리 경유)
): RequestKey             // MDL-202 (UUID v4)

function FN-007_validateRequestKeyFormat (
  raw: string,            // 조회 요청의 요청 키값
): RequestKey             // 형식 검증된 요청 키값
  throws InvalidKeyFormatError { code: EX-DATA-002, http: 400 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | entry | MDL-201 | Y | FN-005 통과 | 진입 요청(회원 키 포함, 무저장) |
| 입력 | raw | string | Y | 조회 시 | 검증 대상 요청 키값 |
| 출력 | RequestKey | MDL-202 | - | UUID v4 | 발급·검증된 불투명 키 |

### 처리 흐름 (의사코드)

```
발급 — issueRequestKey, POL DATA-002-01/02/03 (transform)
1. requestKey = uuidV4()                     // 표준 라이브러리, 예측 불가
   assert(requestKey ≠ derivedFrom(entry.memberKey))  // 역추적 불가(DATA-002-02)
2. 진입 컨텍스트 일시 연결 — DATA-001-01 (무저장)
   entryContextStore.put(requestKey, {
       configCode: entry.configCode,
       memberKey: entry.memberKey,          // 메모리 전용, 어떤 ENT 에도 미저장
       parameters: entry.parameters
   }, ttl)                                    // 비영속(세션/캐시, build 확정)
3. return requestKey                          // 진입 응답으로 서비스 A 반환(DATA-002-03)

검증 — validateRequestKeyFormat, POL DATA-002-04 (validate)
1. if (!isUuidV4(raw))                         → throw InvalidKeyFormatError (400, EX-DATA-002)
2. return raw as RequestKey                    // 미존재(404)는 FN-009 상태 조회에서 판정(EXC-DATA-02)
```

> 진입 컨텍스트는 처리 완료(FN-012 전달·FN-009 상태 저장)까지만 메모리에서 유지하고 이후 폐기한다. 회원 키는 어떤 테이블·로그에도 원문 저장하지 않는다(로그 노출 시 FN-010 마스킹).

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | GET /interlock/entry (발급) · GET/POST /api/consent/:requestKey (컨텍스트 조회) |
| HTTP 메서드 | GET(발급·컨텍스트 조회) |
| 인증 요구 | Public(서비스 A 진입) — 요청 제한(FN-014)·입력 검증(FN-005) 선적용 |
| 요청 DTO | MDL-201(진입 요청) |
| 응답 DTO (200) | MDL-202(요청 키값) — 진입 응답으로 서비스 A 반환 |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-DATA-002(조회 시) |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | EX-DATA-002 | 요청 키값 UUID 형식 불일치 | "요청 키값 형식이 올바르지 않습니다." | DATA-002-04(조회 진입) |
| 500 | EX-FN-999 | UUID 생성·컨텍스트 저장 오류 | "잠시 후 다시 시도해주세요." | - |

- 형식은 맞으나 미존재(만료 삭제 포함)는 본 FN 이 아닌 FN-009 상태 조회에서 404 EX-DATA-003 으로 판정한다(EXC-DATA-02).

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-005 | 발급 전(진입 검증) | 동기 | 형식·크기·주입 선검증 |
| FN-013 | 발급 감사(내부 차단 기록) | 동기 | 감사 실패는 발급에 영향 없음 |

### 구현 가이드

- UUID 는 표준 라이브러리로 v4 생성하고 예측 가능한 시퀀스·타임스탬프 노출식 식별자를 쓰지 않는다. 요청 키값은 진입 응답 반환 후 조회 키로만 사용한다.
- 진입 컨텍스트 저장 수단(단일 인메모리/공유 캐시)·TTL 은 build 단계에서 확정한다. 무저장 원칙상 DB 영속화는 금지한다.
</content>
