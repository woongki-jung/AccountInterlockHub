import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { maskToken } from '../../common/audit/masking.util';
import { EX_CODE_MAP } from '../../common/envelope/ex-code.map';
import { EntryRateLimitStore } from './entry-rate-limit.store';

const ENTRY_LIMIT_PER_MIN = 60; // OPS-001 기본안(EXC-OPS-01)

/**
 * 진입 요청 제한 미들웨어(FN-014 / OPS-001) — POST /interlock/entry 에 선적용.
 *
 * 출발지 IP 기준 분당 60회를 초과하는 요청을 거부한다(429 EX-OPS-001). 초과 이벤트는
 * RATE_LIMIT_EXCEEDED(BLOCKED) 감사에 남긴다(OPS-001-02). 사용자 진입은 IP 기준으로 센다
 * (서비스 대면 API 는 인증 주체 기준 — FN-014 구현 가이드).
 *
 * 응답 형상 주의: 미들웨어는 Nest 예외존(전역 필터) 밖에서 실행되고 next(err) 로 넘기면
 * serve-static 말미 에러 핸들러가 404 로 재작성한다(AdminIpMiddleware 와 동일). 따라서 거부 응답을
 * 여기서 FN-015 엔벨로프로 직접 종결한다.
 */
@Injectable()
export class EntryRateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly rateLimitStore: EntryRateLimitStore,
    private readonly auditService: AuditService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // 출발지 IP 기준(express req.ip — TRUST_PROXY 설정 반영). 미판별 시 소켓 원 IP 폴백.
    const sourceIp = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const allowed = this.rateLimitStore.hit(`entry:${sourceIp}`, ENTRY_LIMIT_PER_MIN);
    if (allowed) {
      next();
      return;
    }

    // 초과 — 감사(OPS-001-02) 후 429 EX-OPS-001 직접 종결.
    await this.auditService.write({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      actorType: ActorType.SYSTEM,
      actorId: null,
      target: 'entry',
      result: AuditResult.BLOCKED,
      detail: `blocked source ip=${maskToken(sourceIp) ?? 'unknown'}`,
    });

    if (res.headersSent) {
      return;
    }
    res.status(EX_CODE_MAP['EX-OPS-001'].httpStatus).json({
      success: false,
      error: {
        code: 'EX-OPS-001',
        message: EX_CODE_MAP['EX-OPS-001'].message,
        details: null,
      },
    });
  }
}
