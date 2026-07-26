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

/**
 * X 평문(UTF-8 직렬화 후) 크기 상한(바이트) — SEC-001-09 §규약 확정값(policy_SEC-crypto.md:40).
 * 라이브러리 암호화 호출·자가진단(API-04) 경계에서 검사 대상이다(FN-003 은 판정하지 않는다 —
 * function_FN-001-003.md §FN-003 §에러 처리 "연동 요청 URL 전체 길이 상한은 본 기능이 판정하지
 * 않는다"와 대칭으로, X 평문 상한도 이 파일이 아니라 각 사용처가 검사한다). P07(PROC-101)은 이
 * 상수를 직접 쓰지 않지만, SEC-001-09·SEC-001-10 은 같은 §규약 확정값 표의 항목이라 매직 넘버
 * 중복을 막기 위해 이 파일 하나에 함께 둔다(accountinterlockhub#484 인계 사항 §4).
 */
export const X_PLAINTEXT_MAX_LENGTH_BYTES = 1024;

/**
 * 연동 요청 URL 전체 길이 상한(문자 수) — SEC-001-10 §규약 확정값(policy_SEC-crypto.md:41).
 * 원본 요청 URL 을 가진 접점은 진입(PROC-101)뿐이라 `PROC-101` `B2` 가 진입 시점에 판정한다
 * (function_FN-001-003.md §FN-003 §에러 처리 같은 문장).
 */
export const INTERLOCK_REQUEST_URL_MAX_LENGTH_CHARS = 2000;

/**
 * 규약 버전 `<MAJOR>.<MINOR>` — SEC-001-11 §규약 확정값(policy_SEC-crypto.md:42). 배포
 * 환경마다 달라지지 않는 프로토콜 고정 상수라 이 파일의 다른 상수들과 같은 이유로 설정
 * 서비스(연동 구성 상수) 주입 대상이 아니다 — 규약을 바꾸면 `SEC-001-12` 에 따라 라이브러리와
 * 허브를 함께 재배포하고 이 값도 함께 올린다. 연동 규약 자가진단 API(`API-04`, `PROC-204` `B6`)
 * 응답에 그대로 실려 발송처 라이브러리 상수와 대조된다(`BR-017`) — 연동 라이브러리
 * `InterlockRequestBuilder.ProtocolVersion`(`apps/sender-sdk/AccountInterlockHub.SenderSdk/
 * InterlockRequestBuilder.cs`)과 **값이 반드시 같아야 한다**(실측 확인 — 두 상수 모두 `1.0`).
 */
export const PROTOCOL_VERSION = '1.0';
