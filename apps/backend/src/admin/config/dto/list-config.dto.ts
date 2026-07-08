import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 연동 구성 목록 조회 조건 DTO(MDL-102 필터) — PROC-102 B1 / FN-005 스키마 재검증.
 *
 * 목록은 read-only 이며 필터는 모두 선택이다. 전역 ValidationPipe(FN-005)가 타입·길이·enum 을
 * 재검증하고 위반 시 400 EX-SEC-004(필드 details)로 변환한다. query 문자열은 트림 후 검증한다.
 *  - active: 'true'/'false' 문자열을 boolean 으로 변환한다. 그 외 값은 원형 유지 → @IsBoolean 위반(400).
 *  - keyword: 트림 후 최대 100자(PROC-102 F1). 공백/빈 문자열은 서비스단에서 미필터로 처리한다.
 */
export class ListConfigQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value; // 그 외 값은 그대로 두어 @IsBoolean 이 400 으로 거부하게 한다.
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
