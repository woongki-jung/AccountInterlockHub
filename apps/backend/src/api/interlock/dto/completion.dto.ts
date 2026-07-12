import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 연동 완료 확인 요청 DTO — POST /api/interlock/completion / PROC-302 B3 / FN-005 스키마 검증.
 *
 * 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조적으로 검증한다. 위반 시 전역 ValidationPipe 가
 * 400 EX-SEC-004(필드 details)로 변환한다. 본문 1MB 상한(SEC-004-03 → 413 EX-SEC-005)은 main.ts
 * 전역 파서가 담당한다. 요청 본문에 담아 질의 문자열 로깅 노출을 피한다(SEC-005-04).
 *
 * `#214` 로 구 {configCode, userKey} 복합 스코프가 폐기되고 **연동 추적 키(trackingKey) 단독**으로
 * 조회 조건을 특정한다(BIZ-004-10). 스코프 내 이력 존재 여부(EX-BIZ-005)는 업무 규칙이라 서비스단
 * (FN-019/FN-017)에서 판정한다.
 */
export class CompletionDto {
  // 연동 추적 키(발송처가 전달 데이터 X 안에 구성해 확보한 값). 스코프 내 이력 존재 여부 검증은 서비스단.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  trackingKey!: string;
}
