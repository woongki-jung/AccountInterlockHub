# 허브 복호화·연동 추적 키 추출 공통 기능 정의

## 개요

- **기능 목적**: 사용자 승인 후 허브가 사용자 생년월일로 발송처 이중 암호값(encX·encY)을 복호화해 전달 데이터 X 를 복원하고, X 내부 지정 필드에서 연동 추적 키를 추출·검증한다(SEC-006-04). 복호화는 연동 실행 시점 메모리에서만 수행하고 암호값·생년월일·복원 키·복호화 원문 X 를 저장·로깅하지 않는다(DATA-001-04·SEC-005-06). `#214` 로 신설된 복호화 규약의 단일 구현 함수다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 4 "연동 실행(허브 복호화·전달): 승인 시 허브가 생년월일로 encY→키→encX→X 복호화" · §시스템 제약사항(암호화·복호화 규약) / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §암호화 연동 규약 / 정책 SEC-006·SEC-002·AUTH-004·BIZ-004.
- **spec 확정 기본값**: AES-256-CBC + PKCS#7·키 32B/IV 16B `_`(0x5F) 우패딩 정규화·encY 평문=encX 키 문자열·Base64URL 은 오케스트레이터 spec 확정값이다([SEC-006](../policies/policy_SEC-crypto.md#sec-006-이중-암호화복호화-규약)). 정적 IV 파생·생년월일 저강도는 알려진 제약으로 수용한다(SEC-008).

---

## FN-020 허브 복호화·연동 추적 키 추출

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 허브 복호화·연동 추적 키 추출 |
| 분류 | POL |
| 사용 서비스 | SVC-005 |
| 호출 PROC | PROC-203 |
| 연관 정책 | [SEC-006](../policies/policy_SEC-crypto.md#sec-006-이중-암호화복호화-규약)(01·02·03·04·05·06), [SEC-002](../policies/policy_SEC.md#sec-002-발송처키전달-데이터-신뢰-위임)(04), [AUTH-004](../policies/policy_AUTH.md#auth-004-사용자-생년월일-본인확인-비인증-복호화-요소)(01·02·03), [BIZ-004-08](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정), [DATA-001-04](../policies/policy_DATA.md#data-001-무저장개인정보-최소화) |
| 참조 데이터 | [MDL-201](../datas/model_user.md) 접근 컨텍스트(encX·encY·생년월일 입력·무저장), [MDL-204](../datas/model_user.md) 복호화 원문 X(출력·무저장), [MDL-202](../datas/model_user.md) 연동 추적 키(출력) |
| 관련 IA 항목 | USR-02, 공통 |

### 시그니처

```
function FN-020_decryptInterlock (
  encX: string,            // MDL-201 이중 암호값 1 (Base64URL·불투명·무저장·미기록)
  encY: string,            // MDL-201 이중 암호값 2 (Base64URL·불투명·무저장·미기록)
  birthDate: string,       // MDL-201 생년월일 yyMMdd (복호화 요소·무저장·미기록, AUTH-004-01)
  accessAddressId: string, // 접근 주소 고유 ID (감사 target — 발송처 식별자, 비민감)
): DecryptResult           // { X: object(→MDL-204 payload), trackingKey: string(→MDL-202) } — 메모리 전용
  throws CryptoParamFormatError  { code: EX-SEC-007, http: 400 }   // 암호 파라미터 누락·Base64URL 형식 오류(발송처 오류·재입력 불가)
        | DecryptFailedError      { code: EX-SEC-006, http: 400 }   // 패딩·키 불일치=생년월일 오류(재입력 가능)
        | MissingTrackingKeyError { code: EX-BIZ-008, http: 400 }   // X 파싱 실패·추적 키 필드 누락·공백(발송처 오류·재입력 불가)
  // CryptoParamFormatError 는 encX·encY 부재(필드 완전 누락)·빈값·형식오류를 모두 포괄한다(#238) — 승인 DTO 는 부재를 EX-SEC-004 로 선차단하지 않고 본 FN 에 위임
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | encX | string | Y | 부재·빈값·Base64URL 형식오류 → EX-SEC-007(SEC-006-05, #238), 로그·저장 미기록 | 이중 암호값 1(발송처 생성, X 암호문) |
| 입력 | encY | string | Y | 부재·빈값·Base64URL 형식오류 → EX-SEC-007(SEC-006-05, #238), 로그·저장 미기록 | 이중 암호값 2(encX 키 문자열 암호문) |
| 입력 | birthDate | string(yyMMdd) | Y | 승인 시점 수신, 로그·저장 미기록 | 복호화 요소(인증·세션 미발급, AUTH-004-01) |
| 입력 | accessAddressId | string | Y | NotBlank | 감사 대상(발송처 식별자, 비민감) |
| 출력 | X | object(MDL-204 payload) | - | 무변형·무저장·미기록 | 복호화 원문(수신처 전달 페이로드) |
| 출력 | trackingKey | string(MDL-202) | - | NotBlank, MaxLength(255) | X 내부 지정 필드값(불투명·무해석) |

### 처리 흐름 (의사코드)

```
// 공통 정규화 — SEC-006-02 (transform, 결정론적)
normalize32(str):  b = utf8Bytes(str); return len(b) >= 32 ? b[0:32] : b + repeat(0x5F, 32-len(b))   // AES-256 키
iv16(str):         b = utf8Bytes(str); return len(b) >= 16 ? b[0:16] : b + repeat(0x5F, 16-len(b))   // CBC IV
// 0x5F = '_' 우측 패딩. 초과분은 앞에서부터 절단(앞 32B/앞 16B). 정규화 전 원문이 encY 평문·키 문자열 원천.

FN-020_decryptInterlock(encX, encY, birthDate, accessAddressId):

1. 암호 파라미터 부재·형식 검증 — SEC-006-05 (validate)
   if (absent(encX) OR absent(encY) OR blank(encX) OR blank(encY))  → throw CryptoParamFormatError (400, EX-SEC-007)
   // 부재(필드 완전 누락)·빈값·공백을 형식오류와 동일 취급 — 승인 DTO 는 부재를 EX-SEC-004 로 선차단하지 않고 본 단계에 위임(#238)
   try { rawY = base64urlDecode(encY); rawX = base64urlDecode(encX) }
   catch (형식 오류)                                     → throw CryptoParamFormatError (400, EX-SEC-007)
   // Base64URL 디코드 실패 = 발송처 링크 구성 오류(재입력 불가)

2. encY 복호화 → encX 키 문자열 복원 — SEC-006-02/04 (transform, 메모리)
   keyY = normalize32(birthDate);  ivY = iv16(birthDate)
   try { keyXstr = AES-256-CBC-decrypt(rawY, key=keyY, iv=ivY, pad=PKCS7) }   // keyXstr = "발송처키+생년월일" 원문
   catch (패딩 오류·키 불일치)                            → goto FAIL_DECRYPT   // 잘못된 생년월일

3. encX 복호화 → 전달 데이터 X(JSON 문자열) — SEC-006-02/04 (transform, 메모리)
   keyX = normalize32(keyXstr);  ivX = iv16(keyXstr)
   try { Xjson = AES-256-CBC-decrypt(rawX, key=keyX, iv=ivX, pad=PKCS7) }
   catch (패딩 오류·키 불일치)                            → goto FAIL_DECRYPT   // 잘못된 생년월일

4. X 파싱·연동 추적 키 추출·검증 — BIZ-004-08·DATA-002-05 (validate)
   try { X = JSON.parse(Xjson) }
   catch (파싱·형식 오류)                                → goto FAIL_SENDER_DATA   // 복호화는 됐으나 X 가 유효 JSON 아님(발송처 데이터 오류)
   trackingKey = X["trackingKey"]                       // 규약 고정 필드명 trackingKey (external-apis §암호화 연동 규약)
   if (trackingKey is null OR blank(trackingKey))       → goto FAIL_SENDER_DATA   // 추적 키 필드 누락·공백

5. 성공 감사 — AUTH-004-03·OPS-002-04·SEC-008-01 (audit, 원문 미기록)
   FN-013_writeAudit({ eventType:'DECRYPT_SUCCESS', actorType:'SYSTEM',
                       target: accessAddressId, result:'SUCCESS',
                       detail: 'trackingKey=' + FN-010_mask(trackingKey) })   // 암호값·생년월일·원문 미기록(SEC-005-06)

6. 반환(메모리 전용)
   return { X, trackingKey }   // 호출 PROC-203 이 이력 생성(FN-016)→전달(FN-012)로 진행. 반환 후 encX·encY·birthDate·keyXstr 참조 즉시 해제

FAIL_DECRYPT: — SEC-006-05·AUTH-004-02 (validate)
   FN-013_writeAudit({ eventType:'DECRYPT_FAIL', actorType:'SYSTEM',
                       target: accessAddressId, result:'FAIL' })   // 원문·생년월일 미기록
   → throw DecryptFailedError (400, EX-SEC-006)   // 생년월일 재입력 재시도 유도(하드 잠금 없음)

FAIL_SENDER_DATA: — BIZ-004-08·EXC-BIZ-13 (validate)
   FN-013_writeAudit({ eventType:'DECRYPT_SENDER_DATA_ERR', actorType:'SYSTEM',
                       target: accessAddressId, result:'FAIL' })
   → throw MissingTrackingKeyError (400, EX-BIZ-008)   // 발송처 데이터 오류(재입력 불가)
```

> encX·encY·birthDate·keyXstr·복호화 원문 X 는 **어떤 저장소·로그·감사·응답에도 남기지 않는다**(DATA-001-04·SEC-005-06). 감사에는 접근 주소 고유 ID·복호화 성공 여부·연동 추적 키(마스킹)만 남긴다(OPS-002-05·SEC-008-01 이상 징후 관측). 복호화 실패(EX-SEC-006, 생년월일 정정 가능)와 발송처 데이터 오류(EX-BIZ-008·X 파싱 실패·추적 키 누락, 재입력 불가)는 사용자 재시도 가능 여부가 달라 구분해 처리한다(EXC-BIZ-13). 키·IV 정규화와 encY→encX→X 복호화 순서는 검증 도구가 재현할 수 있도록 결정론적으로 구현한다(라이브러리 강제 없음).

> **EX 코드 정합(개정 노트)**: 오케스트레이터 복호화 의사코드는 X JSON 파싱 실패를 EX-SEC-007 로 표기했으나, 본 사양은 EX 재정의 금지 원칙에 따라 EX-SEC-007 의 정책 정의 의미(암호 파라미터 encX·encY 누락·Base64URL 형식 오류 — SEC-006-05)를 유지하고, **복호화된 X 의 파싱 실패·추적 키 필드 누락은 발송처 데이터 오류 EX-BIZ-008 로 귀속**한다(선행 SVC-005 F-003·BIZ-003-08·EXC-BIZ-13 정합). 바이트 수준 복호화 절차(정규화·복호화 순서·PKCS#7)는 의사코드 그대로다.

### API 인터페이스

해당 없음 — 연동 실행(PROC-203) 내부에서 호출되는 복호화 단위 로직으로 독립 엔드포인트가 없다. 승인·복호화 진입점은 SVC-005 의 승인 처리 엔드포인트(POST — 접근 주소 고유 ID·encX·encY·생년월일 수신)가 담당하며, 복호화 원문 X 는 서버-서버로만 전달되고 브라우저를 경유하지 않는다(SEC-007-01).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | EX-SEC-007 | 암호 파라미터(encX·encY) 부재(필드 완전 누락)·빈값·Base64URL 형식 오류 | "요청이 올바르지 않습니다." | SEC-006-05, 발송처 링크 오류(재입력 불가). 부재도 형식오류와 동일 취급(#238) — 승인 DTO 선차단 없음 |
| 400 | EX-SEC-006 | 복호화 실패(생년월일 불일치·패딩·키 불일치) | "사용자 정보가 일치하지 않습니다." | AUTH-004-02, 생년월일 재입력 재시도(하드 잠금 없음) |
| 400 | EX-BIZ-008 | 복호화된 X 파싱 실패·연동 추적 키 필드 누락·공백 | "연동에 필요한 값이 없습니다." | BIZ-004-08·EXC-BIZ-13, 발송처 데이터 오류(재입력 불가) |
| 500 | EX-FN-999 | 정규화·복호화 라이브러리 오류(암호 파라미터 무관) | "잠시 후 다시 시도해주세요." | 원문·생년월일 미기록, 감사 로그 필수 |

- 복호화 실패(EX-SEC-006)만 사용자 정정(생년월일 재입력) 대상이다 — 재시도는 동일 접근 주소·암호값에 생년월일만 다시 받아 본 FN 을 재호출한다(암호값 재수신 불요, AUTH-004 구현 가이드). 반복 재시도 남용은 요청 제한(FN-014, OPS-001)이 1차 억제한다(EXC-OPS-04, 본인확인 잠금 아님).

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-010 | 성공 감사 마스킹(단계 5) | 동기 | trackingKey 앞2·뒤2 마스킹(원문 배제) |
| FN-013 | 성공·실패 감사(단계 5·FAIL) | 동기 | 감사 실패는 복호화 결정에 영향 없음(암호값·생년월일·원문 미기록) |

### 구현 가이드

- 복호화 함수의 입력은 encX·encY·생년월일뿐이며 출력 X 는 수신처 전달 페이로드(FN-012)로만 사용하고 저장하지 않는다(DATA-001-04·SEC-002·SEC-007). 키 32B·IV 16B 정규화(`_` 우패딩·초과 절단)와 encY→encX→X 복호화 순서를 결정론적으로 구현한다(SEC-006-02/04). 발송처키는 encY 로부터 생년월일로 일시 복원할 뿐 저장·검증하지 않는다(SEC-002-04).
- 연동 추적 키 필드명은 발송처↔허브 암호화 연동 규약이 고정한 `trackingKey` 다 — X 내부 지정 필드는 `X["trackingKey"]` 로 추출한다([`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §암호화 연동 규약). 추적 키는 불투명 문자열로 해석·변형·복호화·해시하지 않고 원문 그대로 상위(FN-016·FN-012)에 넘긴다(DATA-002-06).
- 정적 IV 파생(IV 를 키 문자열에서 결정론적으로 유도) + 생년월일 저강도의 오프라인 전수대입 취약은 알려진 제약으로 초기 범위에서 수용한다(SEC-008-01·EXC-SEC-06). 링크 TTL·1회성·발송처 서명 검증은 후속 보완 항목이다(SEC-008-02).
