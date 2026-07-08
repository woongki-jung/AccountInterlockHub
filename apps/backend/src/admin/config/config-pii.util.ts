/**
 * BR-102 / BIZ-001-05 개인정보 직접 수신 파라미터 탐지 휴리스틱(경고·비차단).
 *
 * 사양 근거·구현 판단:
 *  - FN-006 step6·BIZ-001-05 는 "개인정보 직접 수신 항목"의 판정 규칙을 구체화하지 않는다(담당자 확정 대기 기본안).
 *  - SCR-003 조건부 표시("원천 키명이 개인정보성 명칭 패턴에 해당")와 검증 TC ADM-01_008(예: `ssn`)을
 *    근거로, 전달 파라미터의 **원천 키명(sourceKeyA)·표시명(name)** 이 개인정보성 명칭 토큰을 포함하는지로 판정한다.
 *  - 값 자체는 저장하지 않으므로(무저장 원칙, DATA-001) 값이 아닌 **이름 기반 휴리스틱**만 사용한다.
 *  - 저장은 절대 차단하지 않는다(경고만 — 오탐 허용). 매칭 시 호출부가 CONFIG_PII_WARN(INFO) 감사를 남긴다.
 *
 * ※ 담당자가 개인정보 항목 판정 규칙을 확정하면 본 토큰 목록·정규화 규칙을 리비전한다(완료 보고 WARN).
 */

// 개인정보성 명칭 토큰(영문 — 정규화 후 부분일치). 소문자·영숫자만 남긴 키명에 substring 매칭.
const PII_TOKENS_EN = [
  'ssn',
  'jumin',
  'rrn',
  'resident',
  'socialsecurity',
  'nationalid',
  'foreignerid',
  'passport',
  'driverlicense',
  'birth',
  'birthday',
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
  'accountno',
  'bankaccount',
];

// 개인정보성 명칭 토큰(한글 — 원문 substring 매칭).
const PII_TOKENS_KO = [
  '주민',
  '주민등록',
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

// 영숫자만 남기고 소문자화(구분자·대소문자 차이를 흡수 — 'SSN','ssn_no','ssnNo' 등을 동일 취급).
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPiiName(raw: string | null | undefined): boolean {
  if (!raw) {
    return false;
  }
  const norm = normalize(raw);
  if (norm.length > 0 && PII_TOKENS_EN.some((token) => norm.includes(token))) {
    return true;
  }
  return PII_TOKENS_KO.some((token) => raw.includes(token));
}

interface PiiCandidate {
  name: string;
  sourceKeyA: string;
}

/**
 * 파라미터 정의 목록에서 개인정보성 명칭이 의심되는 항목의 원천 키명을 반환한다.
 * 반환값(원천 키명·표시명)은 회원 키 '값'이 아니라 구성 정의 메타이므로 감사 detail 에 남겨도 무저장 원칙과 양립한다.
 */
export function detectPiiParams(parameters: PiiCandidate[]): string[] {
  const hits: string[] = [];
  for (const p of parameters) {
    if (isPiiName(p.sourceKeyA) || isPiiName(p.name)) {
      hits.push(p.sourceKeyA || p.name);
    }
  }
  return hits;
}
