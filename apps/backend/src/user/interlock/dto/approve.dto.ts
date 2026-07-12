import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * 승인/거부 제출 DTO(MDL-203 동의 결과 + MDL-201 접근 컨텍스트) — POST /api/interlock/approve /
 * PROC-202 B1 / FN-005 스키마 검증.
 *
 * `#214` 로 진입점이 `POST /api/consent/:requestKey`(요청 키값 경로)에서 `POST /api/interlock/approve`
 * (본문 수신)로 바뀌었다 — 승인 본문에 동의 결과(decision·accessAddressId·requiredConsentMet)와 접근
 * 컨텍스트(encX·encY·birthDate)를 함께 담는다. birthDate 는 decision=AGREE 일 때만 DTO 가 NotBlank 를
 * 강제한다(REJECT 는 복호화 요소 미포함). encX·encY 는 AGREE 여부와 무관하게 선택 검증만 두고, 부재·
 * 형식 판정은 복호화 단계(FN-020)에 위임한다(#238 — 아래).
 *
 * 여기서는 전송 안전성(형식·크기·주입 방어, SEC-004)만 구조적으로 검증한다 — encX·encY 의 부재·빈값·
 * Base64URL 형식 정오·birthDate 의 실제 유효성은 검증하지 않는다(모두 SEC-006 복호화 단계(FN-020)의
 * 책임이며, 위반 시 EX-SEC-007/EX-SEC-006 이어야 한다). 특히 encX·encY 는 필드 자체가 완전 누락되어도
 * FN-020 이 EX-SEC-007 로 판정해야 하므로(#238), DTO 에서 NotBlank(@IsNotEmpty)를 두지 않는다 —
 * 두면 부재가 EX-SEC-004 로 뭉개져 형식오류(EX-SEC-007)와 코드가 갈린다. decision·accessAddressId·
 * birthDate 등 나머지 위반(NotBlank 등)은 전역 ValidationPipe 가 400 EX-SEC-004(필드 details)로 변환한다.
 * 본문 1MB 상한(SEC-004-03 → 413 EX-SEC-005)은 main.ts 전역 파서가 담당한다.
 *
 * 필수 동의 충족(requiredConsentMet)·구성 매칭(accessAddressId)의 업무 재검증(BIZ-002-06)은 서비스단
 * (ConsentService.processDecision)이 수행한다.
 */

// 허용 결정값(MDL-203 decision enum). 서버는 이 두 값만 처리한다.
export const CONSENT_DECISIONS = ['AGREE', 'REJECT'] as const;
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

export class ApproveDto {
  // 동의/거부 결정. 허용값 밖은 위반(400 EX-SEC-004).
  @IsIn(CONSENT_DECISIONS)
  decision!: ConsentDecision;

  // 접근 주소 고유 ID(구성 매칭 근거) — 실재·활성 검증은 서비스단(EX-SEC-004).
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  accessAddressId!: string;

  // 필수 연동 동의 충족(FE 파생 집계값) — 서버 재검증은 서비스단(BIZ-002-06).
  @IsBoolean()
  requiredConsentMet!: boolean;

  // 이중 암호값 1(발송처 생성, 불투명) — 부재·빈값·Base64URL 형식 정오는 모두 FN-020 이 EX-SEC-007 로 판정한다
  // (#238). DTO 는 부재를 EX-SEC-004 로 선차단하지 않도록 @IsNotEmpty 를 두지 않고, 값이 있을 때 문자열 타입만 확인한다.
  @IsOptional()
  @IsString()
  encX?: string;

  // 이중 암호값 2(발송처 생성, 불투명) — 부재·빈값·Base64URL 형식 정오는 모두 FN-020 이 EX-SEC-007 로 판정한다
  // (#238). DTO 는 부재를 EX-SEC-004 로 선차단하지 않도록 @IsNotEmpty 를 두지 않고, 값이 있을 때 문자열 타입만 확인한다.
  @IsOptional()
  @IsString()
  encY?: string;

  // 사용자 생년월일(yyMMdd, 복호화 요소) — AGREE 시 NotBlank. 값 정오는 FN-020 복호화 성공/실패로 귀결
  // (AUTH-004-01) — 본 DTO 는 자릿수·범위 정규식을 두지 않는다.
  @ValidateIf((o: ApproveDto) => o.decision === 'AGREE')
  @IsString()
  @IsNotEmpty()
  birthDate?: string;
}
