import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { loadDatabaseConfig } from './database.config';

/**
 * 마이그레이션 실행기 — 루트 `npm run migration:run`(up) · `migration:revert`(down) 이 호출한다.
 * apps/backend/migrations/*.up.sql · *.down.sql 을 파일명 순으로 적용한다.
 *
 * 마이그레이션 이력을 담는 별도 테이블을 두지 않는다 — 저장 대상은 ENT-001~003 셋뿐이고 그 밖의
 * 어떤 테이블도 만들지 않는다(DATA-001-01 저장 3종 원칙). 대신 모든 DDL 문을 IF NOT EXISTS/
 * IF EXISTS 로 작성해 재실행해도 안전(멱등)하게 만든다 — 이미 적용된 상태에서 다시 실행해도
 * 오류 없이 끝난다. 파일이 여러 개로 늘어나도 이 방식이 성립하려면 각 파일의 DDL 이 계속
 * IF NOT EXISTS/IF EXISTS 로 작성돼야 한다(후속 마이그레이션 작성 시 유지할 관례).
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

type Direction = 'up' | 'down';

function parseDirection(argv: string[]): Direction {
  const arg = argv[2];
  if (arg === undefined || arg === 'up') return 'up';
  if (arg === 'down') return 'down';
  throw new Error(`알 수 없는 방향 인자 '${arg}' — up 또는 down 만 허용한다`);
}

function listMigrationFiles(direction: Direction): string[] {
  const suffix = `.${direction}.sql`;
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(suffix));
  // up 은 파일명 오름차순(선행 스키마 먼저) · down 은 내림차순(가장 나중 변경부터 되돌린다).
  files.sort((a, b) => (direction === 'up' ? a.localeCompare(b) : b.localeCompare(a)));
  return files;
}

async function run(): Promise<void> {
  const direction = parseDirection(process.argv);
  const files = listMigrationFiles(direction);

  if (files.length === 0) {
    console.log(`[migration:${direction}] 적용할 파일이 없다 — ${MIGRATIONS_DIR}`);
    return;
  }

  const client = new Client(loadDatabaseConfig(process.env));
  await client.connect();

  try {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migration:${direction}] 적용 중 — ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${file} 적용 실패 — ${(error as Error).message}`);
      }
    }
    console.log(`[migration:${direction}] 전체 완료 — ${files.length}개 파일`);
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  console.error(`[migration] 실패 — ${(error as Error).message}`);
  process.exitCode = 1;
});
