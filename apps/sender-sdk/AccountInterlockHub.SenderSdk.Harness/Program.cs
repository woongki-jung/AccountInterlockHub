using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using AccountInterlockHub.SenderSdk;
using AccountInterlockHub.SenderSdk.Harness.Json;

namespace AccountInterlockHub.SenderSdk.Harness
{
    /// <summary>
    /// 규약 테스트 벡터 파일을 읽어 <see cref="InterlockRequestBuilder.Encrypt"/>·
    /// <see cref="InterlockRequestBuilder.BuildRequestUrl"/> 을 호출하고 기대 출력과 대조하는
    /// C# 콘솔 검증 하네스다(spec-functions-lib.md §검증 하네스).
    ///
    /// 실행: AccountInterlockHub.SenderSdk.Harness.exe --vectors &lt;벡터 파일 경로&gt;
    /// 표준 출력 마지막 줄 — 요약 JSON 1줄: {"total":N,"passed":N,"failed":N,"failedCaseIds":[...]}
    /// 진단 문구는 모두 표준 오류로 낸다.
    /// 종료 코드 — 0: 전건 일치 / 1: 하나 이상 불일치 / 2: 실행 자체가 실패(인자·파일·형식 오류·케이스 0건).
    /// 케이스 0건은 "전건 일치"(0)로 보지 않는다 — 규약 대조가 사실상 수행되지 않았기 때문이다.
    /// </summary>
    internal static class Program
    {
        private const int ExitOk = 0;
        private const int ExitMismatch = 1;
        private const int ExitExecutionFailure = 2;

        private static int Main(string[] args)
        {
            string vectorsPath;
            try
            {
                vectorsPath = ParseVectorsArg(args);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("인자 해석에 실패했습니다: " + ex.Message);
                PrintUsage();
                return ExitExecutionFailure;
            }

            if (vectorsPath == null)
            {
                Console.Error.WriteLine("--vectors 인자가 필요합니다.");
                PrintUsage();
                return ExitExecutionFailure;
            }

            string jsonText;
            try
            {
                jsonText = File.ReadAllText(vectorsPath, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("벡터 파일을 읽을 수 없습니다: " + vectorsPath);
                Console.Error.WriteLine(ex.GetType().Name + ": " + ex.Message);
                return ExitExecutionFailure;
            }

            JsonValue root;
            try
            {
                root = MiniJsonParser.Parse(jsonText);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("벡터 파일 JSON 해석에 실패했습니다.");
                Console.Error.WriteLine(ex.GetType().Name + ": " + ex.Message);
                return ExitExecutionFailure;
            }

            VectorFile vectors;
            try
            {
                vectors = VectorFile.FromJson(root);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("벡터 파일 구조가 규약 형식과 다릅니다.");
                Console.Error.WriteLine(ex.GetType().Name + ": " + ex.Message);
                return ExitExecutionFailure;
            }

            if (!string.Equals(vectors.ProtocolVersion, InterlockRequestBuilder.ProtocolVersion, StringComparison.Ordinal))
            {
                Console.Error.WriteLine(
                    "경고: 벡터 파일 규약 버전(" + vectors.ProtocolVersion + ")과 라이브러리 규약 버전(" +
                    InterlockRequestBuilder.ProtocolVersion + ")이 다릅니다.");
            }

            if (vectors.Cases.Count == 0)
            {
                // 케이스 0건은 단순 경고가 아니라 오류다 — 아래 for 루프가 0회 실행되어
                // failed == 0 이 되므로, 이 검사가 없으면 "대조를 하나도 하지 않은 상태"가
                // "전건 일치"(종료 코드 0)로 둔갑한다. 배포 전제(규약 대조 통과)가 사실은
                // 수행되지 않은 채 충족된 것처럼 보이는 사고를 막는다.
                Console.Error.WriteLine("오류: 벡터 파일에 케이스가 하나도 없어 규약 대조를 수행하지 않았습니다.");
            }

            int total = vectors.Cases.Count;
            int passed = 0;
            List<string> failedCaseIds = new List<string>();

            for (int i = 0; i < vectors.Cases.Count; i++)
            {
                VectorCase testCase = vectors.Cases[i];
                if (RunCase(vectors.HubBaseUrl, testCase))
                {
                    passed++;
                }
                else
                {
                    failedCaseIds.Add(testCase.CaseId);
                }
            }

            int failed = total - passed;

            // 요약 JSON 은 항상 표준 출력의 마지막 줄이어야 한다 — 위의 모든 진단은 표준 오류로만 냈다.
            Console.Out.WriteLine(BuildSummaryJson(total, passed, failed, failedCaseIds));

            if (total == 0)
            {
                // failed == 0 이더라도 "전건 일치"가 아니다 — 대조 대상 자체가 없었다.
                return ExitExecutionFailure;
            }

            return failed == 0 ? ExitOk : ExitMismatch;
        }

        private static bool RunCase(string hubBaseUrl, VectorCase testCase)
        {
            try
            {
                EncryptedPair pair = InterlockRequestBuilder.Encrypt(
                    testCase.PayloadJson, testCase.SenderKey, testCase.BirthDate);

                bool encXMatch = string.Equals(pair.EncX, testCase.ExpectedEncX, StringComparison.Ordinal);
                bool encYMatch = string.Equals(pair.EncY, testCase.ExpectedEncY, StringComparison.Ordinal);

                string requestUrl = InterlockRequestBuilder.BuildRequestUrl(hubBaseUrl, pair);
                bool urlMatch = string.Equals(requestUrl, testCase.ExpectedRequestUrl, StringComparison.Ordinal);

                if (encXMatch && encYMatch && urlMatch)
                {
                    return true;
                }

                // 불일치 진단에는 caseId·boundaryNote 와 "무엇이 다른지"만 남긴다 —
                // 실제 값(암호값·발송처키·생년월일·전달 데이터)은 담지 않는다(DATA-001-04 정신을 하네스에도 적용).
                Console.Error.WriteLine("불일치 [" + testCase.CaseId + "] " + DescribeBoundary(testCase));
                if (!encXMatch) Console.Error.WriteLine("  - encX 가 기대 출력과 다릅니다.");
                if (!encYMatch) Console.Error.WriteLine("  - encY 가 기대 출력과 다릅니다.");
                if (!urlMatch) Console.Error.WriteLine("  - requestUrl 이 기대 출력과 다릅니다.");
                return false;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(
                    "실행 실패 [" + testCase.CaseId + "] " + DescribeBoundary(testCase) +
                    " : " + ex.GetType().Name + " - " + ex.Message);
                return false;
            }
        }

        private static string DescribeBoundary(VectorCase testCase)
        {
            if (string.IsNullOrEmpty(testCase.BoundaryNote)) return string.Empty;
            return "(" + testCase.BoundaryNote + ")";
        }

        private static string BuildSummaryJson(int total, int passed, int failed, List<string> failedCaseIds)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{\"total\":").Append(total.ToString(CultureInfo.InvariantCulture));
            sb.Append(",\"passed\":").Append(passed.ToString(CultureInfo.InvariantCulture));
            sb.Append(",\"failed\":").Append(failed.ToString(CultureInfo.InvariantCulture));
            sb.Append(",\"failedCaseIds\":[");
            for (int i = 0; i < failedCaseIds.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('"').Append(EscapeJsonString(failedCaseIds[i])).Append('"');
            }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string EscapeJsonString(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            StringBuilder sb = new StringBuilder(value.Length);
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else sb.Append(c);
            }
            return sb.ToString();
        }

        private static string ParseVectorsArg(string[] args)
        {
            const string flag = "--vectors";
            const string flagWithEquals = "--vectors=";

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (string.Equals(arg, flag, StringComparison.Ordinal))
                {
                    if (i + 1 >= args.Length)
                        throw new ArgumentException("--vectors 다음에 파일 경로가 필요합니다.");
                    return args[i + 1];
                }
                if (arg.StartsWith(flagWithEquals, StringComparison.Ordinal))
                {
                    return arg.Substring(flagWithEquals.Length);
                }
            }
            return null;
        }

        private static void PrintUsage()
        {
            Console.Error.WriteLine("사용법: AccountInterlockHub.SenderSdk.Harness.exe --vectors <벡터 파일 경로>");
        }
    }
}
