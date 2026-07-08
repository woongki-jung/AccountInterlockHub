/*
 * 개인정보성 파라미터명 휴리스틱(FE 안내 전용) — BR-102 / BIZ-001-05.
 *
 * SCR-003 §조건부 표시: 원천 키명이 개인정보성 명칭 패턴에 해당하면 참고 안내 Banner 를 노출한다(비차단).
 * 저장은 절대 차단하지 않는다 — 실제 감사 판정은 서버(config-pii.util)가 전담한다(BIZ-001-05).
 * FE 는 사전 판단하지 않는다는 원칙(SCR-003 §입력 폼 정의 각주)에 따라, 본 휴리스틱은 오직 안내 목적이며
 * 검증·저장 흐름에 영향을 주지 않는다. 서버 토큰 목록과 대략 정합하되 정본은 서버다.
 */

// 개인정보성 명칭 토큰(영문 — 정규화 후 부분일치).
const PII_TOKENS_EN = [
  'ssn',
  'jumin',
  'rrn',
  'resident',
  'nationalid',
  'passport',
  'driverlicense',
  'birth',
  'dob',
  'gender',
  'phone',
  'mobile',
  'cellphone',
  'telno',
  'email',
  'mail',
  'address',
  'addr',
  'zipcode',
  'postal',
  'cardno',
  'cardnumber',
  'creditcard',
  'account',
  'bankaccount',
  'ci',
  'di',
];

// 개인정보성 명칭 토큰(한글 — 원문 부분일치).
const PII_TOKENS_KO = [
  '주민',
  '생년월일',
  '생일',
  '전화',
  '휴대폰',
  '핸드폰',
  '이메일',
  '메일',
  '여권',
  '운전면허',
  '계좌',
  '카드번호',
  '주소',
  '성별',
];

// 영숫자만 남기고 소문자화(구분자·대소문자 차이 흡수).
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPiiName(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const norm = normalize(trimmed);
  // 'ci'·'di' 는 짧아 오탐이 크므로 정확 일치(정규화 후)만 인정한다.
  if (norm === 'ci' || norm === 'di') {
    return true;
  }
  if (norm.length > 0 && PII_TOKENS_EN.some((t) => (t.length <= 2 ? norm === t : norm.includes(t)))) {
    return true;
  }
  return PII_TOKENS_KO.some((t) => trimmed.includes(t));
}

/** 파라미터 정의(표시명·원천 키명)에서 개인정보성 의심 항목의 표시명을 반환한다(안내 전용). */
export function detectPiiParamNames(
  parameters: Array<{ name: string; sourceKeyA: string }>,
): string[] {
  const hits: string[] = [];
  for (const p of parameters) {
    if (isPiiName(p.sourceKeyA) || isPiiName(p.name)) {
      const label = (p.name || p.sourceKeyA).trim();
      if (label && !hits.includes(label)) {
        hits.push(label);
      }
    }
  }
  return hits;
}
