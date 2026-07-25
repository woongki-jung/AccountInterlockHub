using System.Collections.Generic;

namespace AccountInterlockHub.SenderSdk.Harness.Json
{
    /// <summary>JSON 값의 종류.</summary>
    internal enum JsonKind
    {
        Object,
        Array,
        String,
        Number,
        True,
        False,
        Null
    }

    /// <summary>
    /// 최소 JSON 파서(<see cref="MiniJsonParser"/>)가 만드는 값 노드다.
    /// <see cref="RawText"/> 에 원본 문자열에서 이 값이 차지하는 구간의 원문을 그대로 보관한다 —
    /// 규약 테스트 벡터의 <c>input.payload</c> 처럼 재직렬화 없이 원문 그대로 써야 하는 값이 있기 때문이다
    /// (재직렬화하면 바이트열이 달라져 AES 암호화 결과가 기대 출력과 어긋난다).
    /// </summary>
    internal sealed class JsonValue
    {
        internal JsonKind Kind;

        /// <summary>Kind == String 일 때의 디코딩된 문자열 값(이스케이프 해석 완료).</summary>
        internal string StringValue;

        /// <summary>Kind == Object 일 때의 멤버 맵(입력 순서는 보장하지 않는다).</summary>
        internal Dictionary<string, JsonValue> ObjectValue;

        /// <summary>Kind == Array 일 때의 항목 목록.</summary>
        internal List<JsonValue> ArrayValue;

        /// <summary>이 값이 원본 텍스트에서 차지한 구간의 원문(공백 포함하지 않음, 값의 시작~끝만).</summary>
        internal string RawText;
    }
}
