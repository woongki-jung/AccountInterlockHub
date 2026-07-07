import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * 관리자 경로 IP 접근 제한 미들웨어 — 스켈레톤(자리표시자).
 *
 * 현재는 모든 요청을 통과시킨다. 실제 허용목록 대조·차단(403)은 후속 단계에서 본구현한다.
 *
 * TODO(ADM-P1, refs #38 · FN-001 · PROC-104 · SEC-001): 본구현 시
 *  - 운영 구성값으로 주입되는 허용 IP 목록(SEC-001-02, 코드 하드코딩 금지)을 정확 IP·CIDR 로 매칭한다.
 *  - 미허용 출발지는 403 EX-SEC-001 로 차단하고, 차단 시도(출발지 IP·시각·경로)를 감사 로그로 남긴다(SEC-001-03, FN-013).
 *  - dev/local 환경은 허용목록 비어 있으면 비활성 가능(EXC-SEC-01), 로그인 인증(AUTH-001)은 유지.
 *  - 프록시 환경의 원 출발지 IP 판별(X-Forwarded-For 신뢰 범위)을 확정한다.
 *  - IP 가드는 인증 가드(FN-002·003)보다 앞단에 위치한다(SEC-001 → AUTH-001 순).
 */
@Injectable()
export class AdminIpMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    // TODO(refs #38): 허용 IP 목록 대조 후 미허용 시 403 EX-SEC-001. 현재는 통과.
    next();
  }
}
