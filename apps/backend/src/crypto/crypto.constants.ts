// SEC-001 암호화 연동 규약 확정값(policy_SEC-crypto.md §규약 확정값) — 배포 환경마다 달라지지
// 않는 프로토콜 고정 상수다. `InterlockConfigService`(config/)가 주입하는 CLAUDE.env.md
// §연동 구성 상수(경로·URL·보관 기간 등, 배포 시점 값)와는 범주가 다르다 — 그 값들은 재배포 없이
// 바뀔 수 있지만, 이 상수들은 규약 자체의 일부라 바뀌면 SEC-001-12 에 따라 규약 버전을 올리고
// 라이브러리·허브를 함께 재배포해야 한다. 잠정값이 아니라 정책이 못박은 확정값이므로 설정
// 서비스 주입 대상이 아니라 여기 상수로 둔다.

/** 정규화된 대칭 키 길이(바이트) — SEC-001 §규약 확정값. */
export const NORMALIZED_KEY_LENGTH_BYTES = 32;

/** 초기화 벡터 길이(바이트) — SEC-001 §규약 확정값. */
export const IV_LENGTH_BYTES = 16;

/** AES 블록 크기(바이트). IV 길이와 값이 같지만(둘 다 128비트) 의미가 다른 별개 상수다 —
 *  암호문 길이가 이 값의 배수인지 판정(FN-003·SEC-002-02)하는 데 쓴다. */
export const CIPHER_BLOCK_SIZE_BYTES = 16;

/** 키 정규화 우측 채움 바이트 `_`(0x5F) — SEC-001-03. */
export const KEY_PAD_BYTE = 0x5f;

/** AES-256-CBC — SEC-001-01. 다른 블록 모드·패딩으로 바꾸지 않는다. */
export const CIPHER_ALGORITHM = 'aes-256-cbc';

/** 연동 추적 키 최대 길이(문자 수) — DATA-004-03·EXC-DATA-10. */
export const TRACKING_KEY_MAX_LENGTH = 255;

/** 생년월일 자리 수(`yyMMdd`) — AUTH-002-02. */
export const BIRTH_DATE_LENGTH = 6;
