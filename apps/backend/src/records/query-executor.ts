import type { QueryResult, QueryResultRow } from 'pg';

/**
 * DatabaseService(풀 실행)와 pg PoolClient(트랜잭션 참여)를 함께 받기 위한 최소 구조적 타입.
 * FN-007~013 각 함수는 "지금 트랜잭션 안에 있는지"를 스스로 판단하지 않는다 — 호출부가 이
 * 인터페이스를 만족하는 실행기(커넥션 풀 전체 또는 특정 트랜잭션의 client)를 건네줄 뿐이다.
 * DatabaseService.query() 시그니처와 pg 의 Pool·PoolClient.query() 시그니처가 이미 구조적으로
 * 호환되므로(둘 다 `query<T>(sql: string, params?): Promise<QueryResult<T>>` 형태의 오버로드를
 * 갖는다) 별도 어댑터가 필요 없다.
 */
export interface QueryExecutor {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}
