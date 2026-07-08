/**
 * 민감 단일 토큰 마스킹 — SEC-005-01(앞 2·뒤 2자만 노출, 나머지 마스킹).
 *
 * 회원 키(=지정 사용자 키값)·요청 키값·인증 자격 같은 "단일 불투명 토큰"에만 적용한다.
 * 자유 서술(detail) 전체에는 적용하지 않는다 — 전체 문자열 마스킹은 감사 가독성을 훼손하며,
 * DATA-001-03 의 목적은 서술에 회원 키·개인정보 원문을 넣지 않는 것(원문 배제)이다.
 * 4자 이하 짧은 값은 앞2·뒤2 노출이 곧 전체 노출이 되므로 전부 마스킹한다.
 */
export function maskToken(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const s = String(value);
  if (s.length === 0) {
    return s;
  }
  if (s.length <= 4) {
    return '*'.repeat(s.length);
  }
  return `${s.slice(0, 2)}${'*'.repeat(s.length - 4)}${s.slice(-2)}`;
}
