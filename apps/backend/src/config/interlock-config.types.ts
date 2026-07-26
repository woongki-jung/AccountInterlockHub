// MDL-022 연동 구성 상수 집합 · MDL-008 동의 항목 구성의 TypeScript 표현이다.
// 값의 단일 출처는 CLAUDE.env.md §연동 구성 상수 — 본 파일은 형태(타입)만 정의하고 값을 복제하지 않는다(OPS-001-04).

/** MDL-008 동의 항목 하나. 상수표가 정의한 속성 순서(코드·항목명·필수 여부·설명) 그대로다. */
export interface ConsentItemConfig {
  code: string;
  label: string;
  required: boolean;
  description: string;
}

/**
 * MDL-008 동의 항목 구성 — PROC-901 B4 산출물.
 * 기동 시 1회 산출되어 런타임 내내 읽힌다. PROC-103(동의 화면 노출)과 PROC-302(동의 증적 기록)가 같은 값을 쓴다.
 */
export interface ConsentConfig {
  /** 동의 항목 버전 식별자 — 소문자 16진수 64자 `^[0-9a-f]{64}$` */
  version: string;
  notice: string;
  /** 항목 코드 오름차순 정렬 */
  items: ConsentItemConfig[];
}

/**
 * MDL-022 연동 구성 상수 집합.
 * `<HUB_BASE_URL_PROD>`·`<HUB_BASE_URL_DEV>`는 발송처 호출 입력 값이라 이 모델에 담지 않는다(EXC-OPS-04 · SVC-018 F-007).
 */
export interface InterlockConfig {
  interlockEntryPath: string;
  selfcheckPath: string;
  receiverDeliveryUrl: string;
  consentNotice: string;
  retentionMonths: number;
  retentionMaxMonths: number;
  consentProofRetentionMonths: number;
  completionRedirectUrl: string;
}

/**
 * PROC-901 B3 형식 검증에서 검사하는 env 키 이름 — MDL-022 필수 상수 8종과 정확히 일치한다.
 * `CONSENT_NOTICE` 는 선택 상수이며 기동 시 형식 검증 대상이 아니므로 이 목록에 없다(MDL-022 · EXC-DATA-08).
 * 미충족 보고에는 이 이름만 남기고 값은 남기지 않는다(FN-015 취지).
 */
export type MissingConstantKey =
  | 'INTERLOCK_ENTRY_PATH'
  | 'SELFCHECK_PATH'
  | 'RECEIVER_DELIVERY_URL'
  | 'CONSENT_ITEMS'
  | 'RETENTION_MONTHS'
  | 'RETENTION_MAX_MONTHS'
  | 'CONSENT_PROOF_RETENTION_MONTHS'
  | 'COMPLETION_REDIRECT_URL';

export interface LoadInterlockConfigResult {
  /** 미충족(누락 또는 형식 위반) 상수명 목록. 모두 모아 한 번에 담는다 — 하나씩 실패시키지 않는다(OPS-001-02 구현 가이드). */
  missing: MissingConstantKey[];
  /** missing 이 비어 있을 때만 채워진다. */
  config?: InterlockConfig;
  /** missing 이 비어 있을 때만 채워진다. */
  consent?: ConsentConfig;
}
