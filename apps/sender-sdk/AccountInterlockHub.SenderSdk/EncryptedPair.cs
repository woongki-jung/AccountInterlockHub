using System;

namespace AccountInterlockHub.SenderSdk
{
    /// <summary>
    /// 전달 데이터 암호화 결과인 encX·encY 쌍이다(MDL-004).
    /// 불변 타입이며 생성 후 값을 바꿀 수 없다 — 공개 진입점이 스레드 안전을 보장하는 근거 중 하나다.
    /// </summary>
    public sealed class EncryptedPair
    {
        private readonly string _encX;
        private readonly string _encY;

        // 발송처가 직접 생성하지 않는다 — 항상 InterlockRequestBuilder.Encrypt 의 반환값으로만 얻는다.
        internal EncryptedPair(string encX, string encY)
        {
            if (encX == null) throw new ArgumentNullException("encX");
            if (encY == null) throw new ArgumentNullException("encY");

            _encX = encX;
            _encY = encY;
        }

        /// <summary>전달 데이터(X)를 암호화한 값. Base64URL 인코딩·패딩 없음.</summary>
        public string EncX
        {
            get { return _encX; }
        }

        /// <summary><c>encX</c> 산출에 쓴 키를 생년월일로 암호화한 값. Base64URL 인코딩·패딩 없음.</summary>
        public string EncY
        {
            get { return _encY; }
        }
    }
}
