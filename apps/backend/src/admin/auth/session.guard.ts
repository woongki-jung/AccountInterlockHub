import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../common/envelope/app.exception';
import { destroySession, getIdleTimeoutMs } from './session.support';

/**
 * 관리자 세션 검증 가드(FN-003_verifySession) — AUTH-001-01·AUTH-002-01.
 *
 * IP 게이트(PROC-104, 미들웨어) 통과 뒤 관리자 보호 요청의 진입 가드다. 지금은 logout 에 적용하고,
 * 후속 단계(PROC-101/102/105/106 구성 라우트)에서 재사용하도록 모듈이 export 한다(IP → 세션 순).
 *
 *  - 세션에 admin 상태 없음(미인증) → 401 EX-AUTH-001.
 *  - 마지막 활동 후 유휴 초과 → 세션 파기 후 401 EX-AUTH-002(오류 아닌 재인증 유도, EXC-AUTH-02).
 *  - 유효 → lastActivityAt 갱신(rolling 활동 연장) 후 통과.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const session = req.session;
    const admin = session?.admin;

    if (!session || !admin) {
      throw new AppException('EX-AUTH-001');
    }

    const now = Date.now();
    if (now - admin.lastActivityAt > getIdleTimeoutMs()) {
      await destroySession(session);
      throw new AppException('EX-AUTH-002');
    }

    // 활동 갱신 — 세션 변경으로 rolling 쿠키가 재발급된다(유휴 창 연장).
    admin.lastActivityAt = now;
    return true;
  }
}
