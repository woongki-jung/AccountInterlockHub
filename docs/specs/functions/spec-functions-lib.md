# 연동 라이브러리 공개 계약

정본 목록은 [`spec-functions.md`](spec-functions.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

본 문서는 발송처에 파일로 전달하는 연동 라이브러리의 **공개 API·오류 처리·배포 패키지·규약 테스트 벡터**를 확정한다(`LIB-01`~`LIB-04`). 소스 경로·산출물명·대상 런타임은 [`../../../CLAUDE.env.md`](../../../CLAUDE.env.md) §연동 라이브러리 식별자가 단일 출처이며 본 사양은 값을 복제하지 않는다(`OPS-001-04`).

## 형태·공개 표면

- **형태** — `<LIB_TARGET_FRAMEWORK>` 를 대상으로 하는 클래스 라이브러리. 발송처의 C# 프로젝트가 참조해 함수를 호출한다.
- **의존 런타임** — 대상 런타임 외의 구성요소를 추가로 요구하지 않는다([`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §1 비기능 요구). 그래서 **JSON 직렬화기를 쓰지 않는다** — 전달 데이터는 이미 직렬화된 문자열로 받는다.
- **네임스페이스** — 산출물(`<LIB_BIN>`)의 어셈블리 이름과 같게 둔다. 값은 상수표가 정본이다.
- **공개 표면은 아래 넷뿐이다.** 내부 정규화·인코딩 도구(FN-001·FN-002 에 해당하는 로직)를 공개하지 않는다(`SVC-006` 예외 사항).

| 공개 타입 | 종류 | 역할 |
|---|---|---|
| `InterlockRequestBuilder` | 정적 클래스 | 공개 진입점 2개 + 규약 버전 상수 |
| `EncryptedPair` | 불변 클래스 | 암호값 쌍([`MDL-004`](../datas/model_MDL-004-006.md)) |
| `InterlockProtocolException` | 예외 | 규약 위반. 사유 코드를 갖는다 |
| `ProtocolVersion` | 공개 상수(`InterlockRequestBuilder` 멤버) | 라이브러리가 구현한 규약 버전 문자열 |

## 공개 API 시그니처 (확정)

```
public static class InterlockRequestBuilder
{
    // 규약 버전 문자열. 값은 정책 SEC-001 §규약 확정값의 규약 버전을 따른다.
    public const string ProtocolVersion;

    // LIB-01 데이터 암호화 — 입력 MDL-016 · 출력 MDL-004
    public static EncryptedPair Encrypt(
        string payloadJson,   // 전달 데이터 X 의 JSON 문자열. 발송처가 직렬화해 넘긴다
        string senderKey,     // 발송처키. 라이브러리에 내장하지 않는다
        string birthDate);    // 사용자 생년월일 `yyMMdd` 6자리

    // LIB-02 연동 요청 URL 생성 — 입력 MDL-017 · 출력 MDL-018
    public static string BuildRequestUrl(
        string hubBaseUrl,    // 환경별 허브 기준 URL. 라이브러리에 내장하지 않는다
        EncryptedPair pair);
}

public sealed class EncryptedPair
{
    public string EncX { get; }   // Base64URL·패딩 없음
    public string EncY { get; }
}

public sealed class InterlockProtocolException : Exception
{
    public string ReasonCode { get; }   // 정책 예외 코드 카탈로그의 EX 코드 문자열
}
```

### `Encrypt` 처리 흐름 (의사코드)

```
1. 인자 검사 (호출 오류 — .NET 관용)
   if (payloadJson == null OR senderKey == null OR birthDate == null)  → throw ArgumentNullException
   if (TRIM(senderKey) == "")                                          → throw ArgumentException

2. 생년월일 형식 검증 — POL AUTH-002-02 (validate)
   if (!MATCH(birthDate, "^[0-9]{6}$"))     → throw InterlockProtocolException("EX-AUTH-001")

3. 전달 데이터 형태 검증 — POL SEC-002-01 ③ 의 사전 방어 (validate)
   trimmed = TRIM(payloadJson)
   if (trimmed 가 '{' 로 시작하지 않거나 '}' 로 끝나지 않는다)
                                            → throw InterlockProtocolException("EX-SEC-002")
   // JSON 을 파싱하지 않는다 — 추가 의존을 만들지 않기 위함이며, 필드 수준 적합성은 자가진단이 판정한다

4. 직렬화·크기 상한 검증 — POL SEC-001-02 · SEC-001-09 (validate)
   plain = UTF8_BYTES(payloadJson)
   if (LENGTH(plain) > 규약 평문 상한)        → throw InterlockProtocolException("EX-SEC-004")

5. 키 산출 — POL SEC-001-05 · SEC-001-06 · SEC-001-03 · SEC-001-04 (transform)
   keyX = 정규화(senderKey + birthDate)      // 이어 붙인 뒤 정규화한다
   keyY = 정규화(birthDate)

6. 암호화 — POL SEC-001-01 · SEC-001-07
   cipherX = AES256_CBC_PKCS7_ENCRYPT(plain,       keyX.key, keyX.iv)
   cipherY = AES256_CBC_PKCS7_ENCRYPT(keyX.key,    keyY.key, keyY.iv)
   // encY 의 평문은 encX 에 쓴 정규화된 32바이트 키 바이트열 그대로다

7. 전달 인코딩 — POL SEC-001-08
   return new EncryptedPair(Base64Url(cipherX), Base64Url(cipherY))
```

### `BuildRequestUrl` 처리 흐름 (의사코드)

```
1. 인자 검사
   if (hubBaseUrl == null OR pair == null)                    → throw ArgumentNullException
   if (hubBaseUrl 이 절대 URL 형태가 아니다)                    → throw ArgumentException

2. 기준 경로 결합 (끝 구분자 유무에 관계없이 같은 결과)
   baseUrl = TRIM_TRAILING(hubBaseUrl, '/')
   url     = baseUrl + <INTERLOCK_ENTRY_PATH>

3. 파라미터 결합 — 진입 파라미터 이름 확정값 (POL SEC-001-08)
   url = url + "?encX=" + pair.EncX + "&encY=" + pair.EncY
   // 이미 URL 에 실을 수 있는 형태이므로 퍼센트 인코딩을 겹쳐 적용하지 않는다

4. 길이 상한 판정 — POL SEC-001-10 (validate)
   if (LENGTH(url) > 규약 URL 길이 상한)      → throw InterlockProtocolException("EX-SEC-004")

5. 반환 (길이 판정을 통과한 값만 돌려준다)
   return url
```

- **진입 경로는 라이브러리 내부 상수로 갖는다.** 라이브러리는 허브의 배포 설정을 받을 수 없고, 진입 경로는 규약의 일부인 확정 상수다. 경로가 바뀌면 규약 버전을 올려 라이브러리와 허브를 함께 배포한다(`SEC-001-12`).
- **기준 URL·발송처키는 내장하지 않는다.** 환경마다·발송처마다 다른 값이므로 호출 인자로 받는다.
- **공개 진입점은 호출 간 상태를 공유하지 않는다**(스레드 안전). 정적 메서드이며 반환 타입은 불변이다.

## 오류 처리 (확정)

호출측이 **자기 입력 문제**와 **실행 환경 문제**를 구별할 수 있도록 세 층으로 나눈다(BR-020).

| 층 | 예외 타입 | 언제 | 호출측 대응 |
|---|---|---|---|
| 호출 오류 | `ArgumentNullException` · `ArgumentException` | 인자가 없거나 형태 자체가 성립하지 않는다(기준 URL 이 절대 URL 이 아님 등) | 호출 코드를 고친다 |
| **규약 위반** | `InterlockProtocolException` (`ReasonCode`) | 생년월일 형식·전달 데이터 형태·평문 크기 상한·URL 길이 상한 | 사유 코드로 원인을 좁힌다 |
| 런타임 오류 | 대상 런타임의 표준 예외를 **감싸지 않고 그대로 전파** | 암호 기능 초기화 실패 등 | 실행 환경을 점검한다 |

### 오류 사유 코드 (자가진단과 같은 값 체계)

| `ReasonCode` | 발생 조건 | 자가진단의 같은 코드 |
|---|---|---|
| `EX-AUTH-001` | 생년월일이 숫자 6자리가 아님 | 자가진단 요청 입력 검증 |
| `EX-SEC-002` | 전달 데이터가 JSON 객체 형태가 아님 | 판정 3·4단계 실패 |
| `EX-SEC-004` | X 평문 크기 상한 초과 · 연동 요청 URL 길이 상한 초과 | 크기 상한 위반 |

- **코드 값은 정책 예외 코드 카탈로그를 그대로 쓴다**([`../policies/spec-policies.md`](../policies/spec-policies.md) §예외(EX) 코드 카탈로그). 라이브러리 전용 코드 체계를 만들지 않는다 — 발송처가 라이브러리와 자가진단 두 경로에서 같은 진단을 얻게 하기 위함이다(`SVC-006` F-008 · `SVC-013` F-007).
- **예외 메시지에 발송처키·생년월일·전달 데이터·암호값·정규화 키를 담지 않는다**(`DATA-001-04`). 사유 코드와 어느 제약을 어겼는지 이상은 담지 않는다.

## 규약 버전 호환 판단 (확정)

1. 라이브러리는 규약 버전 문자열을 **공개 상수**(`ProtocolVersion`)로 노출한다.
2. 허브는 **자가진단 응답에 자기 규약 버전**을 담는다([`spec-functions-api-server.md`](spec-functions-api-server.md) §연동 규약 자가진단 API).
3. 발송처가 둘을 대조한다 — **MAJOR 가 다르면 비호환**(새 배포 패키지 수령·재배포 필요), **MINOR 차이는 호환**(그대로 사용)이다(BR-017·`SEC-001-11`).
4. **허브는 요청을 버전으로 거절하지 않는다.** 버전 값이 연동 요청에 실리지 않으므로 런타임 분기가 아니다.
5. 규약이 바뀌면 **라이브러리와 허브를 함께 배포**하고 테스트 벡터를 다시 만든다(`SEC-001-12`).

## 배포 패키지 (`LIB-03`)

동봉 범위는 **정확히 다섯**이다([`MDL-020`](../datas/model_MDL-019-022.md)). 여섯 번째 구성을 늘리지 않는다.

| 구성 | 내용 |
|---|---|
| 라이브러리 파일 | 산출물명은 상수표가 정본 |
| C# 호출 샘플 | 콘솔 형태. 발송처가 복사해 바로 실행할 수 있다. 검증 하네스와 같은 형태를 쓴다 |
| 사용 안내 | 아래 §사용 안내 구성 |
| 규약 테스트 벡터 | §규약 테스트 벡터 |
| 무결성 확인 수단 | `SHA256SUMS.txt` — 각 줄 `<소문자 16진수 64자>  <패키지 내 상대 경로>`. 표준 도구로 대조할 수 있는 형태다 |

- **어셈블리 서명을 채택하지 않았다** — 코드 서명 인증서의 조달·갱신이 필요해 이번 범위의 비용 균형에 맞지 않는다. 도입은 후속 보완 사안이다(`SVC-008` 예외 사항).
- 체크섬 파일과 구성 파일 목록은 **같은 절차에서 만들어** 항상 동기 상태를 유지한다.
- **자가진단 경로 값을 패키지 어디에도 담지 않는다**(`SEC-003-02`). 발송처에 경로를 알리는 수단은 배포 안내가 아닌 별도 비공개 전달이며 그 절차는 배포 절차가 정한다.

### 사용 안내 구성 (진입 게이트 🟡 G-04 해소)

사용 안내는 아래 여섯 절을 고정으로 갖는다.

1. **규약 버전 표기** — 이 패키지가 구현한 규약 버전과 호환 판단 방법(§규약 버전 호환 판단).
2. **공개 진입점** — 두 함수의 시그니처·인자 설명·반환값.
3. **오류 사유 코드 목록** — §오류 사유 코드 표.
4. **환경별 허브 기준 URL 기재란** — 아래 양식.
5. **무결성 확인 절차** — 체크섬 대조 방법.
6. **규약 적합성 확인 절차** — 테스트 벡터 대조와 자가진단 호출.

**기준 URL 기재란 양식** — 확정된 값을 발송처에 전달하는 경로다. 패키지를 만들 때 [`../../../CLAUDE.env.md`](../../../CLAUDE.env.md) §연동 구성 상수 — 발송처 호출 입력 값에서 **그 시점의 확정 값을 가져와 채운다.** 본 사양에는 값을 적지 않는다.

| 환경 | 허브 기준 URL | 확정 시점 |
|---|---|---|
| 운영 | (패키지 작성 시 `<HUB_BASE_URL_PROD>` 값을 채운다) | |
| 개발·로컬 | (패키지 작성 시 `<HUB_BASE_URL_DEV>` 값을 채운다) | |

- **기재란은 값을 문서에 박기 위한 자리가 아니다.** 값이 바뀌면 안내만 갱신하며 사양·코드는 개정하지 않는다.
- 규약 세부 값(알고리즘·정규화·인코딩)은 정책 문서를 참조하게 하고 안내에 복제하지 않는다.

## 규약 테스트 벡터 (`LIB-04`)

### 형식 (확정)

**JSON 파일 1개**로 둔다 — 사람이 읽고 기계가 파싱할 수 있어야 발송처의 자체 확인과 검증 절차가 같은 파일을 쓸 수 있다(`SVC-009` 구현 가이드). 패키지 안의 이름은 `protocol-test-vectors.json` 이다.

```
{ "protocolVersion": "<규약 버전>",
  "hubBaseUrl": "<벡터 전용 예시 기준 URL>",
  "cases": [
    { "caseId": "...", "boundaryNote": "...",
      "input":    { "senderKey": "...", "birthDate": "...", "payload": { ... } },
      "expected": { "encX": "...", "encY": "...", "requestUrl": "..." } } ] }
```

- `cases` 의 각 항목이 [`MDL-019`](../datas/model_MDL-019-022.md) 다.
- **`hubBaseUrl` 은 항목이 아니라 파일 수준 값**이다. 기대 요청 URL 은 기준 URL 하나를 전제로 산출되므로 항목마다 반복할 이유가 없고, 이 값은 **벡터 전용 예시**이며 실제 환경 값과 무관하다.
- **실 사용자 생년월일·실 발송처키·실 회원 정보를 넣지 않는다**(`DATA-001-02`). 벡터는 저장소와 발송처 양쪽에 남는 문서다.

### 반드시 덮는 경계 (최소 6항목)

| # | 경계 | 확인 대상 |
|---|---|---|
| 1 | 키 원문(발송처키+생년월일)이 **32바이트 미만** | `_` 우측 패딩(`SEC-001-03`) |
| 2 | 키 원문이 **정확히 32바이트** | 절단·패딩이 일어나지 않는 경계 |
| 3 | 키 원문이 **32바이트 초과** | 앞 32바이트 절단 |
| 4 | 암호값에 **Base64URL 치환 문자(`-`·`_`)가 나오는 값** | 전달 인코딩(`SEC-001-08`) |
| 5 | X 평문이 **크기 상한 바로 아래** | 상한 판정 경계(`SEC-001-09`) |
| 6 | X 에 **다국어 문자 포함** | UTF-8 직렬화(`SEC-001-02`) |

- 각 항목의 `boundaryNote` 에 어떤 경계를 덮는지 적어 두면 규약 개정 시 어느 항목을 다시 만들어야 하는지 판단하기 쉽다.
- 규약이 바뀌면 벡터를 다시 만들고 **재생성·대조 통과를 배포 전제**로 삼는다(`SEC-001-12`).

### 검증 하네스

라이브러리 산출물과 함께 만드는 C# 콘솔 프로그램이다([`../../prd/PRD.md`](../../prd/PRD.md) §프로그램 구성·기술스택·검증 방법).

- **실행** — `<하네스 실행 파일> --vectors <벡터 파일 경로>`. 벡터를 읽어 각 항목에 대해 `Encrypt`·`BuildRequestUrl` 을 호출하고 기대 출력과 대조한다.
- **표준 출력** — 마지막 줄에 요약 JSON 1줄. `{"total":6,"passed":6,"failed":0,"failedCaseIds":[]}`. 진단 문구는 표준 오류로 내보낸다.
- **종료 코드** — `0` = 전건 일치 / `0` 이외 = 불일치·실행 실패. 명령 실행 절차를 그대로 적용할 수 있다.
- **왕복 검증**은 허브가 이 벡터의 암호값을 복호화해 원래 전달 데이터가 복원되는지 대조하는 별도 통합 검증 항목이다(`SVC-009` F-004). 라이브러리와 허브가 모두 준비된 뒤 수행한다.
