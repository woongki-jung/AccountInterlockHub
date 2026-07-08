import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 완료 콜백 요청 DTO(MDL-305) — POST /api/interlock/callback / PROC-303 B3 / FN-005 스키마 검증.
 *
 * 서비스 B 가 허브→서비스 B 전달 페이로드(MDL-204)로 수령한 { 연동 구성 식별자, 전달받은 키값 }을 회신한다.
 * 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조적으로 검증한다 — 위반 시 전역 ValidationPipe 가
 * 400 EX-SEC-004(필드 details)로 변환한다. 본문 1MB 상한(SEC-004-03 → 413 EX-SEC-005)은 main.ts
 * 전역 파서가 담당한다. 요청 본문에 담아 질의 문자열 로깅 노출을 피한다(SEC-005-01).
 *
 * 구성 실재·사용자 키값 파라미터 지정 여부(BIZ-004-05)·대상 이력 특정(BIZ-004-03)은 업무 규칙이라
 * 서비스단(CallbackService → FN-019/FN-018)에서 판정한다. 요청 키값은 콜백 계약의 필수 항목이 아니다
 * (대상 특정은 {configCode + userKey} 스코프의 미수신 최신 1건 규칙으로 단일화 — SVC-009).
 */
export class CallbackDto {
  // 연동 구성 식별자(전달 페이로드로 수령한 값 회신). 구성 실재·지정 여부 검증은 서비스단.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  configCode!: string;

  // 서비스 B 가 전달받은 지정 사용자 키값(대상 특정 스코프의 절반). 로그·감사 노출 시 마스킹(SEC-005-01).
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  userKey!: string;
}
