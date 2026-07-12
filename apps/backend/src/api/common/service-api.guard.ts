import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AppException } from '../../common/envelope/app.exception';
import {
  API_KEY_HEADER,
  SIGNATURE_HEADER,
  ServiceApiAuthService,
  TIMESTAMP_HEADER,
} from './service-api-auth.service';
import { ServiceApiRateLimitStore } from './service-api-rate-limit.store';
import { SERVICE_API_METADATA } from './service-api.decorator';
import { ServiceApiMetadata } from './service-api.types';

// 요청 제한 분당 임계치(OPS-001 기본안, EXC-OPS-01).
const SERVICE_API_LIMIT_PER_MIN = 60;

/**
 * 서비스 대면 API 진입 가드(API-01/02/03 횡단) — FN-004 인증 → 주체 검사 → FN-014 요청제한 순.
 *
 * 가드로 구현하는 이유: Nest 파이프라인 내부라 여기서 throw 한 AppException 이 전역 예외필터
 * (AllExceptionsFilter, FN-015)로 정상 엔벨로프된다. /api/**·/interlock/** 는 serve-static 제외
 * 경로라 entry 미들웨어가 겪던 404 재작성 문제가 없다(미들웨어가 직접 응답 종결할 필요 없음).
 *
 * 라우트별 기대 주체·요청제한 스코프는 @ServiceApi({ actor, scope }) 메타데이터로 전달한다.
 * 통과 시 req.serviceCaller 에 인증 주체를 부착해 후속 컨트롤러(P2~P4)가 소비한다.
 *
 * 소비 예:
 *   @UseGuards(ServiceApiGuard)
 *   @ServiceApi({ actor: ServiceActor.SERVICE_A, scope: 'status' })
 */
@Injectable()
export class ServiceApiGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: ServiceApiAuthService,
    private readonly rateLimitStore: ServiceApiRateLimitStore,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<ServiceApiMetadata | undefined>(
      SERVICE_API_METADATA,
      [context.getHandler(), context.getClass()],
    );
    // 메타데이터 없는 라우트에 가드가 부착되면 구성 오류 — fail-closed(401).
    if (!metadata) {
      throw new AppException('EX-SEC-003');
    }

    const req = context.switchToHttp().getRequest<Request>();

    // 1) FN-004 인증(+ 주체 구분) — 통과 시 caller, 실패 시 401 EX-SEC-003(내부 감사).
    const caller = await this.authService.authenticate(
      {
        method: req.method,
        path: requestPath(req),
        rawBody: req.rawBody ?? Buffer.alloc(0),
        headers: {
          apiKey: headerValue(req, API_KEY_HEADER),
          timestamp: headerValue(req, TIMESTAMP_HEADER),
          signature: headerValue(req, SIGNATURE_HEADER),
        },
        trackingKey: (req.params?.trackingKey as string | undefined) ?? null,
        now: new Date(),
      },
      metadata,
    );

    // 2) FN-014 요청 제한 — caller 기준(`${scope}:${caller.id}`) 분당 60회.
    const allowed = this.rateLimitStore.hit(
      `${metadata.scope}:${caller.id}`,
      SERVICE_API_LIMIT_PER_MIN,
    );
    if (!allowed) {
      await this.auditService.write({
        eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
        actorType: ActorType.SERVICE,
        actorId: caller.id, // AuditService 가 SERVICE actorId 를 마스킹한다.
        target: metadata.scope,
        result: AuditResult.BLOCKED,
        detail: 'service api rate limit exceeded',
      });
      throw new AppException('EX-OPS-001');
    }

    // 3) 통과 — 인증 주체를 요청에 부착(후속 컨트롤러가 소비).
    req.serviceCaller = caller;
    return true;
  }
}

/** 쿼리 문자열을 제외한 요청 경로(서명 canonical 의 path). 예 `/api/status/<uuid>`. */
function requestPath(req: Request): string {
  const url = req.originalUrl || req.url || '';
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/** 헤더 단일 값(배열이면 첫 값). Express 는 헤더명을 소문자로 보관한다. */
function headerValue(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
