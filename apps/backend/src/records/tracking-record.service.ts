import { Injectable } from '@nestjs/common';
import {
  INTERLOCK_TRACKING_TABLE,
  InterlockTrackingModel,
  InterlockTrackingRow,
  RESULT_CODE_VALUES,
  ResultCode,
  toInterlockTrackingModel,
} from '../entities';
import { DatabaseService } from '../database/database.service';
import { MetricCounterService } from './metric-counter.service';
import { RecordWriteError } from './records.errors';
import { isUniqueViolation } from './pg-error.util';
import { QueryExecutor } from './query-executor';
import { TrackingLookupResult, TrackingSecureResult } from './tracking-record.types';

/** ENT-001 기본 키 제약명(0001_create_storage_tables.up.sql) — 기본 키 충돌 판정에 쓴다. */
const PK_CONSTRAINT_NAME = 'pk_interlock_tracking';

/**
 * FN-007~011 연동 추적 레코드 조회·확보·기록(function_FN-007-008.md·function_FN-009-011.md).
 * 메서드명은 PROC-301 §진입점의 `kind` 값(LOOKUP·SECURE·FIX_RESULT·CONFIRM_RESULT·
 * RECORD_CALLBACK)과 그대로 대응시켰다 — 그 kind 디스패처(PROC-301 자체의 배선)는 후속 Phase
 * 소관이지만, 대응 이름을 맞춰 두면 그 배선이 스위치 1개로 바로 연결할 수 있다.
 */
@Injectable()
export class TrackingRecordService {
  constructor(
    private readonly db: DatabaseService,
    private readonly metrics: MetricCounterService,
  ) {}

  /**
   * FN-007 추적 레코드 사전 조회·3분기 판정. 예외를 던지지 않는다(대상 없음도 정상 판정 결과다).
   * `executor` 를 생략하면 커넥션 풀에서 단건 조회한다 — 진행 중인 트랜잭션 안에서 재조회할
   * 때는(FN-008·FN-009 내부) 그 트랜잭션의 client 를 그대로 넘겨 같은 스냅샷을 보게 한다.
   */
  async lookup(trackingKey: string, executor: QueryExecutor = this.db): Promise<TrackingLookupResult> {
    const result = await executor.query<InterlockTrackingRow>(
      `SELECT tracking_key, result_code, result_at, result_confirmed_at, callback_received_at, created_at
       FROM ${INTERLOCK_TRACKING_TABLE}
       WHERE tracking_key = $1`,
      [trackingKey],
    );

    const row = result.rows[0];
    if (row === undefined) {
      // 미진입과 보관 만료 삭제를 구별하지 않는다(POL DATA-002-05).
      return { branch: 'NONE', record: null };
    }

    const record = toInterlockTrackingModel(row);
    // "결과 확정" 판정은 결과 구분 값의 존재 여부로만 한다(BIZ-002 구현 가이드).
    return { branch: record.isResultFixed ? 'FIXED' : 'OPEN', record };
  }

  /**
   * FN-008 추적 레코드 확보(생성·이어쓰기). `FIXED`·`OPEN` 이면 어떤 컬럼도 갱신하지 않고 그대로
   * 반환한다(BIZ-002-04 — 보관 기산점이 밀리지 않는다). `NONE` 이면 INSERT + FN-013 요청 수
   * 계수를 **하나의 트랜잭션**으로 묶는다(BIZ-002-01·BIZ-005-02 ①). FN-008 자신의 처리 흐름
   * 의사코드에 "트랜잭션 시작(4단계)"~"트랜잭션 종료(6단계)" 주석이 있어 — "호출측 트랜잭션에
   * 참여"로만 적힌 FN-012 와 달리 — 이 함수 스스로 트랜잭션 경계를 연다.
   */
  async secure(trackingKey: string, at: Date): Promise<TrackingSecureResult> {
    const preLookup = await this.lookup(trackingKey);
    if (preLookup.branch === 'FIXED') {
      return { branch: 'FIXED', record: preLookup.record as InterlockTrackingModel, isCreated: false };
    }
    if (preLookup.branch === 'OPEN') {
      return { branch: 'OPEN', record: preLookup.record as InterlockTrackingModel, isCreated: false };
    }

    try {
      return await this.db.withTransaction(async (client) => {
        await client.query(`INSERT INTO ${INTERLOCK_TRACKING_TABLE} (tracking_key) VALUES ($1)`, [trackingKey]);
        // FN-013 요청 수 계수 — 같은 트랜잭션(POL BIZ-005-02 ①). 실패하면 EX-BIZ-003 이 전파돼
        // withTransaction 이 INSERT 와 함께 되돌린다.
        await this.metrics.recordEvent(client, { kind: 'REQUEST', at });
        const created = await this.lookup(trackingKey, client);
        return {
          branch: 'OPEN' as const,
          record: created.record as InterlockTrackingModel,
          isCreated: true,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error, PK_CONSTRAINT_NAME)) {
        // 같은 키의 동시 진입(BIZ-002-03 ②) — withTransaction 이 이미 ROLLBACK 했다(PostgreSQL 은
        // 오류가 발생한 트랜잭션 안에서 이어서 조회할 수 없다 — "current transaction is aborted"
        // 이 되므로, 재조회는 그 트랜잭션 밖에서 새로 연 것이어야 한다). 트랜잭션 밖에서 다시
        // 조회해 이어쓰기로 수렴시킨다.
        const relookup = await this.lookup(trackingKey);
        if (relookup.branch === 'NONE') {
          // 이론상 도달 불가(방금 충돌한 행이 그새 사라진 경우) — 방어적으로 실패 처리한다.
          throw new RecordWriteError('SECURE_RACE_LOOKUP_EMPTY', error);
        }
        return { branch: relookup.branch, record: relookup.record as InterlockTrackingModel, isCreated: false };
      }
      if (error instanceof RecordWriteError) throw error;
      throw new RecordWriteError('SECURE_INSERT_FAILED', error);
    }
  }

  /**
   * FN-009 결과 구분 확정 기록. 조건부 UPDATE(`WHERE result_code IS NULL`)로 1회 확정을 DB 가
   * 판정하게 한다(응용 코드의 조회 후 판정이 아니다). 갱신이 실제로 일어났을 때만 FN-013 결과
   * 카운터를 **같은 트랜잭션**에서 부른다(BIZ-005-04) — 실패하면 UPDATE 와 함께 되돌린다. 이미
   * 확정된 레코드에 대한 재요청은 계수 없이 확정된 값을 그대로 반환한다(BIZ-001-04 — 오류가 아니다).
   */
  async fixResult(trackingKey: string, resultCode: ResultCode, at: Date): Promise<InterlockTrackingModel> {
    // 1. 값 검증 — POL BIZ-001-01(3종 밖의 값은 저장하지 않는다)
    if (!RESULT_CODE_VALUES.includes(resultCode)) {
      throw new RecordWriteError('FIX_RESULT_INVALID_RESULT_CODE');
    }

    try {
      return await this.db.withTransaction(async (client) => {
        const update = await client.query(
          `UPDATE ${INTERLOCK_TRACKING_TABLE}
           SET result_code = $1, result_at = $2
           WHERE tracking_key = $3 AND result_code IS NULL`,
          [resultCode, at, trackingKey],
        );

        if (update.rowCount === 1) {
          await this.metrics.recordEvent(client, { kind: 'RESULT', resultCode, at });
        } else {
          // 갱신 0행 — 이미 확정된 상태이거나 대상 레코드가 없다. 어느 쪽이든 계수하지 않는다
          // (BIZ-001-04). 대상 자체가 없으면 결함으로 본다(정상 호출은 항상 확보된 레코드를 갖는다).
          const existing = await this.lookup(trackingKey, client);
          if (existing.branch === 'NONE') {
            throw new RecordWriteError('FIX_RESULT_TARGET_MISSING');
          }
        }

        const latest = await this.lookup(trackingKey, client);
        return latest.record as InterlockTrackingModel;
      });
    } catch (error) {
      if (error instanceof RecordWriteError) throw error;
      throw new RecordWriteError('FIX_RESULT_UPDATE_FAILED', error);
    }
  }

  /**
   * FN-010 결과 확인 표시. 조건부 UPDATE 하나(WHERE 3조건 — 비어 있고 · 결과가 확정된 행만)가
   * 판정과 기록을 동시에 수행한다. FN-013 연계가 없는 유일한 조건부 갱신이라 별도 트랜잭션이
   * 필요 없다(단일 UPDATE 문 자체가 이미 원자적이다). 갱신 0행이면 기존 값(있으면 그 값, 레코드
   * 자체가 없으면 null)을 그대로 반환한다.
   */
  async confirmResult(trackingKey: string, at: Date): Promise<Date | null> {
    try {
      const update = await this.db.query(
        `UPDATE ${INTERLOCK_TRACKING_TABLE}
         SET result_confirmed_at = $1
         WHERE tracking_key = $2 AND result_confirmed_at IS NULL AND result_code IS NOT NULL`,
        [at, trackingKey],
      );

      if (update.rowCount === 1) {
        return at; // 이번 응답이 보관 기산을 시작시켰다.
      }
      const existing = await this.lookup(trackingKey);
      return existing.record?.resultConfirmedAt ?? null;
    } catch (error) {
      throw new RecordWriteError('CONFIRM_RESULT_UPDATE_FAILED', error);
    }
  }

  /**
   * FN-011 완료 콜백 기록. 최초 수신에만 기록하고(BR-012 멱등) `result_code` 는 건드리지 않는다
   * (BR-021 — 결과 확정과 완료 통지는 다른 사실이다). FN-013 연계가 없어 별도 트랜잭션이 필요 없다.
   */
  async recordCallback(trackingKey: string, at: Date): Promise<Date> {
    try {
      const update = await this.db.query(
        `UPDATE ${INTERLOCK_TRACKING_TABLE}
         SET callback_received_at = $1
         WHERE tracking_key = $2 AND callback_received_at IS NULL`,
        [at, trackingKey],
      );

      if (update.rowCount === 1) {
        return at;
      }
      const existing = await this.lookup(trackingKey);
      if (existing.branch === 'NONE') {
        // 정상 호출에서는 도달하지 않는다 — 호출측이 사전 조회(FN-007)로 404 를 먼저 응답한다
        // (function_FN-009-011.md §에러 처리). 그럼에도 도달하면 방어적으로 실패 처리한다.
        throw new RecordWriteError('RECORD_CALLBACK_TARGET_MISSING');
      }
      return existing.record!.callbackReceivedAt as Date; // 최초 수신 시각 유지(BR-012)
    } catch (error) {
      if (error instanceof RecordWriteError) throw error;
      throw new RecordWriteError('RECORD_CALLBACK_UPDATE_FAILED', error);
    }
  }
}
