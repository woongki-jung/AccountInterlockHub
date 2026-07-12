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
 * 발송처 접근 주소 구성 등록·편집 요청 DTO(MDL-101) — PROC-101 B1 / FN-005 스키마 재검증.
 *
 * 계층 분리(스펙 재검증 이원화):
 *  - 본 DTO(전역 ValidationPipe·FN-005)는 타입·길이 상한·enum 등 **구조적 스키마**만 검증한다.
 *    위반 시 400 EX-SEC-004(필드 details). 문자열 필드는 트림 후 검증한다.
 *  - 필수 공백·URL 형식·동의 항목 개수·고유성 등 **업무 규칙**은
 *    서비스단 FN-006(validateConfig)에서 재검증한다 → 422 EX-BIZ-001 / 409 EX-BIZ-002.
 *    그래서 configCode·configName·serviceBDeliveryUrl 필드에는 @IsNotEmpty 를 두지 않아(길이 상한만)
 *    공백이 FN-006 으로 전달돼 422(BIZ-001-08)로 처리되게 한다. (개별 자식의 label 은 DB CHECK(length>0)
 *    500 을 피하려 구조적으로 @IsNotEmpty 를 둔다.)
 *
 * `#214` 개정(accountinterlockhub#227 P3): 입력이 단일 암호화 JSON(encX·encY)으로 바뀌어
 * serviceAEntryUrl(구 서비스 A 진입 주소)·parameters[](전달 파라미터 정의)·ParameterDto·isUserKey
 * (사용자 키값 exactly-one 지정)를 전량 제거했다 — 구성에 파라미터를 두지 않는다(EXC-BIZ-14).
 * consentNotice(동의 대상 설명 문구, 선택, BIZ-002-08)를 신설했다.
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

export class SaveConfigDto {
  // 접근 주소 고유 ID(발송처 식별자) — 관리자 직접 입력, 고유(BIZ-001-10). 편집 시 불변 —
  // 서비스가 기존 값으로 대체한다(제출값 무시, EXC-BIZ-02).
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  configCode!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  configName!: string;

  // 수신처(서비스 B) 전달 주소(서버-서버 POST 대상, BIZ-001-09).
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

  // 동의 대상 설명 문구(자유 텍스트, 선택, BIZ-002-08) — 사용자 동의 화면(SCR-005) 상단 노출용.
  // 미입력 허용·크기 상한 1000자(consent_notice varchar(1000)와 정합).
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  consentNotice?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consentItems!: ConsentItemDto[];
}
