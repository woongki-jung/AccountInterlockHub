// 암호 규약 판정 실패를 나타내는 예외 클래스 — FN-002.decode·FN-003·FN-004·FN-005 가 던진다.
// 각 클래스는 정책 카탈로그(spec-policies.md §예외(EX) 코드 카탈로그)의 EX 코드를 그대로
// 옮긴다 — 새 코드·별칭·부분집합을 만들지 않는다. 이 Phase 는 접점(엔드포인트)을 만들지
// 않으므로 HTTP 응답으로 옮기는 것은 컨트롤러 계층(P07 이후)의 몫이다 — 그 계층은 exCode·
// httpStatus 를 읽어 오류 엔벨로프를 구성하면 된다.
//
// message 는 각 함수 사양의 "사용자 메시지" 칸(문서 정본)을 그대로 옮긴 값이라 응답에 그대로
// 노출해도 된다(SEC-002-05 가 요구하는 수준). reason 은 내부 진단용 사유 코드일 뿐이며 "어느
// 단계에서 어느 제약을 어겼는지" 이상의 정보(원문 값·길이·중간 계산값)를 담지 않는다 —
// 로그에 남기더라도 이 사유 코드까지만 남긴다(DATA-001-04). encX·encY·생년월일·복호화
// 원문·정규화 키 바이트열은 reason 문자열에도, message 에도 절대 담지 않는다.

/** FN-002.decode·FN-003·FN-004 단계 0 이 던지는 사유 — 생년월일 입력 이전에 판정 가능한 구조 위반. */
export type ProtocolFormatReason =
  // FN-002.decode(base64url.ts)
  | 'BASE64URL_EMPTY'
  | 'BASE64URL_CHARSET_INVALID'
  | 'BASE64URL_LENGTH_INVALID'
  | 'BASE64URL_DECODE_FAILED'
  // FN-003 구조 판정(cipher-pair.ts)
  | 'ENC_PAIR_MISSING'
  | 'ENC_X_EMPTY'
  | 'ENC_Y_EMPTY'
  | 'ENC_X_BLOCK_LENGTH_INVALID'
  | 'ENC_Y_BLOCK_LENGTH_INVALID'
  // PROC-101 B3 진입 파라미터 파싱(interlock-entry/entry-query.ts) — FN-003 호출 이전 단계.
  // 같은 이름의 쿼리 파라미터가 둘 이상이면 Express 가 배열로 담아 준다(SEC-001-08 대소문자·
  // 중복 판정, spec-functions-api.md §진입 파라미터 이름 "같은 이름의 파라미터가 둘 이상 오면
  // 구조 위반"). 같은 EX-SEC-001 이므로 새 예외 클래스를 만들지 않고 이 유니온에만 추가한다.
  | 'ENC_X_DUPLICATE'
  | 'ENC_Y_DUPLICATE';

/**
 * `EX-SEC-001`(400) — 구조 판정 실패(`SEC-002-02`). 암호 파라미터 부재·형식 위반·Base64URL
 * 디코드 실패·암호문 길이가 16의 배수가 아님. 생년월일을 몰라도 판정 가능하며 복호화를
 * 시도하지 않는다. 추적 레코드를 만들지 않고 지표에만 계수한다.
 */
export class ProtocolFormatError extends Error {
  readonly exCode = 'EX-SEC-001' as const;
  readonly httpStatus = 400 as const;

  constructor(readonly reason: ProtocolFormatReason) {
    super('연동 링크가 올바르지 않습니다.');
    this.name = 'ProtocolFormatError';
  }
}

/** FN-004 판정 1·2단계가 던지는 사유 — 생년월일 불일치와 구별되지 않는다. */
export type IdentityMismatchReason =
  | 'ENC_Y_DECRYPT_FAILED'
  | 'ENC_Y_KEY_LENGTH_INVALID'
  | 'ENC_X_DECRYPT_FAILED';

/**
 * `EX-AUTH-002`(400) — 복호화 판정 1·2단계 실패(`SEC-002-04`·`AUTH-002-03`). encY 복호화(패딩
 * 검증 포함) 실패·복원한 키 길이가 32바이트가 아님·encX 복호화(패딩 검증 포함) 실패 셋을
 * 하나로 묶는다 — 잘못된 생년월일과 구별할 수 없으므로 **결과를 확정하지 않고 재입력 안내로
 * 되돌린다**. 추적 레코드·지표 갱신이 없다. 재입력 횟수 제한도 없다(`AUTH-002-04`).
 */
export class IdentityMismatchError extends Error {
  readonly exCode = 'EX-AUTH-002' as const;
  readonly httpStatus = 400 as const;

  constructor(readonly reason: IdentityMismatchReason) {
    super('입력하신 생년월일로 확인되지 않았습니다. 다시 확인해 주세요.');
    this.name = 'IdentityMismatchError';
  }
}

/** FN-004 판정 3·4단계가 던지는 사유 — 두 겹의 패딩 검증을 통과한 뒤의 실패라 발송처 페이로드 문제로 본다(EXC-SEC-05). */
export type ProtocolViolationReason =
  | 'X_UTF8_OR_JSON_PARSE_FAILED'
  | 'X_PAYLOAD_NOT_OBJECT'
  | 'TRACKING_KEY_INVALID';

/**
 * `EX-SEC-002`(400) — 복호화 판정 3·4단계 실패(`SEC-002-03`). X 의 UTF-8/JSON 해석 실패·
 * 페이로드가 객체가 아님·`trackingKey` 부재 또는 형식 위반. 1·2단계(두 겹 PKCS#7 패딩 검증)를
 * 이미 통과했으므로 **발송처 페이로드의 규약 위반**으로 분류하고 결과 구분 `DECRYPT_FAILED`
 * 로 확정한다(`EXC-SEC-05`). 추적 키를 알 수 없어 추적 레코드는 만들지 않는다.
 */
export class ProtocolViolationError extends Error {
  readonly exCode = 'EX-SEC-002' as const;
  readonly httpStatus = 400 as const;

  constructor(readonly reason: ProtocolViolationReason) {
    super('연동 요청 정보가 규약과 맞지 않습니다.');
    this.name = 'ProtocolViolationError';
  }
}

/** FN-005 가 던지는 사유. */
export type BirthDateFormatReason = 'BIRTH_DATE_MISSING' | 'BIRTH_DATE_FORMAT_INVALID';

/**
 * `EX-AUTH-001`(400) — 생년월일 입력 형식 위반(`AUTH-002-02`). 값 부재·`yyMMdd` 숫자 6자리가
 * 아님. 복호화를 시도하지 않는다. 결과 미확정(재입력 안내와 같은 종류이지만 `SEC-002` 4단계
 * 판정에 들어가기 전 단계라 별도 코드다).
 */
export class BirthDateFormatError extends Error {
  readonly exCode = 'EX-AUTH-001' as const;
  readonly httpStatus = 400 as const;

  constructor(readonly reason: BirthDateFormatReason) {
    super('생년월일을 여섯 자리 숫자로 입력해 주세요.');
    this.name = 'BirthDateFormatError';
  }
}

/** FN-004 가 던질 수 있는 예외 전체(시그니처의 throws 합집합) — 컨트롤러 계층의 catch 타입 힌트용. */
export type DecryptionJudgmentError = ProtocolFormatError | IdentityMismatchError | ProtocolViolationError;
