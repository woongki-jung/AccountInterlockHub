import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import './pg-type-parsers';
import { loadDatabaseConfig } from './database.config';
import { RecordWriteError } from '../records/records.errors';
import { isHttpMappedError } from '../common/errors/http-mapped.error';

/**
 * PostgreSQL 연결 풀 보유소 — ENT-001~003 접근의 공통 하부 계층이다.
 * 쿼리 실행·트랜잭션 경계 제공에 한정한다. 결과 구분 3분기·조건부 UPDATE·UPSERT 같은
 * 저장 비즈니스 규칙(BIZ-002·BIZ-005)은 담지 않는다 — 그 구현은 PROC-301~303(P06) 소관이다.
 * AppModule 등록은 P04 가 이미 수행했다(database.module.ts 참고 — 당초 계획은 P06 이었으나
 * P04 가 실 DB 검증을 위해 선점했다).
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger('DatabaseService');

  constructor() {
    this.pool = new Pool(loadDatabaseConfig(process.env));

    // 횡단 결함 시정 [C-1] — pg-pool 은 유휴 커넥션이 서버측에서 끊기면(관리형 PostgreSQL 의
    // 정기 점검·페일오버·유휴 커넥션 회수 등 운영 중 흔한 이벤트, 재현: pg_terminate_backend()
    // 로 유휴 커넥션 1개만 강제 종료) 그 오류를 idleListener 로 잡아 죽은 클라이언트를 스스로
    // 제거(pool._remove)한 뒤 이 Pool(BoundPool, EventEmitter) 에 'error' 로 재발행한다
    // (node_modules/pg-pool/index.js makeIdleListener 확인). Node EventEmitter 는 'error' 이벤트에
    // 리스너가 하나도 없으면 그 오류를 던져 **프로세스 전체를 종료**시킨다 — 요청 1건의 실패가
    // 아니라 서비스 전체 가동 중단이다(node-postgres 공식 문서가 명시하는 필수 운영 요건). 여기서
    // 리스너를 달아 무해화(swallow)하기만 하면 충분하다 — 죽은 클라이언트 제거는 idleListener 가
    // 이미 수행했으므로 풀은 다음 요청부터 신규 커넥션으로 계속 서비스한다. message·stack·code 는
    // 로그에 담지 않는다(FN-015 금지 키·OPS-003-03·SEC-002-05) — describeError 는 error.name 만
    // 남기는 기존 관례(interlock-delivery.service.ts 등 describeError·global-exception.filter.ts
    // describeForLog)를 그대로 따른다.
    this.pool.on('error', (err: unknown) => {
      this.logger.error(`pg.Pool idle client error — ${this.describeError(err)}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  /**
   * 트랜잭션 경계 — work 안에서 실패하면 롤백하고 그대로 던진다.
   * "저장 실패 시 호출측 트랜잭션과 함께 되돌린다"(EX-BIZ-003)는 상위 규칙의 하부 지원 수단이며,
   * 그 규칙을 적용하는 구체 판단(무엇을 실패로 볼지)은 이 함수의 책임이 아니다.
   *
   * 횡단 결함 시정 [C-2] — 위 "그대로 던진다"는 work() 가 이미 exCode 를 가진 예외(FN-007~013 이
   * 스스로 RecordWriteError 등으로 분류한 실패)로 던졌을 때만 성립한다. `pool.connect()`·
   * `BEGIN`·`COMMIT` **자체**의 실패(연결 장애·직렬화 충돌 등)는 어디서도 분류되지 않아 그대로
   * 전파하면 전역 필터의 마지막 방어(EX-OPS-002)로 떨어지는데, process_PROC-102.md §분기 표는
   * "레코드 확보·지표 계수 실패 → 500 EX-BIZ-003·재시도 가능"을 요구한다 — `B6` 트랜잭션 경계
   * 전체가 그 "레코드 확보"다. `toRecordWriteFailure()` 가 그 판정을 한 곳에 모은다.
   */
  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (error) {
      // 커넥션 획득 자체의 실패 — 아직 트랜잭션이 없어 ROLLBACK·release 대상이 없다.
      throw this.toRecordWriteFailure(error);
    }

    // 횡단 결함 시정 [C-3] — [C-1]이 무해화한 것은 "유휴(idle)" 커넥션의 크래시뿐이다. pg-pool 은
    // 커넥션을 체크아웃할 때(_acquireClient, node_modules/pg-pool/index.js 344행)
    // `client.removeListener('error', idleListener)` 로 자신의 idleListener 를 그 client 인스턴스에서
    // 뗀다 — 이 함수가 커넥션을 쥐고 있는 체크아웃 구간에는 Pool 이 대신 받아줄 'error' 리스너가
    // 없다. 그 구간에 서버가 이 커넥션을 강제 종료하면(관리형 PostgreSQL 의
    // idle_in_transaction_session_timeout, DBA 의 세션 강제 종료 등 — 재현: pg_terminate_backend()
    // 로 BEGIN 이후·COMMIT 이전의 활성 커넥션만 강제 종료) Pool 이 아니라 이 개별 Client 인스턴스가
    // 리스너 없는 'error' 를 던져 [C-1] 과 같은 이유로 프로세스 전체가 크래시한다(node_modules/pg/lib/
    // client.js _handleErrorEvent 확인 — 실측 재현: "Emitted 'error' event on Client instance", exit 1).
    // 체크아웃 구간에만 한정해 무해화 리스너를 달고, release 직전(finally)에 반드시 뗀다 — 풀에
    // 반납된 뒤에는 pg-pool 자신의 idleListener 가 다시 그 자리를 맡으므로(_release, index.js 385행)
    // 이 리스너를 남겨두면 다음 체크아웃 때 또 새로 달려 누적된다(MaxListenersExceededWarning 위험,
    // 같은 커넥션의 재사용 횟수만큼 실측 확인 — 완료 보고 참고). 이 리스너는 "unhandled 'error' 로
    // 인한 프로세스 종료"만 막을 뿐이다 — 진행 중이던 쿼리의 거절(reject)은 pg 내부
    // `_errorAllQueries()` 가 `emit('error')` 보다 먼저 별도 경로로 그대로 처리해(client.js
    // _handleErrorEvent) 아래 catch 로 전파되므로 [C-2] 분류를 그대로 탄다 — 이 리스너가 그 전파를
    // 가로채거나 삼키지 않는다. message·stack·code 는 로그에 담지 않는다(FN-015 금지 키·
    // OPS-003-03·SEC-002-05) — describeError 관례를 그대로 따른다.
    let checkedOutClientErrored = false;
    const onCheckedOutError = (err: unknown): void => {
      checkedOutClientErrored = true;
      this.logger.error(`pg.Client checked-out error — ${this.describeError(err)}`);
    };
    client.on('error', onCheckedOutError);

    try {
      // ISOLATION LEVEL 을 명시한다 — 현재 PostgreSQL 기본 구성(READ COMMITTED)에서는 동작이
      // 무변경이다. 목적은 암묵적으로 기대고 있던 의존을 코드에 명시하는 것이다. 아래 4곳의
      // 사양이 이미 이 트랜잭션 경계를 READ COMMITTED 로 못박는다 — process_PROC-102-logic.md
      // B6(118행) · process_PROC-103-logic.md B3(89행) · process_PROC-104.md B6(175행) ·
      // process_PROC-203.md B4(135행). 서버 기본 격리수준이 REPEATABLE READ 로 바뀌면
      // process_PROC-103-logic.md B6 표지 검사(124~133행 — 잠금을 쥔 채로
      // `SELECT COUNT(*) FROM tbl_consent_proof … AND consented_at >= locked.created_at` 로
      // 이미 전달을 시도했는지 본다)가 조용히 깨진다: 그 검사를 도는 트랜잭션(T2)의 스냅숏이
      // BEGIN 시점에 고정돼 T1 이 그 직후 커밋한 증적을 보지 못하고(이중 전달 부활), T1 은
      // 그 행에 FOR UPDATE 로 잠금만 걸 뿐 UPDATE 하지 않으므로(실제 쓰기는 다른 테이블인
      // tbl_consent_proof 의 INSERT) 행 버전이 그대로라 T2 는 직렬화 실패조차 겪지 않고
      // 자신의 스냅숏을 그대로 신뢰해 진행한다.
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // ROLLBACK 자체가 실패해도(예: 이 커넥션이 위 [C-1] 과 같은 이유로 이미 서버측에서 끊긴
      // 경우) 그 2차 실패가 원본 error 를 가리거나 아래 분류를 건너뛰게 하지 않는다 — 항상 원본
      // error 를 분류 대상으로 삼는다(ROLLBACK 실패 자체를 별도로 보고하지 않는다 — 원본 실패의
      // 부수 결과일 뿐이고, 이미 중단된 트랜잭션에 대한 ROLLBACK 실패는 흔하다).
      await client.query('ROLLBACK').catch(() => undefined);
      throw this.toRecordWriteFailure(error);
    } finally {
      // [C-3] — 위 무해화 리스너를 release 이전에 반드시 뗀다(누적 방지, 위 주석 참고). 체크아웃
      // 구간에서 실제로 소켓 오류를 겪은 커넥션은 `release(true)` 로 반납해 pg-pool 이 그 커넥션을
      // 폐기(discard, `_remove`)하게 한다 — pg-pool README "Shutdown" 절이 명시하는 공식 계약이다
      // (진단: pg 내부적으로도 이런 커넥션은 `_queryable=false` 로 남아 `release()` 인자 없이 반납해도
      // pg-pool 자신이 결국 폐기하지만 — index.js `_release` 의 `!client._queryable` 분기 — 그 판정을
      // pg 의 비공개 내부 상태 플래그에만 의존시키지 않고, 우리가 실제로 관측한 사실을 공개 계약으로
      // 명시한다). 그냥 반납하면 이 죽은 커넥션이 idle 목록에 남아 다음 pool.connect() 가 그 죽은
      // 커넥션을 다시 뽑아 실패하는 사태로 이어질 수 있다. 체크아웃 구간에서 오류가 없었던 정상
      // 종료는 `release(false)` 로 기존과 동일하게 idle 로 반환한다(동작 무변경).
      client.removeListener('error', onCheckedOutError);
      client.release(checkedOutClientErrored);
    }
  }

  /**
   * `error` 가 이미 `exCode` 를 가졌으면(work() 내부에서 이미 분류된 실패 — 덕 타이핑,
   * isHttpMappedError) 그대로 돌려준다 — 덧씌우면 그 exCode 가 EX-BIZ-003 에 가려진다. 그 밖의
   * (분류되지 않은) 실패만 RecordWriteError('TX_BOUNDARY_FAILED') 로 감싼다. 원본 오류는 `cause`
   * 로만 연결하고 message·reason 에 옮겨 적지 않는다(DATA-001-04 — records.errors.ts 상단 문서
   * 주석과 같은 원칙).
   */
  private toRecordWriteFailure(error: unknown): unknown {
    return isHttpMappedError(error) ? error : new RecordWriteError('TX_BOUNDARY_FAILED', error);
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
