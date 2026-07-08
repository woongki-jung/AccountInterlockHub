import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ConsentItemResponse, ConsentService } from './consent.service';

/**
 * 이용 동의 화면 컨트롤러 — PROC-201 B1b / SVC-004 / USR-01(SCR-005 mount).
 *
 * 진입점: GET /api/consent/:requestKey (Public — 진입 컨텍스트(요청 키값)로 접근).
 * 요청 키값 미존재·만료·불일치는 서비스단에서 400 EX-DATA-002 로 응답한다. 응답 본문은 전역
 * SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /** 동의 항목 조회(GET /api/consent/:requestKey). 성공 → ConsentItem[]. */
  @Get(':requestKey')
  @HttpCode(200)
  async getConsentItems(@Param('requestKey') requestKey: string): Promise<ConsentItemResponse[]> {
    return this.consentService.buildConsentView(requestKey);
  }
}
