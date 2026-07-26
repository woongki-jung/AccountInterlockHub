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

/**
 * `EX-BIZ-003`(500) — PROC-103 `B6` **전달 시도 표지 검사**(process_PROC-103-logic.md B6 ·
 * 2026-07-26 spec 회귀 `964e8d0`)가 이번 레코드의 기존 동의 증적을 발견했는데, 그 레코드의
 * 결과가 아직 **미확정**일 때. 증적은 `B7` 전달 **직전**에 커밋되므로 그 존재 자체가 "이
 * 레코드로 전달을 시도했다"는 표지이고(`BIZ-003-04`), 미확정이라는 것은 그 선행 요청이 아직
 * PROC-104 전달 구간에 있다는 뜻이다.
 *
 * **재제출은 안전하다** — 이 검사가 증적·전달을 둘 다 다시 막고, 그사이 결과가 확정됐으면
 * `ConsentApprovalService.submit()` 의 같은 분기가 그 결과를 재안내한다
 * (spec-functions-api-user.md §`EX-BIZ-003` 의 뜻(확정) 표 "전달 이후" 행 · process_PROC-103.md
 * §구현 가이드 "재제출이 증적·전달을 되풀이하지 않는 것은 `B6` 의 전달 시도 표지 검사가 이미
 * 보장한다"). `RecordWriteError`(records/records.errors.ts)를 재사용하지 않는 이유는 이 분기가
 * "쓰기 실패"가 아니라 **"쓰지 않기로 한 결정"**이기 때문이다 — `ConsentValidationError`·
 * `DeliveryFailedError` 와 같은 성격의 PROC-103 오케스트레이션 결정이라 이 파일에 둔다.
 */
export class DeliveryInProgressError extends Error {
  readonly exCode = 'EX-BIZ-003' as const;
  readonly httpStatus = 500 as const;

  constructor() {
    super('처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    this.name = 'DeliveryInProgressError';
  }
}

/**
 * `EX-BIZ-003`(500) — 방어적 분기. PROC-103 `B6` 이 추적 레코드 행을 잠그려 했으나(`FOR UPDATE`)
 * 대상 행이 없다. `B3`(PROC-301 `SECURE`)가 이번 요청 안에서 이미 그 행을 확보했으므로(생성
 * 또는 확인) 정상 호출에서는 도달하지 않는다 — 보관 삭제(PROC-304)는 월 단위 기산이라 같은
 * 요청 처리 중에 사라질 수 없다. `tracking-record.service.ts` 의 `SECURE_RACE_LOOKUP_EMPTY`·
 * `FIX_RESULT_TARGET_MISSING` 과 같은 "이론상 도달 불가 — 방어적으로 실패 처리한다" 관례를
 * 따르되, `B6` 의 잠금 조회는 `PROC-301`(`TrackingRecordProcessService`) 을 거치지 않는 이
 * 접점 자신의 SQL이라(process_PROC-103-logic.md B6 이 `SELECT … FOR UPDATE` 를 직접 적는다)
 * 그 파일의 `RecordWriteError` 대신 이 파일에 둔다.
 */
export class LockTargetMissingError extends Error {
  readonly exCode = 'EX-BIZ-003' as const;
  readonly httpStatus = 500 as const;

  constructor() {
    super('처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    this.name = 'LockTargetMissingError';
  }
}
