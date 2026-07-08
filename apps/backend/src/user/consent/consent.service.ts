import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/envelope/app.exception';
import { EntryContextStore } from '../entry-context/entry-context.store';

/**
 * 이용 동의 화면 데이터 구성 서비스 — PROC-201 B1b / SVC-004 F-003 / FN-008 buildConsentView.
 *
 * 진입 컨텍스트(요청 키값)로 구성을 특정해 그 구성에 설정된 동의 항목만 조회한다(BIZ-002-01 구성 외 노출 금지).
 * 응답에는 회원 키·요청 키값·구성 코드 등 민감·내부 값을 포함하지 않는다(DATA-001). 약관 컨텐츠(terms_content)는
 * 포함한다([상세] 버튼·약관 모달은 화면(SCR-005) 처리 — BIZ-002-05·EXC-BIZ-08).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 감사 미기록(read-only 조회).
 */

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

@Injectable()
export class ConsentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly entryContextStore: EntryContextStore,
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
}
