import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import './pg-type-parsers';
import { loadDatabaseConfig } from './database.config';

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

  constructor() {
    this.pool = new Pool(loadDatabaseConfig(process.env));
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
   */
  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
