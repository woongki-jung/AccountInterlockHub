import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 완료 콜백 요청 DTO(MDL-305) — POST /api/interlock/callback / PROC-303 B3 / FN-005 스키마 검증.
 *
 * 서비스 B 가 허브→서비스 B 전달 페이로드(복호화 원문 X)로 수령한 **연동 추적 키**를 회신한다.
 * 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조적으로 검증한다 — 위반 시 전역 ValidationPipe 가
 * 400 EX-SEC-004(필드 details)로 변환한다. 본문 1MB 상한(SEC-004-03 → 413 EX-SEC-005)은 main.ts
 * 전역 파서가 담당한다. 요청 본문에 담아 질의 문자열 로깅 노출을 피한다(SEC-005-04).
 *
 * `#214` 로 구 {configCode, userKey} 2항목 회신은 폐기되고 **연동 추적 키(trackingKey) 단독**으로
 * 대상을 특정한다(BIZ-004-09). 대상 이력 특정(스코프 내 미수신 최신 1건)·재통지 멱등 판정은 업무 규칙이라
 * 서비스단(CallbackService → FN-019/FN-018)에서 판정한다.
 */
export class CallbackDto {
  // 연동 추적 키(전달 페이로드 X 로 수령한 값 회신). 대상 특정(스코프 내 미수신 최신 1건)은 서비스단.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  trackingKey!: string;
}
