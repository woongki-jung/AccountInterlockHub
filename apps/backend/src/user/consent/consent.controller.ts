import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ConsentService, ConsentViewResponse, DecisionResponse } from './consent.service';
import { SubmitConsentDto } from './dto/submit-consent.dto';

/**
 * 이용 동의 컨트롤러 — PROC-201 B1b(조회) / PROC-202(동의·거부 제출) / SVC-004 / USR-01(SCR-005/006).
 *
 * 진입점: GET·POST /api/consent/:requestKey (Public — 진입 컨텍스트(요청 키값)로 접근).
 *  - 입력 검증(FN-005)은 전역 ValidationPipe(SubmitConsentDto)가 수행한다(위반 400 EX-SEC-004).
 *  - 본문 1MB 상한(SEC-004-03)은 main.ts 전역 파서가 담당한다(초과 413 EX-SEC-005).
 * 요청 키값 미존재·만료·불일치는 서비스단에서 400 EX-DATA-002 로 응답한다. 응답 본문은 전역
 * SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /** 동의 항목 조회(GET /api/consent/:requestKey). 성공 → { configCode, items:[...] }(configCode 는 FE 제출 회신용). */
  @Get(':requestKey')
  @HttpCode(200)
  async getConsentItems(@Param('requestKey') requestKey: string): Promise<ConsentViewResponse> {
    return this.consentService.buildConsentView(requestKey);
  }

  /**
   * 동의/거부 처리(POST /api/consent/:requestKey). 본문 MDL-203 { decision, configCode }.
   * 성공(동의 전달 성공·거부) → { success:true }(200). 동의 후 전달 실패 → 502 EX-BIZ-004(상태는 저장됨).
   */
  @Post(':requestKey')
  @HttpCode(200)
  async submitDecision(
    @Param('requestKey') requestKey: string,
    @Body() dto: SubmitConsentDto,
  ): Promise<DecisionResponse> {
    return this.consentService.processDecision(requestKey, dto);
  }
}
