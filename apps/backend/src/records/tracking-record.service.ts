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
import { QueryExecutor } from './query-executor';
import { TrackingLookupResult, TrackingSecureResult } from './tracking-record.types';

/**
 * FN-007~011 연동 추적 레코드 조회·확보·기록(function_FN-007-008.md·function_FN-009-011.md).
 * 메서드명은 PROC-301 §진입점의 `kind` 값(LOOKUP·SECURE·FIX_RESULT·CONFIRM_RESULT·
 * RECORD_CALLBACK)과 그대로 대응시켰다 — 그 kind 디스패처(PROC-301 자체의 배선)는 후속 Phase
 * 소관이지만, 대응 이름을 맞춰 두면 그 배선이 스위치 1개로 바로 연결할 수 있다.
 *
 * **트랜잭션 소유권 — 전부 호출측이 갖는다.** 각 FN 문서 §처리 흐름의 "(트랜잭션 시작)"/
 * "(트랜잭션 종료)" 주석은 원자 경계의 표시일 뿐 소유권 선언이 아니다 — 같은 표기가 FN-010
 * (function_FN-009-011.md §FN-010 단계 1·2)에도 있지만, 이 다섯 계기를 묶는 process_PROC-301.md
 * 는 `B3`(FN-008)~`B6`(FN-011) **전부**를 "(트랜잭션 참여)"로 적고, §실행 제약사항·§구현
 * 가이드에서 "호출측 트랜잭션에 참여한다 · 새 트랜잭션을 열지 않는다"를 프로세스 전체에 대해
 * 명시한다. 실제 BEGIN 은 이 프로세스보다 위(PROC-102 B6·PROC-103 B3·PROC-104 B6·PROC-201 B5·
 * PROC-203 B4 — 전부 후속 Phase)에서 연다. 그래서 쓰기 메서드 넷(secure·fixResult·confirmResult·
 * recordCallback)은 `executor` 를 **필수 첫 인자**로 받고 스스로 트랜잭션을 열지 않는다(FN-012·
 * FN-013 이 이미 쓰던 형태와 통일). `lookup` 만 읽기 전용이라 풀 기본값을 허용한다.
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
   * 때는 그 트랜잭션의 client 를 그대로 넘겨 같은 스냅샷을 보게 한다.
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
   * FN-008 추적 레코드 확보(생성·이어쓰기). `executor` 는 호출측이 이미 연 트랜잭션에 참여하는
   * client 다(PROC-301 `B3` "트랜잭션 참여"). `FIXED`·`OPEN` 이면 어떤 컬럼도 갱신하지 않고
   * 그대로 반환한다(BIZ-002-04 — 보관 기산점이 밀리지 않고, 지표 요청 수에도 계수하지 않는다).
   *
   * `NONE` 이면 `INSERT ... ON CONFLICT (tracking_key) DO NOTHING` 을 쓴다 — 일반 INSERT 라면
   * 같은 키의 동시 진입에서 기본 키 충돌 오류가 나고, PostgreSQL 은 오류가 발생한 트랜잭션
   * 안에서 더 이상 조회를 실행할 수 없다("current transaction is aborted") — 이 오류를 잡으려면
   * 호출측 트랜잭션 전체를 롤백해야 하므로 이어쓰기로 수렴시킬 수 없다. `DO NOTHING` 은 충돌을
   * **오류로 만들지 않아** 트랜잭션이 중단되지 않고, 같은 `executor`(같은 트랜잭션)로 그대로
   * 재조회해 이어쓰기 분기로 갈 수 있다(data_ENT-001.md §구현 가이드 "기본 키 충돌을 정상
   * 경로로 다룬다"를 오류 없이 만족한다).
   */
  async secure(executor: QueryExecutor, trackingKey: string, at: Date): Promise<TrackingSecureResult> {
    const preLookup = await this.lookup(trackingKey, executor);
    if (preLookup.branch === 'FIXED') {
      return { branch: 'FIXED', record: preLookup.record as InterlockTrackingModel, isCreated: false };
    }
    if (preLookup.branch === 'OPEN') {
      return { branch: 'OPEN', record: preLookup.record as InterlockTrackingModel, isCreated: false };
    }

    try {
      const inserted = await executor.query(
        `INSERT INTO ${INTERLOCK_TRACKING_TABLE} (tracking_key) VALUES ($1)
         ON CONFLICT (tracking_key) DO NOTHING`,
        [trackingKey],
      );

      if (inserted.rowCount === 1) {
        // FN-013 요청 수 계수 — 같은 트랜잭션(POL BIZ-005-02 ①). 실패하면 EX-BIZ-003 이 전파돼
        // 호출측이 INSERT 와 함께 되돌린다(이 함수는 트랜잭션을 소유하지 않으므로 스스로
        // 롤백하지 않는다 — 롤백은 호출측 BEGIN 의 몫이다).
        await this.metrics.recordEvent(executor, { kind: 'REQUEST', at });
        const created = await this.lookup(trackingKey, executor);
        return {
          branch: 'OPEN' as const,
          record: created.record as InterlockTrackingModel,
          isCreated: true,
        };
      }

      // rowCount === 0 — 같은 키의 동시 진입(BIZ-002-03 ②). ON CONFLICT DO NOTHING 은 오류를
      // 내지 않으므로 트랜잭션이 중단되지 않는다 — 같은 executor 로 그대로 재조회해 이어쓰기로
      // 수렴시킨다.
      const relookup = await this.lookup(trackingKey, executor);
      if (relookup.branch === 'NONE') {
        // 이론상 도달 불가(방금 충돌한 행이 그새 사라진 경우) — 방어적으로 실패 처리한다.
        throw new RecordWriteError('SECURE_RACE_LOOKUP_EMPTY');
      }
      return { branch: relookup.branch, record: relookup.record as InterlockTrackingModel, isCreated: false };
    } catch (error) {
      if (error instanceof RecordWriteError) throw error;
      throw new RecordWriteError('SECURE_INSERT_FAILED', error);
    }
  }

  /**
   * FN-009 결과 구분 확정 기록. `executor` 는 호출측 트랜잭션에 참여하는 client 다(PROC-301
   * `B4` "트랜잭션 참여"). 조건부 UPDATE(`WHERE result_code IS NULL`)로 1회 확정을 DB 가
   * 판정하게 한다(응용 코드의 조회 후 판정이 아니다). 갱신이 실제로 일어났을 때만 FN-013 결과
   * 카운터를 **같은 트랜잭션**에서 부른다(BIZ-005-04) — 실패하면 호출측이 UPDATE 와 함께
   * 되돌린다. 이미 확정된 레코드에 대한 재요청은 계수 없이 확정된 값을 그대로 반환한다
   * (BIZ-001-04 — 오류가 아니다).
   */
  async fixResult(
    executor: QueryExecutor,
    trackingKey: string,
    resultCode: ResultCode,
    at: Date,
  ): Promise<InterlockTrackingModel> {
    // 1. 값 검증 — POL BIZ-001-01(3종 밖의 값은 저장하지 않는다). 트랜잭션 참여 전에 걸러낸다.
    if (!RESULT_CODE_VALUES.includes(resultCode)) {
      throw new RecordWriteError('FIX_RESULT_INVALID_RESULT_CODE');
    }

    try {
      const update = await executor.query(
        `UPDATE ${INTERLOCK_TRACKING_TABLE}
         SET result_code = $1, result_at = $2
         WHERE tracking_key = $3 AND result_code IS NULL`,
        [resultCode, at, trackingKey],
      );

      if (update.rowCount === 1) {
        await this.metrics.recordEvent(executor, { kind: 'RESULT', resultCode, at });
      } else {
        // 갱신 0행 — 이미 확정된 상태이거나 대상 레코드가 없다. 어느 쪽이든 계수하지 않는다
        // (BIZ-001-04). 대상 자체가 없으면 결함으로 본다(정상 호출은 항상 확보된 레코드를 갖는다).
        const existing = await this.lookup(trackingKey, executor);
        if (existing.branch === 'NONE') {
          throw new RecordWriteError('FIX_RESULT_TARGET_MISSING');
        }
      }

      const latest = await this.lookup(trackingKey, executor);
      return latest.record as InterlockTrackingModel;
    } catch (error) {
      if (error instanceof RecordWriteError) throw error;
      throw new RecordWriteError('FIX_RESULT_UPDATE_FAILED', error);
    }
  }

  /**
   * FN-010 결과 확인 표시. `executor` 는 호출측 트랜잭션에 참여하는 client 다(PROC-301 `B5`
   * "트랜잭션 참여" · PROC-201 `B5` 가 응답 구성과 같은 경계에서 부른다). 조건부 UPDATE 하나
   * (WHERE 3조건 — 비어 있고 · 결과가 확정된 행만)가 판정과 기록을 동시에 수행한다. FN-013
   * 연계가 없다(recordCallback 도 마찬가지다 — function_FN-009-011.md 어느 쪽도 FN-013 을 호출하지
   * 않는다). 갱신 0행이면 기존 값(있으면 그 값, 레코드 자체가 없으면 null)을 그대로 반환한다.
   */
  async confirmResult(executor: QueryExecutor, trackingKey: string, at: Date): Promise<Date | null> {
    try {
      const update = await executor.query(
        `UPDATE ${INTERLOCK_TRACKING_TABLE}
         SET result_confirmed_at = $1
         WHERE tracking_key = $2 AND result_confirmed_at IS NULL AND result_code IS NOT NULL`,
        [at, trackingKey],
      );

      if (update.rowCount === 1) {
        return at; // 이번 응답이 보관 기산을 시작시켰다.
      }
      const existing = await this.lookup(trackingKey, executor);
      return existing.record?.resultConfirmedAt ?? null;
    } catch (error) {
      throw new RecordWriteError('CONFIRM_RESULT_UPDATE_FAILED', error);
    }
  }

  /**
   * FN-011 완료 콜백 기록. `executor` 는 호출측 트랜잭션에 참여하는 client 다(PROC-301 `B6`
   * "트랜잭션 참여" · PROC-203 `B4`). 최초 수신에만 기록하고(BR-012 멱등) `result_code` 는
   * 건드리지 않는다(BR-021 — 결과 확정과 완료 통지는 다른 사실이다).
   */
  async recordCallback(executor: QueryExecutor, trackingKey: string, at: Date): Promise<Date> {
    try {
      const update = await executor.query(
        `UPDATE ${INTERLOCK_TRACKING_TABLE}
         SET callback_received_at = $1
         WHERE tracking_key = $2 AND callback_received_at IS NULL`,
        [at, trackingKey],
      );

      if (update.rowCount === 1) {
        return at;
      }

      // 갱신 0행 — 중복 통지(최초 값 유지)거나 대상 레코드 부재다. 정상 호출에서는 후자가
      // 도달하지 않는다(호출측이 사전 조회(FN-007)로 404 를 먼저 응답한다 —
      // function_FN-009-011.md §에러 처리). 그럼에도 도달하면 명시적으로 검사해 방어한다
      // (비-null 단언 없이 — `existing.record`·`callbackReceivedAt` 둘 다 실제로 널이 아님을 확인).
      const existing = await this.lookup(trackingKey, executor);
      if (existing.record === null || existing.record.callbackReceivedAt === null) {
        throw new RecordWriteError('RECORD_CALLBACK_TARGET_MISSING');
      }
      return existing.record.callbackReceivedAt; // 최초 수신 시각 유지(BR-012)
    } catch (error) {
      if (error instanceof RecordWriteError) throw error;
      throw new RecordWriteError('RECORD_CALLBACK_UPDATE_FAILED', error);
    }
  }
}
