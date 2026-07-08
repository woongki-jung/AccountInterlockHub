import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from './app.exception';
import { DEFAULT_EX_CODE, EX_CODE_MAP, TRANSPORT_STATUS_TO_CODE } from './ex-code.map';
import { FieldError } from './envelope.types';

/**
 * 전역 예외 필터(FN-015) — 모든 실패를 { success: false, error: { code, message, details } } 로 직렬화한다.
 *  - AppException: 실린 EX 코드로 상태·메시지·details 구성.
 *  - 프레임워크 HttpException: 전송 상태를 EX 로 환원(413→EX-SEC-005·429→EX-OPS-001), 그 외는 상태 보존 + 공통 코드(EX-FN-999).
 *  - 그 외 미포착 오류(및 본문 초과 413 raw 에러): EX-FN-999(500) 폴백, 413 은 EX-SEC-005.
 * 응답에는 스택트레이스·내부 경로·자격 값을 노출하지 않으며, 상세는 서버 로그에만 남긴다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = DEFAULT_EX_CODE;
    let details: FieldError[] | null = null;

    if (exception instanceof AppException) {
      code = exception.code;
      details = exception.details;
      httpStatus = EX_CODE_MAP[code]?.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const mapped = TRANSPORT_STATUS_TO_CODE[status];
      if (mapped) {
        code = mapped;
        httpStatus = EX_CODE_MAP[code].httpStatus;
      } else {
        // 도메인 EX 로 환원되지 않는 프레임워크 예외: 전송 상태는 보존하되 코드는 공통 폴백.
        code = DEFAULT_EX_CODE;
        httpStatus = status;
      }
    } else {
      // 비 HttpException(런타임 오류·body-parser raw 에러 등). 본문 초과(413)만 EX-SEC-005 로 환원.
      const rawStatus =
        (exception as { status?: number; statusCode?: number })?.status ??
        (exception as { statusCode?: number })?.statusCode;
      if (rawStatus === HttpStatus.PAYLOAD_TOO_LARGE) {
        code = 'EX-SEC-005';
        httpStatus = HttpStatus.PAYLOAD_TOO_LARGE;
      }
      // 그 외는 EX-FN-999(500) 유지.
    }

    const message = EX_CODE_MAP[code]?.message ?? EX_CODE_MAP[DEFAULT_EX_CODE].message;

    // 서버측 상세 로깅(스택 포함) — 응답 본문에는 절대 포함하지 않는다.
    this.logger.error(
      `[${code}] ${httpStatus} ${request?.method ?? '-'} ${request?.originalUrl ?? '-'}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(httpStatus).json({
      success: false,
      error: { code, message, details },
    });
  }
}
