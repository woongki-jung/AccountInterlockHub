// DB 접속 설정 로더. 값의 출처는 배포 시 채워지는 apps/backend/.env(git 비관리) — 여기서는
// 키 이름(DB_HOST·DB_PORT·DB_NAME·DB_USER·DB_PASSWORD)과 형식만 정의하고 값을 복제하지 않는다.
// MDL-022 연동 구성 상수(src/config/**)와는 별개다 — DB 접속 정보는 배포 인프라 값이지 연동 구성 상수가 아니다.
//
// P06(accountinterlockhub#483) — DB 키 누락·접속 실패의 기동 검증 정책 매핑 결정(#483 journal 3417 §2
// 인계 사항 해소). **결정: ② 별도 실패 경로로 둔다 — PROC-901/EX-OPS-001 에 편입하지 않는다.**
// 근거는 세 곳 모두 일치한다 — process_PROC-901.md §관련 사양 코드 "DB 엔터티: 없음 — 연동 구성을
// 데이터베이스에 두지 않는다"·§실행 제약사항 "트랜잭션 경계: 없음. 데이터베이스를 쓰지 않는다"·
// §의존 프로세스 "데이터베이스 상태에 의존하지 않는다". PROC-901 이 검증하는 MDL-022 상수 8종
// (interlock-config.types.ts `MissingConstantKey`)에 DB_* 5키가 없는 것도 같은 설계다(CLAUDE.env.md
// §연동 구성 상수에도 DB 키가 없다 — DB 접속값은 배포 인프라 값이지 연동 구성 상수가 아니다). 이
// 함수가 던지는 일반 Error 는 그래서 EX-OPS-001(HTTP 응답 없음·표준출력 상수명만)로 재포장하지
// 않는다 — 미충족 키 이름만 담고 값은 담지 않아(DATA-001-04 취지) 별도 실패 경로로도 값 노출
// 리스크는 없다. NestJS 부트스트랩(main.ts) 은 AppModule DI 그래프 초기화 중 이 오류를 만나면
// 처리하지 않은 프라미스 거부로 프로세스가 비정상 종료돼 "부분 기동을 하지 않는다"는 일반 원칙은
// 실질적으로 유지되지만, main.ts 명시적 catch 배선은 이 Phase 시점에 다른 세션이 그 파일을 편집
// 중이라(작업 규율 — 미커밋 변경 위 수정 금지) 보류했다 — 후속 확인 필요(완료 보고 참고).

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
