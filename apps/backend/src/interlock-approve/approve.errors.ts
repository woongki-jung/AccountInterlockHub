// PROC-103 승인 제출 접점(POST <INTERLOCK_ENTRY_PATH>/approve) 전용 예외 — crypto/crypto.errors.ts·
// records/records.errors.ts 와 같은 관례(exCode·httpStatus readonly const, reason 은 내부
// 진단용 사유만 담고 원문 값을 담지 않는다 — DATA-001-04). 전역 예외 필터가 exCode 를
// 덕 타이핑으로 인식해(common/errors/http-mapped.error.ts) FN-014 엔벨로프로 변환한다.

/**
 * `EX-BIZ-001`(400) — 동의·승인 제출의 필수 동의 미충족(`BIZ-003-02`). 두 원인을 하나로
 * 묶는다(둘 다 같은 EX 코드·같은 메시지다 — spec-functions-api-user.md §동의·승인 제출 에러
 * 처리 표):
 * - `B1`(입력 DTO 재검증 — 형상만): `agreedItemCodes` 가 문자열 배열이 아니다(부재 포함).
 * - `B5b`(서버 재검증 — 값): 상수에 없는 항목 코드가 섞였거나, 필수 항목이 빠졌다.
 * 결과를 확정하지 않고 동의 화면으로 되돌린다 — 증적 기록·전달을 수행하지 않는다.
 */
export type ConsentValidationReason =
  // B1 — process_PROC-103-logic.md B1 "agreedItemCodes 가 문자열 배열이 아니다 (부재 포함)"
  | 'AGREED_ITEM_CODES_NOT_STRING_ARRAY'
  // B5b — 상수에 없는 코드
  | 'AGREED_ITEM_CODES_UNKNOWN_CODE'
  // B5b — 필수 항목 미충족
  | 'AGREED_ITEM_CODES_MISSING_REQUIRED';

export class ConsentValidationError extends Error {
  readonly exCode = 'EX-BIZ-001' as const;
  readonly httpStatus = 400 as const;

  constructor(readonly reason: ConsentValidationReason) {
    super('필수 동의 항목에 모두 동의해 주세요.');
    this.name = 'ConsentValidationError';
  }
}

/**
 * `EX-BIZ-002`(502) — PROC-104 `B4`·`B5` 수신처 전달이 즉시 재시도(`BIZ-004-02`)를 모두
 * 소진하고도 실패했을 때(`BIZ-004-03`). **오류처럼 다루지 않는다** — `result_code =
 * DELIVERY_FAILED` 확정은 이미 커밋된 뒤이며(PROC-103 `B8` 이 이 예외를 던지기 **전**에
 * PROC-301 `FIX_RESULT` 트랜잭션이 끝나 있다), 이 예외는 그 확정된 결과를 502 + 결과 경로
 * ③으로 화면에 옮기는 역할만 한다(process_PROC-103.md §구현 가이드 "EX-BIZ-002 를 오류처럼
 * 다루지 않는다 — 502 이지만 결과가 확정된 정상 종료").
 */
export class DeliveryFailedError extends Error {
  readonly exCode = 'EX-BIZ-002' as const;
  readonly httpStatus = 502 as const;

  constructor() {
    super('연동 대상 서비스에 전달하지 못했습니다.');
    this.name = 'DeliveryFailedError';
  }
}
