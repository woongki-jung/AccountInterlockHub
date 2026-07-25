using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using AccountInterlockHub.SenderSdk.Internal;

namespace AccountInterlockHub.SenderSdk
{
    /// <summary>
    /// 발송처의 C# 프로젝트가 참조하는 연동 라이브러리의 공개 진입점이다(LIB-01·LIB-02).
    /// 데이터 암호화(<see cref="Encrypt"/>)와 연동 요청 URL 생성(<see cref="BuildRequestUrl"/>)을
    /// 제공한다. 두 정적 메서드 모두 호출 간 상태를 공유하지 않으며(스레드 안전),
    /// 반환 타입은 불변이다. 발송처키·허브 기준 URL 은 내장하지 않고 호출 인자로만 받는다.
    /// </summary>
    public static class InterlockRequestBuilder
    {
        /// <summary>
        /// 이 라이브러리가 구현한 암호화 연동 규약의 버전 문자열이다(정책 SEC-001-11 확정값).
        /// 허브 자가진단 응답의 규약 버전과 MAJOR 가 다르면 비호환이다 — 재배포가 필요하다.
        /// </summary>
        public const string ProtocolVersion = "1.0";

        // 사용자 진입 경로 — 규약의 일부인 확정 상수다(CLAUDE.env.md §연동 구성 상수 <INTERLOCK_ENTRY_PATH>).
        // 라이브러리는 허브의 배포 설정을 받을 수 없으므로 내부 상수로 고정한다. 값이 바뀌면
        // 규약 버전을 올려 라이브러리와 허브를 함께 배포한다(SEC-001-12).
        private const string InterlockEntryPath = "/interlock/entry";

        // 정책 SEC-001 §규약 확정값 — X 평문 크기 상한(바이트, UTF-8 직렬화 후).
        private const int PlaintextMaxBytes = 1024;

        // 정책 SEC-001 §규약 확정값 — 연동 요청 URL 전체 길이 상한(문자 수).
        private const int RequestUrlMaxLength = 2000;

        private static readonly Regex BirthDatePattern =
            new Regex("^[0-9]{6}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>
        /// 전달 데이터 X 를 암호화해 <c>encX</c>·<c>encY</c> 쌍을 만든다(LIB-01 · PROC-401 · SVC-006).
        /// </summary>
        /// <param name="payloadJson">
        /// 전달 데이터 X 의 JSON 문자열. 발송처가 이미 직렬화해 넘긴다 — 이 라이브러리는
        /// JSON 직렬화기를 쓰지 않으며 내용을 파싱하지도 않는다(형태만 <c>{</c>·<c>}</c> 로 확인한다).
        /// </param>
        /// <param name="senderKey">발송처키. 라이브러리는 이 값을 내장하지 않고 호출 시 받는다.</param>
        /// <param name="birthDate">사용자 생년월일. <c>yyMMdd</c> 형식 숫자 6자리.</param>
        /// <returns>불변 암호값 쌍.</returns>
        /// <exception cref="ArgumentNullException">인자 중 하나라도 <c>null</c> 인 경우.</exception>
        /// <exception cref="ArgumentException"><paramref name="senderKey"/> 가 공백만으로 이루어진 경우.</exception>
        /// <exception cref="InterlockProtocolException">
        /// 규약 위반 — 생년월일 형식(<c>EX-AUTH-001</c>)·전달 데이터 형태(<c>EX-SEC-002</c>)·
        /// 평문 크기 상한 초과(<c>EX-SEC-004</c>).
        /// </exception>
        public static EncryptedPair Encrypt(string payloadJson, string senderKey, string birthDate)
        {
            // L1. 인자 검사 (호출 오류 — .NET 관용, BR-020 1층)
            if (payloadJson == null) throw new ArgumentNullException("payloadJson");
            if (senderKey == null) throw new ArgumentNullException("senderKey");
            if (birthDate == null) throw new ArgumentNullException("birthDate");
            if (senderKey.Trim().Length == 0)
                throw new ArgumentException("발송처키는 공백만으로 구성될 수 없습니다.", "senderKey");

            // L2. 생년월일 형식 검증 — POL AUTH-002-02 (달력 유효성은 검사하지 않는다)
            if (!BirthDatePattern.IsMatch(birthDate))
                throw new InterlockProtocolException("EX-AUTH-001");

            // L3. 전달 데이터 형태 검증 — POL SEC-002-01 ③ 의 사전 방어
            //     JSON 을 파싱하지 않는다 — 필드 수준 적합성(trackingKey 존재)은 자가진단이 판정한다.
            string trimmed = payloadJson.Trim();
            if (trimmed.Length == 0 || trimmed[0] != '{' || trimmed[trimmed.Length - 1] != '}')
                throw new InterlockProtocolException("EX-SEC-002");

            // L4. 직렬화·크기 상한 검증 — POL SEC-001-02 · SEC-001-09
            //     주의: 검증·암호화 모두 trimmed 가 아니라 원본 payloadJson 바이트를 그대로 쓴다
            //     (판정 3단계만 trim 한 값으로 형태를 보고, 4단계부터는 원본으로 되돌아간다).
            byte[] plain = Encoding.UTF8.GetBytes(payloadJson);
            if (plain.Length > PlaintextMaxBytes)
                throw new InterlockProtocolException("EX-SEC-004", "전달 데이터(X) 평문 크기가 연동 규약 상한을 초과했습니다.");

            // L5. 키 산출(정규화) — POL SEC-001-05 · SEC-001-06 · SEC-001-03 · SEC-001-04
            //     이어 붙이기 → 정규화 순서를 반드시 지킨다. 각각 정규화한 뒤 이어 붙이면 다른 키가 나온다.
            NormalizedKey keyX = KeyNormalizer.Normalize(senderKey + birthDate);
            NormalizedKey keyY = KeyNormalizer.Normalize(birthDate);

            // L6. 암호화 수행 — POL SEC-001-01 · SEC-001-07
            //     encY 의 평문은 encX 암호화에 쓴 정규화된 32바이트 키 바이트열 그대로다 —
            //     허브가 encY 복호화 결과를 재정규화하지 않고 그대로 encX 의 키로 쓰기 때문이다.
            byte[] cipherX = EncryptAesCbcPkcs7(plain, keyX.Key, keyX.Iv);
            byte[] cipherY = EncryptAesCbcPkcs7(keyX.Key, keyY.Key, keyY.Iv);

            // L7. 전달 인코딩 — POL SEC-001-08
            string encX = Base64UrlEncoder.Encode(cipherX);
            string encY = Base64UrlEncoder.Encode(cipherY);

            // L8. 결과 반환 — 중간 값(plain·keyX·keyY·cipherX·cipherY)은 지역 값으로만 두고 폐기한다.
            //     로그·예외 메시지 어디에도 담지 않는다(DATA-001-04).
            return new EncryptedPair(encX, encY);
        }

        /// <summary>
        /// 허브 기준 URL 과 암호값 쌍으로 사용자를 허브로 보낼 연동 요청 URL 을 조립한다
        /// (LIB-02 · PROC-402 · SVC-007).
        /// </summary>
        /// <param name="hubBaseUrl">
        /// 환경별 허브 기준 URL(절대 URL 형태). 끝 구분자(<c>/</c>) 유무에 관계없이 같은 결과를 낸다.
        /// 라이브러리는 이 값을 내장하지 않는다 — 환경마다 다르므로 호출 인자로 받는다.
        /// </param>
        /// <param name="pair"><see cref="Encrypt"/> 가 반환한 암호값 쌍.</param>
        /// <returns>연동 요청 URL. 길이 판정을 통과한 값만 반환한다.</returns>
        /// <exception cref="ArgumentNullException">인자 중 하나라도 <c>null</c> 인 경우.</exception>
        /// <exception cref="ArgumentException">
        /// <paramref name="hubBaseUrl"/> 이 절대 URL 형태가 아닌 경우.
        /// </exception>
        /// <exception cref="InterlockProtocolException">
        /// 조립된 URL 전체 길이가 규약 상한을 초과한 경우(<c>EX-SEC-004</c>). 이 경우 URL 을 반환하지 않는다.
        /// </exception>
        public static string BuildRequestUrl(string hubBaseUrl, EncryptedPair pair)
        {
            // L1. 인자 검사 (호출 오류 — .NET 관용, BR-020 1층)
            if (hubBaseUrl == null) throw new ArgumentNullException("hubBaseUrl");
            if (pair == null) throw new ArgumentNullException("pair");

            Uri parsedUri;
            bool isAbsolute = Uri.TryCreate(hubBaseUrl, UriKind.Absolute, out parsedUri);
            if (!isAbsolute)
                throw new ArgumentException("허브 기준 URL 은 절대 URL 형태여야 합니다.", "hubBaseUrl");

            // L2. 기준 경로 결합 — 끝 구분자 유무에 관계없이 같은 결과가 나오도록 원본 문자열을 다듬는다.
            //     (파싱된 Uri 가 아니라 원본 문자열을 그대로 쓴다 — 재직렬화로 값이 달라지지 않게 한다)
            string baseUrl = hubBaseUrl.TrimEnd('/');
            string url = baseUrl + InterlockEntryPath;

            // L3. 파라미터 결합 — POL SEC-001-08 (Base64URL 은 이미 URL 에 실을 수 있으므로
            //     퍼센트 인코딩을 겹쳐 적용하지 않는다. 두 파라미터 외의 값을 붙이지 않는다)
            url = url + "?encX=" + pair.EncX + "&encY=" + pair.EncY;

            // L4. 길이 상한 판정 — POL SEC-001-10 (상한을 넘는 값을 돌려주지 않는다)
            if (url.Length > RequestUrlMaxLength)
                throw new InterlockProtocolException("EX-SEC-004", "연동 요청 URL 길이가 연동 규약 상한을 초과했습니다.");

            // L5. 반환 — 길이 판정을 통과한 값만 돌려준다. 로그에 남기지 않는다(DATA-001-04).
            return url;
        }

        private static byte[] EncryptAesCbcPkcs7(byte[] plaintext, byte[] key, byte[] iv)
        {
            using (Aes aes = Aes.Create())
            {
                aes.KeySize = 256;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                aes.Key = key;
                aes.IV = iv;

                using (ICryptoTransform encryptor = aes.CreateEncryptor())
                {
                    return encryptor.TransformFinalBlock(plaintext, 0, plaintext.Length);
                }
            }
        }
    }
}
