using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace AccountInterlockHub.SenderSdk.Harness.Json
{
    /// <summary>
    /// 검증 하네스 전용 최소 JSON 파서다. 규약 테스트 벡터 파일(LIB-04 형식,
    /// spec-functions-lib.md §규약 테스트 벡터)을 읽는 용도로만 필요한 만큼 구현했다.
    ///
    /// 하네스는 라이브러리 산출물이 아니므로 라이브러리의 "JSON 직렬화기를 쓰지 않는다"
    /// 제약과는 별개다 — 다만 대상 런타임 밖의 외부 패키지 의존을 새로 만들지 않기 위해
    /// 프레임워크 내장 파서 대신 이 최소 구현을 골랐다(빌드 환경에 타게팅 팩이 없어
    /// System.Web.Extensions 같은 GAC 전용 어셈블리 참조 확보가 불확실하기도 하다).
    ///
    /// <see cref="Parse"/> 는 진입 시 입력의 개행을 LF 로 정규화한다(체크아웃 개행 규약과 무관하게
    /// 결정적인 결과를 내기 위함 — 아래 <see cref="Parse"/> 주석 참고) · 중첩 깊이 상한을 둔다
    /// (<see cref="MaxNestingDepth"/>).
    /// </summary>
    internal static class MiniJsonParser
    {
        // 중첩 깊이 상한 — 손상되거나 악의적인 벡터 파일(예: "[" 수만 개 연속)이 재귀 호출로
        // 스택을 소진하지 않도록 막는다. 벡터 파일의 실제 최대 중첩(루트→cases→case→input→payload→
        // payload 내부 필드 몇 단)은 한 자릿수 후반 수준이므로 64 는 정상 벡터에 여유가 충분하다.
        private const int MaxNestingDepth = 64;

        internal static JsonValue Parse(string text)
        {
            if (text == null) throw new ArgumentNullException("text");

            // 개행 정규화 계약(P17 코드리뷰 S-1) — 이 파서가 만드는 JsonValue.RawText 는 원본
            // 문자열의 부분 문자열 그대로다(예: VectorFile 이 input.payload 원문을 재직렬화 없이
            // Encrypt 인자로 쓴다). 저장소에 .gitattributes 가 없고 이 PC 는 core.autocrlf = true 라
            // 벡터 파일(protocol-test-vectors.json)이 여러 줄이면 체크아웃 OS 에 따라 파일의 개행이
            // CRLF/LF 로 갈릴 수 있고, 그 차이가 RawText 의 바이트열을 바꿔 같은 벡터가 다른 encX 를
            // 내게 된다. 파싱 전 모든 개행을 LF 하나로 정규화해 체크아웃 개행 규약과 무관하게 항상
            // 같은 결과가 나오도록 고정한다 — 이 하네스가 만드는 모든 RawText·문자열 값에 적용되는
            // 계약이다. (.gitattributes 도입은 P18 로 이월 — 이 정규화는 그와 무관하게 항상 유효하다.)
            text = text.Replace("\r\n", "\n").Replace("\r", "\n");

            int pos = 0;
            JsonValue result = ParseValue(text, ref pos, 0);
            SkipWhitespace(text, ref pos);
            if (pos != text.Length)
            {
                throw new FormatException(
                    "JSON 값 뒤에 예상치 못한 내용이 있습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
            }
            return result;
        }

        private static JsonValue ParseValue(string text, ref int pos, int depth)
        {
            SkipWhitespace(text, ref pos);
            if (pos >= text.Length)
                throw new FormatException("예상치 못하게 입력이 끝났습니다.");

            char c = text[pos];
            if (c == '{') return ParseObject(text, ref pos, depth);
            if (c == '[') return ParseArray(text, ref pos, depth);
            if (c == '"') return ParseString(text, ref pos);
            if (c == 't' || c == 'f') return ParseBool(text, ref pos);
            if (c == 'n') return ParseNull(text, ref pos);
            if (c == '-' || (c >= '0' && c <= '9')) return ParseNumber(text, ref pos);

            throw new FormatException("알 수 없는 JSON 토큰입니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
        }

        private static JsonValue ParseObject(string text, ref int pos, int depth)
        {
            depth = CheckDepth(depth, pos);

            int start = pos;
            Expect(text, ref pos, '{');
            Dictionary<string, JsonValue> members = new Dictionary<string, JsonValue>(StringComparer.Ordinal);

            SkipWhitespace(text, ref pos);
            if (Peek(text, pos) == '}')
            {
                pos++;
            }
            else
            {
                while (true)
                {
                    SkipWhitespace(text, ref pos);
                    JsonValue keyToken = ParseString(text, ref pos);
                    SkipWhitespace(text, ref pos);
                    Expect(text, ref pos, ':');
                    JsonValue value = ParseValue(text, ref pos, depth);
                    members[keyToken.StringValue] = value;

                    SkipWhitespace(text, ref pos);
                    char next = Peek(text, pos);
                    if (next == ',')
                    {
                        pos++;
                        continue;
                    }
                    if (next == '}')
                    {
                        pos++;
                        break;
                    }
                    throw new FormatException(
                        "객체 안에서 ',' 또는 '}' 를 기대했습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
                }
            }

            JsonValue result = new JsonValue();
            result.Kind = JsonKind.Object;
            result.ObjectValue = members;
            result.RawText = text.Substring(start, pos - start);
            return result;
        }

        private static JsonValue ParseArray(string text, ref int pos, int depth)
        {
            depth = CheckDepth(depth, pos);

            int start = pos;
            Expect(text, ref pos, '[');
            List<JsonValue> items = new List<JsonValue>();

            SkipWhitespace(text, ref pos);
            if (Peek(text, pos) == ']')
            {
                pos++;
            }
            else
            {
                while (true)
                {
                    JsonValue value = ParseValue(text, ref pos, depth);
                    items.Add(value);

                    SkipWhitespace(text, ref pos);
                    char next = Peek(text, pos);
                    if (next == ',')
                    {
                        pos++;
                        continue;
                    }
                    if (next == ']')
                    {
                        pos++;
                        break;
                    }
                    throw new FormatException(
                        "배열 안에서 ',' 또는 ']' 를 기대했습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
                }
            }

            JsonValue result = new JsonValue();
            result.Kind = JsonKind.Array;
            result.ArrayValue = items;
            result.RawText = text.Substring(start, pos - start);
            return result;
        }

        // 객체·배열에 진입할 때마다(중첩 한 단마다) 호출한다 — 증가한 깊이를 돌려주거나,
        // 상한을 넘으면 재귀를 더 내려가지 않고 바로 진단한다.
        private static int CheckDepth(int depth, int pos)
        {
            depth++;
            if (depth > MaxNestingDepth)
            {
                throw new FormatException(
                    "JSON 중첩 깊이가 상한(" + MaxNestingDepth.ToString(CultureInfo.InvariantCulture) +
                    ")을 초과했습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
            }
            return depth;
        }

        private static JsonValue ParseString(string text, ref int pos)
        {
            int start = pos;
            Expect(text, ref pos, '"');
            StringBuilder sb = new StringBuilder();

            while (true)
            {
                if (pos >= text.Length)
                    throw new FormatException("문자열이 닫히지 않았습니다.");

                char c = text[pos];
                if (c == '"')
                {
                    pos++;
                    break;
                }
                if (c == '\\')
                {
                    pos++;
                    if (pos >= text.Length)
                        throw new FormatException("문자열 이스케이프가 완성되지 않았습니다.");

                    char esc = text[pos];
                    switch (esc)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (pos + 4 >= text.Length)
                                throw new FormatException("\\u 이스케이프가 완성되지 않았습니다.");
                            string hex = text.Substring(pos + 1, 4);
                            int code = int.Parse(hex, NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);
                            sb.Append((char)code);
                            pos += 4;
                            break;
                        default:
                            throw new FormatException("알 수 없는 이스케이프 시퀀스입니다: \\" + esc);
                    }
                    pos++;
                }
                else
                {
                    sb.Append(c);
                    pos++;
                }
            }

            JsonValue result = new JsonValue();
            result.Kind = JsonKind.String;
            result.StringValue = sb.ToString();
            result.RawText = text.Substring(start, pos - start);
            return result;
        }

        private static JsonValue ParseBool(string text, ref int pos)
        {
            int start = pos;
            if (Match(text, pos, "true"))
            {
                pos += 4;
                JsonValue result = new JsonValue();
                result.Kind = JsonKind.True;
                result.RawText = text.Substring(start, pos - start);
                return result;
            }
            if (Match(text, pos, "false"))
            {
                pos += 5;
                JsonValue result = new JsonValue();
                result.Kind = JsonKind.False;
                result.RawText = text.Substring(start, pos - start);
                return result;
            }
            throw new FormatException("true/false 리터럴을 해석할 수 없습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
        }

        private static JsonValue ParseNull(string text, ref int pos)
        {
            int start = pos;
            if (Match(text, pos, "null"))
            {
                pos += 4;
                JsonValue result = new JsonValue();
                result.Kind = JsonKind.Null;
                result.RawText = text.Substring(start, pos - start);
                return result;
            }
            throw new FormatException("null 리터럴을 해석할 수 없습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
        }

        private static JsonValue ParseNumber(string text, ref int pos)
        {
            int start = pos;
            if (Peek(text, pos) == '-') pos++;
            while (pos < text.Length && text[pos] >= '0' && text[pos] <= '9') pos++;
            if (Peek(text, pos) == '.')
            {
                pos++;
                while (pos < text.Length && text[pos] >= '0' && text[pos] <= '9') pos++;
            }
            if (Peek(text, pos) == 'e' || Peek(text, pos) == 'E')
            {
                pos++;
                if (Peek(text, pos) == '+' || Peek(text, pos) == '-') pos++;
                while (pos < text.Length && text[pos] >= '0' && text[pos] <= '9') pos++;
            }

            if (pos == start)
                throw new FormatException("숫자 리터럴을 해석할 수 없습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");

            JsonValue result = new JsonValue();
            result.Kind = JsonKind.Number;
            result.RawText = text.Substring(start, pos - start);
            return result;
        }

        private static bool Match(string text, int pos, string literal)
        {
            if (pos + literal.Length > text.Length) return false;
            return string.CompareOrdinal(text, pos, literal, 0, literal.Length) == 0;
        }

        private static char Peek(string text, int pos)
        {
            if (pos >= text.Length) return '\0';
            return text[pos];
        }

        private static void Expect(string text, ref int pos, char expected)
        {
            if (pos >= text.Length || text[pos] != expected)
            {
                throw new FormatException(
                    "'" + expected + "' 를 기대했습니다(위치 " + pos.ToString(CultureInfo.InvariantCulture) + ").");
            }
            pos++;
        }

        private static void SkipWhitespace(string text, ref int pos)
        {
            while (pos < text.Length)
            {
                char c = text[pos];
                if (c == ' ' || c == '\t' || c == '\r' || c == '\n')
                {
                    pos++;
                }
                else
                {
                    break;
                }
            }
        }
    }
}
