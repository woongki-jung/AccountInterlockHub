import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../audit/audit.constants';
import { maskToken } from '../audit/masking.util';
import { EX_CODE_MAP } from '../envelope/ex-code.map';
import { matchesAny, normalizeIp, parseAllowList } from './ip-match.util';
import { isTrustProxyEnabled, resolveClientIp } from './source-ip.util';

/**
 * 관리자 경로 IP 접근 제어 미들웨어 — PROC-104 / FN-001 / SEC-001.
 *
 * 관리자 진입(`/api/admin/**`, 정적 SPA `/admin/**`) 요청의 출발지 IP 를 운영 구성값(ADMIN_IP_ALLOWLIST)의
 * 허용 목록(정확 IP·CIDR)과 대조한다. 인증(FN-002·003)보다 앞단의 최선행 가드다(SEC-001 → AUTH 순).
 *
 * 판정:
 *  1. dev 비활성(EXC-SEC-01): NODE_ENV=dev/development 이고 허용목록이 비어 있으면 통과(로그인 인증은 PROC-103 유지).
 *  2. 허용 대조(SEC-001-01): 정규화한 출발지 IP 가 허용목록 매칭이면 통과, 아니면 차단.
 *  3. 차단(SEC-001-03): IP_BLOCK 감사(actorType SYSTEM, target=경로, result BLOCKED, detail=마스킹 IP) 후 403 EX-SEC-001.
 *
 * 응답 형상 주의: 미들웨어는 Nest 예외존(전역 필터) 밖에서 실행되고, next(err) 로 넘기면 serve-static 의
 * 말미 에러 핸들러가 404 로 재작성한다(main.ts 참조). 따라서 차단 응답을 여기서 FN-015 엔벨로프로 직접 종결한다.
 *
 * 출발지 IP 판별(프록시): 소켓 원 IP(req.socket.remoteAddress)를 신뢰한다. 프록시/LB 뒤에서
 * X-Forwarded-For 를 신뢰하려면 TRUST_PROXY 환경 플래그를 켠다(켜면 XFF 최좌측=원 클라이언트 IP 사용).
 * 판별 로직은 진입 요청제한(EntryRateLimitMiddleware)과 공유하는 source-ip.util 로 단일화한다(오류 #213 방지).
 */
@Injectable()
export class AdminIpMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AdminIpMiddleware.name);

  constructor(
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const allowList = parseAllowList(this.config.get<string>('ADMIN_IP_ALLOWLIST'));
    const nodeEnv = (this.config.get<string>('NODE_ENV') ?? '').toLowerCase();
    // fail-closed: NODE_ENV 미설정은 dev 로 보지 않는다(운영 오구성 시 우회 방지). 명시적 dev/development 만 대상.
    const isDev = nodeEnv === 'dev' || nodeEnv === 'development';

    // 1. dev 비활성(EXC-SEC-01) — dev/local 이고 허용목록 미설정이면 IP 대조 생략(로그인 인증은 유지).
    if (isDev && allowList.length === 0) {
      next();
      return;
    }

    const trustProxy = isTrustProxyEnabled(this.config.get<string>('TRUST_PROXY'));
    const sourceIp = normalizeIp(resolveClientIp(req, trustProxy));

    // 2. 허용 대조(SEC-001-01)
    if (sourceIp.length > 0 && matchesAny(sourceIp, allowList)) {
      next();
      return;
    }

    // 3. 차단 — 감사(SEC-001-03) 후 403 EX-SEC-001 직접 종결.
    const requestPath = req.originalUrl ?? req.url ?? '';
    await this.auditService.write({
      eventType: AuditEventType.IP_BLOCK,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: requestPath.slice(0, 200),
      result: AuditResult.BLOCKED,
      detail: `blocked source ip=${maskToken(sourceIp) ?? 'unknown'}`,
    });

    if (res.headersSent) {
      return;
    }
    res.status(EX_CODE_MAP['EX-SEC-001'].httpStatus).json({
      success: false,
      error: {
        code: 'EX-SEC-001',
        message: EX_CODE_MAP['EX-SEC-001'].message,
        details: null,
      },
    });
  }
}
