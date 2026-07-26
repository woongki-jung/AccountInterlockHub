import { createDecipheriv } from 'node:crypto';
import { CIPHER_ALGORITHM, IV_LENGTH_BYTES, NORMALIZED_KEY_LENGTH_BYTES } from './crypto.constants';
import { IdentityMismatchError, ProtocolViolationError } from './crypto.errors';
import { normalizeKey } from './key-normalizer';
import { parseCipherPair } from './cipher-pair';
import { isTrackingKeyFormatValid } from './tracking-key.validator';
import type { EncPair } from '../models/enc-pair.model';
import type { TransferPayload } from '../models/transfer-payload.model';

// UTF-8 엄격 디코더 — Buffer#toString('utf8') 과 달리 잘못된 바이트열을 U+FFFD 로 조용히
// 치환하지 않고 던진다(판정 3단계 "UTF-8 해석 실패"를 실제로 구현하기 위함).
const utf8StrictDecoder = new TextDecoder('utf-8', { fatal: true });

/**
 * FN-004 반환값 — `payload`(function_FN-004.md §시그니처가 문서화한 값)에 `rawPlaintext` 를
 * 더한다. **P09(#486, PROC-104 B3 전달 페이로드 구성) 확장** — `process_PROC-104.md` B3
 * "body = payload 의 UTF-8 바이트열 그대로 // 파싱한 객체를 다시 직렬화하지 않는다 — 숫자
 * 표현·유니코드 이스케이프·필드 순서가 달라진다"는 파싱 **이전**의 원본 바이트열을 요구하는데,
 * `function_FN-004.md` §시그니처의 출력란은 `payload: MDL-005` 하나만 문서화해 두 사양이
 * 어긋난다(§완료 보고 "사양 결함" 참고). FN-004 는 이미 함수 내부에서 그 바이트열(`plain`)을
 * 만들고도 버렸으므로(구 버전 — 유일한 소비자였던 `PROC-102`/`PROC-204` 는 `trackingKey` 만
 * 필요), 재분해·재복호화 없이 **그 자리에서 함께 반환**하는 것이 유일하게 안전한 해법이다 —
 * 별도 경로로 다시 만들면 `SEC-002-01`(세 접점이 반드시 같은 절차 하나를 공유)이 깨진다.
 * ⚠️ **오기재 정정(P09 회귀 1회차, #486)** — 이 확장 시점에 "호출부가 전무해(실측 — grep
 * 0건) 기존 소비자를 깨지 않는다"고 판단했으나 그 실측이 틀렸다. 실제로는
 * `apps/sender-sdk/verify-roundtrip.js:118` 이 유일한 기존 호출부였고, 반환형이 `payload`
 * 단일 값에서 `{payload, rawPlaintext}` 로 바뀌면서 그 자리의 구조 비교(반환값 전체를
 * `input.payload` 와 직접 비교)가 전건 불일치로 무력화돼 있었다 — 같은 회귀에서 그 호출부를
 * `judgeDecryption(...).payload` 구조분해로 시정했다(상세: verify-roundtrip.js 헤더 주석).
 * `payload` 자체의 값·형태는 무변경이다.
 */
export interface DecryptionJudgmentResult {
  readonly payload: TransferPayload;
  /** X 평문의 UTF-8 원본 바이트열(JSON 파싱 이전) — PROC-104 B3 전용. 재직렬화하지 않는다. */
  readonly rawPlaintext: Buffer;
}

/**
 * FN-004 복호화 판정(`SEC-002-01`, function_FN-004.md). **본인확인(`PROC-102`)·연동 실행
 * (`PROC-104`)·자가진단(`PROC-204`) 세 경로가 반드시 이 함수 하나를 공유하는 단일
 * 진입점이다**(`SEC-002-01` "허브와 자가진단이 같은 절차를 쓴다") — 세 곳이 서로 다른
 * 판정을 쓰면 자가진단이 통과시킨 값이 실제 연동에서 실패하는 사고가 구조적으로 생긴다.
 * 호출측은 이 함수를 감싸거나 절차를 다시 구현하지 말고 그대로 재사용해야 한다.
 *
 * 호출 전 `birthDate` 는 반드시 {@link validateBirthDateFormat}(`FN-005`)을 먼저 통과한
 * 값이어야 한다(이 함수는 형식 검증을 내부에서 하지 않는다 — function_FN-004.md 의존
 * 기능표에 `FN-005` 가 없다).
 *
 * 4단계를 모두 통과해야 성공이다:
 * 1. `encY` 복호화(PKCS#7 패딩 검증 포함) → 32바이트 키 획득
 * 2. 획득한 키로 `encX` 복호화(패딩 검증 포함) → X 바이트열 획득
 * 3. X 를 UTF-8 JSON 으로 파싱
 * 4. 필수 필드 `trackingKey` 존재·형식 검증(`FN-006`)
 *
 * 1·2단계 실패는 생년월일 불일치와 구별할 수 없어 {@link IdentityMismatchError}
 * (`EX-AUTH-002`) — 결과를 확정하지 않고 재입력 안내로 되돌린다. 3·4단계 실패는 두 겹의
 * 패딩 검증을 이미 통과한 뒤라 발송처 페이로드 문제로 보고 {@link ProtocolViolationError}
 * (`EX-SEC-002`, 결과 구분 `DECRYPT_FAILED`)로 던진다(`EXC-SEC-05`).
 *
 * 반환값·중간 값은 호출측이 지역 변수로만 다뤄야 한다(`DATA-001-03`) — 이 함수 자신도 중간
 * 값(`keyY`·`keyXBytes`·`ivX`)을 어디에도 저장하지 않고, 반환·예외 발생과 함께 지역 스코프를
 * 벗어나 폐기된다. `plain`(X 평문)은 {@link DecryptionJudgmentResult.rawPlaintext} 로 호출측에
 * 반환되므로 그 지역 스코프가 호출측으로 넘어갈 뿐, 저장소에 넣지 않는 원칙은 그대로다 — 호출측도
 * 요청 처리 종료와 함께 폐기해야 한다(PROC-104 B7). 승인 시점의 재복호화도 같은 함수를 다시
 * 호출한다(`EXC-SEC-07`·`BIZ-002-06`) — 한 연동에서 최소 두 번 호출된다.
 *
 * @throws {ProtocolFormatError} `EX-SEC-001` — 단계 0 구조 판정 실패(`FN-003` 그대로 전파).
 * @throws {IdentityMismatchError} `EX-AUTH-002` — 판정 1·2단계 실패.
 * @throws {ProtocolViolationError} `EX-SEC-002` — 판정 3·4단계 실패.
 */
export function judgeDecryption(encPair: EncPair, birthDate: string): DecryptionJudgmentResult {
  // 0. 구조 판정 — FN-003(validate). 실패 시 EX-SEC-001 그대로 전파된다.
  const cipher = parseCipherPair(encPair);

  // 1. encY 키 산출 — SEC-001-06·SEC-001-03·SEC-001-04(transform). 생년월일 6자 +
  //    `_` 26개로 정규화된다.
  const keyY = normalizeKey(birthDate);

  // 2. 판정 1단계 — encY 복호화 · SEC-002-01 ①(validate)
  let keyXBytes: Buffer;
  try {
    keyXBytes = aesCbcPkcs7Decrypt(cipher.y, keyY.key, keyY.iv);
  } catch {
    throw new IdentityMismatchError('ENC_Y_DECRYPT_FAILED');
  }
  if (keyXBytes.length !== NORMALIZED_KEY_LENGTH_BYTES) {
    throw new IdentityMismatchError('ENC_Y_KEY_LENGTH_INVALID');
  }

  // 3. encX 초기화 벡터 도출 — SEC-001-07·SEC-001-04(transform). **재정규화하지 않는다**
  //    (EXC-SEC-04 — 허브는 발송처키가 없어 encY 복호화 결과를 그대로 쓰는 것 말고는
  //    encX 의 키를 얻을 방법이 없다). key 와 메모리를 공유하지 않도록 복사본으로 만든다.
  const ivX = Buffer.from(keyXBytes.subarray(0, IV_LENGTH_BYTES));

  // 4. 판정 2단계 — encX 복호화 · SEC-002-01 ②(validate)
  let plain: Buffer;
  try {
    plain = aesCbcPkcs7Decrypt(cipher.x, keyXBytes, ivX);
  } catch {
    throw new IdentityMismatchError('ENC_X_DECRYPT_FAILED');
  }

  // 5. 판정 3단계 — UTF-8 JSON 파싱 · SEC-002-01 ③·SEC-002-03(validate). 이 지점부터는
  //    두 겹의 패딩 검증을 통과했다는 뜻이라 실패를 EX-SEC-002 로 분류한다(EXC-SEC-05).
  let payload: unknown;
  try {
    payload = JSON.parse(utf8StrictDecoder.decode(plain));
  } catch {
    throw new ProtocolViolationError('X_UTF8_OR_JSON_PARSE_FAILED');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ProtocolViolationError('X_PAYLOAD_NOT_OBJECT');
  }

  // 6. 판정 4단계 — 추적 키 검증 · SEC-002-01 ④·SEC-002-03(validate). FN-006 의 판정
  //    false 는 이 지점에서 EX-SEC-002 로 변환해 던진다(function_FN-004.md 의존 기능표).
  const trackingKey = (payload as Record<string, unknown>).trackingKey;
  if (!isTrackingKeyFormatValid(trackingKey)) {
    throw new ProtocolViolationError('TRACKING_KEY_INVALID');
  }

  // 7. 중간 값 폐기 — DATA-001-03. keyY·keyXBytes·ivX 는 지역 값으로만 존재했고 별도 저장을
  //    하지 않았다 — 함수를 벗어나는 순간 참조가 사라진다. plain 은 rawPlaintext 로 호출측에
  //    넘어가되(PROC-104 B3 전용), 호출측도 요청 처리 종료와 함께 폐기해야 한다(PROC-104 B7).

  // 8. 반환
  return { payload: payload as TransferPayload, rawPlaintext: plain };
}

/**
 * AES-256-CBC + PKCS#7 복호화(`SEC-001-01`). `setAutoPadding` 을 절대 `false` 로 두지
 * 않는다 — 패딩 검증이 잘못된 키를 걸러 내는 1차 판정 수단이다(`SEC-002` 구현 가이드).
 * 이 검증을 끄면 `EX-AUTH-002` 와 `EX-SEC-002` 의 경계가 무너진다(패딩이 깨진 복호화
 * 결과가 그대로 다음 단계로 흘러간다). Node 의 `Decipheriv` 는 기본값이 이미 패딩 검증
 * 활성 상태이므로 별도 설정 없이 기본값을 그대로 쓴다 — 아무도 이후에 `false` 로 바꾸지
 * 않아야 한다.
 */
function aesCbcPkcs7Decrypt(cipherText: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}
