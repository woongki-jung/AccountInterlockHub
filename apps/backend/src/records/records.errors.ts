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
  | 'METRIC_UPSERT_FAILED'
  // PROC-301 kind 디스패처(B1 기록 계기 수신 — process_PROC-301.md B1 입력 재검증)
  | 'TRACKING_RECORD_INVALID_KIND'
  | 'TRACKING_RECORD_MISSING_EXEC'
  // DatabaseService.withTransaction 트랜잭션 경계 자체의 실패(FN-007~013 밖 — pool.connect()·
  // BEGIN·COMMIT 자체, 또는 work() 안에서 분류되지 않은 원시 쿼리 실패. 횡단 결함 시정 [C-2])
  | 'TX_BOUNDARY_FAILED';

/**
 * `EX-BIZ-003`(500) — FN-007~013 이 공유하는 저장 실패 예외. function_FN-007-008.md 의
 * `RecordWriteError`·function_FN-009-011.md 의 `RecordWriteError`·function_FN-012-013.md 의
 * `ConsentProofWriteError`/`MetricWriteError` 는 이름만 다를 뿐 EX 코드·HTTP 상태·사용자 메시지가
 * 전부 같다(각 함수의 §에러 처리 표 참조) — 하나의 클래스로 통일하고 `reason` 으로 발생 지점만
 * 구분한다. `DatabaseService.withTransaction` 은 이 예외를 두 가지 방식으로 다룬다 — work() 가
 * 이미 이 클래스로 던진 실패는 그대로 받아 롤백 후 재전파하고, `TX_BOUNDARY_FAILED`(트랜잭션
 * 경계 자체 — `pool.connect()`·`BEGIN`·`COMMIT`의 실패)는 그 함수 자신이 새로 만들어 던진다
 * (횡단 결함 시정 [C-2] — `database/database.service.ts` 참고).
 *
 * **사용자 노출 문구를 이 클래스가 들지 않는다** — `apps/backend/src/common/errors/ex-catalog.ts`
 * (FN-014)의 `EX_CODE_CATALOG['EX-BIZ-003'].message` 가 그 문구의 단일 출처이며, 전역 예외 필터
 * (`GlobalExceptionFilter`)는 예외의 `exCode` 만 읽어 그 카탈로그로 메시지를 다시 계산한다(
 * `common/errors/http-mapped.error.ts` — `exCode` 를 가진 예외는 이미 덕 타이핑으로 인식된다).
 * `Error.message` 는 `reason`(내부 진단 코드)을 그대로 담아 로그·스택 추적에서 어느 분기가
 * 실패했는지 식별하는 용도로만 쓴다 — 사용자에게 그대로 노출되지 않는다(DATA-001-04 준수 —
 * `reason` 값 자체가 원문·바인딩 파라미터를 담지 않으므로 노출 대상이 아니다).
 */
export class RecordWriteError extends Error {
  readonly exCode = 'EX-BIZ-003' as const;
  readonly httpStatus = 500 as const;

  constructor(
    readonly reason: RecordWriteErrorReason,
    cause?: unknown,
  ) {
    super(reason, cause !== undefined ? { cause } : undefined);
    this.name = 'RecordWriteError';
  }
}
