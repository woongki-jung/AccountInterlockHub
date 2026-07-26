import { ProtocolFormatError } from './crypto.errors';

// RFC 4648 §5 알파벳(A-Z a-z 0-9 - _), 패딩 없음.
const BASE64URL_CHARSET_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * FN-002.encode — Base64URL 인코딩(`SEC-001-08`, function_FN-001-003.md §FN-002).
 * 표준 Base64 를 만든 뒤 `+`→`-`·`/`→`_` 치환, 패딩 `=` 제거 순으로 옮긴다.
 * 연동 라이브러리(암호화)만 쓰는 방향이지만, 규약 대칭을 자가 점검(라이브러리가 만든
 * `encX`·`encY` 와 대조)하려면 허브 쪽에도 같은 알고리즘이 있어야 하므로 이 함수도 둔다 —
 * 허브 런타임 자신은 이 결과를 외부로 내보내지 않는다(허브는 decode 만 쓴다).
 */
export function encodeBase64Url(raw: Buffer): string {
  return raw
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * FN-002.decode — Base64URL 디코딩(`SEC-001-08`). **관대하게 받지 않는다** — 표준 Base64 의
 * `+`·`/`·`=` 가 섞여 오면 문자 집합 검사에서 걸러 낸다. Node 내장 `'base64url'` 버퍼
 * 인코딩은 표준 Base64 문자까지 관대하게 허용해 이 규약보다 느슨하므로 여기서는 쓰지 않고,
 * 사양 의사코드(문자 집합 검사 → 길이 판정 → 패딩 복원·알파벳 역치환 → 디코드)를 그대로
 * 구현한다.
 *
 * @throws {ProtocolFormatError} `EX-SEC-001` — 빈 값·문자 집합 위반·해석 불가능한 길이·
 *   디코드 실패.
 */
export function decodeBase64Url(text: string): Buffer {
  // 1. 문자 집합 검사 — SEC-001-08
  if (text == null || text === '') {
    throw new ProtocolFormatError('BASE64URL_EMPTY');
  }
  if (!BASE64URL_CHARSET_PATTERN.test(text)) {
    throw new ProtocolFormatError('BASE64URL_CHARSET_INVALID');
  }

  // 2. 길이 판정 — 나머지가 1이면 어떤 패딩으로도 유효한 Base64 블록을 만들 수 없다.
  const rest = text.length % 4;
  if (rest === 1) {
    throw new ProtocolFormatError('BASE64URL_LENGTH_INVALID');
  }

  // 3. 패딩 복원·알파벳 역치환
  const padded = text + '='.repeat((4 - rest) % 4);
  const standard = padded.replace(/-/g, '+').replace(/_/g, '/');

  // 4. 디코드 (Node 의 Buffer.from(..., 'base64') 는 관대해 실질적으로 던지지 않지만,
  //    사양 의사코드의 try/catch 구조를 그대로 유지해 향후 런타임 변경에도 방어한다)
  let raw: Buffer;
  try {
    raw = Buffer.from(standard, 'base64');
  } catch {
    throw new ProtocolFormatError('BASE64URL_DECODE_FAILED');
  }

  // 5. 반환
  return raw;
}
