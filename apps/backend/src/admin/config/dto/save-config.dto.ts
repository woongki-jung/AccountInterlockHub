import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * 연동 구성 등록·편집 요청 DTO(MDL-101) — PROC-101 B1 / FN-005 스키마 재검증.
 *
 * 계층 분리(스펙 재검증 이원화):
 *  - 본 DTO(전역 ValidationPipe·FN-005)는 타입·길이 상한·enum·주입 방어 등 **구조적 스키마**만 검증한다.
 *    위반 시 400 EX-SEC-004(필드 details). 문자열 필드는 트림 후 검증한다.
 *  - 필수 공백·URL 형식·동의 항목/파라미터 개수·사용자 키값 지정(exactly-one)·고유성 등 **업무 규칙**은
 *    서비스단 FN-006(validateConfig)에서 재검증한다 → 422 EX-BIZ-001 / 409 EX-BIZ-002.
 *    그래서 configCode·configName·URL 필드에는 @IsNotEmpty 를 두지 않아(길이 상한만) 공백이 FN-006 으로
 *    전달돼 422(BIZ-001-01/02)로 처리되게 한다. (개별 자식의 label·name·sourceKeyA 는 DB CHECK(length>0)
 *    500 을 피하려 구조적으로 @IsNotEmpty 를 둔다.)
 */

// 문자열 트림 변환(비문자열은 원형 유지 — 타입 검증이 별도로 처리).
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** 동의 항목(ENT-002) — {label, description?, termsContent?, required, order}. */
export class ConsentItemDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  // 약관 컨텐츠(전체 약관 본문)는 선택 입력(BIZ-001-06). 크기 상한은 본문 1MB(SEC-004-03)로 진입 검증이 담당.
  @IsOptional()
  @IsString()
  termsContent?: string | null;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

/** 전달 파라미터(ENT-003) — {name, sourceKeyA, deliverToB, required, order, isUserKey}. */
export class ParameterDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceKeyA!: string;

  @IsOptional()
  @IsBoolean()
  deliverToB?: boolean;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  // 사용자 키값 파라미터 지정 플래그 — 구성당 정확히 1개 true(BIZ-001-07). 개수 검증은 FN-006.
  @IsOptional()
  @IsBoolean()
  isUserKey?: boolean;
}

export class SaveConfigDto {
  // 구성 코드(고유·BIZ-001-03). 편집 시 불변 — 서비스가 기존 값으로 대체(제출값 무시).
  @Transform(trim)
  @IsString()
  @MaxLength(64)
  configCode!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  configName!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  serviceAEntryUrl!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  serviceBDeliveryUrl!: string;

  // 전달 방식(기본 'POST' — MDL-101). 미지정 시 서비스단에서 'POST' 보충.
  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH'])
  serviceBHttpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consentItems!: ConsentItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  parameters!: ParameterDto[];
}
