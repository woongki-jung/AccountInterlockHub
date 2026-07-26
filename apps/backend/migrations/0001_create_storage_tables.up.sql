-- 0001_create_storage_tables.up.sql
-- 저장 3종 원칙(DATA-001-01) — 이 마이그레이션이 만드는 테이블은 ENT-001~003 셋뿐이다.
-- 물리 FK 없음(spec-datas.md §엔터티 관계 요약 — 보존 기간 상이) · 논리 삭제 컬럼 없음(하드 삭제만) ·
-- 생성자·수정자·범용 수정 일시 컬럼 없음(AUTH-001 인증 부재) ·
-- 파생값(처리 성공 여부·결과 확인 여부·콜백 수신 여부·성공률) 컬럼 없음(spec-datas.md §데이터 설계 원칙 6).
-- 마이그레이션 이력 테이블을 별도로 두지 않는다 — 저장 대상 3 테이블 외 어떤 테이블도 만들지 않기 위해
-- 모든 DDL 을 IF NOT EXISTS 로 작성해 재실행해도 안전(멱등)하게 했다(apps/backend/src/database/migrate.ts 참고).
-- 정본: docs/specs/datas/spec-datas.md · data_ENT-001.md · data_ENT-002.md · data_ENT-003.md

-- ============================================================
-- ENT-001 연동 추적 레코드 (data_ENT-001.md)
-- 연동 1건의 진행·결과를 추적 키 기준 단일 레코드에 기록한다. 정확히 6컬럼.
-- ============================================================
CREATE TABLE IF NOT EXISTS tbl_interlock_tracking (
  tracking_key          VARCHAR(255) NOT NULL,
  result_code           VARCHAR(20)  NULL DEFAULT NULL,
  result_at             TIMESTAMPTZ  NULL DEFAULT NULL,
  result_confirmed_at   TIMESTAMPTZ  NULL DEFAULT NULL,
  callback_received_at  TIMESTAMPTZ  NULL DEFAULT NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT pk_interlock_tracking
    PRIMARY KEY (tracking_key),

  -- DATA-004-03 · EXC-DATA-10 — 1자 이상(공백만은 불가). 상한(255자)은 컬럼 길이(VARCHAR(255))가 담당한다.
  CONSTRAINT ck_interlock_tracking_tracking_key_length
    CHECK (char_length(btrim(tracking_key)) >= 1),

  -- BIZ-001-01 — 결과 구분은 3종뿐이다. USER_DENIED(사용자 거부)는 값 체계에서 제거됐다
  -- (도달 불가능한 값을 제약에 남기면 발송처가 쓸모없는 처리 분기를 만든다).
  CONSTRAINT ck_interlock_tracking_result_code
    CHECK (result_code IN ('SUCCESS', 'DECRYPT_FAILED', 'DELIVERY_FAILED')),

  -- data_ENT-001.md §속성 정의 — 결과 구분과 처리 일시는 항상 함께 채워진다(한쪽만 채워진 행 금지).
  CONSTRAINT ck_result_pair
    CHECK ((result_code IS NULL) = (result_at IS NULL))
);

-- PROC-304 삭제 대상 산정 — 결과 확인 완료 기산(부분 인덱스: 미확인 행은 이 기준의 대상이 아니다).
CREATE INDEX IF NOT EXISTS idx_interlock_tracking_result_confirmed_at
  ON tbl_interlock_tracking (result_confirmed_at)
  WHERE result_confirmed_at IS NOT NULL;

-- PROC-304 삭제 대상 산정 — 생성 기산 절대 상한.
CREATE INDEX IF NOT EXISTS idx_interlock_tracking_created_at
  ON tbl_interlock_tracking (created_at);


-- ============================================================
-- ENT-002 동의 증적 (data_ENT-002.md)
-- 승인 확정 시점의 동의 사실을 사후 입증 가능한 형태로 남긴다. 생성 후 불변. 정확히 6컬럼.
-- ============================================================
CREATE TABLE IF NOT EXISTS tbl_consent_proof (
  -- 대리 키를 쓰는 이유 — 보관 기간이 지나 추적 레코드가 삭제된 뒤 같은 추적 키가 재수신되면(EXC-BIZ-04)
  -- 새 승인이 새 증적을 남기는데 앞선 증적이 아직 보존 기간 안일 수 있어, 같은 tracking_key 의 증적이
  -- 시간차로 공존할 수 있다 — tracking_key 를 키로 쓸 수 없다.
  consent_proof_id   UUID         NOT NULL DEFAULT gen_random_uuid(),
  tracking_key       VARCHAR(255) NOT NULL,
  consented_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  consent_version    VARCHAR(64)  NOT NULL,
  consent_snapshot   JSONB        NOT NULL,
  agreed_item_codes  JSONB        NOT NULL,

  CONSTRAINT pk_consent_proof
    PRIMARY KEY (consent_proof_id),

  CONSTRAINT ck_consent_proof_tracking_key_length
    CHECK (char_length(btrim(tracking_key)) >= 1),

  -- data_ENT-002.md §버전 식별자 산출 규칙 — SHA-256 다이제스트를 소문자 16진수 64자로 표기한 값.
  CONSTRAINT ck_consent_proof_consent_version_format
    CHECK (consent_version ~ '^[0-9a-f]{64}$'),

  CONSTRAINT ck_consent_proof_snapshot_is_object
    CHECK (jsonb_typeof(consent_snapshot) = 'object'),

  CONSTRAINT ck_consent_proof_agreed_items_is_array
    CHECK (jsonb_typeof(agreed_item_codes) = 'array')
);

-- PROC-304 삭제 대상 산정 — 동의 일시 기산. tracking_key 인덱스는 두지 않는다
-- (증적을 추적 키로 조회하는 PROC 가 0건 — data_ENT-002.md §인덱스 정의).
CREATE INDEX IF NOT EXISTS idx_consent_proof_consented_at
  ON tbl_consent_proof (consented_at);


-- ============================================================
-- ENT-003 연동 지표 집계 (data_ENT-003.md)
-- 일자별 요청·결과 구분 건수만 누적한다. 개인정보·추적 키 없음 — 보관 배치 삭제 대상이 아니다. 정확히 5컬럼.
-- ============================================================
CREATE TABLE IF NOT EXISTS tbl_interlock_metric_daily (
  metric_date            DATE   NOT NULL,
  request_count          BIGINT NOT NULL DEFAULT 0,
  success_count          BIGINT NOT NULL DEFAULT 0,
  decrypt_failed_count   BIGINT NOT NULL DEFAULT 0,
  delivery_failed_count  BIGINT NOT NULL DEFAULT 0,

  CONSTRAINT pk_interlock_metric_daily
    PRIMARY KEY (metric_date),

  -- BIZ-005-01 — 카운터 4개 분리 저장(요청 수 1 + 결과 구분 3). 거부 카운터·파생 비율 컬럼을 두지 않는다.
  -- 행 단위 등식(3종 합 = request_count) CHECK 는 의도적으로 두지 않는다 — 결과 미확정 종료·일자 경계를
  -- 걸친 연동으로 합계가 어긋날 수 있는 것이 정상 상태다(data_ENT-003.md §행 단위 합계에 제약을 두지 않는 이유).
  CONSTRAINT ck_interlock_metric_daily_request_count_nonneg
    CHECK (request_count >= 0),
  CONSTRAINT ck_interlock_metric_daily_success_count_nonneg
    CHECK (success_count >= 0),
  CONSTRAINT ck_interlock_metric_daily_decrypt_failed_count_nonneg
    CHECK (decrypt_failed_count >= 0),
  CONSTRAINT ck_interlock_metric_daily_delivery_failed_count_nonneg
    CHECK (delivery_failed_count >= 0)
);
-- 삭제용 인덱스를 두지 않는다(DATA-002-03 — 보관 배치 삭제 대상이 아니다). 기간 조회도 기본 키가 처리한다.
