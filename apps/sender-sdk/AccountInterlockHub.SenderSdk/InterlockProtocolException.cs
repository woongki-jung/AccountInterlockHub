using System;
using System.Runtime.Serialization;

namespace AccountInterlockHub.SenderSdk
{
    /// <summary>
    /// 암호화 연동 규약(SEC-001) 위반을 알리는 전용 예외다. 호출 오류(ArgumentException 계열)·
    /// 런타임 오류(그대로 전파)와 구분되는 3층 오류 구조의 가운데 층이다(BR-020).
    /// <see cref="ReasonCode"/> 는 정책 예외 코드 카탈로그(spec-policies.md §예외(EX) 코드 카탈로그)의
    /// 값을 그대로 쓴다 — 라이브러리 전용 코드 체계를 두지 않는다.
    /// </summary>
    [Serializable]
    public sealed class InterlockProtocolException : Exception
    {
        private readonly string _reasonCode;

        /// <summary>
        /// 사유 코드만으로 예외를 만든다. 메시지는 사유 코드가 가리키는 위반 제약을
        /// 값 없이 일반화한 문구로 내부에서 채운다(DATA-001-04 — 값 자체는 담지 않는다).
        /// </summary>
        /// <param name="reasonCode">정책 예외 코드 카탈로그의 EX 코드(예: "EX-AUTH-001").</param>
        public InterlockProtocolException(string reasonCode)
            : this(reasonCode, DescribeReason(reasonCode))
        {
        }

        // 같은 사유 코드라도 발생 지점에 따라(예: EX-SEC-004 가 평문 상한인지 URL 길이 상한인지)
        // 조금 더 구체적이지만 여전히 값을 담지 않는 메시지를 내부에서 골라 쓰기 위한 오버로드.
        // 공개 계약은 한 인자 생성자뿐이므로 이 오버로드는 어셈블리 내부에서만 쓴다.
        internal InterlockProtocolException(string reasonCode, string message)
            : base(message)
        {
            _reasonCode = reasonCode;
        }

        private InterlockProtocolException(SerializationInfo info, StreamingContext context)
            : base(info, context)
        {
            _reasonCode = info.GetString("ReasonCode");
        }

        /// <summary>정책 예외 코드 카탈로그의 EX 코드 문자열.</summary>
        public string ReasonCode
        {
            get { return _reasonCode; }
        }

        public override void GetObjectData(SerializationInfo info, StreamingContext context)
        {
            if (info == null) throw new ArgumentNullException("info");
            info.AddValue("ReasonCode", _reasonCode);
            base.GetObjectData(info, context);
        }

        private static string DescribeReason(string reasonCode)
        {
            switch (reasonCode)
            {
                case "EX-AUTH-001":
                    return "생년월일 형식이 연동 규약과 일치하지 않습니다(yyMMdd 6자리 숫자).";
                case "EX-SEC-002":
                    return "전달 데이터가 JSON 객체 형태가 아닙니다.";
                case "EX-SEC-004":
                    return "연동 규약이 정한 크기 상한을 초과했습니다.";
                default:
                    return "연동 규약을 위반했습니다.";
            }
        }
    }
}
