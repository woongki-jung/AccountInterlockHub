using System;
using System.Globalization;
using System.IO;
using System.Text;
using AccountInterlockHub.SenderSdk;

namespace AccountInterlockHub.SenderSdk.VectorGen
{
    /// <summary>
    /// LIB-04 규약 테스트 벡터(<c>protocol-test-vectors.json</c>) 생성 도구다
    /// (PROC-404 L1~L3 "벡터 생성 절차"). <b>배포 패키지에 동봉되는 산출물이 아니다</b> —
    /// 허브 운영자가 라이브러리 릴리스·규약 개정 시점에 실행하는 저장소 내부 개발 도구다
    /// (build.ps1 과 같은 성격). 기대 출력(<c>encX</c>·<c>encY</c>·<c>requestUrl</c>)을
    /// 손으로 적지 않고 실제 라이브러리(<see cref="InterlockRequestBuilder"/>)를 호출해
    /// 그대로 기록한다(spec-functions-lib.md §규약 테스트 벡터 · process_PROC-404.md L2
    /// "기대 출력을 손으로 적지 않는다").
    ///
    /// 6개 케이스가 사양이 요구하는 필수 경계 6종(spec-functions-lib.md §반드시 덮는 경계)을
    /// 1:1로 덮는다. 모든 입력값(발송처키·생년월일·전달 데이터)은 합성 값이며 실 사용자
    /// 정보를 담지 않는다(`DATA-001-02`).
    ///
    /// 실행: AccountInterlockHub.SenderSdk.VectorGen.exe [출력 파일 경로]
    /// 출력 파일 경로를 생략하면 이 실행 파일이 있는 bin\ 의 상위 폴더(apps/sender-sdk/)에
    /// protocol-test-vectors.json 을 (재)생성한다.
    /// </summary>
    internal static class Program
    {
        // 규약 확정값(policy_SEC-crypto.md §규약 확정값) — X 평문 크기 상한(UTF-8 직렬화 후 바이트).
        private const int PlaintextMaxBytes = 1024;

        // 규약 확정값 — 키 정규화 목표 길이(바이트). 경계 케이스 산출에만 쓰는 로컬 상수이며
        // 라이브러리 자신의 정규화 로직(Internal/KeyNormalizer.cs)과는 무관하게 이 도구가
        // "몇 바이트짜리 senderKey 를 만들어야 32바이트 경계를 만드는지" 계산하는 데 쓴다.
        private const int NormalizedKeyLengthBytes = 32;

        private const int BirthDateLengthBytes = 6; // yyMMdd — 항상 ASCII 6바이트

        // 벡터 전용 예시 기준 URL — 실제 환경 값과 무관하다(spec-functions-lib.md §규약
        // 테스트 벡터: "hubBaseUrl 은 벡터 전용 예시이며 실제 환경 값과 무관하다"). RFC 2606
        // 예약 도메인(.example) + RFC 6761 예약 TLD(.test) 조합으로 실제 호스트와 혼동을
        // 원천 차단한다 — CLAUDE.env.md 의 실제 HUB_BASE_URL_* 값을 참조하지 않는다.
        private const string VectorHubBaseUrl = "https://vector-hub.example.test";

        private static int Main(string[] args)
        {
            try
            {
                string outputPath = args.Length > 0 ? args[0] : DefaultOutputPath();

                VectorCaseSpec[] specs = BuildCaseSpecs();

                var sb = new StringBuilder();
                sb.Append("{\n");
                sb.Append("  \"protocolVersion\": ").Append(JsonWriter.Str(InterlockRequestBuilder.ProtocolVersion)).Append(",\n");
                sb.Append("  \"hubBaseUrl\": ").Append(JsonWriter.Str(VectorHubBaseUrl)).Append(",\n");
                sb.Append("  \"cases\": [\n");

                for (int i = 0; i < specs.Length; i++)
                {
                    VectorCaseSpec spec = specs[i];

                    // 기대 출력을 손으로 적지 않는다 — 실제 라이브러리 호출 결과를 그대로 기록한다.
                    EncryptedPair pair = InterlockRequestBuilder.Encrypt(spec.PayloadJson, spec.SenderKey, spec.BirthDate);
                    string requestUrl = InterlockRequestBuilder.BuildRequestUrl(VectorHubBaseUrl, pair);

                    sb.Append("    {\n");
                    sb.Append("      \"caseId\": ").Append(JsonWriter.Str(spec.CaseId)).Append(",\n");
                    sb.Append("      \"boundaryNote\": ").Append(JsonWriter.Str(spec.BoundaryNote)).Append(",\n");
                    sb.Append("      \"input\": {\n");
                    sb.Append("        \"senderKey\": ").Append(JsonWriter.Str(spec.SenderKey)).Append(",\n");
                    sb.Append("        \"birthDate\": ").Append(JsonWriter.Str(spec.BirthDate)).Append(",\n");
                    sb.Append("        \"payload\": ").Append(spec.PayloadJson).Append("\n");
                    sb.Append("      },\n");
                    sb.Append("      \"expected\": {\n");
                    sb.Append("        \"encX\": ").Append(JsonWriter.Str(pair.EncX)).Append(",\n");
                    sb.Append("        \"encY\": ").Append(JsonWriter.Str(pair.EncY)).Append(",\n");
                    sb.Append("        \"requestUrl\": ").Append(JsonWriter.Str(requestUrl)).Append("\n");
                    sb.Append("      }\n");
                    sb.Append(i < specs.Length - 1 ? "    },\n" : "    }\n");
                }

                sb.Append("  ]\n");
                sb.Append("}\n");

                // 개행은 LF 로 고정한다(P18 S-b). 체크아웃 개행 규약(core.autocrlf 등)과 무관하게
                // 이 도구가 스스로 결정적인 바이트를 낸다 — .gitattributes(apps/sender-sdk/**
                // text eol=lf)가 저장소 차원에서 같은 경로를 이미 LF 로 고정하지만, 이 도구
                // 자신은 그와 무관하게 항상 LF 를 쓴다(이중 방어).
                string text = sb.ToString().Replace("\r\n", "\n");
                var utf8NoBom = new UTF8Encoding(false);
                File.WriteAllText(outputPath, text, utf8NoBom);

                Console.WriteLine("생성 완료: " + outputPath + " (" + specs.Length.ToString(CultureInfo.InvariantCulture) + "개 케이스)");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("벡터 생성 실패: " + ex.GetType().Name + " - " + ex.Message);
                return 1;
            }
        }

        private static string DefaultOutputPath()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory; // .../apps/sender-sdk/bin/
            string senderSdkRoot = Path.GetFullPath(Path.Combine(exeDir, ".."));
            return Path.Combine(senderSdkRoot, "protocol-test-vectors.json");
        }

        /// <summary>
        /// 필수 경계 6종(spec-functions-lib.md §반드시 덮는 경계)을 1:1로 덮는 6개 케이스를
        /// 만든다. 순서 그대로 ①~⑥ 경계에 대응한다.
        /// </summary>
        private static VectorCaseSpec[] BuildCaseSpecs()
        {
            return new VectorCaseSpec[]
            {
                BuildBoundary1KeyShort(),
                BuildBoundary2KeyExact(),
                BuildBoundary3KeyLong(),
                BuildBoundary4Base64UrlSubstitution(),
                BuildBoundary5PlaintextNearLimit(),
                BuildBoundary6Multilingual(),
            };
        }

        // ── 경계 ① 키 원문(발송처키+생년월일)이 32바이트 미만 — '_' 우측 패딩 확인 ──
        private static VectorCaseSpec BuildBoundary1KeyShort()
        {
            string birthDate = "990101";
            int targetTotalBytes = NormalizedKeyLengthBytes - 8; // 24 바이트 (< 32)
            string senderKey = MakeAscii("SNDR-SHORT-", targetTotalBytes - BirthDateLengthBytes); // 18자
            AssertConcatBytes(senderKey, birthDate, targetTotalBytes);

            string payload = "{\"trackingKey\":\"TRK-VEC-001\",\"note\":\"sender key + birth date shorter than 32 bytes\"}";
            return new VectorCaseSpec(
                "VEC-001-KEY-SHORT",
                "키 원문(발송처키+생년월일)이 32바이트 미만 — '_'(0x5F) 우측 패딩 경계",
                senderKey, birthDate, payload);
        }

        // ── 경계 ② 키 원문이 정확히 32바이트 — 절단·패딩이 없는 경계 ──
        private static VectorCaseSpec BuildBoundary2KeyExact()
        {
            string birthDate = "990102";
            int targetTotalBytes = NormalizedKeyLengthBytes; // 32 바이트 (= 32, 절단·패딩 경계)
            string senderKey = MakeAscii("SNDR-EXACT-", targetTotalBytes - BirthDateLengthBytes); // 26자
            AssertConcatBytes(senderKey, birthDate, targetTotalBytes);

            string payload = "{\"trackingKey\":\"TRK-VEC-002\",\"note\":\"sender key + birth date exactly 32 bytes\"}";
            return new VectorCaseSpec(
                "VEC-002-KEY-EXACT",
                "키 원문(발송처키+생년월일)이 정확히 32바이트 — 절단·패딩이 일어나지 않는 경계",
                senderKey, birthDate, payload);
        }

        // ── 경계 ③ 키 원문이 32바이트 초과 — 앞 32바이트 절단 ──
        private static VectorCaseSpec BuildBoundary3KeyLong()
        {
            string birthDate = "990103";
            int targetTotalBytes = NormalizedKeyLengthBytes + 14; // 46 바이트 (> 32)
            string senderKey = MakeAscii("SNDR-LONG-OVER-", targetTotalBytes - BirthDateLengthBytes); // 40자
            AssertConcatBytes(senderKey, birthDate, targetTotalBytes);

            string payload = "{\"trackingKey\":\"TRK-VEC-003\",\"note\":\"sender key + birth date longer than 32 bytes\"}";
            return new VectorCaseSpec(
                "VEC-003-KEY-LONG",
                "키 원문(발송처키+생년월일)이 32바이트 초과 — 앞 32바이트 절단 경계",
                senderKey, birthDate, payload);
        }

        // ── 경계 ④ 암호값(encX/encY)에 Base64URL 치환 문자('-'·'_')가 실제로 나오는 값 ──
        private static VectorCaseSpec BuildBoundary4Base64UrlSubstitution()
        {
            string birthDate = "990104";
            string payload = "{\"trackingKey\":\"TRK-VEC-004\",\"note\":\"base64url substitution character boundary\"}";

            // 기대 출력을 손으로 만들 수 없으므로(실제 암호화 결과여야 한다), 치환 문자가
            // 실제로 나오는 senderKey 후보를 찾을 때까지 라이브러리를 반복 호출한다.
            // AES 출력은 사실상 의사난수라 몇 차례 안에 반드시 걸린다(각 후보의 encY 는
            // 64자 Base64URL 이므로 문자 하나가 '-'·'_' 일 확률은 대략 1-(62/64)^64 ≈ 85%).
            for (int i = 0; i < 5000; i++)
            {
                string senderKey = "SUBCH-CANDIDATE-" + i.ToString(CultureInfo.InvariantCulture);
                EncryptedPair pair = InterlockRequestBuilder.Encrypt(payload, senderKey, birthDate);
                if (ContainsBase64UrlSubstitutionChar(pair.EncX) || ContainsBase64UrlSubstitutionChar(pair.EncY))
                {
                    return new VectorCaseSpec(
                        "VEC-004-BASE64URL-SUBST",
                        "암호값(encX 또는 encY)에 Base64URL 치환 문자('-' 또는 '_')가 실제로 출현 — 전달 인코딩 경계",
                        senderKey, birthDate, payload);
                }
            }

            throw new InvalidOperationException(
                "Base64URL 치환 문자('-' 또는 '_')를 포함하는 암호값 후보를 찾지 못했습니다(5000회 시도).");
        }

        private static bool ContainsBase64UrlSubstitutionChar(string value)
        {
            return value.IndexOf('-') >= 0 || value.IndexOf('_') >= 0;
        }

        // ── 경계 ⑤ X 평문이 크기 상한(1,024바이트) 바로 아래 ──
        private static VectorCaseSpec BuildBoundary5PlaintextNearLimit()
        {
            string birthDate = "990105";
            string senderKey = "DEMO-SENDER-KEY-005";

            const string prefix = "{\"trackingKey\":\"TRK-VEC-005\",\"filler\":\"";
            const string suffix = "\"}";
            int overhead = Encoding.UTF8.GetByteCount(prefix) + Encoding.UTF8.GetByteCount(suffix);
            int targetBytes = PlaintextMaxBytes - 1; // "바로 아래" — 상한보다 1바이트 작은 값
            int fillerLength = targetBytes - overhead;
            if (fillerLength <= 0)
            {
                throw new InvalidOperationException("필러 길이 계산이 음수입니다 — prefix/suffix 상수를 확인하십시오.");
            }

            string filler = new string('A', fillerLength); // 'A' = ASCII 1바이트라 길이=바이트 수
            string payload = prefix + filler + suffix;

            int actualBytes = Encoding.UTF8.GetByteCount(payload);
            if (actualBytes != targetBytes)
            {
                throw new InvalidOperationException(
                    "X 평문 크기 계산이 어긋났습니다. 목표=" + targetBytes.ToString(CultureInfo.InvariantCulture) +
                    " 실제=" + actualBytes.ToString(CultureInfo.InvariantCulture));
            }

            return new VectorCaseSpec(
                "VEC-005-SIZE-NEAR-LIMIT",
                "X 평문이 크기 상한(1,024바이트) 바로 아래(" + targetBytes.ToString(CultureInfo.InvariantCulture) + "바이트) — 상한 판정 경계",
                senderKey, birthDate, payload);
        }

        // ── 경계 ⑥ X 에 다국어 문자 포함 — UTF-8 다중 바이트 직렬화 확인 ──
        private static VectorCaseSpec BuildBoundary6Multilingual()
        {
            string birthDate = "990106";
            string senderKey = "DEMO-SENDER-KEY-006";

            // 한글(완성형, UTF-8 3바이트/문자) + 이모지(서로게이트 쌍, UTF-8 4바이트) 혼합을
            // \uXXXX 이스케이프가 아니라 원문 문자 그대로 담는다 — 평문 바이트열 자체에
            // 다중 바이트 UTF-8 시퀀스가 실제로 나타나야 이 경계(UTF-8 직렬화)를 의미
            // 있게 덮는다(이스케이프 표기는 ASCII 문자만 남아 경계를 우회한다).
            string payload = "{\"trackingKey\":\"TRK-VEC-006\",\"note\":\"안녕하세요 계정연동 확인 메시지입니다 😀\"}";

            return new VectorCaseSpec(
                "VEC-006-MULTILINGUAL",
                "X 에 다국어 문자(한글·이모지) 포함 — UTF-8 다중 바이트 직렬화 경계",
                senderKey, birthDate, payload);
        }

        private static string MakeAscii(string seed, int length)
        {
            var sb = new StringBuilder(length);
            for (int i = 0; i < length; i++)
            {
                sb.Append(seed[i % seed.Length]);
            }
            return sb.ToString();
        }

        private static void AssertConcatBytes(string senderKey, string birthDate, int expectedBytes)
        {
            int actual = Encoding.UTF8.GetByteCount(senderKey + birthDate);
            if (actual != expectedBytes)
            {
                throw new InvalidOperationException(
                    "키 원문 길이 계산이 어긋났습니다. 목표=" + expectedBytes.ToString(CultureInfo.InvariantCulture) +
                    " 실제=" + actual.ToString(CultureInfo.InvariantCulture));
            }
            if (Encoding.UTF8.GetByteCount(birthDate) != BirthDateLengthBytes)
            {
                throw new InvalidOperationException("birthDate 는 항상 ASCII 6바이트여야 합니다.");
            }
        }
    }

    /// <summary>규약 테스트 벡터 케이스 하나를 만들기 위한 입력 명세(합성 값).</summary>
    internal sealed class VectorCaseSpec
    {
        internal readonly string CaseId;
        internal readonly string BoundaryNote;
        internal readonly string SenderKey;
        internal readonly string BirthDate;
        internal readonly string PayloadJson; // 압축 1행 JSON 원문 — 그대로 Encrypt 인자로 쓴다

        internal VectorCaseSpec(string caseId, string boundaryNote, string senderKey, string birthDate, string payloadJson)
        {
            CaseId = caseId;
            BoundaryNote = boundaryNote;
            SenderKey = senderKey;
            BirthDate = birthDate;
            PayloadJson = payloadJson;
        }
    }

    /// <summary>
    /// 벡터 파일의 스칼라 필드(문자열)만 감당하는 최소 JSON 문자열 이스케이퍼다.
    /// payload 자체는 이미 유효한 JSON 원문을 그대로 쓰므로(재직렬화 없음) 이 클래스를
    /// 거치지 않는다 — 이 클래스는 caseId·boundaryNote·senderKey·birthDate·protocolVersion·
    /// hubBaseUrl·encX·encY·requestUrl 처럼 "라이브러리·이 도구가 만든 평범한 문자열"에만 쓴다.
    /// </summary>
    internal static class JsonWriter
    {
        internal static string Str(string value)
        {
            if (value == null) return "null";
            var sb = new StringBuilder(value.Length + 8);
            sb.Append('"');
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ')
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }
    }
}
