import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AppException } from '../../common/envelope/app.exception';
import { FieldError } from '../../common/envelope/envelope.types';
import { detectPiiParams } from './config-pii.util';
import { SaveConfigDto } from './dto/save-config.dto';

/**
 * 연동 구성 등록·편집 서비스 — PROC-101(B2~B4) / SVC-001 / FN-006.
 *
 * 책임:
 *  - FN-006 서버 재검증(필수·URL·동의 항목 개수·사용자 키값 exactly-one → 422 EX-BIZ-001, 고유성 → 409 EX-BIZ-002).
 *  - BR-102 개인정보 파라미터 경고(비차단 — CONFIG_PII_WARN 감사 후 저장 진행).
 *  - 부모(ENT-001)+자식(ENT-002·ENT-003) 단일 트랜잭션 영속화(전량 교체·순환 FK 대응 순서).
 *  - 커밋 후 감사(FN-013 CONFIG_CREATE/UPDATE) + MDL-101(자식 포함) 응답 조립.
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 구성은 설정 데이터라 마스킹 대상이 아니다(EXC-SEC-05).
 */

type SaveMode = 'CREATE' | 'EDIT';

// 검증·영속화·응답에 공통으로 쓰는 정규화 도메인 모델(기본값 보충·order 부여·boolean 정규화 후).
interface NormalizedConfig {
  configCode: string;
  configName: string;
  serviceAEntryUrl: string;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: string;
  isActive: boolean;
  consentItems: NormalizedConsentItem[];
  parameters: NormalizedParameter[];
}
interface NormalizedConsentItem {
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}
interface NormalizedParameter {
  name: string;
  sourceKeyA: string;
  deliverToB: boolean;
  required: boolean;
  order: number;
  isUserKey: boolean;
}

// MDL-101 응답(자식·지정 참조 포함). SuccessInterceptor 가 { success, data } 로 감싼다.
export interface ConfigResponse {
  id: string;
  configCode: string;
  configName: string;
  serviceAEntryUrl: string;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: string;
  isActive: boolean;
  userKeyParamId: string | null;
  consentItems: ConsentItemResponse[];
  parameters: ParameterResponse[];
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}
interface ConsentItemResponse {
  id: string;
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}
interface ParameterResponse {
  id: string;
  name: string;
  sourceKeyA: string;
  deliverToB: boolean;
  required: boolean;
  order: number;
  isUserKey: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ConfigService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /** POST /api/admin/configs — 신규 등록(PROC-101 CREATE). */
  async createConfig(dto: SaveConfigDto, actor: string): Promise<ConfigResponse> {
    return this.saveConfig('CREATE', dto, null, actor);
  }

  /** PUT /api/admin/configs/:id — 편집(PROC-101 EDIT, config_code 불변). */
  async updateConfig(selfId: string, dto: SaveConfigDto, actor: string): Promise<ConfigResponse> {
    return this.saveConfig('EDIT', dto, selfId, actor);
  }

  private async saveConfig(
    mode: SaveMode,
    dto: SaveConfigDto,
    selfId: string | null,
    actor: string,
  ): Promise<ConfigResponse> {
    const domain = this.normalize(dto);

    // EDIT: 대상 구성 로드(deleted_at IS NULL). config_code 는 불변이라 기존 값으로 대체한다(제출값 무시 — EXC-BIZ-02).
    let effectiveConfigCode = domain.configCode;
    if (mode === 'EDIT') {
      if (!selfId || !UUID_RE.test(selfId)) {
        throw new AppException('EX-DATA-003'); // 잘못된 대상 식별자 → 대상 없음 처리
      }
      const rows: Array<{ config_code: string }> = await this.dataSource.query(
        `SELECT config_code FROM "TBL_INTERLOCK_CONFIG" WHERE id = $1 AND deleted_at IS NULL`,
        [selfId],
      );
      if (!rows[0]) {
        throw new AppException('EX-DATA-003'); // 편집 대상 구성 미존재(스펙 미정 — 완료 보고 참조)
      }
      effectiveConfigCode = rows[0].config_code;
    }

    // FN-006 업무 재검증(422/409). 통과 후에만 영속화한다.
    await this.validateConfig(domain, mode, selfId, effectiveConfigCode);

    // BR-102 개인정보 파라미터 경고(비차단) — 저장 진행. 이름 기반 휴리스틱(config-pii.util).
    const piiHits = detectPiiParams(domain.parameters);
    if (piiHits.length > 0) {
      await this.auditService.write({
        eventType: AuditEventType.CONFIG_PII_WARN,
        actorType: ActorType.ADMIN,
        actorId: actor,
        target: effectiveConfigCode,
        result: AuditResult.INFO,
        detail: `개인정보성 원천 키명 의심(${piiHits.length}건): ${piiHits.join(', ')}`,
      });
    }

    // 단일 트랜잭션 영속화(부모+자식). 실패 시 롤백.
    const configId = await this.persist(mode, domain, selfId, effectiveConfigCode, actor);

    // 커밋 후 감사(OPS-002-01).
    await this.auditService.write({
      eventType: mode === 'CREATE' ? AuditEventType.CONFIG_CREATE : AuditEventType.CONFIG_UPDATE,
      actorType: ActorType.ADMIN,
      actorId: actor,
      target: effectiveConfigCode,
      result: AuditResult.SUCCESS,
    });

    // 저장 결과 조회 → MDL-101(자식 포함) 응답.
    return this.selectConfig(configId);
  }

  /** DTO → 정규화 도메인(기본값·order·boolean). 문자열은 DTO 에서 이미 트림됨. */
  private normalize(dto: SaveConfigDto): NormalizedConfig {
    const consentItems: NormalizedConsentItem[] = (dto.consentItems ?? []).map((c, i) => ({
      label: c.label,
      description: c.description ?? null,
      termsContent: c.termsContent ?? null,
      required: c.required === true,
      order: i, // display_order = 제출(화면) 순서
    }));
    const parameters: NormalizedParameter[] = (dto.parameters ?? []).map((p, i) => ({
      name: p.name,
      sourceKeyA: p.sourceKeyA,
      deliverToB: p.deliverToB !== false, // 기본 true(MDL-101)
      required: p.required === true,
      order: i,
      isUserKey: p.isUserKey === true,
    }));
    return {
      configCode: dto.configCode ?? '',
      configName: dto.configName ?? '',
      serviceAEntryUrl: dto.serviceAEntryUrl ?? '',
      serviceBDeliveryUrl: dto.serviceBDeliveryUrl ?? '',
      serviceBHttpMethod: dto.serviceBHttpMethod ?? 'POST', // 기본값 보충
      isActive: dto.isActive !== false, // 기본 true(MDL-101)
      consentItems,
      parameters,
    };
  }

  /**
   * FN-006 구성 검증·고유성(BR-101·BR-107).
   *  - 필수(BIZ-001-01)·URL 형식(BIZ-001-02)·동의 항목 개수(BIZ-001-04)·사용자 키값 exactly-one(BIZ-001-07)
   *    위반 → 422 EX-BIZ-001(필드 details 동봉).
   *  - 고유성 사전 조회(BIZ-001-03) 위반 → 409 EX-BIZ-002.
   */
  private async validateConfig(
    domain: NormalizedConfig,
    mode: SaveMode,
    selfId: string | null,
    effectiveConfigCode: string,
  ): Promise<void> {
    const errors: FieldError[] = [];

    // 1. 필수 항목(BIZ-001-01)
    if (isBlank(effectiveConfigCode)) {
      errors.push({ field: 'configCode', message: '구성 코드는 필수입니다.' });
    }
    if (isBlank(domain.configName)) {
      errors.push({ field: 'configName', message: '구성명은 필수입니다.' });
    }
    if (isBlank(domain.serviceAEntryUrl)) {
      errors.push({ field: 'serviceAEntryUrl', message: '서비스 A 호출 주소는 필수입니다.' });
    }
    if (isBlank(domain.serviceBDeliveryUrl)) {
      errors.push({ field: 'serviceBDeliveryUrl', message: '서비스 B 전달 주소는 필수입니다.' });
    }
    if (domain.parameters.length < 1) {
      errors.push({ field: 'parameters', message: '전달 파라미터를 1개 이상 정의해주세요.' });
    }

    // 2. URL 형식(BIZ-001-02) — http/https 절대 URL
    if (!isBlank(domain.serviceAEntryUrl) && !isHttpUrl(domain.serviceAEntryUrl)) {
      errors.push({ field: 'serviceAEntryUrl', message: 'http/https 절대 URL 형식이어야 합니다.' });
    }
    if (!isBlank(domain.serviceBDeliveryUrl) && !isHttpUrl(domain.serviceBDeliveryUrl)) {
      errors.push({ field: 'serviceBDeliveryUrl', message: 'http/https 절대 URL 형식이어야 합니다.' });
    }

    // 3. 동의 항목 개수(BIZ-001-04)
    if (domain.consentItems.length < 1) {
      errors.push({ field: 'consentItems', message: '동의 항목을 1개 이상 정의해주세요.' });
    }

    // 4. 사용자 키값 파라미터 지정 exactly-one(BIZ-001-07)
    //    isUserKey 는 파라미터 행에 붙는 플래그라 "실재하는 파라미터만 지정"이 구조적으로 보장된다(별도 실재 검증 불요).
    const designatedCount = domain.parameters.filter((p) => p.isUserKey).length;
    if (designatedCount === 0) {
      errors.push({ field: 'parameters', message: '사용자 키값 파라미터를 정확히 1개 지정해주세요.' });
    } else if (designatedCount > 1) {
      errors.push({ field: 'parameters', message: '사용자 키값 파라미터는 1개만 지정할 수 있습니다.' });
    }

    if (errors.length > 0) {
      throw new AppException('EX-BIZ-001', errors);
    }

    // 5. 고유성 사전 조회(BIZ-001-03) — 유효(미삭제) 구성 간. EDIT 는 자기 자신 제외(EXC-BIZ-02).
    const dupRows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM "TBL_INTERLOCK_CONFIG" WHERE config_code = $1 AND deleted_at IS NULL`,
      [effectiveConfigCode],
    );
    const dup = dupRows[0];
    if (dup && (mode === 'CREATE' || dup.id !== selfId)) {
      throw new AppException('EX-BIZ-002');
    }
  }

  /**
   * 부모+자식 단일 트랜잭션 영속화. CREATE=INSERT, EDIT=UPDATE + 자식 전량 교체.
   * 순환 FK(user_key_param_id → ENT-003.id) 대응: 자식 INSERT 후 부모 user_key_param_id 를 설정하고,
   * EDIT 는 교체 전 user_key_param_id 를 NULL 로 초기화해 RESTRICT 를 회피한다(data_ENT-001 §구현 가이드).
   */
  private async persist(
    mode: SaveMode,
    domain: NormalizedConfig,
    selfId: string | null,
    effectiveConfigCode: string,
    actor: string,
  ): Promise<string> {
    const qr: QueryRunner = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('READ COMMITTED');
    try {
      let configId: string;

      if (mode === 'CREATE') {
        const inserted: Array<{ id: string }> = await qr.query(
          `INSERT INTO "TBL_INTERLOCK_CONFIG"
             (config_code, config_name, service_a_entry_url, service_b_delivery_url,
              service_b_http_method, is_active, created_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
           RETURNING id`,
          [
            effectiveConfigCode,
            domain.configName,
            domain.serviceAEntryUrl,
            domain.serviceBDeliveryUrl,
            domain.serviceBHttpMethod,
            domain.isActive,
            actor,
          ],
        );
        configId = inserted[0].id;
      } else {
        configId = selfId as string;
        // 지정 참조 해제(전량 교체 전 RESTRICT 회피) + 부모 필드 갱신. config_code 는 불변이라 SET 대상 아님.
        await qr.query(
          `UPDATE "TBL_INTERLOCK_CONFIG"
             SET config_name = $1, service_a_entry_url = $2, service_b_delivery_url = $3,
                 service_b_http_method = $4, is_active = $5, user_key_param_id = NULL,
                 updated_at = now(), updated_by = $6
           WHERE id = $7 AND deleted_at IS NULL`,
          [
            domain.configName,
            domain.serviceAEntryUrl,
            domain.serviceBDeliveryUrl,
            domain.serviceBHttpMethod,
            domain.isActive,
            actor,
            configId,
          ],
        );
        // 자식 전량 교체(delete-and-reinsert).
        await qr.query(`DELETE FROM "TBL_INTERLOCK_CONSENT_ITEM" WHERE config_id = $1`, [configId]);
        await qr.query(`DELETE FROM "TBL_INTERLOCK_PARAMETER" WHERE config_id = $1`, [configId]);
      }

      // 동의 항목(ENT-002) INSERT.
      for (const c of domain.consentItems) {
        await qr.query(
          `INSERT INTO "TBL_INTERLOCK_CONSENT_ITEM"
             (config_id, item_label, item_description, terms_content, is_required, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [configId, c.label, c.description, c.termsContent, c.required, c.order],
        );
      }

      // 전달 파라미터(ENT-003) INSERT — 지정 파라미터의 신규 행 id 를 포착.
      let designatedParamId: string | null = null;
      for (const p of domain.parameters) {
        const ins: Array<{ id: string }> = await qr.query(
          `INSERT INTO "TBL_INTERLOCK_PARAMETER"
             (config_id, param_name, source_key_a, deliver_to_b, is_required, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [configId, p.name, p.sourceKeyA, p.deliverToB, p.required, p.order],
        );
        if (p.isUserKey) {
          designatedParamId = ins[0].id; // 정확히 1개(FN-006 통과 보장)
        }
      }

      // 사용자 키값 파라미터 지정 참조 설정(자식 INSERT 후 부모 UPDATE — 순환 FK 대응, BIZ-001-07).
      await qr.query(`UPDATE "TBL_INTERLOCK_CONFIG" SET user_key_param_id = $1 WHERE id = $2`, [
        designatedParamId,
        configId,
      ]);

      await qr.commitTransaction();
      return configId;
    } catch (err) {
      await qr.rollbackTransaction();
      // 고유성 경합(부분 유니크 최종 방어) → 409, 그 외 무결성·DB 오류 → 500.
      if (isUniqueViolation(err)) {
        throw new AppException('EX-BIZ-002');
      }
      if (err instanceof AppException) {
        throw err;
      }
      throw new AppException('EX-FN-999');
    } finally {
      await qr.release();
    }
  }

  /** 저장 결과를 MDL-101(자식 포함·지정 참조 복원)로 조립한다. */
  private async selectConfig(configId: string): Promise<ConfigResponse> {
    const configRows: ConfigRow[] = await this.dataSource.query(
      `SELECT id, config_code, config_name, service_a_entry_url, service_b_delivery_url,
              service_b_http_method, user_key_param_id, is_active,
              created_at, created_by, updated_at, updated_by
       FROM "TBL_INTERLOCK_CONFIG" WHERE id = $1`,
      [configId],
    );
    const cfg = configRows[0];
    if (!cfg) {
      // 방금 커밋한 행이 사라지는 비정상 상황 — 내부 오류로 처리.
      throw new AppException('EX-FN-999');
    }

    const consentRows: ConsentRow[] = await this.dataSource.query(
      `SELECT id, item_label, item_description, terms_content, is_required, display_order
       FROM "TBL_INTERLOCK_CONSENT_ITEM" WHERE config_id = $1 ORDER BY display_order ASC`,
      [configId],
    );
    const paramRows: ParamRow[] = await this.dataSource.query(
      `SELECT id, param_name, source_key_a, deliver_to_b, is_required, display_order
       FROM "TBL_INTERLOCK_PARAMETER" WHERE config_id = $1 ORDER BY display_order ASC`,
      [configId],
    );

    return {
      id: cfg.id,
      configCode: cfg.config_code,
      configName: cfg.config_name,
      serviceAEntryUrl: cfg.service_a_entry_url,
      serviceBDeliveryUrl: cfg.service_b_delivery_url,
      serviceBHttpMethod: cfg.service_b_http_method,
      isActive: cfg.is_active,
      userKeyParamId: cfg.user_key_param_id,
      consentItems: consentRows.map((c) => ({
        id: c.id,
        label: c.item_label,
        description: c.item_description,
        termsContent: c.terms_content,
        required: c.is_required,
        order: c.display_order,
      })),
      parameters: paramRows.map((p) => ({
        id: p.id,
        name: p.param_name,
        sourceKeyA: p.source_key_a,
        deliverToB: p.deliver_to_b,
        required: p.is_required,
        order: p.display_order,
        // 지정 참조 복원 — user_key_param_id 와 매칭되는 행에 true.
        isUserKey: cfg.user_key_param_id != null && p.id === cfg.user_key_param_id,
      })),
      createdAt: toIso(cfg.created_at),
      createdBy: cfg.created_by,
      updatedAt: toIso(cfg.updated_at),
      updatedBy: cfg.updated_by,
    };
  }
}

// ── 조회 행 형상(snake_case) ──
interface ConfigRow {
  id: string;
  config_code: string;
  config_name: string;
  service_a_entry_url: string;
  service_b_delivery_url: string;
  service_b_http_method: string;
  user_key_param_id: string | null;
  is_active: boolean;
  created_at: Date | string | null;
  created_by: string | null;
  updated_at: Date | string | null;
  updated_by: string | null;
}
interface ConsentRow {
  id: string;
  item_label: string;
  item_description: string | null;
  terms_content: string | null;
  is_required: boolean;
  display_order: number;
}
interface ParamRow {
  id: string;
  param_name: string;
  source_key_a: string;
  deliver_to_b: boolean;
  is_required: boolean;
  display_order: number;
}

// ── 검증 유틸 ──
function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

// http/https 절대 URL(FE 1차 검증·DB CHECK 와 정합). 공백 없는 스킴 이후 1자 이상.
function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

// PostgreSQL unique_violation(23505) 판별 — TypeORM QueryFailedError 래핑 포함.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}

// timestamptz → ISO8601 문자열(node-postgres 는 Date 반환).
function toIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}
