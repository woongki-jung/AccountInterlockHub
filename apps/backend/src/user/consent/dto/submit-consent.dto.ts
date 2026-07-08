import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 동의/거부 제출 DTO(MDL-203) — POST /api/consent/:requestKey / PROC-202 B1 / FN-005 스키마 검증.
 *
 * 본문은 { decision, configCode } 만 받는다. requestKey 는 경로 파라미터로 수신하며(본 DTO 미포함)
 * UUID 형식 검증은 서비스단(processDecision)에서 수행한다(위반 400 EX-SEC-004).
 * 위반 시 전역 ValidationPipe 가 400 EX-SEC-004(필드 details)로 변환한다. 본문 1MB 상한은 main.ts 전역 파서 담당.
 *
 * configCode 는 화면 값 단독 신뢰 금지 원칙(BIZ-002) 하에 서버가 진입 컨텍스트의 구성 매칭 근거와 대조한다
 * (불일치 400 EX-DATA-002 — FN-008). 여기서는 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조 검증한다.
 */

// 허용 결정값(MDL-203 decision enum). 서버는 이 두 값만 처리한다.
export const CONSENT_DECISIONS = ['AGREE', 'REJECT'] as const;
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

export class SubmitConsentDto {
  // 동의/거부 결정. 허용값 밖은 위반(400 EX-SEC-004).
  @IsIn(CONSENT_DECISIONS)
  decision!: ConsentDecision;

  // 구성 매칭 검증 근거(진입 컨텍스트 configCode 와 대조). 실재·활성 검증은 서비스단.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  configCode!: string;
}
