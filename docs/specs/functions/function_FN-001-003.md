# 암호 규약 기본 기능 정의 (FN-001 ~ FN-003)

정본 목록은 [`spec-functions.md`](spec-functions.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **기능 목적**: 암호화 연동 규약(`SEC-001`)을 코드로 옮긴 가장 작은 조각 셋이다 — **키 정규화**, **전달 인코딩**, **암호값 구조 판정**. 연동 라이브러리(암호화)와 허브(복호화)가 같은 입력에서 같은 결과를 내야 하므로, 이 셋은 두 구현이 글자 그대로 같은 규칙을 따른다.
- **관련 PRD 요구사항**:
	- [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 2 — "전달 데이터 X(JSON) → `encX`·`encY` 이중 암호화 규약을 정의한다. 이 규약은 **연동 라이브러리(암호화)와 허브(복호화)가 공유하는 단일 계약**이다."
	- [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §암호화 연동 규약 — "IV는 암호화 키값을 첫 자리부터 필요한 만큼 잘라 쓰고, 권장 길이보다 짧으면 나머지를 `_`로 채운다."

---

## FN-001 키 32바이트 정규화·초기화 벡터 도출

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 키 32바이트 정규화·초기화 벡터 도출 |
| 분류 | POL |
| 사용 서비스 | SVC-002 · SVC-004 · SVC-006 · SVC-013 |
| 호출 PROC | PROC-102 · PROC-104 · PROC-204 · PROC-401 |
| 연관 정책 | `SEC-001-02` · `SEC-001-03` · `SEC-001-04` · `SEC-001-05` · `SEC-001-06` |
| 참조 데이터 | 없음 (원시 문자열·바이트열만 다룬다) |
| 관련 IA 항목 | 공통 |

### 시그니처

```
function FN-001 (
  keySource: string,        // 키 원문. 이어 붙이기를 마친 값(POL SEC-001-05)·필수·빈 문자열 허용
): NormalizedKey            // { key: bytes(32), iv: bytes(16) }
  throws 없음               // 어떤 입력이든 32바이트로 정규화된다
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | keySource | string | Y | 이어 붙이기를 **마친** 값이어야 한다 | `encX` 키는 발송처키+생년월일, `encY` 키는 생년월일 6자 |
| 출력 | key | bytes | - | 정확히 32바이트 | 대칭 암호 키 |
| 출력 | iv | bytes | - | 정확히 16바이트 | 초기화 벡터 |

### 처리 흐름 (의사코드)

```
1. 인코딩 변환 — POL SEC-001-02 (transform)
   raw = UTF8_BYTES(keySource)

2. 길이 정규화 — POL SEC-001-03 (transform)
   if (LENGTH(raw) > 32)   key = raw[0 .. 31]
   else                    key = raw + REPEAT(0x5F, 32 - LENGTH(raw))

3. 초기화 벡터 도출 — POL SEC-001-04 (transform)
   iv = key[0 .. 15]

4. 반환
   return { key, iv }
```

### API 인터페이스

해당 없음 — 외부에 노출되지 않는 내부 계산 기능이다. 라이브러리도 이 기능을 공개 진입점으로 내보내지 않는다([`spec-functions-lib.md`](spec-functions-lib.md) §공개 표면 최소화).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| — | — | 없음 | — | 본 기능은 예외를 던지지 않는다. 어떤 길이의 입력도 절단·패딩으로 32바이트가 된다 |

### 의존 기능

없음 (가장 하위 기능).

### 구현 가이드

- **이어 붙이기 → 정규화 순서를 지킨다**(`SEC-001-05`). 발송처키와 생년월일을 각각 정규화한 뒤 이어 붙이면 다른 키가 나온다.
- 절단(`> 32`)과 패딩(`< 32`)을 같은 함수 안에서 처리해, 두 구현이 경계값에서 갈리지 않게 한다. 정확히 32바이트인 입력은 그대로 통과한다.
- 반환값은 불변으로 두고 호출측이 바꿀 수 없게 한다. 같은 배열을 키와 초기화 벡터가 공유하면 한쪽 변경이 다른 쪽을 오염시킨다.
- **반환값을 로그·예외 메시지·응답 어디에도 담지 않는다**(`DATA-001-04`). 정규화 키가 노출되면 `encX` 가 그대로 복호화된다.

---

## FN-002 Base64URL 인코딩·디코딩

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | Base64URL 인코딩·디코딩 |
| 분류 | DAT |
| 사용 서비스 | SVC-001 · SVC-002 · SVC-004 · SVC-006 · SVC-013 |
| 호출 PROC | PROC-101 · PROC-102 · PROC-104 · PROC-204 · PROC-401 |
| 연관 정책 | `SEC-001-08` |
| 참조 데이터 | [`MDL-004`](../datas/model_MDL-004-006.md) (암호값 쌍의 문자열 표현) |
| 관련 IA 항목 | 공통 |

### 시그니처

```
function FN-002.encode (
  raw: bytes,               // 인코딩할 바이트열·필수
): string                   // Base64URL 문자열(패딩 `=` 없음)
  throws 없음

function FN-002.decode (
  text: string,             // Base64URL 문자열·필수
): bytes
  throws ProtocolFormatError { code: EX-SEC-001, http: 400 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | raw | bytes | Y | 길이 제한 없음 | encode 입력 |
| 출력 | (encode) | string | - | `A-Z a-z 0-9 - _` 만 사용·패딩 없음 | RFC 4648 §5 |
| 입력 | text | string | Y | 위와 같은 문자 집합 | decode 입력 |
| 출력 | (decode) | bytes | - | - | 디코딩 결과 |

### 처리 흐름 (의사코드)

```
[encode]
1. 표준 Base64 인코딩
   std = BASE64_ENCODE(raw)

2. 알파벳 치환·패딩 제거 — POL SEC-001-08 (transform)
   text = REPLACE(REPLACE(std, '+', '-'), '/', '_')
   text = TRIM_TRAILING(text, '=')

3. 반환 (퍼센트 인코딩을 겹쳐 적용하지 않는다)
   return text

[decode]
1. 문자 집합 검사 — POL SEC-001-08 (validate)
   if (text == null OR text == "")                → throw EX-SEC-001 (400)
   if (!MATCH(text, "^[A-Za-z0-9_-]+$"))          → throw EX-SEC-001 (400)

2. 길이 판정
   rest = LENGTH(text) MOD 4
   if (rest == 1)                                 → throw EX-SEC-001 (400)

3. 패딩 복원·알파벳 역치환 (transform)
   padded = text + REPEAT('=', (4 - rest) MOD 4)
   std    = REPLACE(REPLACE(padded, '-', '+'), '_', '/')

4. 디코드
   try  raw = BASE64_DECODE(std)
   catch                                          → throw EX-SEC-001 (400)

5. 반환
   return raw
```

### API 인터페이스

해당 없음 — 내부 변환 기능이다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | `EX-SEC-001` | 빈 값·Base64URL 문자 집합 밖의 문자·해석 불가능한 길이·디코드 실패 | "연동 링크가 올바르지 않습니다." | `SEC-002-02` 구조 위반. 입력 문자열을 응답·로그에 담지 않는다(`DATA-001-04`) |

### 의존 기능

없음.

### 구현 가이드

- **퍼센트 인코딩을 겹쳐 적용하지 않는다.** Base64URL 결과는 이미 URL 에 그대로 실을 수 있다. 이중 인코딩은 진입 단계 디코드 실패의 대표 원인이다(`SEC-001-08`).
- 디코드는 **관대하게 받지 않는다** — 표준 Base64 의 `+`·`/`·`=` 가 섞여 오면 문자 집합 검사에서 걸러 낸다. 관대하게 받으면 규약을 어긴 발송처 구현이 통합 시점에 드러나지 않는다.
- 라이브러리(암호화)는 encode 만, 허브(복호화·자가진단)는 decode 만 쓴다. 두 구현이 같은 알파벳·패딩 규칙을 쓰는지는 규약 테스트 벡터의 치환 문자 사례로 확인한다([`spec-functions-lib.md`](spec-functions-lib.md) §규약 테스트 벡터).

---

## FN-003 암호값 구조 판정

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 암호값 구조 판정 |
| 분류 | POL |
| 사용 서비스 | SVC-001 · SVC-002 · SVC-004 · SVC-013 |
| 호출 PROC | PROC-101 · PROC-102 · PROC-104 · PROC-204 |
| 연관 정책 | `SEC-002-02` · `SEC-001-08` · `SEC-001-01` |
| 참조 데이터 | [`MDL-004`](../datas/model_MDL-004-006.md) |
| 관련 IA 항목 | `USR-01` · `API-04` |

### 시그니처

```
function FN-003 (
  encPair: MDL-004,         // 암호값 쌍(Base64URL 문자열)·필수
): CipherBytes              // { x: bytes, y: bytes } — 디코딩된 암호문
  throws ProtocolFormatError { code: EX-SEC-001, http: 400 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | encPair.encX | string | Y | 비어 있지 않음·Base64URL·디코드 길이가 16의 배수 | 전달 데이터 암호문 |
| 입력 | encPair.encY | string | Y | 위와 같다 | 키 암호문 |
| 출력 | x | bytes | - | 16의 배수·0바이트 아님 | 디코딩된 `encX` |
| 출력 | y | bytes | - | 16의 배수·0바이트 아님 | 디코딩된 `encY` |

### 처리 흐름 (의사코드)

```
1. 존재·빈 값 검사 — POL SEC-002-02 (validate)
   if (encPair == null)                                   → throw EX-SEC-001 (400)
   if (encPair.encX == null OR TRIM(encPair.encX) == "")  → throw EX-SEC-001 (400)
   if (encPair.encY == null OR TRIM(encPair.encY) == "")  → throw EX-SEC-001 (400)

2. 전달 인코딩 해석 — FN-002.decode (transform)
   x = FN-002.decode(encPair.encX)      // 실패 시 EX-SEC-001 그대로 전파
   y = FN-002.decode(encPair.encY)

3. 블록 길이 검사 — POL SEC-002-02 · SEC-001-01 (validate)
   if (LENGTH(x) == 0 OR LENGTH(x) MOD 16 != 0)           → throw EX-SEC-001 (400)
   if (LENGTH(y) == 0 OR LENGTH(y) MOD 16 != 0)           → throw EX-SEC-001 (400)

4. 반환 (복호화를 시도하지 않는다 — 생년월일이 필요 없는 판정만 수행)
   return { x, y }
```

### API 인터페이스

해당 없음 — `USR-01` 진입 접점과 `API-04` 자가진단 접점이 이 기능의 판정 결과를 소비한다([`spec-functions-api-user.md`](spec-functions-api-user.md) §연동 요청 진입 · [`spec-functions-api-server.md`](spec-functions-api-server.md) §연동 규약 자가진단 API).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | `EX-SEC-001` | 암호 파라미터 부재·빈 값·Base64URL 디코드 실패·암호문 길이가 16의 배수 아님 | "연동 링크가 올바르지 않습니다." | `SEC-002-02`. 진입에서는 추적 레코드를 만들지 않고 지표에만 계수한다(`BIZ-002-02`·`BIZ-005-02` ②) |

- **연동 요청 URL 전체 길이 상한**(`SEC-001-10` → `EX-SEC-004`)은 본 기능이 판정하지 않는다. 원본 URL 은 진입 접점만 갖고 있으므로 `PROC-101` 이 진입 시점에 판정한다.

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-002 | 단계 2 | 동기 | `EX-SEC-001` 그대로 전파 |

### 구현 가이드

- **길이 배수 검사는 디코드 직후에 한다.** 복호화를 시도하기 전에 걸러 낼 수 있는 가장 값싼 검사다(`SEC-002` 구현 가이드).
- `encX`·`encY` 는 **항상 쌍으로** 판정한다. 하나만 통과해도 복호화 판정이 성립하지 않는다.
- 본 기능은 **생년월일을 받지 않는다.** 생년월일 없이 판정 가능한 위반만 다루기 때문이며, 이 경계가 "링크가 잘못됐다"(`EX-SEC-001`)와 "본인확인이 안 됐다"(`EX-AUTH-002`)를 가른다.
- 실패 응답에 입력 문자열·길이·디코드 중간 값을 담지 않는다(`SEC-002-05`).
