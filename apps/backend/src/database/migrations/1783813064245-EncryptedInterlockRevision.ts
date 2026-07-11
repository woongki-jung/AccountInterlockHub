import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 암호화 연동 플로우 스키마 개정(P1) — `#214`/`#218`(데이터 정의서 재정의) 반영, `accountinterlockhub#225`.
 *
 * 델타 근거(docs/specs/datas/spec-datas.md·data_ENT-001/004/007.md):
 *  - ENT-001 TBL_INTERLOCK_CONFIG: 구 `service_a_entry_url`(서비스 A 호출 주소)·`user_key_param_id`
 *    (사용자 키값 파라미터 지정 참조 FK) 제거, `consent_notice`(동의 대상 설명 문구, BIZ-002-08) 신설.
 *    기존 행을 보존해야 하는 소규모 마스터라 ALTER 로 처리한다.
 *  - ENT-003 TBL_INTERLOCK_PARAMETER: 입력이 단일 암호화 JSON(encX·encY)으로 전환되며 전달 파라미터
 *    정의 자체가 무의미해져 폐기(결번, 재사용 금지). DROP TABLE.
 *  - ENT-004·ENT-007: PK 를 `request_key`(허브 발급 UUID)에서 내부 surrogate `id` 로 교체하고
 *    비유니크 조회 컬럼 `tracking_key`(연동 추적 키, DATA-002)를 신설한다 — PK 구조 자체가 바뀌므로
 *    ALTER 로 표현할 수 없다. qa spec(docs/specs/qa/spec-qa.md §1-3)이 "이관 범위 없음(그린필드)"을
 *    명시하므로 DROP + CREATE 로 재생성한다(구 `request_key`/`user_key` 행 데이터는 유실 전제).
 *
 * 순서 주의: ENT-001.user_key_param_id 의 FK(FK_CONFIG_USERKEY_PARAM)가 ENT-003 을 참조하므로,
 * 그 FK·컬럼을 먼저 제거한 뒤에야 TBL_INTERLOCK_PARAMETER 를 DROP TABLE 할 수 있다.
 *
 * 서비스 계층(관리자 구성 CRUD·상태/이력 조회·배치 등)의 raw SQL 은 구 컬럼(request_key·user_key·
 * service_a_entry_url·user_key_param_id 등)을 여전히 참조하며, 후속 Phase(P3/P5/P7~P10)에서
 * 함께 개정한다 — 본 마이그레이션은 스키마만 다루고, 그 raw SQL 은 TS 컴파일 대상이 아니라
 * (문자열 리터럴) 빌드·부팅에는 영향이 없다(서비스는 런타임 지연 쿼리라 부팅 시점 실행 없음).
 */
export class EncryptedInterlockRevision1783813064245 implements MigrationInterface {
  name = 'EncryptedInterlockRevision1783813064245';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENT-001 발송처 접근 주소 구성 (TBL_INTERLOCK_CONFIG) — ALTER ──
    // 지정 참조 FK 를 먼저 제거해야 아래 ENT-003 DROP TABLE 이 가능하다.
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" DROP CONSTRAINT IF EXISTS "FK_CONFIG_USERKEY_PARAM"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" DROP COLUMN IF EXISTS "user_key_param_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" DROP CONSTRAINT IF EXISTS "CK_CONFIG_URL_A"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" DROP COLUMN IF EXISTS "service_a_entry_url"`,
    );
    // 동의 대상 설명 문구(BIZ-002-08) — 선택 입력, CHECK 없음(자유 텍스트)
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" ADD COLUMN "consent_notice" varchar(1000) NULL DEFAULT NULL`,
    );
    // UQ_CONFIG_CODE·IX_CONFIG_LIST 는 컬럼 변경과 무관해 그대로 유지한다.

    // ── ENT-003 연동 구성 전달 파라미터 (TBL_INTERLOCK_PARAMETER) — 폐기(`#214`, 결번) ──
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_PARAMETER"`);

    // ── ENT-004 처리 상태 (TBL_INTERLOCK_PROCESS_STATUS) — PK 구조 변경으로 재생성 ──
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_PROCESS_STATUS"`);
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_PROCESS_STATUS" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tracking_key" varchar(255) NOT NULL,
        "config_id" uuid NOT NULL,
        "is_success" boolean NOT NULL,
        "is_result_confirmed" boolean NOT NULL DEFAULT false,
        "processed_at" timestamptz(3) NOT NULL,
        "result_confirmed_at" timestamptz(3) NULL DEFAULT NULL,
        "created_at" timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_PROCESS_STATUS" PRIMARY KEY ("id"),
        CONSTRAINT "CK_STATUS_TRACKING_LEN" CHECK (length("tracking_key") > 0),
        CONSTRAINT "CK_STATUS_CONFIRM_CONSISTENCY" CHECK (
          ("is_result_confirmed" = true AND "result_confirmed_at" IS NOT NULL)
          OR ("is_result_confirmed" = false AND "result_confirmed_at" IS NULL)
        ),
        CONSTRAINT "FK_STATUS_CONFIG" FOREIGN KEY ("config_id")
          REFERENCES "TBL_INTERLOCK_CONFIG" ("id") ON DELETE NO ACTION
      ) WITH (autovacuum_vacuum_scale_factor = 0.05)
    `);
    // 조회(API-01)·재사용 시 최신 1건 선정(EXC-BIZ-12) 겸용
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_TRACKING" ON "TBL_INTERLOCK_PROCESS_STATUS" ("tracking_key", "processed_at" DESC)`,
    );
    // 보존 삭제 두 갈래(BR-401): 결과 확인 건(90일, 부분)·전체 절대 상한(180일, 전체)
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_RETENTION_CONFIRMED" ON "TBL_INTERLOCK_PROCESS_STATUS" ("result_confirmed_at") WHERE "is_result_confirmed" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_RETENTION_CREATED" ON "TBL_INTERLOCK_PROCESS_STATUS" ("created_at")`,
    );

    // ── ENT-007 연동이력 (TBL_INTERLOCK_HISTORY) — PK 구조 변경으로 재생성 ──
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_HISTORY"`);
    await queryRunner.query(`
      CREATE TABLE "TBL_INTERLOCK_HISTORY" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tracking_key" varchar(255) NOT NULL,
        "config_id" uuid NOT NULL,
        "requested_at" timestamptz(3) NOT NULL,
        "callback_received" boolean NOT NULL DEFAULT false,
        "callback_received_at" timestamptz(3) NULL DEFAULT NULL,
        "created_at" timestamptz(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_INTERLOCK_HISTORY" PRIMARY KEY ("id"),
        CONSTRAINT "CK_HISTORY_TRACKING_LEN" CHECK (length("tracking_key") > 0),
        CONSTRAINT "CK_HISTORY_CALLBACK_CONSISTENCY" CHECK (
          ("callback_received" = true AND "callback_received_at" IS NOT NULL)
          OR ("callback_received" = false AND "callback_received_at" IS NULL)
        ),
        CONSTRAINT "FK_HISTORY_CONFIG" FOREIGN KEY ("config_id")
          REFERENCES "TBL_INTERLOCK_CONFIG" ("id") ON DELETE NO ACTION
      ) WITH (autovacuum_vacuum_scale_factor = 0.05)
    `);
    // 완료 판정(PROC-302)·콜백 특정(PROC-303) 스코프 최신 1건 겸용 — 구 IX_HISTORY_SCOPE 대체
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_TRACKING" ON "TBL_INTERLOCK_HISTORY" ("tracking_key", "requested_at" DESC)`,
    );
    // 보존 삭제 두 갈래(BR-402): 콜백 수신 건(90일, 부분)·전체 절대 상한(180일, 전체)
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_RETENTION_RECEIVED" ON "TBL_INTERLOCK_HISTORY" ("callback_received_at") WHERE "callback_received" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_RETENTION_CREATED" ON "TBL_INTERLOCK_HISTORY" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // best-effort 역방향 — 그린필드 전제(spec-qa.md §1-3 "이관 범위 없음")로 데이터 보존을 시도하지
    // 않는다. ENT-004·ENT-007 은 PK 자체가 바뀌어(surrogate id → request_key) 신 스키마의 행을 구
    // 스키마로 매핑할 방법이 없으므로 구조만 복원한다(데이터 유실). 순서는 up() 의 역순.

    // ── ENT-007 연동이력 — 구 스키마(request_key PK·user_key)로 복원 ──
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_HISTORY"`);
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
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_SCOPE" ON "TBL_INTERLOCK_HISTORY" ("config_id", "user_key", "requested_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_RETENTION_RECEIVED" ON "TBL_INTERLOCK_HISTORY" ("callback_received_at") WHERE "callback_received" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_HISTORY_RETENTION_PENDING" ON "TBL_INTERLOCK_HISTORY" ("requested_at") WHERE "callback_received" = false`,
    );

    // ── ENT-004 처리 상태 — 구 스키마(request_key PK)로 복원 ──
    await queryRunner.query(`DROP TABLE IF EXISTS "TBL_INTERLOCK_PROCESS_STATUS"`);
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
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_RETENTION_PENDING" ON "TBL_INTERLOCK_PROCESS_STATUS" ("processed_at") WHERE "is_result_confirmed" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IX_STATUS_RETENTION_CONFIRMED" ON "TBL_INTERLOCK_PROCESS_STATUS" ("result_confirmed_at") WHERE "is_result_confirmed" = true`,
    );

    // ── ENT-003 연동 구성 전달 파라미터 — 재생성(ENT-001 지정 참조 FK 복원의 선행 조건) ──
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

    // ── ENT-001 발송처 접근 주소 구성 — consent_notice 제거, 구 컬럼 복원 ──
    // best-effort: 기존 행(비어있지 않을 수 있음)이 있어도 실패하지 않도록 NULL 허용·CHECK 미부여로
    // 복원한다(구 컬럼의 원문 값 자체는 up() 에서 DROP 된 시점에 유실되어 복구 불가).
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" DROP COLUMN IF EXISTS "consent_notice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" ADD COLUMN "service_a_entry_url" varchar(2048) NULL DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "TBL_INTERLOCK_CONFIG" ADD COLUMN "user_key_param_id" uuid NULL DEFAULT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "TBL_INTERLOCK_CONFIG"
        ADD CONSTRAINT "FK_CONFIG_USERKEY_PARAM" FOREIGN KEY ("user_key_param_id")
          REFERENCES "TBL_INTERLOCK_PARAMETER" ("id") ON DELETE RESTRICT
    `);
  }
}
