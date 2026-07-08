import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 초기 스키마 — 데이터 정의서(docs/specs/datas)의 ENT-001~007 전체를 생성한다.
 *
 * 설계 근거(정확 재현 목적으로 raw SQL DDL 사용):
 *  - uuid PK 기본값 gen_random_uuid()(PostgreSQL 13+ 코어 함수, pgcrypto 확장 불요).
 *  - timestamptz(3)(밀리초, UTC 저장 권장), boolean 상태 플래그.
 *  - 부분 유니크 인덱스(UQ_CONFIG_CODE, WHERE deleted_at IS NULL) — 소프트 삭제 코드 재사용 허용.
 *  - 상태·이력의 보존 부분 인덱스(WHERE 절)로 배치 삭제 두 갈래를 각각 지원.
 *  - CHECK 로 URL 형식·enum·정합(확인 여부↔확인 일시)을 DB 레벨 강제.
 *  - 순환 FK(ENT-001.user_key_param_id → ENT-003.id, ENT-003.config_id → ENT-001.id):
 *    ENT-001·ENT-003 을 먼저 만들고, ENT-001 의 지정 참조 FK 를 이후 ALTER 로 추가한다.
 *  - ON DELETE 이원화: 정의 자식(002·003)=CASCADE(안전망), 트랜잭션 자식(004·007)=NO ACTION,
 *    지정 참조(user_key_param_id)=RESTRICT. ON UPDATE 는 전부 기본값 NO ACTION(생략).
 *  - 고변경 테이블(004·007)은 autovacuum_vacuum_scale_factor=0.05 로 하향(spec 확정 기본안).
 */
export class InitSchema1720000000000 implements MigrationInterface {
  name = 'InitSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENT-001 연동 구성 (TBL_INTERLOCK_CONFIG) ── 지정 참조 FK 는 ENT-003 생성 후 추가
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_CONFIG" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "config_code" varchar(64) NOT NULL,
        "config_name" varchar(100) NOT NULL,
        "service_a_entry_url" varchar(2048) NOT NULL,
        "service_b_delivery_url" varchar(2048) NOT NULL,
        "service_b_http_method" varchar(10) NOT NULL DEFAULT 'POST',
        "user_key_param_id" uuid NULL DEFAULT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz(3) NOT NULL DEFAULT now(),
        "created_by" varchar(64) NOT NULL,
        "updated_at" timestamptz(3) NULL DEFAULT NULL,
        "updated_by" varchar(64) NULL DEFAULT NULL,
        "deleted_at" timestamptz(3) NULL DEFAULT NULL,
        CONSTRAINT "PK_INTERLOCK_CONFIG" PRIMARY KEY ("id"),
        CONSTRAINT "CK_CONFIG_CODE_LEN" CHECK (length("config_code") > 0),
        CONSTRAINT "CK_CONFIG_NAME_LEN" CHECK (length("config_name") > 0),
        CONSTRAINT "CK_CONFIG_URL_A" CHECK ("service_a_entry_url" LIKE 'http://%' OR "service_a_entry_url" LIKE 'https://%'),
        CONSTRAINT "CK_CONFIG_URL_B" CHECK ("service_b_delivery_url" LIKE 'http://%' OR "service_b_delivery_url" LIKE 'https://%'),
        CONSTRAINT "CK_CONFIG_METHOD" CHECK ("service_b_http_method" IN ('GET','POST','PUT','PATCH'))
      )
    `);
    // 부분 유니크: 유효(미삭제) 구성 간 config_code 고유성만 강제, 소프트 삭제분 재사용 허용
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_CONFIG_CODE" ON "TBL_INTERLOCK_CONFIG" ("config_code") WHERE "deleted_at" IS NULL`,
    );
    // 목록 조회·필터·정렬(PROC-102): 미삭제분 대상 (is_active, created_at DESC)
    await queryRunner.query(
      `CREATE INDEX "IX_CONFIG_LIST" ON "TBL_INTERLOCK_CONFIG" ("is_active", "created_at" DESC) WHERE "deleted_at" IS NULL`,
    );

    // ── ENT-002 연동 구성 동의 항목 (TBL_INTERLOCK_CONSENT_ITEM) ──
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_CONSENT_ITEM" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "config_id" uuid NOT NULL,
        "item_label" varchar(200) NOT NULL,
        "item_description" varchar(1000) NULL DEFAULT NULL,
        "terms_content" text NULL DEFAULT NULL,
        "is_required" boolean NOT NULL DEFAULT false,
        "display_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_CONSENT_ITEM" PRIMARY KEY ("id"),
        CONSTRAINT "CK_CONSENT_LABEL_LEN" CHECK (length("item_label") > 0),
        CONSTRAINT "CK_CONSENT_ORDER" CHECK ("display_order" >= 0),
        CONSTRAINT "FK_CONSENT_CONFIG" FOREIGN KEY ("config_id")
          REFERENCES "TBL_INTERLOCK_CONFIG" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IX_CONSENT_CONFIG" ON "TBL_INTERLOCK_CONSENT_ITEM" ("config_id", "display_order")`,
    );

    // ── ENT-003 연동 구성 전달 파라미터 (TBL_INTERLOCK_PARAMETER) ──
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_PARAMETER" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "config_id" uuid NOT NULL,
        "param_name" varchar(100) NOT NULL,
        "source_key_a" varchar(100) NOT NULL,
        "deliver_to_b" boolean NOT NULL DEFAULT true,
        "is_required" boolean NOT NULL DEFAULT false,
        "display_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_INTERLOCK_PARAMETER" PRIMARY KEY ("id"),
        CONSTRAINT "CK_PARAM_NAME_LEN" CHECK (length("param_name") > 0),
        CONSTRAINT "CK_PARAM_SRC_LEN" CHECK (length("source_key_a") > 0),
        CONSTRAINT "CK_PARAM_ORDER" CHECK ("display_order" >= 0),
        CONSTRAINT "FK_PARAM_CONFIG" FOREIGN KEY ("config_id")
          REFERENCES "TBL_INTERLOCK_CONFIG" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IX_PARAM_CONFIG" ON "TBL_INTERLOCK_PARAMETER" ("config_id", "display_order")`,
    );

    // 순환 FK 마무리: ENT-001 의 사용자 키값 파라미터 지정 참조(정확히 1개 필수는 응용 검증,
    // DB 는 RESTRICT 로 지정 유지 상태 파라미터의 삭제만 차단 — BIZ-001-07 안전망)
    await queryRunner.query(`
      ALTER TABLE "TBL_INTERLOCK_CONFIG"
        ADD CONSTRAINT "FK_CONFIG_USERKEY_PARAM" FOREIGN KEY ("user_key_param_id")
          REFERENCES "TBL_INTERLOCK_PARAMETER" ("id") ON DELETE RESTRICT
    `);

    // ── ENT-005 관리자 계정 (TBL_ADMIN_ACCOUNT) ──
    await queryRunner.query(`
      CREATE TABLE "TBL_ADMIN_ACCOUNT" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" varchar(64) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "failed_login_count" integer NOT NULL DEFAULT 0,
        "locked_until" timestamptz(3) NULL DEFAULT NULL,
        "last_login_at" timestamptz(3) NULL DEFAULT NULL,
        "created_at" timestamptz(3) NOT NULL DEFAULT now(),
        "created_by" varchar(64) NULL DEFAULT NULL,
        "updated_at" timestamptz(3) NULL DEFAULT NULL,
        "updated_by" varchar(64) NULL DEFAULT NULL,
        CONSTRAINT "PK_ADMIN_ACCOUNT" PRIMARY KEY ("id"),
        CONSTRAINT "CK_ADMIN_USERNAME_LEN" CHECK (length("username") > 0),
        CONSTRAINT "CK_ADMIN_FAILCOUNT" CHECK ("failed_login_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ADMIN_USERNAME" ON "TBL_ADMIN_ACCOUNT" ("username")`,
    );

    // ── ENT-006 감사 로그 (TBL_AUDIT_LOG) ── append-only, bigint identity PK, 강제 FK 없음(소프트 참조)
    await queryRunner.query(`
      CREATE TABLE "TBL_AUDIT_LOG" (
        "id" bigint GENERATED ALWAYS AS IDENTITY,
        "event_type" varchar(50) NOT NULL,
        "actor_type" varchar(20) NOT NULL,
        "actor_id" varchar(64) NULL DEFAULT NULL,
        "target" varchar(200) NULL DEFAULT NULL,
        "result" varchar(20) NOT NULL,
        "detail" varchar(1000) NULL DEFAULT NULL,
        "occurred_at" timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_AUDIT_LOG" PRIMARY KEY ("id"),
        CONSTRAINT "CK_AUDIT_EVENTTYPE_LEN" CHECK (length("event_type") > 0),
        CONSTRAINT "CK_AUDIT_ACTORTYPE" CHECK ("actor_type" IN ('ADMIN','SERVICE','SYSTEM','BATCH')),
        CONSTRAINT "CK_AUDIT_RESULT" CHECK ("result" IN ('SUCCESS','FAIL','BLOCKED','INFO'))
      )
    `);

    // ── ENT-004 처리 상태 (TBL_INTERLOCK_PROCESS_STATUS) ── request_key=허브 발급 UUID v4(기본값 없음)
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_PROCESS_STATUS" (
        "request_key" uuid NOT NULL,
        "config_id" uuid NOT NULL,
        "is_success" boolean NOT NULL,
        "is_result_confirmed" boolean NOT NULL DEFAULT false,
        "processed_at" timestamptz(3) NOT NULL,
        "result_confirmed_at" timestamptz(3) NULL DEFAULT NULL,
        "created_at" timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_PROCESS_STATUS" PRIMARY KEY ("request_key"),
        CONSTRAINT "CK_STATUS_CONFIRM_CONSISTENCY" CHECK (
          ("is_result_confirmed" = true AND "result_confirmed_at" IS NOT NULL)
          OR ("is_result_confirmed" = false AND "result_confirmed_at" IS NULL)
        ),
        CONSTRAINT "FK_STATUS_CONFIG" FOREIGN KEY ("config_id")
          REFERENCES "TBL_INTERLOCK_CONFIG" ("id") ON DELETE NO ACTION
      ) WITH (autovacuum_vacuum_scale_factor = 0.05)
    `);
    // 보존 삭제 두 갈래(BR-401): 미완료(processed_at 기산)·완료(result_confirmed_at 기산)
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_RETENTION_PENDING" ON "TBL_INTERLOCK_PROCESS_STATUS" ("processed_at") WHERE "is_result_confirmed" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_RETENTION_CONFIRMED" ON "TBL_INTERLOCK_PROCESS_STATUS" ("result_confirmed_at") WHERE "is_result_confirmed" = true`,
    );

    // ── ENT-007 연동이력 (TBL_INTERLOCK_HISTORY) ── request_key=진입 발급 값(기본값 없음), user_key 원문 저장(EXC-DATA-07)
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_HISTORY" (
        "request_key" uuid NOT NULL,
        "config_id" uuid NOT NULL,
        "user_key" varchar(512) NOT NULL,
        "requested_at" timestamptz(3) NOT NULL,
        "callback_received" boolean NOT NULL DEFAULT false,
        "callback_received_at" timestamptz(3) NULL DEFAULT NULL,
        "created_at" timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_INTERLOCK_HISTORY" PRIMARY KEY ("request_key"),
        CONSTRAINT "CK_HISTORY_USERKEY_LEN" CHECK (length("user_key") > 0),
        CONSTRAINT "CK_HISTORY_CALLBACK_CONSISTENCY" CHECK (
          ("callback_received" = true AND "callback_received_at" IS NOT NULL)
          OR ("callback_received" = false AND "callback_received_at" IS NULL)
        ),
        CONSTRAINT "FK_HISTORY_CONFIG" FOREIGN KEY ("config_id")
          REFERENCES "TBL_INTERLOCK_CONFIG" ("id") ON DELETE NO ACTION
      ) WITH (autovacuum_vacuum_scale_factor = 0.05)
    `);
    // 완료 판정(PROC-302)·콜백 특정(PROC-303) 스코프: {config_id + user_key} 최신 건
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_SCOPE" ON "TBL_INTERLOCK_HISTORY" ("config_id", "user_key", "requested_at" DESC)`,
    );
    // 보존 삭제 두 갈래(BR-402): 수신(callback_received_at 기산)·미수신(requested_at 기산)
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_RETENTION_RECEIVED" ON "TBL_INTERLOCK_HISTORY" ("callback_received_at") WHERE "callback_received" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_RETENTION_PENDING" ON "TBL_INTERLOCK_HISTORY" ("requested_at") WHERE "callback_received" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 생성 역순 드롭. 순환 FK 는 ENT-001 지정 참조 FK 를 먼저 제거한 뒤 테이블을 드롭한다.
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_HISTORY"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_PROCESS_STATUS"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_AUDIT_LOG"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_ADMIN_ACCOUNT"`);
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" DROP CONSTRAINT IF EXISTS "FK_CONFIG_USERKEY_PARAM"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_PARAMETER"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_CONSENT_ITEM"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_CONFIG"`);
  }
}
