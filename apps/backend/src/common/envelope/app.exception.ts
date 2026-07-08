import { HttpException } from '@nestjs/common';
import { DEFAULT_EX_CODE, EX_CODE_MAP } from './ex-code.map';
import { FieldError } from './envelope.types';

/**
 * 도메인 계층이 throw 하는 타입드 예외. EX 코드를 실어 던지면 전역 예외 필터가
 * 해당 코드의 HTTP 상태·사용자 메시지로 엔벨로프를 구성한다(FN-015).
 * 미등록 코드는 EX-FN-999(500) 로 폴백한다.
 */
export class AppException extends HttpException {
  readonly code: string;
  readonly details: FieldError[] | null;

  constructor(code: string, details?: FieldError[] | null) {
    const resolvedCode = EX_CODE_MAP[code] ? code : DEFAULT_EX_CODE;
    const entry = EX_CODE_MAP[resolvedCode];
    super({ code: resolvedCode, message: entry.message, details: details ?? null }, entry.httpStatus);
    this.code = resolvedCode;
    this.details = details ?? null;
  }
}
