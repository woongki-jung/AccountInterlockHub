import type { Request } from 'express';
import type { Session, SessionData, SessionOptions } from 'express-session';
import { isTrustProxyEnabled } from '../../common/middleware/source-ip.util';

/**
 * 관리자 세션(MDL-104, 애플리케이션 세션 — 비 ENT) 인프라 지원 — FN-003 / AUTH-002.
 * express-session 위에 세션 옵션·유휴 판정·프로미스화 헬퍼·세션 데이터 타입을 정의한다.
 *
 * 저장소: MVP 는 express-session 기본 in-memory 저장소(단일 App Service 기준). 스케일아웃 시
 * 공유 저장소(예: Redis)로 교체가 필요하다(WARN — 완료 보고 참조). sessionId 는 로그에 남기지 않는다.
 *
 * production secure 쿠키 발급(TLS 종단 프록시 대응, 일감 #235 — P11 런타임 게이트 회귀):
 * cookie.secure=true(운영) 인 상태에서 express-session 은 요청이 secure 로 판정될 때만 Set-Cookie 를
 * 내보낸다. Azure App Service 처럼 TLS 를 edge 에서 종단하고 앱에는 평문 HTTP 로 전달하는 배포에서는
 * Express 의 `req.secure`(전역 trust proxy 미설정 시 항상 false)로는 이를 판별할 수 없어 로그인이
 * 200 을 반환하고도 세션 쿠키가 전혀 발급되지 않았다(운영 전용 결함). 아래 buildSessionOptions 의
 * `proxy` 옵션이 그 해결책이다 — 자세한 내용은 해당 함수 주석 참조.
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
 *  - proxy: TRUST_PROXY 로만 게이팅(§일감 #235). express-session 의 secure 쿠키 판정(issecure)에 그대로
 *    전달된다 — true 면 X-Forwarded-Proto 헤더를 직접 신뢰(TLS 종단 프록시 뒤 production 대응),
 *    false 면 direct TLS 여부만 신뢰(오늘의 dev/무프록시 동작 그대로 유지, 보안 하향 없음).
 *    Express 전역 `app.set('trust proxy', …)` 는 건드리지 않는다 — express-session 의 `proxy` 옵션이
 *    true 로 명시되면 issecure() 는 Express 의 req.secure/trust proxy 설정을 아예 참조하지 않고
 *    X-Forwarded-Proto 헤더를 직접 읽기 때문이다(express-session 자체 구현, node_modules 확인).
 *    따라서 출발지 IP 판별(source-ip.util·오류 #213 XFF 격리, admin-ip/entry-rate-limit 미들웨어)과
 *    완전히 독립된 신뢰 경계다 — req.ip/req.ips 는 이 옵션의 영향을 받지 않는다(무회귀).
 */
export function buildSessionOptions(): SessionOptions {
  const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const secret = process.env.SESSION_SECRET;
  if (!secret && isProd) {
    throw new Error('SESSION_SECRET 환경변수가 필요합니다(운영 세션 서명).');
  }
  const trustProxy = isTrustProxyEnabled(process.env.TRUST_PROXY);
  return {
    name: SESSION_COOKIE_NAME,
    secret: secret ?? 'dev-insecure-session-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: trustProxy,
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
