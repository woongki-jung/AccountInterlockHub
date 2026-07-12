import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 연동이력 추적 키 스코프 조회 서비스 — FN-019.
 *
 * 완료 확인(API-02 / PROC-302 / FN-017)과 완료 콜백(API-03 / PROC-303 / FN-018)이 **공유**하는
 * 대상 이력 해석의 단일 소스다(build P8·P9 공유 — 스코프 정의를 본 서비스 한 곳에만 둔다). **연동 추적 키
 * 단독 스코프**의 연동 요청 일시 최신 이력 1건(pendingOnly=true 면 미수신 최신 1건)을 조회해 판단 재료
 * 2값(target·anyInScope)만 반환한다.
 *
 * `#214` 로 스코프가 구 {연동 구성 식별자 + 사용자 키값}에서 **연동 추적 키 단독**으로 전환됐다 — 구성
 * 실재·지정 여부 사전 검증(구 eligible 반환값)은 폐기됐다. 추적 키 단독 스코프라 구성(ENT-001) 조회 없이
 * 추적 키 등가 매칭만 수행한다.
 *
 *  - 도메인 404(EX-BIZ-005/006)를 직접 throw 하지 않는다 — 존재 여부 비노출 정책상 호출 FN 이 각자의
 *    코드로 단일 404 를 반환하도록 target·anyInScope 만 넘긴다(FN-019 처리 흐름 3).
 *  - 감사·마스킹은 호출 FN(FN-017·FN-018)이 담당한다(본 서비스는 leaf — DB 조회·모델 매핑만).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 조회는 IX_HISTORY_TRACKING(tracking_key,
 * requested_at DESC)로 최신 1건을 O(1) 근접 획득한다(ENT-007 §인덱스).
 */

// ENT-007(TBL_INTERLOCK_HISTORY) 조회 행.
interface HistoryRow {
  id: string;
  tracking_key: string;
  config_id: string;
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
 *
 * id(내부 surrogate PK, ENT-007.id)는 MDL-303 의 업무 속성(트래킹 키·구성 참조·요청 일시·콜백 수신
 * 여부·수신 일시 5항목) 밖의 구현 전용 필드다 — 완료 콜백 기록(FN-018)의 단건 UPDATE 행 타겟팅
 * (`WHERE id = :res.target.id`, FN-018 처리 흐름 3)에만 쓰고 어떤 API 응답에도 노출하지 않는다
 * (FN-017/CompletionService 는 응답 변환 시 id 를 포함하지 않는다 — SEC-005-05).
 */
export interface InterlockHistory {
  id: string;
  trackingKey: string;
  configId: string;
  requestedAt: Date;
  callbackReceived: boolean;
  callbackReceivedAt: Date | null;
}

/**
 * FN-019 반환 — 호출 FN 이 각자의 404·멱등 분기를 결정하는 판단 재료 2값.
 *  - target:     스코프 조건(추적 키·pendingOnly) 만족 최신 이력 1건(없으면 null).
 *  - anyInScope: 추적 키 스코프에 이력이 1건이라도 존재(콜백 재통지 멱등 판정용 — P9 소비).
 */
export interface HistoryScopeResolution {
  target: InterlockHistory | null;
  anyInScope: boolean;
}

@Injectable()
export class HistoryScopeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * 연동 추적 키 스코프의 대상 이력을 해석한다(FN-019).
   * @param trackingKey 연동 추적 키(스코프 키 — 완료 판정·콜백 특정 공유, 등가 매칭·무변형).
   * @param pendingOnly true=미수신 최신 1건(콜백 특정, BIZ-004-09) / false=스코프 최신 1건(완료 판정, BIZ-004-10).
   */
  async resolveHistoryScope(
    trackingKey: string,
    pendingOnly: boolean,
  ): Promise<HistoryScopeResolution> {
    // 1. 스코프 최신 1건 조회 — IX_HISTORY_TRACKING(tracking_key, requested_at DESC).
    //    pendingOnly=true 면 미수신 건만(콜백 특정, BIZ-004-09), false 면 스코프 전체(완료 판정, BIZ-004-10).
    const scopeFilter = pendingOnly ? 'AND callback_received = false' : '';
    const targetRows: HistoryRow[] = await this.dataSource.query(
      `SELECT id, tracking_key, config_id, requested_at, callback_received, callback_received_at
         FROM "TBL_INTERLOCK_HISTORY"
        WHERE tracking_key = $1 ${scopeFilter}
        ORDER BY requested_at DESC
        LIMIT 1`, // IX_HISTORY_TRACKING
      [trackingKey],
    );
    const targetRow = targetRows[0] ?? null;

    // 2. 스코프 내 이력 존재 여부 판정(콜백 재통지 멱등용).
    //    target 있으면 곧 존재. target 없고 pendingOnly 인 경로(재통지 후보)에서만 추가 EXISTS 조회.
    //    pendingOnly=false & target null → 최신 조회가 곧 존재 판정이므로 false(추가 조회 불필요).
    let anyInScope: boolean;
    if (targetRow != null) {
      anyInScope = true;
    } else if (pendingOnly) {
      const existsRows: ExistsRow[] = await this.dataSource.query(
        `SELECT EXISTS(
           SELECT 1 FROM "TBL_INTERLOCK_HISTORY" WHERE tracking_key = $1
         ) AS exists`, // IX_HISTORY_TRACKING
        [trackingKey],
      );
      anyInScope = existsRows[0]?.exists === true;
    } else {
      anyInScope = false;
    }

    // 3. 반환 — ENT-007 행 → MDL-303 도메인 매핑(target 있을 때만).
    return {
      target: targetRow ? mapHistory(targetRow) : null,
      anyInScope,
    };
  }
}

/** ENT-007 행 → MDL-303 도메인 모델 매핑. 일시는 Date, callback_received_at 은 미수신 시 null. */
function mapHistory(row: HistoryRow): InterlockHistory {
  return {
    id: row.id,
    trackingKey: row.tracking_key,
    configId: row.config_id,
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
