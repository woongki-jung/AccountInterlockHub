import { Injectable } from '@nestjs/common';
import { ConsentConfig } from '../config/interlock-config.types';
import { CONSENT_PROOF_TABLE, ConsentProofModel, ConsentProofRow, ConsentSnapshot, toConsentProofModel } from '../entities';
import { RecordWriteError } from './records.errors';
import { QueryExecutor } from './query-executor';
import { ConsentSubmissionInput } from './consent-proof-record.types';

export interface RecordConsentProofInput {
  readonly trackingKey: string;
  readonly submission: ConsentSubmissionInput;
  /** PROC-901 이 기동 시 산출한 MDL-008 그대로(재계산하지 않는다 — DATA-003-03 구현 가이드). */
  readonly consent: ConsentConfig;
  readonly at: Date;
}

/**
 * FN-012 동의 증적 기록(function_FN-012-013.md). **자기 트랜잭션을 열지 않는다** — FN-012 자신의
 * 처리 흐름 의사코드에는 "트랜잭션 시작/종료" 주석이 없다(FN-008·FN-009 와 달리 4단계 "증적 1건
 * 기록"에 "승인 확정과 같은 트랜잭션 경계"라고만 적혀 있다). process_PROC-302.md §실행
 * 제약사항도 "호출측(PROC-103 B6) 트랜잭션에 참여한다"고 명시한다 — 승인 확정 계기(PROC-103,
 * 후속 Phase)가 추적 레코드 행을 FOR UPDATE 로 잠근 상태에서 열어 둔 트랜잭션에 참여해야 한다.
 * 이 Phase 는 그 상위 배선을 만들지 않으므로, 자가 검증에서는 db.withTransaction() 으로 직접
 * 트랜잭션을 열어 그 client 를 건네는 방식으로 미래 호출부를 흉내 낸다.
 */
@Injectable()
export class ConsentProofRecordService {
  async recordConsentProof(executor: QueryExecutor, input: RecordConsentProofInput): Promise<ConsentProofModel> {
    const { trackingKey, submission, consent, at } = input;

    // 1. 계기 검증 — POL DATA-003-04·BIZ-003-01(마지막 방어. 화면 유효성 안내·서버 재검증은
    //    승인 제출 접점(PROC-103, 후속 Phase) 소관이며 이 함수에 도달하기 전에 걸러진다)
    const missingRequired = consent.items.some(
      (item) => item.required && !submission.agreedItemCodes.includes(item.code),
    );
    if (missingRequired) {
      throw new RecordWriteError('CONSENT_REQUIRED_ITEMS_NOT_MET');
    }

    // 2. 동의 항목 정합 검증 — ENT-002 §구현 가이드(스냅샷·동의 목록 간 참조는 응용 계층에서 확인)
    const validCodes = new Set(consent.items.map((item) => item.code));
    const hasUnknownCode = submission.agreedItemCodes.some((code) => !validCodes.has(code));
    if (hasUnknownCode) {
      throw new RecordWriteError('CONSENT_UNKNOWN_ITEM_CODE');
    }

    // 3. 스냅샷 구성 — POL DATA-003-02·DATA-003-05(화면이 실제로 노출한 내용과 같은 구성 모델에서 나온다)
    // items 는 MDL-008 이 이미 정렬한 결과(consent.items) 그대로 쓰고 여기서 다시 정렬하지 않는다
    // (process_PROC-302.md B3 · function_FN-012-013.md §처리 흐름 3 — "정렬 주체는 MDL-008 하나뿐이다.
    // 여기서 다시 정렬하면 정본이 둘이 되고, 두 정렬 기준이 갈리는 순간 스냅샷 순서와 해시 입력
    // 순서가 어긋난다"). 비교 기준(코드 포인트 오름차순)의 정본은 data_ENT-002.md §버전 식별자
    // 산출 규칙 3 이며, 그 정렬은 기동 시 PROC-901 B4(config/interlock-config.loader.ts) 가 유일하게
    // 수행한다 — consent.items 는 이미 그 순서로 정렬돼 도착한다.
    const snapshot: ConsentSnapshot = {
      notice: consent.notice,
      items: consent.items,
    };

    // 4. 증적 1건 기록 — 실패 시 EX-BIZ-003(승인 확정 트랜잭션과 함께 되돌린다, BIZ-003-04)
    try {
      const result = await executor.query<ConsentProofRow>(
        `INSERT INTO ${CONSENT_PROOF_TABLE}
           (tracking_key, consented_at, consent_version, consent_snapshot, agreed_item_codes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING consent_proof_id, tracking_key, consented_at, consent_version, consent_snapshot, agreed_item_codes`,
        [trackingKey, at, consent.version, JSON.stringify(snapshot), JSON.stringify(submission.agreedItemCodes)],
      );
      // 5. 도메인 변환·반환(생성 후 불변 — 갱신 경로를 만들지 않는다)
      return toConsentProofModel(result.rows[0] as ConsentProofRow);
    } catch (error) {
      throw new RecordWriteError('CONSENT_PROOF_INSERT_FAILED', error);
    }
  }
}
