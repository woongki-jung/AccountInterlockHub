using System;
using System.Collections.Generic;
using System.Globalization;
using AccountInterlockHub.SenderSdk.Harness.Json;

namespace AccountInterlockHub.SenderSdk.Harness
{
    /// <summary>규약 테스트 벡터 파일의 항목 하나(MDL-019).</summary>
    internal sealed class VectorCase
    {
        internal string CaseId;
        internal string BoundaryNote;
        internal string SenderKey;
        internal string BirthDate;

        /// <summary>
        /// input.payload 의 원문 그대로(재직렬화하지 않음). Encrypt 의 payloadJson 인자로 그대로 넘긴다.
        /// </summary>
        internal string PayloadJson;

        internal string ExpectedEncX;
        internal string ExpectedEncY;
        internal string ExpectedRequestUrl;
    }

    /// <summary>
    /// 규약 테스트 벡터 파일 전체(spec-functions-lib.md §규약 테스트 벡터 형식).
    /// <c>{ protocolVersion, hubBaseUrl, cases: [...] }</c> 구조를 <see cref="JsonValue"/> 트리에서 읽어 낸다.
    /// </summary>
    internal sealed class VectorFile
    {
        internal string ProtocolVersion;
        internal string HubBaseUrl;
        internal List<VectorCase> Cases;

        internal static VectorFile FromJson(JsonValue root)
        {
            if (root == null) throw new ArgumentNullException("root");
            if (root.Kind != JsonKind.Object)
                throw new FormatException("벡터 파일의 최상위 값은 JSON 객체여야 합니다.");

            VectorFile file = new VectorFile();
            file.ProtocolVersion = GetString(root, "protocolVersion", true);
            file.HubBaseUrl = GetString(root, "hubBaseUrl", true);

            JsonValue casesValue = GetField(root, "cases", true);
            if (casesValue.Kind != JsonKind.Array)
                throw new FormatException("'cases' 필드는 배열이어야 합니다.");

            file.Cases = new List<VectorCase>();
            for (int i = 0; i < casesValue.ArrayValue.Count; i++)
            {
                file.Cases.Add(ParseCase(casesValue.ArrayValue[i], i));
            }
            return file;
        }

        private static VectorCase ParseCase(JsonValue caseValue, int index)
        {
            if (caseValue.Kind != JsonKind.Object)
            {
                throw new FormatException(
                    "cases[" + index.ToString(CultureInfo.InvariantCulture) + "] 항목은 JSON 객체여야 합니다.");
            }

            VectorCase c = new VectorCase();
            c.CaseId = GetString(caseValue, "caseId", true);
            c.BoundaryNote = GetString(caseValue, "boundaryNote", false);

            JsonValue input = GetField(caseValue, "input", true);
            if (input.Kind != JsonKind.Object)
            {
                throw new FormatException(
                    "cases[" + index.ToString(CultureInfo.InvariantCulture) + "].input 은 JSON 객체여야 합니다.");
            }
            c.SenderKey = GetString(input, "senderKey", true);
            c.BirthDate = GetString(input, "birthDate", true);

            JsonValue payload = GetField(input, "payload", true);
            // 원문 그대로 Encrypt 에 넘긴다 — 파싱 결과를 재직렬화하면 바이트열이 달라져
            // 벡터가 고정한 기대 암호값(encX)과 어긋난다.
            c.PayloadJson = payload.RawText;

            JsonValue expected = GetField(caseValue, "expected", true);
            if (expected.Kind != JsonKind.Object)
            {
                throw new FormatException(
                    "cases[" + index.ToString(CultureInfo.InvariantCulture) + "].expected 는 JSON 객체여야 합니다.");
            }
            c.ExpectedEncX = GetString(expected, "encX", true);
            c.ExpectedEncY = GetString(expected, "encY", true);
            c.ExpectedRequestUrl = GetString(expected, "requestUrl", true);

            return c;
        }

        private static JsonValue GetField(JsonValue obj, string name, bool required)
        {
            JsonValue value;
            if (obj.ObjectValue.TryGetValue(name, out value))
            {
                return value;
            }
            if (required)
            {
                throw new FormatException("필수 필드가 없습니다: " + name);
            }
            return null;
        }

        private static string GetString(JsonValue obj, string name, bool required)
        {
            JsonValue value = GetField(obj, name, required);
            if (value == null) return null;
            if (value.Kind != JsonKind.String)
                throw new FormatException("필드 '" + name + "' 는 문자열이어야 합니다.");
            return value.StringValue;
        }
    }
}
