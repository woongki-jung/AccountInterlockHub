import { CIPHER_BLOCK_SIZE_BYTES } from './crypto.constants';
import { ProtocolFormatError } from './crypto.errors';
import { decodeBase64Url } from './base64url';
import type { EncPair } from '../models/enc-pair.model';

/** FN-003 반환값 — Base64URL 디코딩을 마친 암호문 바이트열 쌍. 복호화는 시도하지 않는다. */
export interface CipherBytes {
  readonly x: Buffer;
  readonly y: Buffer;
}

/**
 * FN-003 암호값 구조 판정(`SEC-002-02`·`SEC-001-08`·`SEC-001-01`, function_FN-001-003.md
 * §FN-003). **생년월일을 받지 않는다** — 생년월일 없이 판정 가능한 위반만 다룬다. 이 경계가
 * "링크가 잘못됐다"(`EX-SEC-001`)와 "본인확인이 안 됐다"(`EX-AUTH-002`)를 가른다.
 * `USR-01` 진입 접점과 `API-04` 자가진단 접점이 이 판정 결과를 소비하며, `FN-004` 도 단계
 * 0(구조 판정)에서 그대로 재사용한다.
 *
 * @throws {ProtocolFormatError} `EX-SEC-001` — 암호값 쌍 부재·`encX`/`encY` 빈 값·Base64URL
 *   디코드 실패(`FN-002.decode` 그대로 전파)·디코드 결과 길이가 16의 배수가 아님(0바이트
 *   포함).
 */
export function parseCipherPair(encPair: EncPair | null | undefined): CipherBytes {
  // 1. 존재·빈 값 검사 — SEC-002-02
  if (encPair == null) {
    throw new ProtocolFormatError('ENC_PAIR_MISSING');
  }
  if (encPair.encX == null || encPair.encX.trim() === '') {
    throw new ProtocolFormatError('ENC_X_EMPTY');
  }
  if (encPair.encY == null || encPair.encY.trim() === '') {
    throw new ProtocolFormatError('ENC_Y_EMPTY');
  }

  // 2. 전달 인코딩 해석 — FN-002.decode. 실패 시 EX-SEC-001 그대로 전파된다.
  const x = decodeBase64Url(encPair.encX);
  const y = decodeBase64Url(encPair.encY);

  // 3. 블록 길이 검사 — SEC-002-02·SEC-001-01. 복호화를 시도하기 전에 걸러 낼 수 있는
  //    가장 값싼 검사다(암호문은 항상 16의 배수 바이트 — CBC + PKCS#7).
  if (x.length === 0 || x.length % CIPHER_BLOCK_SIZE_BYTES !== 0) {
    throw new ProtocolFormatError('ENC_X_BLOCK_LENGTH_INVALID');
  }
  if (y.length === 0 || y.length % CIPHER_BLOCK_SIZE_BYTES !== 0) {
    throw new ProtocolFormatError('ENC_Y_BLOCK_LENGTH_INVALID');
  }

  // 4. 반환 — 복호화를 시도하지 않는다.
  return Object.freeze({ x, y });
}
