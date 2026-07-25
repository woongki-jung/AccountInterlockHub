// ENT-002 동의 증적 — tbl_consent_proof 로우 셰이프(data_ENT-002.md §속성 정의). 생성 후 불변.

export const CONSENT_PROOF_TABLE = 'tbl_consent_proof';

/** consent_snapshot.items 원소 — data_ENT-002.md §스냅샷 구조. 상수표(`<CONSENT_ITEMS>`)가 정의한 속성 전부를 담는다. */
export interface ConsentSnapshotItem {
  code: string;
  label: string;
  required: boolean;
  description: string;
}

/** consent_snapshot(JSONB) 최상위 구조 — notice(그 시점 안내 문구 원문) + items(항목 코드 오름차순) 둘뿐이다. */
export interface ConsentSnapshot {
  notice: string;
  items: ConsentSnapshotItem[];
}

/**
 * tbl_consent_proof 1행 — 정확히 6컬럼(BAT-05_001). U(수정) 수행 PROC 이 없다(생성 후 불변 —
 * ENT-002 CRUD 수행 PROC: C = PROC-302 / R = 없음 / U = 없음 / D = PROC-304).
 */
export interface ConsentProofRow {
  consent_proof_id: string;
  tracking_key: string;
  consented_at: Date;
  /** 소문자 16진수 64자 — data_ENT-002.md §버전 식별자 산출 규칙. */
  consent_version: string;
  consent_snapshot: ConsentSnapshot;
  /** 사용자가 실제로 동의한 항목 코드. 각 코드는 같은 행 consent_snapshot.items 의 코드 안에 있어야
   *  한다 — DB 제약이 아니라 응용 계층에서 확인한다(data_ENT-002.md §구현 가이드). */
  agreed_item_codes: string[];
}
