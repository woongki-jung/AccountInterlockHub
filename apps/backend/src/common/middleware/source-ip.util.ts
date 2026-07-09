import type { Request } from 'express';

/**
 * 출발지 IP 판별 공통 유틸 — 관리자 IP 게이트(SEC-001·FN-001·PROC-104)와 진입 요청제한
 * (FN-014·OPS-001·PROC-201)이 **동일 규칙**으로 원 출발지를 판별하도록 단일화한다.
 * 두 경로가 서로 다른 방식으로 IP 를 얻어 발생한 판별 불일치(오류 #213 — 진입 요청제한이 XFF 미반영)를
 * 구조적으로 방지한다.
 *
 * TRUST_PROXY(운영 플래그)가 켜져 있으면 X-Forwarded-For 최좌측(원 클라이언트)을, 아니면 소켓 원 IP 를
 * 신뢰한다. XFF 신뢰는 프록시/LB 뒤 배포에서만 켠다 — 신뢰 프록시가 XFF 를 재작성/추가하는 전제이며,
 * 직접 대면(플래그 off)에서는 클라이언트가 임의 주입할 수 있는 XFF 를 신뢰하지 않는다(스푸핑 방지).
 */

/** TRUST_PROXY 환경값 truthy 판정 — '1'|'true'|'yes'|'on'(대소문자 무시). */
export function isTrustProxyEnabled(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * 원 클라이언트(출발지) IP 를 판별한다.
 *  - trustProxy=true: X-Forwarded-For 최좌측 항목(원 클라이언트). 없으면 소켓 원 IP 로 폴백.
 *  - trustProxy=false: 소켓 원 IP(req.socket.remoteAddress), 없으면 req.ip.
 * 반환값 정규화(IPv4-mapped IPv6 환원 등)는 호출부가 ip-match.util.normalizeIp 로 수행한다.
 */
export function resolveClientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    if (raw) {
      const first = raw.split(',')[0]?.trim();
      if (first) {
        return first;
      }
    }
  }
  return req.socket?.remoteAddress ?? req.ip ?? '';
}
