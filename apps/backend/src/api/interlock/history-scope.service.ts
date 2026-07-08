import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 연동이력 스코프 조회·구성 지정 검증 서비스 — FN-019.
 *
 * 완료 확인(API-02 / PROC-302 / FN-017)과 완료 콜백(API-03 / PROC-303 / FN-018)이 **공유**하는
 * 대상 이력 해석의 단일 소스다(P3·P4 공유 — 스코프 정의를 본 서비스 한 곳에만 둔다). {연동 구성 식별자 +
 * 사용자 키값} 복합 스코프의 구성 실재·지정 여부(BIZ-004-05)를 사전 확인하고, 스코프 내 연동 요청 일시
 * 최신 이력 1건(pendingOnly=true 면 미수신 최신 1건)을 조회해 판단 재료 3값만 반환한다.
 *
 *  - 도메인 404(EX-BIZ-005/006)를 직접 throw 하지 않는다 — 존재 여부 비노출 정책상 호출 FN 이 각자의
 *    코드로 단일 404 를 반환하도록 eligible·target·anyInScope 만 넘긴다(FN-019 처리 흐름 4).
 *  - 감사·마스킹은 호출 FN(FN-017·FN-018)이 담당한다(본 서비스는 leaf — DB 조회·모델 매핑만).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 조회는 IX_HISTORY_SCOPE(config_id, user_key,
 * requested_at DESC)로 최신 1건을 O(1) 근접 획득한다(ENT-007 §인덱스).
 */

// ENT-001(TBL_INTERLOCK_CONFIG) 지정 여부 판정용 조회 행.
interface ConfigRow {
  id: string;
  user_key_param_id: string | null;
}

// ENT-007(TBL_INTERLOCK_HISTORY) 조회 행.
interface HistoryRow {
  request_key: string;
  config_id: string;
  user_key: string;
  requested_at: Date | string;
  callback_received: boolean;
  callback_received_at: Date | string | null;
}

// pg EXISTS 조회 결과 행.
interface ExistsRow {
  exists: boolean;
}

/**
 * 연동이력 도메인 모델(MDL-303) — ENT-007 행 매핑 결과. 일시는 Date 로 보유하고,
 * 응답 직렬화(ISO8601)는 호출 FN(FN-017 등)이 응답 변환 시 수행한다.
 */
export interface InterlockHistory {
  requestKey: string;
  configId: string;
  userKey: string;
  requestedAt: Date;
  callbackReceived: boolean;
  callbackReceivedAt: Date | null;
}

/**
 * FN-019 반환 — 호출 FN 이 각자의 404·멱등 분기를 결정하는 판단 재료 3값.
 *  - eligible:   구성 실재(유효) AND 사용자 키값 파라미터 지정(BIZ-004-05).
 *  - target:     조건 만족 최신 이력 1건(없으면 null).
 *  - anyInScope: 스코프에 이력이 1건이라도 존재(콜백 재통지 멱등 판정용 — P4 소비).
 */
export interface HistoryScopeResolution {
  eligible: boolean;
  target: InterlockHistory | null;
  anyInScope: boolean;
}

@Injectable()
export class HistoryScopeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * {연동 구성 식별자 + 사용자 키값} 스코프의 대상 이력을 해석한다(FN-019).
   * @param configCode 연동 구성 식별자(업무 코드).
   * @param userKey    지정 사용자 키값(등가 매칭 조건 — 원문, 무변형).
   * @param pendingOnly true=미수신 최신 1건(콜백 특정, P4) / false=스코프 최신 1건(완료 판정, P3).
   */
  async resolveHistoryScope(
    configCode: string,
    userKey: string,
    pendingOnly: boolean,
  ): Promise<HistoryScopeResolution> {
    // 1. 구성 실재·지정 여부 사전 검증(BIZ-004-05) — 유효 구성만(deleted_at IS NULL).
    const configRows: ConfigRow[] = await this.dataSource.query(
      `SELECT id, user_key_param_id FROM "TBL_INTERLOCK_CONFIG"
         WHERE config_code = $1 AND deleted_at IS NULL`, // UQ_CONFIG_CODE 부분
      [configCode],
    );
    const cfg = configRows[0];
    // 미존재 또는 미지정(사용자 키값 파라미터 없음) → 호출자가 404 매핑(존재 여부 비노출).
    if (!cfg || cfg.user_key_param_id == null) {
      return { eligible: false, target: null, anyInScope: false };
    }

    // 2. 스코프 최신 1건 조회 — IX_HISTORY_SCOPE(config_id, user_key, requested_at DESC).
    //    pendingOnly=true 면 미수신 건만(콜백 특정, BIZ-004-03), false 면 스코프 전체(완료 판정, BIZ-004-04).
    const scopeFilter = pendingOnly ? 'AND callback_received = false' : '';
    const targetRows: HistoryRow[] = await this.dataSource.query(
      `SELECT request_key, config_id, user_key, requested_at, callback_received, callback_received_at
         FROM "TBL_INTERLOCK_HISTORY"
        WHERE config_id = $1 AND user_key = $2 ${scopeFilter}
        ORDER BY requested_at DESC
        LIMIT 1`,
      [cfg.id, userKey],
    );
    const targetRow = targetRows[0] ?? null;

    // 3. 스코프 내 이력 존재 여부 판정(콜백 재통지 멱등용).
    //    target 있으면 곧 존재. target 없고 pendingOnly 인 경로(재통지 후보)에서만 추가 EXISTS 조회.
    //    pendingOnly=false & target null → 최신 조회가 곧 존재 판정이므로 false(추가 조회 불필요).
    let anyInScope: boolean;
    if (targetRow != null) {
      anyInScope = true;
    } else if (pendingOnly) {
      const existsRows: ExistsRow[] = await this.dataSource.query(
        `SELECT EXISTS(
           SELECT 1 FROM "TBL_INTERLOCK_HISTORY" WHERE config_id = $1 AND user_key = $2
         ) AS exists`, // IX_HISTORY_SCOPE
        [cfg.id, userKey],
      );
      anyInScope = existsRows[0]?.exists === true;
    } else {
      anyInScope = false;
    }

    // 4. 반환 — ENT-007 행 → MDL-303 도메인 매핑(target 있을 때만).
    return {
      eligible: true,
      target: targetRow ? mapHistory(targetRow) : null,
      anyInScope,
    };
  }
}

/** ENT-007 행 → MDL-303 도메인 모델 매핑. 일시는 Date, callback_received_at 은 미수신 시 null. */
function mapHistory(row: HistoryRow): InterlockHistory {
  return {
    requestKey: row.request_key,
    configId: row.config_id,
    userKey: row.user_key,
    requestedAt: toDate(row.requested_at) as Date, // requested_at 은 NOT NULL(ENT-007)
    callbackReceived: row.callback_received,
    callbackReceivedAt: toDate(row.callback_received_at),
  };
}

/** timestamptz 값을 Date 로 정규화한다. pg 드라이버는 Date 로 반환하나 문자열 반환 케이스도 방어한다. */
function toDate(value: Date | string | null): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}
