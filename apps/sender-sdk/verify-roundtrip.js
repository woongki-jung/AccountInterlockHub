#!/usr/bin/env node
'use strict';

/**
 * PROC-404 C2 규약 대칭(왕복) 검증 — 라이브러리가 규약 테스트 벡터 기준으로 암호화한 값
 * (protocol-test-vectors.json 의 expected.encX/encY)을 허브 복호화 판정(FN-004,
 * apps/backend/src/crypto/decryption-judgment.ts)에 넣어 원래 전달 데이터(input.payload)로
 * 복원되는지 대조한다(SVC-009 F-004).
 *
 * 대칭 자체는 P17(accountinterlockhub#494)에서 8/8 케이스로 이미 실측 확정됐다 — 이 Phase
 * (P18)는 규약 테스트 벡터 파일을 기준선으로 삼은 재확인이며, 처음부터 대칭을 다시
 * 증명하려 하지 않는다.
 *
 * apps/backend 의 소스·설정을 고치지 않는다 — 이미 빌드된 dist/crypto/**(node:crypto
 * 외 외부 의존이 없는 순수 함수 모음)를 읽기 전용으로 불러와 쓴다.
 *
 * [회귀 1회차 S-4] 구조 비교(deepEqual)만으로는 "의미상 같음"만 증명한다 — 리뷰어가 별도
 * 구현으로 6/6 바이트 동일까지 확인했으므로 그 강도를 여기 고정해 둔다. 판정 1·2단계
 * (encY 복호화 → encX 복호화, FN-004 §설명 1·2)를 허브가 내보낸 원시 도구
 * (parseCipherPair·normalizeKey·CIPHER_ALGORITHM·IV_LENGTH_BYTES)로 이 스크립트가 독립적으로
 * 재구성해 평문 바이트 자체를 얻고, 벡터 파일에 적힌 input.payload 원문 텍스트(재직렬화
 * 없는 원본 바이트)와 Buffer.equals 로 대조한다. 3·4단계(UTF-8/JSON 파싱·trackingKey 형식
 * 검증)는 이 보조 검증을 거치지 않는다 — 그건 위 judgeDecryption 기반 검증이 이미 맡는다.
 *
 * [P09 회귀 1회차, #486 — 오기재 정정] judgeDecryption(FN-004)은 이제 rawPlaintext(복호화
 * 평문 바이트, Buffer)도 함께 반환한다(decryption-judgment.ts:27-31, PROC-104 B3 "재직렬화
 * 금지" 충족). 아래 문단이 예전에 "judgeDecryption 은 중간값을 반환하지 않으므로"를 근거로
 * 들었던 것은 그 확장 이전 얘기였고 이제 사실이 아니다 — 118행의 구조 비교는 이 확장에 맞춰
 * `judgeDecryption(...).payload` 를 쓰도록 갱신했다(갱신 전에는 반환값 전체를 그대로
 * `input.payload` 와 비교해 전건이 구조 불일치로 떨어졌었다). 다만 위 바이트 비교는 그
 * rawPlaintext 를 가져다 쓰지 않고 독립 재구성을 그대로 유지한다 — judgeDecryption 자신이
 * 내놓은 값을 그 함수 자신의 결과와 대조하면 함수 내부 배선(복호화 호출 순서·범위 계산 등)의
 * 오류가 "자기 출력을 자기 출력과 비교"하는 셈이 되어 가려질 수 있다. 같은 원시 도구를 쓰되
 * 이 스크립트가 독립적으로 다시 연결한 호출 순서로 대조해야 그 배선 결함을 잡아낼 여지가
 * 남는다(왕복 검증의 존재 이유). 반환값·재구성 결과 모두 지역 변수로 즉시 폐기한다는
 * DATA-001-03 준수는 양쪽 다 여전히 유효하다.
 *
 * 실행: node verify-roundtrip.js [벡터 파일 경로]
 *   (생략 시 이 스크립트와 같은 폴더의 protocol-test-vectors.json 을 쓴다)
 * 종료 코드: 0 = 전건 원문 복원 일치(구조+바이트) / 1 = 하나 이상 불일치 / 2 = 실행 자체 실패.
 *
 * 본 스크립트는 backend-developer(작성 doer)의 자가 실측 도구다 — 합격·통과 판정은
 * 내리지 않는다(기능검증은 별도 tester doer 소관). 아래 출력은 실측 관측치일 뿐이다.
 */

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

function main() {
  const vectorsPath = process.argv[2] || path.join(__dirname, 'protocol-test-vectors.json');
  const distCryptoIndex = path.join(__dirname, '..', 'backend', 'dist', 'crypto', 'index.js');

  if (!fs.existsSync(distCryptoIndex)) {
    console.error('허브 복호화 모듈을 찾을 수 없습니다: ' + distCryptoIndex);
    console.error('apps/backend 가 먼저 빌드(tsc)돼 있어야 합니다 — 이 스크립트는 dist 산출물을 읽기 전용으로만 씁니다.');
    process.exit(2);
  }

  let vectorsRaw;
  try {
    vectorsRaw = fs.readFileSync(vectorsPath, 'utf8');
  } catch (err) {
    console.error('벡터 파일을 읽을 수 없습니다: ' + vectorsPath);
    console.error(String(err && err.message));
    process.exit(2);
  }

  let vectors;
  try {
    vectors = JSON.parse(vectorsRaw);
  } catch (err) {
    console.error('벡터 파일 JSON 해석 실패: ' + String(err && err.message));
    process.exit(2);
  }

  let hubCrypto;
  try {
    hubCrypto = require(distCryptoIndex);
  } catch (err) {
    console.error('허브 복호화 모듈 로드 실패: ' + String(err && err.message));
    process.exit(2);
  }
  const judgeDecryption = hubCrypto.judgeDecryption;
  if (typeof judgeDecryption !== 'function') {
    console.error('judgeDecryption 을 dist/crypto 에서 찾지 못했습니다(허브 빌드 산출물을 확인하십시오).');
    process.exit(2);
  }
  const byteCheckFns = ['parseCipherPair', 'normalizeKey', 'CIPHER_ALGORITHM', 'IV_LENGTH_BYTES'];
  for (const name of byteCheckFns) {
    if (hubCrypto[name] === undefined) {
      console.error('바이트 동일성 보조 검증에 필요한 ' + name + ' 을 dist/crypto 에서 찾지 못했습니다.');
      process.exit(2);
    }
  }

  const cases = Array.isArray(vectors.cases) ? vectors.cases : [];
  if (cases.length === 0) {
    console.error('벡터 파일에 케이스가 없습니다 — 왕복 대조를 수행하지 않았습니다.');
    process.exit(2);
  }

  // [회귀 2회차 S-c — 리뷰어 지적] 원문 추출 개수가 케이스 수와 다르면(벡터 파일 저작
  // 방식이 extractRawPayloadTexts 의 "한 줄 압축 JSON" 전제를 벗어난 경우) 예전에는 바이트
  // 비교를 조용히 건너뛰면서도 성공 줄에는 여전히 "(구조 일치 + 바이트 일치)"를 찍고 exit 0
  // 이 나올 수 있었다 — S-4 가 준 보증을 실제로는 검사하지 않고 참칭하는 상태였다. 이제는
  // 실행 자체를 실패(exit 2)시킨다 — "바이트 비교를 건너뛴 통과"를 아예 만들지 않는다.
  const rawPayloads = extractRawPayloadTexts(vectorsRaw);
  if (rawPayloads.length !== cases.length) {
    console.error(
      '벡터 파일에서 추출한 input.payload 원문 개수(' + rawPayloads.length +
      ')가 케이스 수(' + cases.length + ')와 다릅니다 — extractRawPayloadTexts 의 전제(각 ' +
      'payload 가 한 줄 압축 JSON)가 깨졌을 수 있습니다. 바이트 동일성 보조 검증을 신뢰할 ' +
      '수 없으므로 실행을 중단합니다(구조 비교만으로 통과를 참칭하지 않기 위함).');
    process.exit(2);
  }

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const caseId = testCase.caseId;
    const reasons = [];
    let structuralMatch = false;
    let byteMatch = false;

    try {
      const encPair = { encX: testCase.expected.encX, encY: testCase.expected.encY };
      const birthDate = testCase.input.birthDate;

      const { payload: recovered } = judgeDecryption(encPair, birthDate);
      const expectedPayload = testCase.input.payload;
      structuralMatch = deepEqual(recovered, expectedPayload);
      if (!structuralMatch) reasons.push('구조 비교(judgeDecryption) 불일치');

      const plainBytes = decryptPlainBytesViaHubPrimitives(hubCrypto, encPair, birthDate);
      const expectedBytes = Buffer.from(rawPayloads[i], 'utf8');
      byteMatch = plainBytes.equals(expectedBytes);
      if (!byteMatch) reasons.push('바이트 비교(복호화 평문 vs 벡터 원문) 불일치');
    } catch (err) {
      const exCode = err && err.exCode ? err.exCode : '';
      const reason = err && err.name ? err.name : 'Error';
      reasons.push(reason + (exCode ? ' (' + exCode + ')' : '') + ': ' + (err && err.message));
    }

    const match = reasons.length === 0;
    results.push({ caseId: caseId, match: match, structuralMatch: structuralMatch, byteMatch: byteMatch, reason: reasons.join('; ') });
  }

  let matched = 0;
  for (const r of results) {
    if (r.match) {
      matched++;
      console.log('[MATCH]    ' + r.caseId + ' (구조 일치 + 바이트 일치)');
    } else {
      console.log('[MISMATCH] ' + r.caseId + ' - ' + r.reason);
    }
  }

  const summary = { total: cases.length, matched: matched, mismatched: cases.length - matched };
  console.log(JSON.stringify(summary));

  process.exit(matched === cases.length ? 0 : 1);
}

// protocol-test-vectors.json 원문에서 각 케이스의 "input.payload": {...} 줄을 순서대로 찾아
// 그 값 부분(재직렬화 없는 원본 텍스트)만 뽑는다. VectorGen(AccountInterlockHub.SenderSdk.
// VectorGen/Program.cs)이 payload 를 항상 한 줄 압축 JSON 으로 쓰기 때문에 성립하는 전제다
// (전체 JSON 파서를 새로 만들지 않기 위한 최소 구현 — 벡터 파일 저작 방식이 바뀌면 함께
// 손봐야 한다).
function extractRawPayloadTexts(vectorsRawText) {
  const lines = vectorsRawText.split(/\r\n|\r|\n/);
  const raws = [];
  const pattern = /^\s*"payload":\s*(.+)$/;
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) {
      raws.push(m[1]);
    }
  }
  return raws;
}

// FN-004(judgeDecryption)의 판정 1·2단계만 재구성해 복호화 평문 바이트를 직접 얻는다.
// 정책이 정한 부분(구조 판정·키 정규화·알고리즘 상수)은 허브가 내보낸 함수·상수를 그대로
// 쓰고, AES 복호화 호출 자체만 이 스크립트가 수행한다 — judgeDecryption 이 이제 rawPlaintext
// 를 반환하더라도(P09 회귀 1회차, #486) 그 값을 그대로 되비교하지 않고 이렇게 독립 재구성을
// 유지하는 이유는 위 헤더 주석 [P09 회귀 1회차] 참고(자기 출력을 자기 출력과 비교하는 상황을
// 피해 judgeDecryption 내부 배선 결함을 잡아낼 여지를 남긴다).
function decryptPlainBytesViaHubPrimitives(hubCrypto, encPair, birthDate) {
  const cipher = hubCrypto.parseCipherPair(encPair);
  const keyY = hubCrypto.normalizeKey(birthDate);

  const decipherY = nodeCrypto.createDecipheriv(hubCrypto.CIPHER_ALGORITHM, keyY.key, keyY.iv);
  const keyXBytes = Buffer.concat([decipherY.update(cipher.y), decipherY.final()]);

  const ivX = Buffer.from(keyXBytes.subarray(0, hubCrypto.IV_LENGTH_BYTES));
  const decipherX = nodeCrypto.createDecipheriv(hubCrypto.CIPHER_ALGORITHM, keyXBytes, ivX);
  return Buffer.concat([decipherX.update(cipher.x), decipherX.final()]);
}

// 순서 무관 얕은 재귀 깊은 비교(JSON.parse 결과 전용 — Date·함수 등은 다루지 않는다).
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  for (const key of aKeys) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

main();
