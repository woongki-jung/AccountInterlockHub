import { IsBoolean } from 'class-validator';

/**
 * 연동 구성 활성 전환 요청 DTO — PROC-105 B1 / SVC-002 F-003(BR-103).
 *
 * isActive(전환 목표 상태)는 필수 boolean 이다. 전역 ValidationPipe(FN-005)가 재검증하며
 * 누락·비boolean 은 400 EX-SEC-004(필드 details)로 거부한다.
 */
export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
