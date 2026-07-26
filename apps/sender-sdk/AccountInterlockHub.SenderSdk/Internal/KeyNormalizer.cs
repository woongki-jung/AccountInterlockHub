using System;
using System.Text;

namespace AccountInterlockHub.SenderSdk.Internal
{
    /// <summary>
    /// 키 32바이트 정규화·초기화 벡터 도출(FN-001). 허브 복호화 구현과 글자 그대로 같은 규칙이다
    /// (SEC-001-02·SEC-001-03·SEC-001-04). 공개 표면이 아니다 — 라이브러리 내부 전용 도구다
    /// (spec-functions-lib.md §형태·공개 표면: "내부 정규화·인코딩 도구를 공개하지 않는다").
    /// </summary>
    internal static class KeyNormalizer
    {
        private const int KeyLength = 32;
        private const int IvLength = 16;
        private const byte PaddingByte = 0x5F; // '_' — 정규화 패딩 문자(SEC-001 §규약 확정값)

        /// <summary>
        /// 키 원문 문자열을 UTF-8 바이트로 바꾼 뒤 32바이트로 정규화하고, 그 앞 16바이트를
        /// 초기화 벡터로 도출한다. 어떤 입력도 예외 없이 정규화된다.
        /// </summary>
        /// <param name="keySource">이어 붙이기를 이미 마친 키 원문(SEC-001-05·SEC-001-06).</param>
        internal static NormalizedKey Normalize(string keySource)
        {
            // 1. 인코딩 변환 — SEC-001-02
            byte[] raw = Encoding.UTF8.GetBytes(keySource);

            // 2. 길이 정규화 — SEC-001-03 (32바이트 초과: 앞 32바이트 절단 / 미만: '_' 우측 패딩)
            byte[] key = new byte[KeyLength];
            if (raw.Length >= KeyLength)
            {
                Array.Copy(raw, key, KeyLength);
            }
            else
            {
                Array.Copy(raw, key, raw.Length);
                for (int i = raw.Length; i < KeyLength; i++)
                {
                    key[i] = PaddingByte;
                }
            }

            // 3. 초기화 벡터 도출 — SEC-001-04 (정규화된 키의 앞 16바이트, 난수 IV 없음)
            byte[] iv = new byte[IvLength];
            Array.Copy(key, iv, IvLength);

            return new NormalizedKey(key, iv);
        }
    }

    /// <summary>정규화된 32바이트 키와 그로부터 도출한 16바이트 초기화 벡터의 쌍이다.</summary>
    internal struct NormalizedKey
    {
        internal readonly byte[] Key;
        internal readonly byte[] Iv;

        internal NormalizedKey(byte[] key, byte[] iv)
        {
            Key = key;
            Iv = iv;
        }
    }
}
