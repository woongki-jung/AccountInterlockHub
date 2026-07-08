import { ValidationError } from 'class-validator';
import { AppException } from '../envelope/app.exception';
import { FieldError } from '../envelope/envelope.types';

// class-validator 의 중첩 ValidationError 트리를 필드별 오류 배열로 평탄화한다(FN-015 details).
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  const result: FieldError[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints) {
      for (const message of Object.values(err.constraints)) {
        result.push({ field: path, message });
      }
    }
    if (err.children && err.children.length > 0) {
      result.push(...flattenValidationErrors(err.children, path));
    }
  }
  return result;
}

// 전역 ValidationPipe 의 예외 팩토리(FN-005) — 검증 실패를 400 EX-SEC-004(필드 details 포함)로 변환한다.
export function validationExceptionFactory(errors: ValidationError[]): AppException {
  return new AppException('EX-SEC-004', flattenValidationErrors(errors));
}
