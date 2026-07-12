import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AppException } from '../../common/envelope/app.exception';

/**
 * 이용 동의 서비스 — FN-008(사용자 동의 처리) / PROC-201(동의 화면 데이터 구성)·PROC-202 B2(승인 게이팅) /
 * SVC-004 / USR-01.
 *
 * `#214` 로 진입 방식이 요청 키값(허브 발급 UUID) 기반에서 **접근 주소 고유 ID(config_code) 기반 무상태
 * 조회**로 전환됐다 — 진입 컨텍스트 저장소(구 EntryContextStore)가 사라져 buildConsentView 는 매 호출마다
 * accessAddressId 로 활성 구성을 직접 조회한다. processDecision(승인 게이팅)도 같은 이유로 회원 키·
 * 진입 컨텍스트 대조 없이 accessAddressId(구성 매칭 근거)만으로 서버 재검증한다(BIZ-002-06).
 *
 * 승인(AGREE·필수 충족) 판정만 반환하고 복호화·전달·이력·상태 오케스트레이션(PROC-203)은 호출자
 * (InterlockService)의 책임이다 — 본 서비스는 FN-008 하나의 책임(동의 화면 구성 + 게이팅)만 진다.
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 조회(buildConsentView)는 감사 미기록(read-only),
 * 게이팅(processDecision)은 결과 코드만 최소 감사한다(BIZ-002-04 — 동의 증빙 원장 미저장).
 */

// GET /api/consent/:accessAddressId 조회 대상 활성 구성 행(동의 대상 설명 문구 포함).
interface ActiveConfigRow {
  id: string;
  consent_notice: string | null;
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

// 동의 화면 조회 응답(FN-008_buildConsentView, PROC-201) — 동의 대상 설명 문구(선택) + 항목 목록.
export interface ConsentViewResponse {
  consentNotice: string | null;
  items: ConsentItemResponse[];
}

// FN-008_processDecision 입력(MDL-203 동의 결과) — PROC-202 B2.
export interface ConsentDecisionInput {
  accessAddressId: string; // 구성 매칭 근거(발송처 식별자)
  decision: 'AGREE' | 'REJECT';
  requiredConsentMet: boolean; // 필수 연동 동의 충족(FE 파생 집계값, 서버 재검증)
}

// FN-008_processDecision 출력 — 승인 여부만(상태 값·추적 키 미노출).
export interface ApprovalOutcome {
  approved: boolean;
}

@Injectable()
export class ConsentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /api/consent/:accessAddressId — 동의 화면 데이터 구성(FN-008_buildConsentView, PROC-201 B1).
   * 접근 주소 고유 ID 로 활성 구성을 특정해 그 구성 소속 동의 항목만 반환한다(BIZ-002-01 구성 외 노출
   * 금지). 무효 접근 주소(비활성·삭제·미존재)는 발송처 링크 오류로 처리한다(400 EX-SEC-004).
   */
  async buildConsentView(accessAddressId: string): Promise<ConsentViewResponse> {
    const configRows: ActiveConfigRow[] = await this.dataSource.query(
      `SELECT id, consent_notice FROM "TBL_INTERLOCK_CONFIG"
       WHERE config_code = $1 AND is_active = true AND deleted_at IS NULL`, // UQ_CONFIG_CODE
      [accessAddressId],
    );
    const config = configRows[0];
    if (!config) {
      throw new AppException('EX-SEC-004'); // 유효하지 않은 접근 주소 참조(발송처 링크 오류)
    }

    const items: ConsentItemRow[] = await this.dataSource.query(
      `SELECT item_label, item_description, terms_content, is_required, display_order
       FROM "TBL_INTERLOCK_CONSENT_ITEM"
       WHERE config_id = $1 ORDER BY display_order ASC`, // IX_CONSENT_CONFIG
      [config.id],
    );

    return {
      consentNotice: config.consent_notice, // BIZ-002-08 — 미설정(NULL)이면 FE 가 미노출
      items: items.map((i) => ({
        label: i.item_label,
        description: i.item_description,
        termsContent: i.terms_content,
        required: i.is_required,
        order: i.display_order,
      })),
    };
  }

  /**
   * 동의/거부·승인 게이팅(FN-008_processDecision, PROC-202 B2 — BR-201). 화면 값 단독 신뢰 없이
   * 구성 매칭 근거(accessAddressId)로 활성 구성을 재확인하고 필수 동의 충족을 서버가 재검증한다
   * (BIZ-002-06). 거부·필수 미충족은 결과 코드만 최소 감사(BIZ-002-04·BIZ-002-07)하고 { approved:false }
   * 를 반환한다 — 호출자(InterlockService)는 이 경우 복호화를 수행하지 않는다.
   *
   * ⚠ 사양 발견(완료 보고 WARN): FN-008 의사코드는 `allChecked(requiredItems, decision)` 로 항목별 체크를
   * 서버가 재계산하는 것처럼 서술하나, 실제 요청 모델(MDL-203)은 항목별 체크 배열이 아니라 집계 boolean
   * (requiredConsentMet) 1개만 전달한다(개인식별 동의 증빙 원장 미저장 확정안, BIZ-002-04·Q3) — 항목별
   * 재검증은 현재 와이어 계약상 원천 불가능하다. 본 구현은 서버가 "구성에 필수 항목이 실재하는지"까지는
   * 독립 재확인하고, 그 위에서만 FE 집계값(requiredConsentMet)을 게이팅 조건으로 신뢰한다(필수 항목이
   * 없으면 FE 값과 무관하게 항상 충족) — 확인 필요.
   */
  async processDecision(decision: ConsentDecisionInput, now: Date): Promise<ApprovalOutcome> {
    const configRows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM "TBL_INTERLOCK_CONFIG"
       WHERE config_code = $1 AND is_active = true AND deleted_at IS NULL`, // UQ_CONFIG_CODE
      [decision.accessAddressId],
    );
    const config = configRows[0];
    if (!config) {
      throw new AppException('EX-SEC-004'); // 유효하지 않은 접근 주소 참조
    }

    const requiredRows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM "TBL_INTERLOCK_CONSENT_ITEM" WHERE config_id = $1 AND is_required = true`,
      [config.id],
    );
    const serverRequiredMet =
      decision.decision === 'AGREE' &&
      (requiredRows.length === 0 || decision.requiredConsentMet === true);

    if (decision.decision === 'REJECT' || !serverRequiredMet) {
      // 결과 코드 최소 기록(PII·추적 키·원문 미포함) — 복호화 미수행이라 추적 키가 없어 처리상태·연동이력
      // 은 남기지 않는다(EXC-BIZ-11).
      await this.auditService.write({
        eventType: AuditEventType.CONSENT_REJECT,
        actorType: ActorType.SERVICE,
        actorId: null,
        target: decision.accessAddressId,
        result: AuditResult.INFO,
      });
      return { approved: false }; // 200 정상 종료(EXC-BIZ-03)
    }

    await this.auditService.write({
      eventType: AuditEventType.CONSENT_AGREE,
      actorType: ActorType.SERVICE,
      actorId: null,
      target: decision.accessAddressId,
      result: AuditResult.INFO,
    });
    return { approved: true }; // 호출자가 연동 실행(PROC-203)을 트리거
  }
}
