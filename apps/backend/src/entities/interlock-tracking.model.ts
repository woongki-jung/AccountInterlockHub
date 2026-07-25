import { InterlockTrackingRow, ResultCode } from './interlock-tracking.entity';

/**
 * MDL-001 연동 추적 레코드 — 응용 계층 도메인 모델(model_MDL-001.md §속성 정의).
 * isResultFixed·isSuccess·isResultConfirmed·isCallbackReceived 는 저장되지 않는 파생값이다 —
 * 엔터티에 대응 컬럼이 없고 toInterlockTrackingModel() 이 매 조회마다 다시 산출한다. 두 값이
 * 어긋날 여지를 구조적으로 없앤 결과다(spec-datas.md §데이터 설계 원칙 6).
 */
export interface InterlockTrackingModel {
  trackingKey: string;
  resultCode: ResultCode | null;
  resultAt: Date | null;
  resultConfirmedAt: Date | null;
  callbackReceivedAt: Date | null;
  createdAt: Date;
  /** 파생 — result_code !== null. BIZ-002-03 3분기 판정의 기준이다. */
  readonly isResultFixed: boolean;
  /** 파생 — 결과 미확정이면 null, 확정이면 result_code === 'SUCCESS'. */
  readonly isSuccess: boolean | null;
  /** 파생 — result_confirmed_at !== null. */
  readonly isResultConfirmed: boolean;
  /** 파생 — callback_received_at !== null. */
  readonly isCallbackReceived: boolean;
}

/** ENT→도메인(model_MDL-001.md §엔터티 매핑) — 파생 4종을 이 지점에서 산출한다. */
export function toInterlockTrackingModel(row: InterlockTrackingRow): InterlockTrackingModel {
  return {
    trackingKey: row.tracking_key,
    resultCode: row.result_code,
    resultAt: row.result_at,
    resultConfirmedAt: row.result_confirmed_at,
    callbackReceivedAt: row.callback_received_at,
    createdAt: row.created_at,
    isResultFixed: row.result_code !== null,
    isSuccess: row.result_code === null ? null : row.result_code === 'SUCCESS',
    isResultConfirmed: row.result_confirmed_at !== null,
    isCallbackReceived: row.callback_received_at !== null,
  };
}

/**
 * 도메인→ENT(model_MDL-001.md §엔터티 매핑) — 직접 매핑(무변형) 6개 필드만 대상이다.
 * 파생 4종은 대응 컬럼이 없어 이 방향에 존재하지 않는다. 조건부 UPDATE("아직 비어 있을 때만" 등)
 * 같은 기록 규칙은 이 함수의 책임이 아니다 — PROC-301(P06)이 이 로우 셰이프를 받아 수행한다.
 */
export function toInterlockTrackingRow(model: InterlockTrackingModel): InterlockTrackingRow {
  return {
    tracking_key: model.trackingKey,
    result_code: model.resultCode,
    result_at: model.resultAt,
    result_confirmed_at: model.resultConfirmedAt,
    callback_received_at: model.callbackReceivedAt,
    created_at: model.createdAt,
  };
}
