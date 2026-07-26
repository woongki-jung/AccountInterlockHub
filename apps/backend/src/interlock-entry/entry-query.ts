// PROC-101 B2(요청 URL 길이 판정)·B3(진입 파라미터 파싱) 헬퍼 — process_PROC-101.md 의사코드
// 그대로. B4(구조 판정)는 FN-003(crypto/cipher-pair.ts `parseCipherPair`)이 이미 구현하므로 이
// 파일이 재구현하지 않는다.
import type { Request } from 'express';
import { ProtocolFormatError } from '../crypto/crypto.errors';
import type { EncPair } from '../models/enc-pair.model';

/**
 * B2 — "요청 스킴·호스트·경로·쿼리를 합친 전체 문자열"(process_PROC-101.md). `req.protocol`
 * (스킴)·`req.get('host')`(Host 헤더)·`req.originalUrl`(경로+쿼리, 수신 그대로 미가공)을 그대로
 * 이어 붙인다 — 이 판정의 목적이 "실제로 들어온 요청이 얼마나 큰가"이므로, 상수로 재구성한
 * 이상적인 URL 이 아니라 요청 자신이 실어 온 값을 잰다.
 */
export function buildFullRequestUrl(req: Request): string {
  const host = req.get('host') ?? '';
  return `${req.protocol}://${host}${req.originalUrl}`;
}

/**
 * B3 — 쿼리에서 `name` 값을 대소문자 구분해 읽는다("encX 를 쿼리에서 'encX' 를 대소문자
 * 구분해 읽는다" — JS 객체 속성 접근 자체가 이미 대소문자를 구분해 별도 처리가 필요 없다).
 * **같은 이름이 둘 이상이면 Express 가 배열로 담아 준다** — 이를 그대로 다음 단계(FN-003
 * `parseCipherPair`)에 넘기면 `string` 을 기대하는 그 함수가 `.trim is not a function` 류의
 * `TypeError` 를 던져 분류되지 않은 예외로 새 버그를 만든다(accountinterlockhub#484 인계 사항
 * §4 "Express 가 배열로 받으면 500"). 그래서 이 자리에서 배열(중복)·중첩 객체(bracket 문법,
 * 둘 다 구조 위반)를 먼저 걸러 `EX-SEC-001` 로 명시 변환한다 — B3(파싱)과 B4(구조 판정)가
 * 사양에서도 별개 단계인 이유이기도 하다("if (같은 이름의 파라미터가 둘 이상) → reason =
 * 'EX-SEC-001' → B5"— B4 를 거치지 않고 곧장 B5 로 간다).
 *
 * @throws {ProtocolFormatError} `EX-SEC-001` — 같은 이름이 둘 이상(배열)이거나 `encX[a]=1` 류
 *   중첩 객체로 온 경우.
 */
export function readSingleQueryParam(query: Request['query'], name: 'encX' | 'encY'): string | undefined {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  throw new ProtocolFormatError(name === 'encX' ? 'ENC_X_DUPLICATE' : 'ENC_Y_DUPLICATE');
}

/**
 * B3 전체 — `encX`·`encY` 를 함께 읽는다. 그 밖의 파라미터는 읽지 않고 무시한다(호출측이
 * `req.query` 의 다른 키를 참조하지 않으므로 이 함수 자체가 그 무시를 구현한다).
 *
 * 반환 형은 `EncPair`(두 속성 모두 `string` 필수)이지만, 이 시점에는 아직 원시 쿼리라 실제로
 * `undefined` 일 수 있다 — FN-003(`parseCipherPair`)가 `encPair.encX == null` 로 런타임에 그
 * 경우를 검사하므로(§FN-003 처리 흐름 1) 타입 단언으로 경계를 넘긴다.
 */
export function readEncPairFromQuery(query: Request['query']): EncPair {
  const encX = readSingleQueryParam(query, 'encX');
  const encY = readSingleQueryParam(query, 'encY');
  return { encX, encY } as EncPair;
}
