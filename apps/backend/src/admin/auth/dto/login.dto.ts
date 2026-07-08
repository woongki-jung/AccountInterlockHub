import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 관리자 로그인 요청 DTO — PROC-103 B1 / FN-005 재검증.
 * username: NotBlank·MaxLength(64)(트림 후 검증), password: NotBlank(원문, 트림 금지).
 * 위반 시 전역 ValidationPipe 가 400 EX-SEC-004(필드 details)로 변환한다.
 */
export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
