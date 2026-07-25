import { BirthDateFormatError } from './crypto.errors';

// yyMMdd 숫자 6자리. function_FN-005-006.md §FN-005 시그니처가 지정한 정규식 그대로다.
// ⚠️ 절대 "m"(multiline) 플래그를 붙이지 않는다 — JS 의 "$" 는 m 플래그가 없으면 문자열의
// 절대 끝에만 일치한다(.NET·Python 의 "$" 와 달리 끝의 개행 앞에서는 일치하지 않는다). 이
// 성질 덕분에 별도 앵커("\A"·"\z" 상당)를 쓰지 않아도 P17(연동 라이브러리)에서 발견된 것과
// 같은 "개행을 포함한 값이 통과하는" 결함이 재현되지 않는다 — 이 특성을 깨는 플래그 변경을
// 하지 않는다.
const BIRTH_DATE_PATTERN = /^\d{6}$/;

/**
 * FN-005 생년월일 형식 검증(`AUTH-002-02`, function_FN-005-006.md §FN-005). 달력 유효성
 * (존재하지 않는 월·일)은 검사하지 않는다 — 생년월일은 인증 자격이 아니라 **복호화의 나머지
 * 키**이며, 값이 맞는지는 복호화 성공 여부로만 판단한다(`EXC-AUTH-04`). 재입력 횟수를 세지
 * 않는다(`AUTH-002-04`) — 본 함수는 상태를 갖지 않는다.
 *
 * `FN-004`(복호화 판정)는 이 함수를 내부에서 호출하지 않는다 — 호출측(본인확인·연동 실행·
 * 자가진단 세 접점)이 `FN-004` 를 호출하기 전에 먼저 이 함수로 형식을 통과시켜야 한다
 * (function_FN-004.md §입력/출력 정의 "FN-005 로 형식을 먼저 통과시킨다").
 *
 * @throws {BirthDateFormatError} `EX-AUTH-001` — 값 부재·문자열이 아님·숫자 6자리가 아님.
 */
export function validateBirthDateFormat(birthDate: unknown): void {
  // 1. 존재 검사 — AUTH-002-02
  if (birthDate == null || typeof birthDate !== 'string') {
    throw new BirthDateFormatError('BIRTH_DATE_MISSING');
  }

  // 2. 형식 검사 — AUTH-002-02
  if (!BIRTH_DATE_PATTERN.test(birthDate)) {
    throw new BirthDateFormatError('BIRTH_DATE_FORMAT_INVALID');
  }

  // 3. 통과 (달력 유효성은 검사하지 않는다)
}
