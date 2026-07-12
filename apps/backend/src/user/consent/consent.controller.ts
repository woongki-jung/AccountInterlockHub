import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ConsentService, ConsentViewResponse } from './consent.service';

/**
 * 이용 동의 조회 컨트롤러 — PROC-201(동의 화면 데이터 구성) / SVC-004 / USR-01(SCR-005 mount).
 *
 * 진입점: GET /api/consent/:accessAddressId (Public — 발송처 링크 진입 흐름, 관리자 인증 경로와 분리).
 *  - 요청 제한(FN-014)은 EntryRateLimitMiddleware 가 선적용한다(InterlockModule.configure, scope=consent).
 *  - accessAddressId 는 활성 구성 조회로 유효성이 판정된다(무효 시 400 EX-SEC-004, 별도 DTO 불요 — 경로
 *    파라미터 1개뿐이라 서비스단 검증으로 충분).
 *  - 본문 1MB 상한(SEC-004-03)은 main.ts 전역 파서가 담당한다(GET 이라 사실상 미해당).
 * `#214` 로 동의/거부 제출(POST)은 접근 컨텍스트(encX·encY·생년월일)를 함께 받는 승인 오케스트레이션으로
 * 재정의되어 POST /api/interlock/approve(InterlockController)로 이동했다 — 본 컨트롤러는 조회 전용이다.
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /** 동의 대상 설명 문구·동의 항목 조회(GET /api/consent/:accessAddressId). */
  @Get(':accessAddressId')
  @HttpCode(200)
  async getConsentView(
    @Param('accessAddressId') accessAddressId: string,
  ): Promise<ConsentViewResponse> {
    return this.consentService.buildConsentView(accessAddressId);
  }
}
