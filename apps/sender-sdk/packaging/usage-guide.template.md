# AccountInterlockHub 연동 라이브러리 사용 안내

발송처(서비스 A) 개발팀을 위한 통합 안내입니다. 이 문서는 배포 패키지 다섯 구성 중 하나이며,
패키지를 조립한 시점({{PACKAGE_DATE}})에 확정된 값을 담고 있습니다 — 값이 바뀌면 이 문서만
다시 받으면 됩니다(라이브러리 재배포가 필요하지 않습니다. 다만 규약 자체가 바뀌면 라이브러리와
함께 새 패키지를 받아야 합니다 — §1 참고).

## 1. 규약 버전 표기와 호환 판단 방법

- 이 패키지가 구현한 암호화 연동 규약 버전: **{{PROTOCOL_VERSION}}** (`<MAJOR>.<MINOR>` 형식)
- 라이브러리는 이 값을 `InterlockRequestBuilder.ProtocolVersion` 공개 상수로도 그대로 노출합니다.
- 허브의 연동 규약 자가진단 API 응답에도 같은 형식의 `protocolVersion` 값이 담겨 있습니다.
- **호환 판단**: 두 값의 `MAJOR` 가 다르면 **비호환**입니다 — 새 배포 패키지를 받아 재배포하십시오.
  `MINOR` 만 다르면 호환이며 그대로 사용할 수 있습니다. 허브는 이 값을 이유로 연동 요청 자체를
  거절하지 않습니다(버전 값이 요청 URL 에 실리지 않기 때문입니다) — 호환 판단은 발송처가 스스로
  수행해야 합니다.

## 2. 공개 진입점

`AccountInterlockHub.SenderSdk.dll` 이 공개하는 진입점은 아래 둘뿐입니다.

```csharp
public static class InterlockRequestBuilder
{
    public const string ProtocolVersion; // 이 라이브러리가 구현한 규약 버전

    // 전달 데이터(X)를 암호화해 encX·encY 쌍을 만듭니다.
    public static EncryptedPair Encrypt(
        string payloadJson,  // 전달 데이터 X 의 JSON 문자열(발송처가 직접 직렬화한 값 그대로)
        string senderKey,    // 발송처키(비밀 값) — 라이브러리에 내장돼 있지 않습니다
        string birthDate);   // 사용자 생년월일, yyMMdd 형식 숫자 6자리 문자열

    // 허브 기준 URL 과 암호값 쌍으로, 사용자를 허브로 보낼 연동 요청 URL 을 만듭니다.
    public static string BuildRequestUrl(
        string hubBaseUrl,   // 환경별 허브 기준 URL(§4 참고) — 절대 URL 형태
        EncryptedPair pair); // Encrypt 의 반환값
}

public sealed class EncryptedPair
{
    public string EncX { get; } // Base64URL 인코딩(패딩 없음)
    public string EncY { get; } // Base64URL 인코딩(패딩 없음)
}
```

- 두 메서드 모두 **정적(static)**이며 호출 간 상태를 공유하지 않습니다(스레드 안전합니다).
- 반환 타입(`EncryptedPair`)은 불변입니다 — 생성 후 값이 바뀌지 않습니다.
- 허브 기준 URL·발송처키는 라이브러리에 내장돼 있지 않습니다. 반드시 호출 인자로 전달하십시오
  — 발송처키를 소스·설정 파일에 평문으로 두지 않는 것을 권장합니다.

## 3. 오류 사유 코드 목록

호출 시 발생할 수 있는 예외는 세 층으로 나뉩니다(호출측이 "내 입력 문제"와 "실행 환경 문제"를
구별할 수 있도록 설계됐습니다).

| 층 | 예외 타입 | 발생 조건 | 대응 |
|---|---|---|---|
| 호출 오류 | `ArgumentNullException` / `ArgumentException` | 인자 누락, 발송처키가 공백만으로 구성됨, 기준 URL 이 절대 URL 형태가 아님 | 호출 코드를 수정하십시오 |
| 규약 위반 | `InterlockProtocolException` (`ReasonCode` 참조) | 아래 표 | 사유 코드로 원인을 좁히십시오 |
| 런타임 오류 | .NET 표준 예외(감싸지 않고 그대로 전파) | 암호 기능 초기화 실패 등 | 실행 환경을 점검하십시오 |

`InterlockProtocolException.ReasonCode` 값 — **허브 연동 규약 자가진단 API 와 같은 값
체계**를 씁니다. 두 경로(라이브러리 호출·자가진단 API 호출)에서 같은 진단을 얻을 수 있습니다.

| `ReasonCode` | 발생 조건 |
|---|---|
| `EX-AUTH-001` | 생년월일이 숫자 6자리(`yyMMdd`) 형식이 아님 |
| `EX-SEC-002` | 전달 데이터(X)가 JSON 객체 형태가 아님 |
| `EX-SEC-004` | 전달 데이터(X) 평문 크기 상한 초과, 또는 조립된 연동 요청 URL 길이 상한 초과 |

예외 메시지에는 발송처키·생년월일·전달 데이터·암호값이 담기지 않습니다 — 어느 제약을
어겼는지 이상의 정보는 담기지 않습니다.

## 4. 환경별 허브 기준 URL 기재란

`BuildRequestUrl` 의 `hubBaseUrl` 인자에 아래 값을 환경에 맞게 사용하십시오. 이 값은 패키지를
새로 받을 때마다 그 시점의 확정 값으로 갱신됩니다 — 소스에 직접 하드코딩하지 말고 이 문서를
근거로 설정값(환경 변수·구성 파일 등)을 주입하는 방식을 권장합니다.

| 환경 | 허브 기준 URL |
|---|---|
| 운영 | {{HUB_BASE_URL_PROD}} |
| 개발·로컬 | {{HUB_BASE_URL_DEV}} |

> ⚠️ **값 뒤에 "(**잠정** — …)"가 붙어 있으면 그 값으로 운영 배포하지 마십시오.** 잠정값은
> 확정 전 형식만 실제 값과 같은 모양으로 맞춘 임시 값입니다. 정식 값을 다시 전달받은 뒤
> 운영 환경에 반영하십시오.

## 5. 무결성 확인 절차

이 패키지가 허브 운영자가 낸 산출물인지 동봉된 `SHA256SUMS.txt` 로 확인하십시오. 각 줄은
`<소문자 16진수 64자>  <패키지 내 상대 경로>` 형태이며, 표준 도구로 그대로 대조할 수 있습니다.

- **Windows(PowerShell)**: 패키지 폴더에서 `Get-FileHash -Algorithm SHA256 <파일명>` 을
  실행해 나온 해시를 `SHA256SUMS.txt` 의 같은 파일명 줄과 비교합니다.
- **Windows(명령 프롬프트)**: `certutil -hashfile <파일명> SHA256`
- **Linux/macOS**: 패키지 폴더에서 `sha256sum -c SHA256SUMS.txt` 를 실행하면 구성 파일
  전부에 대해 `OK` 가 출력돼야 합니다.

**하나라도 불일치하면 그 파일을 사용하지 말고 재수령을 요청하십시오.** 이 불일치는 연동 요청
처리 중 발생하는 오류가 아니라 배포 절차상의 문제입니다 — 별도 오류 코드가 없습니다.

이 패키지는 어셈블리 서명을 채택하지 않았습니다(코드 서명 인증서 조달·갱신 비용이 이번 범위의
비용 균형에 맞지 않아 후속 보완 과제로 남겨 두었습니다). 무결성 확인은 위 체크섬 대조가
유일한 수단입니다.

## 6. 규약 적합성 확인 절차

1. 이 패키지의 C# 호출 샘플(`AccountInterlockHub.SenderSdk.Harness-Sample.zip`)을 풀어
   자신의 .NET Framework 4.8 개발 환경에서 빌드하십시오. 이 샘플은 라이브러리를 호출하는
   검증 하네스와 같은 형태의 콘솔 프로그램입니다 — 복사해 바로 실행할 수 있습니다.
2. 아래처럼 실행해 동봉된 규약 테스트 벡터(`protocol-test-vectors.json`)와 대조하십시오.

   ```
   AccountInterlockHub.SenderSdk.Harness.exe --vectors protocol-test-vectors.json
   ```

3. 표준 출력 마지막 줄이 `{"total":N,"passed":N,"failed":0,"failedCaseIds":[]}` 이고 종료
   코드가 `0` 이면, 이 개발 환경에서 빌드한 라이브러리 구현이 허브와 같은 규약을 구현하고
   있다는 뜻입니다. 불일치가 있으면 표준 오류의 진단 문구와 `failedCaseIds` 로 어느 경계가
   어긋났는지 좁히십시오.
4. 자신의 서비스에 통합을 마쳤으면, 허브 운영자로부터 **별도 채널로(비공개로) 전달받은**
   연동 규약 자가진단 API 경로로 자신이 실제로 만든 `encX`·`encY`·생년월일을 보내 규약
   적합성을 다시 확인하십시오. **이 API 경로 값은 이 패키지 어디에도 담겨 있지 않습니다** —
   경로 비공개가 이 API 의 유일한 완화 장치이므로, 별도로 전달받은 값만 쓰고 공개 저장소·
   소스·문서에 남기지 마십시오.
