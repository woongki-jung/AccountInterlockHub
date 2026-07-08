/*
 * 관리자 인증 API 호출 — SVC-003 / PROC-103.
 * 백엔드 계약을 그대로 소비한다(엔드포인트·필드명·타입을 임의로 바꾸지 않는다).
 */
import { apiPost } from './apiClient';

/** 로그인 성공 응답 data(발급된 세션의 계정명). 세션 쿠키는 Set-Cookie 로 별도 전달된다. */
export interface LoginResult {
  username: string;
}

/**
 * 관리자 로그인 — POST /api/admin/auth/login (HttpCode 200).
 * 성공 시 세션 쿠키가 설정되고 { username } 을 반환한다.
 * 실패 시 ApiError(401 EX-AUTH-001 / 423 EX-AUTH-003 / 400 EX-SEC-004 / 403 EX-SEC-001)를 던진다.
 * 로그인 호출은 세션 만료 중앙 리다이렉트를 억제한다(재인증 루프 방지).
 */
export function loginRequest(username: string, password: string): Promise<LoginResult> {
  return apiPost<LoginResult>(
    '/api/admin/auth/login',
    { username, password },
    { suppressSessionExpiredRedirect: true },
  );
}
