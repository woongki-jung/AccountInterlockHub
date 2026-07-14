import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * dummy-test — 발송처(연동처 A) 암호화 링크 더미 생성 CLI (기능검증 보조).
 *
 * 연동처 A 가 전달할 데이터 X 를 이중 암호화(encX·encY)해 사용자 이용 동의 진입 URL 을 만든다.
 * 실제 발송처 없이 사용자 페이지(SCR-005 `/interlock/entry/:accessAddressId`)와 승인·복호화 플로우
 * (FN-020·PROC-203)를 로컬에서 검증하기 위한 도구다. DB 접속·저장은 하지 않는다(순수 링크 생성).
 *
 * 암호화 규약은 hub-decrypt.service.ts(FN-020 복호화)의 **정확한 역**이다 — 동일 정규화(normalize32·
 * iv16, 0x5F 우패딩) · AES-256-CBC(PKCS#7) · Base64URL(패딩 없음). 생성 직후 self-check(자체 복호화)로
 * 왕복 정합을 보증하므로, 출력 URL 은 백엔드 복호화가 반드시 성공한다(생년월일 일치 시).
 *
 * 규약 근거: docs/prd/devspec/external-apis.md §암호화 연동 규약 · policy_SEC-crypto.md(SEC-006) ·
 *           function_FN-020.md.
 *
 * 실행: `npm run dummy-test`  (apps/backend 디렉터리 또는 루트)
 *   위치 인자: [configCode] [birthDate]      예) npm run dummy-test -- BAT-CFG 900101
 *   환경변수(인자 미지정 시 폴백): DUMMY_BASE_URL · DUMMY_CONFIG_CODE · DUMMY_BIRTHDATE ·
 *                                 DUMMY_TRACKING_KEY · DUMMY_MEMBER_KEY
 */

// ── hub-decrypt.service.ts 와 대칭인 상수·정규화(SEC-006-02) ────────────────────────────
const AES_KEY_LEN = 32; // AES-256 키 길이(바이트)
const AES_IV_LEN = 16; // CBC IV 길이(바이트)
const PAD_BYTE = 0x5f; // '_' 우측 패딩 바이트

/**
 * 키/IV 정규화 — 문자열 UTF-8 바이트가 targetLen 이상이면 앞 targetLen 바이트로 절단, 미만이면
 * 0x5F('_')로 우패딩. hub-decrypt.service.ts 의 normalizeBytes 와 **바이트 단위로 동일**해야 한다.
 */
function normalizeBytes(str: string, targetLen: number): Buffer {
  const bytes = Buffer.from(str, 'utf8');
  if (bytes.length >= targetLen) {
    return bytes.subarray(0, targetLen);
  }
  const result = Buffer.alloc(targetLen, PAD_BYTE);
  bytes.copy(result, 0);
  return result;
}
const normalize32 = (str: string): Buffer => normalizeBytes(str, AES_KEY_LEN);
const iv16 = (str: string): Buffer => normalizeBytes(str, AES_IV_LEN);

/** AES-256-CBC 암호화(PKCS#7 자동 패딩 — createDecipheriv 기본 언패딩과 대칭). */
function aesCbcEncrypt(plain: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(plain), cipher.final()]);
}

/** AES-256-CBC 복호화 — self-check 전용(hub-decrypt.service.ts aesCbcDecrypt 와 동일). */
function aesCbcDecrypt(cipherText: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}

/**
 * Base64URL 인코딩(패딩 없음) — hub-decrypt.service.ts base64UrlDecode 가 받는 형식.
 * Node 'base64url' 인코딩은 URL-safe 치환(+→- /→_)에 패딩(=)을 제거한 문자열을 낸다(charset [A-Za-z0-9_-]).
 * AES-CBC 출력은 16바이트 배수라 인코딩 길이 %4===1(디코더가 거부하는 잔여 길이)이 되는 경우가 없다.
 */
function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

/** Base64URL 디코드 — self-check 왕복 검증에서 hub-decrypt.service.ts 와 동일 형식으로 되돌린다. */
function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

// ── 전달 데이터 X · 암호화 링크 조립 ──────────────────────────────────────────────────

/** 발송처가 전달하는 데이터 X — trackingKey 필수(허브가 추출·검증), 그 외 필드는 수신처 B 규약. */
interface DummyPayloadX {
  trackingKey: string;
  [field: string]: unknown;
}

interface BuildResult {
  encX: string;
  encY: string;
  url: string;
  xJson: string;
}

/**
 * 이중 암호화 링크 생성(복호화의 역순).
 *  1) encX = Base64URL( AES-CBC( JSON(X), key=normalize32(keyXstr), iv=iv16(keyXstr) ) )
 *  2) encY = Base64URL( AES-CBC( keyXstr,  key=normalize32(birthDate), iv=iv16(birthDate) ) )
 * 복호화(허브)는 생년월일로 encY→keyXstr 복원 → keyXstr 로 encX→X 복원 → X.trackingKey 추출.
 */
function buildEncryptedLink(params: {
  baseUrl: string;
  configCode: string;
  birthDate: string;
  keyXstr: string;
  x: DummyPayloadX;
}): BuildResult {
  const { baseUrl, configCode, birthDate, keyXstr, x } = params;
  const xJson = JSON.stringify(x);

  const encX = base64UrlEncode(
    aesCbcEncrypt(Buffer.from(xJson, 'utf8'), normalize32(keyXstr), iv16(keyXstr)),
  );
  const encY = base64UrlEncode(
    aesCbcEncrypt(Buffer.from(keyXstr, 'utf8'), normalize32(birthDate), iv16(birthDate)),
  );

  const origin = baseUrl.replace(/\/+$/, '');
  const url = `${origin}/interlock/entry/${encodeURIComponent(configCode)}?encX=${encX}&encY=${encY}`;
  return { encX, encY, url, xJson };
}

/**
 * self-check — 생성한 encX·encY 를 hub-decrypt 규약대로 복호화해 X.trackingKey 가 복원되는지 확인한다.
 * 스크립트의 암호화 로직이 복호화 규약과 왕복 정합함을 매 실행마다 보증한다(실패 시 예외로 중단).
 */
function verifyRoundTrip(encX: string, encY: string, birthDate: string, expected: DummyPayloadX): void {
  const keyXstr = aesCbcDecrypt(
    base64UrlDecode(encY),
    normalize32(birthDate),
    iv16(birthDate),
  ).toString('utf8');
  const xJson = aesCbcDecrypt(
    base64UrlDecode(encX),
    normalize32(keyXstr),
    iv16(keyXstr),
  ).toString('utf8');
  const parsed = JSON.parse(xJson) as DummyPayloadX;
  if (parsed.trackingKey !== expected.trackingKey) {
    throw new Error(
      `self-check 실패: 복원 trackingKey(${parsed.trackingKey}) != 기대(${expected.trackingKey})`,
    );
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────

/** URL-safe 랜덤 토큰(Base64URL) — keyXstr·기본 trackingKey·memberKey 생성에 사용. */
function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

/** 승인 화면(ConsentPage isBirthDateFormatValid)이 입력을 허용하는 6자리 YYMMDD 형식 여부. */
function isConsentEnterableBirthDate(value: string): boolean {
  if (!/^\d{6}$/.test(value)) {
    return false;
  }
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function main(): void {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const [argConfigCode, argBirthDate] = positional;

  const baseUrl = process.env.DUMMY_BASE_URL ?? 'http://localhost:5173';
  const configCode = argConfigCode ?? process.env.DUMMY_CONFIG_CODE ?? 'BAT-CFG';
  const birthDate = argBirthDate ?? process.env.DUMMY_BIRTHDATE ?? '900101';
  const trackingKey = process.env.DUMMY_TRACKING_KEY ?? `TRK-DUMMY-${randomToken(6)}`;
  const memberKey = process.env.DUMMY_MEMBER_KEY ?? `member-${randomToken(4)}`;
  // keyXstr — 발송처가 encX 암호화에 쓰는 임의 키 문자열(encY 안에 생년월일로 봉인된다).
  const keyXstr = randomToken(18);

  // 전달 데이터 X — trackingKey(허브 필수) + 수신처 B 로 넘길 더미 사용자 키.
  const x: DummyPayloadX = {
    trackingKey,
    memberKey,
    serviceName: 'dummy-service-A',
  };

  const { encX, encY, url } = buildEncryptedLink({ baseUrl, configCode, birthDate, keyXstr, x });
  verifyRoundTrip(encX, encY, birthDate, x); // 왕복 정합 보증(실패 시 throw)

  const birthDateOk = isConsentEnterableBirthDate(birthDate);

  console.log('\n=== dummy-test — 발송처(연동처 A) 암호화 링크 더미 ===');
  console.log(`접근 주소(config_code)   : ${configCode}`);
  console.log(`생년월일(복호화 요소)     : ${birthDate}   ← 승인 화면에서 입력할 값`);
  console.log(`연동 추적 키(trackingKey) : ${trackingKey}`);
  console.log(`전달 데이터 X            : ${JSON.stringify(x)}`);
  console.log(`self-check(왕복 복호화)   : ✅ 통과 (trackingKey 복원 일치)`);

  console.log('\n--- 사용자 페이지 진입 URL ---');
  console.log(url);

  console.log('\n[안내]');
  console.log(
    '  • 화면 진입·표시는 config_code 만으로 동작하고, encX·encY 는 [승인] 제출 시 복호화됩니다(FN-020).',
  );
  console.log(
    `  • 승인 화면에서 생년월일 '${birthDate}' 을(를) 입력하면 복호화가 성공합니다(다른 값이면 EX-SEC-006, 재입력 가능).`,
  );
  if (!birthDateOk) {
    console.log(
      `  • ⚠ 생년월일 '${birthDate}' 은(는) 승인 화면 형식(6자리 YYMMDD)에 맞지 않아 화면에서 입력할 수 없습니다.`,
    );
  }
  console.log(
    '  • dev(5173): Vite 가 /interlock/* 를 SPA 폴백하므로 위 URL 로 바로 열립니다(빌드 불필요).',
  );
  console.log(
    '  • 배포 산출물 검증(3000): `npm run build:frontend` 로 dist 생성 후 백엔드가 정적 서빙 →',
  );
  console.log(
    '    DUMMY_BASE_URL=http://localhost:3000 npm run dummy-test -- BAT-CFG 900101',
  );
  console.log('');
}

main();
