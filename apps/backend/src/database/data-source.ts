import 'reflect-metadata';
import { DataSource } from 'typeorm';

// 마이그레이션 CLI(스탠드얼론) 전용 DataSource. 접속 값은 환경변수(.env, git 비관리)에서 읽는다.
// 개발·로컬은 별도 구축 PostgreSQL 서버(devspec/infra.md §환경 구분). synchronize 는 항상 false —
// 스키마는 raw SQL 마이그레이션으로만 반영해 사양(부분 유니크·CHECK·FK ON DELETE)을 정확히 재현한다.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'accountinterlockhub',
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  synchronize: false,
  logging: ['error', 'warn', 'migration', 'schema'],
  entities: [],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  migrationsTableName: 'migrations_history',
});
