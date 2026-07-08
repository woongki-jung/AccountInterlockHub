import * as bcrypt from 'bcrypt';
import { AppException } from '../../common/envelope/app.exception';

/**
 * 관리자 비밀번호 해시·복잡도 유틸 — AUTH-001-02·03 / FN-002.
 * 비밀번호는 단방향 해시(bcrypt, 솔트 포함)로만 대조하며 평문·해시를 응답·로그에 남기지 않는다.
 */

// bcrypt 코스트(라운드). 저빈도 관리자 로그인 기준 균형값.
const BCRYPT_ROUNDS = 10;

/** 평문 → bcrypt 해시(솔트 자동 포함). 프로비저닝(seed)·비밀번호 변경에서 사용. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** 평문 대 저장 해시 단방향 대조(타이밍 안전). */
export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

/**
 * 비밀번호 복잡도 검증(AUTH-001-02) — 8자 이상 + 영대문자·소문자·숫자·특수문자 각 1자 이상.
 * 미달 시 422 EX-AUTH-004. 설정·변경(운영 프로비저닝) 경로에서만 호출한다.
 */
export function validatePasswordComplexity(plain: string): void {
  const hasUpper = /[A-Z]/.test(plain);
  const hasLower = /[a-z]/.test(plain);
  const hasDigit = /[0-9]/.test(plain);
  const hasSpecial = /[^A-Za-z0-9]/.test(plain);
  if (plain.length < 8 || !hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    throw new AppException('EX-AUTH-004');
  }
}
