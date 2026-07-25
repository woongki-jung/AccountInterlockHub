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
 * 실행: node verify-roundtrip.js [벡터 파일 경로]
 *   (생략 시 이 스크립트와 같은 폴더의 protocol-test-vectors.json 을 쓴다)
 * 종료 코드: 0 = 전건 원문 복원 일치 / 1 = 하나 이상 불일치 / 2 = 실행 자체 실패.
 *
 * 본 스크립트는 backend-developer(작성 doer)의 자가 실측 도구다 — 합격·통과 판정은
 * 내리지 않는다(기능검증은 별도 tester doer 소관). 아래 출력은 실측 관측치일 뿐이다.
 */

const fs = require('fs');
const path = require('path');

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

  const cases = Array.isArray(vectors.cases) ? vectors.cases : [];
  if (cases.length === 0) {
    console.error('벡터 파일에 케이스가 없습니다 — 왕복 대조를 수행하지 않았습니다.');
    process.exit(2);
  }

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const caseId = testCase.caseId;
    try {
      const encPair = { encX: testCase.expected.encX, encY: testCase.expected.encY };
      const birthDate = testCase.input.birthDate;
      const recovered = judgeDecryption(encPair, birthDate);
      const expectedPayload = testCase.input.payload;
      const match = deepEqual(recovered, expectedPayload);
      results.push({ caseId: caseId, match: match, reason: match ? null : 'payload mismatch' });
    } catch (err) {
      const exCode = err && err.exCode ? err.exCode : '';
      const reason = err && err.name ? err.name : 'Error';
      results.push({ caseId: caseId, match: false, reason: reason + (exCode ? ' (' + exCode + ')' : '') + ': ' + (err && err.message) });
    }
  }

  let matched = 0;
  for (const r of results) {
    if (r.match) {
      matched++;
      console.log('[MATCH]   ' + r.caseId);
    } else {
      console.log('[MISMATCH] ' + r.caseId + ' - ' + r.reason);
    }
  }

  const summary = { total: cases.length, matched: matched, mismatched: cases.length - matched };
  console.log(JSON.stringify(summary));

  process.exit(matched === cases.length ? 0 : 1);
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
