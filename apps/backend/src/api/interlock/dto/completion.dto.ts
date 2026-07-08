import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 연동 완료 확인 요청 DTO — POST /api/interlock/completion / PROC-302 B3 / FN-005 스키마 검증.
 *
 * 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조적으로 검증한다. 위반 시 전역 ValidationPipe 가
 * 400 EX-SEC-004(필드 details)로 변환한다. 본문 1MB 상한(SEC-004-03 → 413 EX-SEC-005)은 main.ts
 * 전역 파서가 담당한다. 요청 본문에 담아 질의 문자열 로깅 노출을 피한다(SEC-005-01).
 *
 * 구성 실재·사용자 키값 파라미터 지정 여부(BIZ-004-05)는 업무 규칙이라 서비스단(FN-019/FN-017)에서 판정한다.
 */
export class CompletionDto {
  // 연동 구성 식별자(진입 계약과 동일 값). 구성 실재·지정 여부 검증은 서비스단.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  configCode!: string;

  // 서비스 A 가 전달했던 지정 사용자 키값(조회 스코프의 절반). 로그·감사 노출 시 마스킹(SEC-005-01).
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  userKey!: string;
}
