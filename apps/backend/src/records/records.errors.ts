/**
 * FN-007~013 저장 계층이 던지는 저장 실패 사유 — 어느 단계에서 무엇이 어겨졌는지만 남긴다.
 * DATA-001-04 취지: 원문 값·바인딩 파라미터를 reason 문자열에 담지 않는다. 하부 pg 오류는
 * `cause` 로만 연결하고(런타임 진단용) 메시지·reason 에는 옮겨 적지 않는다.
 */
export type RecordWriteErrorReason =
  // FN-008 추적 레코드 확보
  | 'SECURE_INSERT_FAILED'
  | 'SECURE_RACE_LOOKUP_EMPTY'
  // FN-009 결과 구분 확정 기록
  | 'FIX_RESULT_INVALID_RESULT_CODE'
  | 'FIX_RESULT_UPDATE_FAILED'
  | 'FIX_RESULT_TARGET_MISSING'
  // FN-010 결과 확인 표시
  | 'CONFIRM_RESULT_UPDATE_FAILED'
  // FN-011 완료 콜백 기록
  | 'RECORD_CALLBACK_UPDATE_FAILED'
  | 'RECORD_CALLBACK_TARGET_MISSING'
  // FN-012 동의 증적 기록 — function_FN-012-013.md 시그니처의 `ConsentProofWriteError` 와 같은 의미
  | 'CONSENT_REQUIRED_ITEMS_NOT_MET'
  | 'CONSENT_UNKNOWN_ITEM_CODE'
  | 'CONSENT_PROOF_INSERT_FAILED'
  // FN-013 지표 카운터 갱신 — function_FN-012-013.md 시그니처의 `MetricWriteError` 와 같은 의미
  | 'METRIC_INVALID_EVENT_KIND'
  | 'METRIC_INVALID_RESULT_CODE'
  | 'METRIC_UPSERT_FAILED';

/**
 * `EX-BIZ-003`(500) — FN-007~013 이 공유하는 저장 실패 예외. function_FN-007-008.md 의
 * `RecordWriteError`·function_FN-009-011.md 의 `RecordWriteError`·function_FN-012-013.md 의
 * `ConsentProofWriteError`/`MetricWriteError` 는 이름만 다를 뿐 EX 코드·HTTP 상태·사용자 메시지가
 * 전부 같다(각 함수의 §에러 처리 표 참조) — 하나의 클래스로 통일하고 `reason` 으로 발생 지점만
 * 구분한다. 트랜잭션에 참여 중이면 호출측(DatabaseService.withTransaction)이 이 예외를 받아
 * 롤백한다.
 */
export class RecordWriteError extends Error {
  readonly exCode = 'EX-BIZ-003' as const;
  readonly httpStatus = 500 as const;

  constructor(
    readonly reason: RecordWriteErrorReason,
    cause?: unknown,
  ) {
    super('처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', cause !== undefined ? { cause } : undefined);
    this.name = 'RecordWriteError';
  }
}
