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
    try {
      await client.query('BEGIN');
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
      client.release();
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
