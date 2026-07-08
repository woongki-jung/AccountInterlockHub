import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * 서비스 A 진입 요청 DTO(MDL-201) — POST /interlock/entry / PROC-201 B1a / FN-005 스키마 검증.
 *
 * 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조적으로 검증한다. 위반 시 전역 ValidationPipe 가
 * 400 EX-SEC-004(필드 details)로 변환한다. 값의 의미적 신뢰성은 서비스 A 책임(SEC-002, 무판단).
 * 본문 1MB 상한(SEC-004-03 → 413 EX-SEC-005)은 main.ts 전역 파서가 담당한다.
 *
 * 지정 파라미터 값 완결성(BIZ-004-02, 400 EX-BIZ-007)·활성 구성 참조(EX-SEC-004)는 업무 규칙이라
 * 서비스단(InterlockService)에서 재검증한다.
 */

// parameters 는 문자열 값의 맵(Record<string,string>)이어야 한다. 값이 비문자열이면 위반.
@ValidatorConstraint({ name: 'isStringRecord', async: false })
class IsStringRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true; // 선택 항목 — 부재는 @IsOptional 이 통과시킨다.
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'string');
  }

  defaultMessage(): string {
    return 'parameters 는 문자열 값의 맵이어야 합니다.';
  }
}

function IsStringRecord(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsStringRecordConstraint,
    });
  };
}

export class EntryDto {
  // 대상 연동 구성 참조(활성 구성 실재 검증은 서비스단 — EX-SEC-004).
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  configCode!: string;

  // 회원 고유 키 — 무저장·무변형(값 신뢰성 위임, SEC-002). 로그 노출 시 마스킹(SEC-005-01).
  @IsString()
  @IsNotEmpty()
  memberKey!: string;

  // 전달 파라미터 값(구성 정의에 따라 매핑). 미지정 시 서비스단에서 {} 보충.
  @IsOptional()
  @IsStringRecord()
  parameters?: Record<string, string>;
}
