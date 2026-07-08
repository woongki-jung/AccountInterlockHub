import 'reflect-metadata';
import { AppException } from '../common/envelope/app.exception';
import { hashPassword, validatePasswordComplexity } from '../admin/auth/password.util';
import { AppDataSource } from './data-source';

/**
 * 관리자 계정 시드(멱등 upsert) — ENT-005 운영 프로비저닝 대체(수동 절차, 별도 PROC 없음).
 * `node --env-file=.env dist/database/seed-admin.js` (npm run seed:admin)로 실행한다.
 *
 * env ADMIN_SEED_USERNAME / ADMIN_SEED_PASSWORD 로 1건을 upsert 한다. 비밀번호는 복잡도 검증(AUTH-001-02)
 * 후 bcrypt 해시로만 저장하며 평문·해시를 출력·로그에 남기지 않는다. 실계정 자격을 커밋하지 않는다.
 */
async function main(): Promise<void> {
  const username = process.env.ADMIN_SEED_USERNAME;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!username || !password) {
    console.error(
      '[seed:admin] ADMIN_SEED_USERNAME / ADMIN_SEED_PASSWORD 환경변수가 필요합니다(.env).',
    );
    process.exit(1);
  }

  try {
    validatePasswordComplexity(password);
  } catch (err) {
    if (err instanceof AppException) {
      console.error(
        '[seed:admin] 시드 비밀번호 복잡도 미달 — 8자 이상 + 영대문자·소문자·숫자·특수문자 각 1자 이상(AUTH-001-02).',
      );
      process.exit(1);
    }
    throw err;
  }

  const passwordHash = await hashPassword(password);

  await AppDataSource.initialize();
  try {
    await AppDataSource.query(
      `INSERT INTO "TBL_ADMIN_ACCOUNT" (username, password_hash, is_active, failed_login_count, created_by)
       VALUES ($1, $2, true, 0, 'seed')
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_active = true,
         failed_login_count = 0,
         locked_until = NULL,
         updated_at = now(),
         updated_by = 'seed'`,
      [username, passwordHash],
    );
    console.log(`[seed:admin] 관리자 계정 upsert 완료 — username=${username}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[seed:admin] 실패:', err);
  process.exit(1);
});
