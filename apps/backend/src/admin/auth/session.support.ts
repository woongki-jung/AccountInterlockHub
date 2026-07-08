import type { Request } from 'express';
import type { Session, SessionData, SessionOptions } from 'express-session';

/**
 * 관리자 세션(MDL-104, 애플리케이션 세션 — 비 ENT) 인프라 지원 — FN-003 / AUTH-002.
 * express-session 위에 세션 옵션·유휴 판정·프로미스화 헬퍼·세션 데이터 타입을 정의한다.
 *
 * 저장소: MVP 는 express-session 기본 in-memory 저장소(단일 App Service 기준). 스케일아웃 시
 * 공유 저장소(예: Redis)로 교체가 필요하다(WARN — 완료 보고 참조). sessionId 는 로그에 남기지 않는다.
 */

/** 세션에 실리는 관리자 인증 상태. sessionId 자체는 express-session 이 난수로 관리한다(AUTH-002-02). */
export interface AdminSessionData {
  username: string; // 세션 소유 계정
  issuedAt: number; // 발급 시각(epoch ms)
  lastActivityAt: number; // 마지막 활동 시각(epoch ms, 유휴 판정 기준)
}

// express-session 의 SessionData 를 관리자 상태로 확장(타입 보강).
declare module 'express-session' {
  interface SessionData {
    admin?: AdminSessionData;
  }
}

// 세션 쿠키명. 기본 'connect.sid' 대신 명시명 사용(디폴트 노출 회피).
export const SESSION_COOKIE_NAME = 'aih.admin.sid';

// 쿠키 유휴 만료(AUTH-002-01 유휴 30분, rolling 갱신).
export const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * express-session 옵션 구성.
 *  - httpOnly: 항상. sameSite: 'lax'. secure: 운영(prod)만 true — dev/local 은 http 로그인 허용(false).
 *  - rolling: 매 응답 쿠키 만료 갱신. saveUninitialized/resave: false(익명 세션 미저장).
 *  - secret: SESSION_SECRET(운영 필수). dev 미설정 시 안전하지 않은 기본값으로 대체.
 */
export function buildSessionOptions(): SessionOptions {
  const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const secret = process.env.SESSION_SECRET;
  if (!secret && isProd) {
    throw new Error('SESSION_SECRET 환경변수가 필요합니다(운영 세션 서명).');
  }
  return {
    name: SESSION_COOKIE_NAME,
    secret: secret ?? 'dev-insecure-session-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: SESSION_MAX_AGE_MS,
    },
  };
}

/**
 * 유휴 만료 기준(ms) — 기본 30분(AUTH-002-01). SESSION_IDLE_MINUTES 로 재정의(검증 편의).
 * 쿠키 maxAge 와 분리해 관리하므로 낮춰도 세션이 저장소에서 조기 소거되지 않아 EX-AUTH-002 관측이 가능하다.
 */
export function getIdleTimeoutMs(): number {
  const min = Number(process.env.SESSION_IDLE_MINUTES ?? 30);
  return (Number.isFinite(min) && min > 0 ? min : 30) * 60 * 1000;
}

/** 로그인 시 세션 재생성(세션 고정 공격 방지 — 새 sessionId 발급). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

/** 세션 저장(쿠키 확정 후 응답). */
export function saveSession(req: Request): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

/** 세션 즉시 파기(로그아웃·유휴 만료). best-effort — 저장소 오류가 흐름을 막지 않는다(FN-003). */
export function destroySession(session: Session & Partial<SessionData>): Promise<void> {
  return new Promise<void>((resolve) => {
    session.destroy(() => resolve());
  });
}
