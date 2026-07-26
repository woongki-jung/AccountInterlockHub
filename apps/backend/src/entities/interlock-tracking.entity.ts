// ENT-001 연동 추적 레코드 — tbl_interlock_tracking 로우 셰이프(data_ENT-001.md §속성 정의).
// 컬럼명은 스네이크 케이스로 데이터베이스 컬럼명과 그대로 대응한다.

export const INTERLOCK_TRACKING_TABLE = 'tbl_interlock_tracking';

/** BIZ-001-01 결과 구분 값 체계 — 3종뿐이다. 네 번째 값(USER_DENIED 포함)을 두지 않는다. */
export const RESULT_CODE_VALUES = ['SUCCESS', 'DECRYPT_FAILED', 'DELIVERY_FAILED'] as const;
export type ResultCode = (typeof RESULT_CODE_VALUES)[number];

/**
 * tbl_interlock_tracking 1행 — 정확히 6컬럼(BAT-04_007). 이 타입 밖의 컬럼을 추가하지 않는다.
 * 처리 성공 여부·결과 확인 여부·콜백 수신 여부 컬럼은 여기 없다 — result_code·result_confirmed_at·
 * callback_received_at 에서 결정되는 파생값이라 컬럼으로 두지 않는다(spec-datas.md §데이터 설계 원칙 6.
 * MDL-001 이 ENT→도메인 변환 지점에서 매번 다시 산출한다).
 */
export interface InterlockTrackingRow {
  tracking_key: string;
  /** NULL = 결과 미확정. */
  result_code: ResultCode | null;
  result_at: Date | null;
  /** NULL = 결과 미확인. 값이 채워진 시점이 보관 기간(`<RETENTION_MONTHS>`) 기산점이다. */
  result_confirmed_at: Date | null;
  /** NULL = 완료 콜백 미수신. */
  callback_received_at: Date | null;
  created_at: Date;
}
