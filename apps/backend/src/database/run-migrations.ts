import { AppDataSource } from './data-source';

// 스탠드얼론 마이그레이션 실행기. `node --env-file=.env dist/database/run-migrations.js` 로 구동한다
// (TypeORM CLI 바이너리 의존 없이 DataSource API 로 실행 — 버전 간 호환 안정성 목적).
// `--revert` 인자를 주면 마지막 마이그레이션을 되돌린다.
async function main(): Promise<void> {
  const revert = process.argv.includes('--revert');
  await AppDataSource.initialize();
  try {
    if (revert) {
      await AppDataSource.undoLastMigration();
      console.log('[migration] 마지막 마이그레이션을 되돌렸습니다.');
    } else {
      const applied = await AppDataSource.runMigrations();
      console.log(`[migration] 적용된 마이그레이션: ${applied.length}건`);
      for (const m of applied) {
        console.log(`  - ${m.name}`);
      }
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[migration] 실패:', err);
  process.exit(1);
});
