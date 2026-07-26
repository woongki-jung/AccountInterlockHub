using System;
using System.Text;

namespace AccountInterlockHub.SenderSdk.Internal
{
    /// <summary>
    /// Base64URL 전달 인코딩(FN-002 의 encode 절반, SEC-001-08). RFC 4648 §5 —
    /// 표준 Base64 의 '+'→'-', '/'→'_' 로 치환하고 패딩 '=' 을 제거한다.
    /// 공개 표면이 아니다 — 라이브러리 내부 전용 도구다.
    /// </summary>
    internal static class Base64UrlEncoder
    {
        internal static string Encode(byte[] raw)
        {
            if (raw == null) throw new ArgumentNullException("raw");

            // 1. 표준 Base64 인코딩
            string standard = Convert.ToBase64String(raw);

            // 2. 알파벳 치환·패딩 제거 — SEC-001-08
            StringBuilder result = new StringBuilder(standard.Length);
            for (int i = 0; i < standard.Length; i++)
            {
                char c = standard[i];
                if (c == '+')
                {
                    result.Append('-');
                }
                else if (c == '/')
                {
                    result.Append('_');
                }
                else if (c == '=')
                {
                    // 표준 Base64 의 '=' 패딩은 항상 문자열 끝에만 나타나므로 건너뛰어도 안전하다.
                }
                else
                {
                    result.Append(c);
                }
            }

            return result.ToString();
        }
    }
}
