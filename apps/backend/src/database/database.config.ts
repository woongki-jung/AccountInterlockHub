// DB 접속 설정 로더. 값의 출처는 배포 시 채워지는 apps/backend/.env(git 비관리) — 여기서는
// 키 이름(DB_HOST·DB_PORT·DB_NAME·DB_USER·DB_PASSWORD)과 형식만 정의하고 값을 복제하지 않는다.
// MDL-022 연동 구성 상수(src/config/**)와는 별개다 — DB 접속 정보는 배포 인프라 값이지 연동 구성 상수가 아니다.

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const REQUIRED_ENV_KEYS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;
type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

/**
 * env 에서 DB 접속 설정을 읽는다. 누락 키는 이름만 오류 메시지에 남기고 값은 남기지 않는다
 * (DATA-001-04 취지 — 로그·오류 메시지에 민감 값을 담지 않는다).
 */
export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const missing: RequiredEnvKey[] = REQUIRED_ENV_KEYS.filter(
    (key) => !env[key] || env[key]!.trim().length === 0,
  );
  if (missing.length > 0) {
    throw new Error(`DB 접속 설정 누락 — ${missing.join(', ')} (값은 로그에 남기지 않는다)`);
  }

  const port = Number(env.DB_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DB_PORT 형식 위반 — 양의 정수 문자열이어야 한다');
  }

  return {
    host: env.DB_HOST!,
    port,
    database: env.DB_NAME!,
    user: env.DB_USER!,
    password: env.DB_PASSWORD!,
  };
}
