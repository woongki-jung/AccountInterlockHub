// ENT-002 동의 증적 — tbl_consent_proof 로우 셰이프(data_ENT-002.md §속성 정의). 생성 후 불변.

export const CONSENT_PROOF_TABLE = 'tbl_consent_proof';

/** consent_snapshot.items 원소 — data_ENT-002.md §스냅샷 구조. 상수표(`<CONSENT_ITEMS>`)가 정의한 속성 전부를 담는다.
 *  전 속성 readonly — model_MDL-002.md §구현 가이드 "스냅샷과 동의 목록을 읽기 전용 구조로 둔다". */
export interface ConsentSnapshotItem {
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly description: string;
}

/** consent_snapshot(JSONB) 최상위 구조 — notice(그 시점 안내 문구 원문) + items(항목 코드 오름차순) 둘뿐이다.
 *  전 속성 readonly(model_MDL-002.md §구현 가이드). */
export interface ConsentSnapshot {
  readonly notice: string;
  readonly items: readonly ConsentSnapshotItem[];
}

/**
 * tbl_consent_proof 1행 — 정확히 6컬럼(BAT-05_001). U(수정) 수행 PROC 이 없다(생성 후 불변 —
 * ENT-002 CRUD 수행 PROC: C = PROC-302 / R = 없음 / U = 없음 / D = PROC-304).
 * 전 속성 readonly — model_MDL-002.md §구현 가이드 "생성 후 불변이라는 성질을 타입으로 강제하면
 * 갱신 코드가 생기지 않는다".
 */
export interface ConsentProofRow {
  readonly consent_proof_id: string;
  readonly tracking_key: string;
  readonly consented_at: Date;
  /** 소문자 16진수 64자 — data_ENT-002.md §버전 식별자 산출 규칙. */
  readonly consent_version: string;
  readonly consent_snapshot: ConsentSnapshot;
  /** 사용자가 실제로 동의한 항목 코드. 각 코드는 같은 행 consent_snapshot.items 의 코드 안에 있어야
   *  한다 — DB 제약이 아니라 응용 계층에서 확인한다(data_ENT-002.md §구현 가이드). */
  readonly agreed_item_codes: readonly string[];
}
