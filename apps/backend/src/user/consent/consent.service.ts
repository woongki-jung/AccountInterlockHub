import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AppException } from '../../common/envelope/app.exception';
import { DeliveryConfig, DeliveryService } from '../delivery/delivery.service';
import { EntryContextStore } from '../entry-context/entry-context.store';
import { ProcessStatusService } from '../status/process-status.service';
import { SubmitConsentDto } from './dto/submit-consent.dto';

/**
 * 이용 동의 서비스 — PROC-201 B1b(동의 항목 조회) / PROC-202(동의·거부 처리) / SVC-004 / FN-008.
 *
 * 진입 컨텍스트(요청 키값)로 구성을 특정해 그 구성에 설정된 동의 항목만 조회하고(BIZ-002-01 구성 외 노출 금지),
 * 사용자의 동의/거부 결정을 서버가 구성 매칭 근거(configCode)로 검증·분기한다(화면 값 단독 신뢰 금지, BIZ-002).
 * 조회 응답에는 회원 키·요청 키값·구성 코드 등 민감·내부 값을 포함하지 않는다(DATA-001). 약관 컨텐츠(terms_content)는
 * 포함한다([상세] 버튼·약관 모달은 화면(SCR-005) 처리 — BIZ-002-05·EXC-BIZ-08).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 동의 항목 조회는 감사 미기록(read-only), 거부 처리는 감사 기록.
 */

// 요청 키값(UUID v4) 형식 검증(FN-005) — 위반 400 EX-SEC-004. uuid 컬럼 대상 22P02(→500) 방어도 겸한다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 활성 구성 조회 행(동의/거부 처리 — 전달 대상 필드 포함).
interface DecisionConfigRow {
  id: string;
  service_b_delivery_url: string;
  service_b_http_method: string;
}

// 동의 항목 조회 행(snake_case).
interface ConsentItemRow {
  item_label: string;
  item_description: string | null;
  terms_content: string | null;
  is_required: boolean;
  display_order: number;
}

// 동의 항목 응답(구성 소속만). 민감·내부 값 미포함.
export interface ConsentItemResponse {
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}

// 동의/거부 처리 응답(PROC-202) — 상태 값 미노출, 결과 유형만. SuccessInterceptor 가 { success, data } 로 감싼다.
export interface DecisionResponse {
  success: true;
}

@Injectable()
export class ConsentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly entryContextStore: EntryContextStore,
    private readonly deliveryService: DeliveryService,
    private readonly processStatusService: ProcessStatusService,
    private readonly auditService: AuditService,
  ) {}

  /** GET /api/consent/:requestKey — 동의 항목 조회(FN-008 buildConsentView). */
  async buildConsentView(requestKey: string): Promise<ConsentItemResponse[]> {
    // 1. 진입 컨텍스트 조회. 미존재·만료면 400 EX-DATA-002(요청이 올바르지 않습니다).
    const ctx = this.entryContextStore.get(requestKey);
    if (!ctx) {
      throw new AppException('EX-DATA-002');
    }

    // 2. 활성 구성 특정(컨텍스트의 구성 코드). 진입 이후 비활성·삭제됐으면 무효 요청으로 처리.
    const configRows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM "TBL_INTERLOCK_CONFIG"
       WHERE config_code = $1 AND is_active = true AND deleted_at IS NULL`,
      [ctx.configCode],
    );
    const config = configRows[0];
    if (!config) {
      throw new AppException('EX-DATA-002');
    }

    // 3. 구성 소속 동의 항목만 조회(display_order 오름차순, 약관 컨텐츠 포함 — IX_CONSENT_CONFIG).
    const items: ConsentItemRow[] = await this.dataSource.query(
      `SELECT item_label, item_description, terms_content, is_required, display_order
       FROM "TBL_INTERLOCK_CONSENT_ITEM"
       WHERE config_id = $1 ORDER BY display_order ASC`,
      [config.id],
    );

    return items.map((i) => ({
      label: i.item_label,
      description: i.item_description,
      termsContent: i.terms_content,
      required: i.is_required,
      order: i.display_order,
    }));
  }

  /**
   * POST /api/consent/:requestKey — 동의/거부 처리(PROC-202 B2~B3 / FN-008_processDecision, BR-201).
   *
   * 흐름:
   *  1) requestKey UUID 형식 검증(FN-005) — 위반 400 EX-SEC-004.
   *  2) 진입 컨텍스트 조회·구성 매칭 근거 대조 — 미존재 또는 configCode 불일치면 400 EX-DATA-002(만료·불일치·재제출 방지).
   *  3) 활성 구성 특정(진입 후 비활성·삭제 시 EX-DATA-002).
   *  4a) REJECT — 미전달·실패 상태 1건 저장 → 컨텍스트 폐기 → CONSENT_REJECT 감사 → 200 정상 종료(EXC-BIZ-03, 오류 아님).
   *  4b) AGREE — consentConfirmed=true 후 PROC-203 전달·저장 내부 호출 → 컨텍스트 폐기. 성공 200,
   *      실패 시 502 EX-BIZ-004 전파(상태는 저장됨).
   *
   * 전달은 멱등하지 않으므로 요청 키값 1회 실행을 보장한다 — 성공·실패 공통으로 컨텍스트를 폐기해 재제출을 차단한다
   * (PROC-203 §동시성 제어). 재제출은 컨텍스트 부재로 EX-DATA-002 가 된다.
   */
  async processDecision(requestKey: string, dto: SubmitConsentDto): Promise<DecisionResponse> {
    // 1. 요청 키값 형식 검증(FN-005).
    if (!UUID_RE.test(requestKey)) {
      throw new AppException('EX-SEC-004');
    }

    // 2. 진입 컨텍스트·구성 매칭 근거 검증(FN-008, BR-201). 미존재·만료·불일치 → 400 EX-DATA-002.
    const ctx = this.entryContextStore.get(requestKey);
    if (!ctx || ctx.configCode !== dto.configCode) {
      throw new AppException('EX-DATA-002');
    }

    // 3. 활성 구성 특정(전달 대상 필드 포함). 진입 이후 비활성·삭제됐으면 무효 요청.
    const configRows: DecisionConfigRow[] = await this.dataSource.query(
      `SELECT id, service_b_delivery_url, service_b_http_method
         FROM "TBL_INTERLOCK_CONFIG"
        WHERE config_code = $1 AND is_active = true AND deleted_at IS NULL`,
      [ctx.configCode],
    );
    const configRow = configRows[0];
    if (!configRow) {
      throw new AppException('EX-DATA-002');
    }
    const config: DeliveryConfig = {
      id: configRow.id,
      serviceBDeliveryUrl: configRow.service_b_delivery_url,
      serviceBHttpMethod: configRow.service_b_http_method,
    };

    const now = new Date();

    // 4a. 거부 경로(BIZ-002-03) — 미전달·실패 상태 1건 저장 후 종료.
    if (dto.decision === 'REJECT') {
      await this.processStatusService.saveStatus({
        requestKey,
        configId: config.id,
        isSuccess: false, // 거부=미전달·실패
        processedAt: now,
      });
      this.entryContextStore.remove(requestKey); // 컨텍스트 폐기(무저장·재제출 방지)
      await this.auditService.write({
        eventType: AuditEventType.CONSENT_REJECT,
        actorType: ActorType.SERVICE,
        actorId: null,
        target: requestKey,
        result: AuditResult.INFO,
      });
      return { success: true }; // 200 정상 종료(EXC-BIZ-03 — 오류 아님)
    }

    // 4b. 동의 경로(BIZ-002-02) — 전달 사전 조건 표식 후 PROC-203 내부 호출. 성공·실패 공통으로 컨텍스트 폐기.
    const confirmedCtx = { ...ctx, consentConfirmed: true };
    try {
      await this.deliveryService.deliverAndSave(confirmedCtx, requestKey, config, now);
    } finally {
      // 처리 완료(성공)·실패(502) 공통 폐기 — 전달 비멱등이라 재실행 차단(PROC-203 §동시성 제어).
      this.entryContextStore.remove(requestKey);
    }
    return { success: true };
  }
}
