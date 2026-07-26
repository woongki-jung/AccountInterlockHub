import { ConsentProofRow, ConsentSnapshot } from './consent-proof.entity';

/** MDL-002 동의 증적 — 응용 계층 도메인 모델(model_MDL-002.md §속성 정의). 생성 후 불변, 갱신 경로가 없다.
 *  전 속성 readonly(model_MDL-002.md §구현 가이드 "읽기 전용 구조로 둔다"). */
export interface ConsentProofModel {
  readonly consentProofId: string;
  readonly trackingKey: string;
  readonly consentedAt: Date;
  readonly consentVersion: string;
  readonly consentSnapshot: ConsentSnapshot;
  readonly agreedItemCodes: readonly string[];
}

/** ENT→도메인(model_MDL-002.md §엔터티 매핑) — 전 필드 직접 매핑. */
export function toConsentProofModel(row: ConsentProofRow): ConsentProofModel {
  return {
    consentProofId: row.consent_proof_id,
    trackingKey: row.tracking_key,
    consentedAt: row.consented_at,
    consentVersion: row.consent_version,
    consentSnapshot: row.consent_snapshot,
    agreedItemCodes: row.agreed_item_codes,
  };
}

/**
 * 도메인→ENT(model_MDL-002.md §엔터티 매핑) — 전 필드 직접 매핑.
 * ⚠️ consent_snapshot·agreed_item_codes 를 pg 파라미터로 바인딩할 때는 반드시 JSON.stringify() 로
 * 문자열화한 뒤 전달한다 — pg 는 일반 JS 배열을 Postgres 배열 리터럴(`{a,b}`)로 직렬화하므로
 * (JSON 배열 문자열이 아니다), agreed_item_codes(JSONB 배열)를 그대로 바인딩하면 잘못된 형태로
 * 기록되거나 저장이 실패한다. 이 직렬화는 실행 지점(PROC-302, P06)의 책임이며 본 매핑 함수는
 * 값 형태(도메인 모델 ↔ 로우 셰이프)만 다룬다.
 */
export function toConsentProofRow(model: ConsentProofModel): ConsentProofRow {
  return {
    consent_proof_id: model.consentProofId,
    tracking_key: model.trackingKey,
    consented_at: model.consentedAt,
    consent_version: model.consentVersion,
    consent_snapshot: model.consentSnapshot,
    agreed_item_codes: model.agreedItemCodes,
  };
}
