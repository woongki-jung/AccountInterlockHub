import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EntryDto } from './dto/entry.dto';
import { EntryResponse, InterlockService } from './interlock.service';

/**
 * 서비스 A 진입 컨트롤러 — PROC-201 B1a / SVC-004 / USR-01.
 *
 * 진입점: POST /interlock/entry (Public — 서비스 A 진입 흐름, 관리자 인증 경로와 분리).
 *  - 요청 제한(FN-014)은 EntryRateLimitMiddleware 가 선적용한다(InterlockModule.configure).
 *  - 입력 검증(FN-005)은 전역 ValidationPipe(EntryDto)가 수행한다(위반 400 EX-SEC-004).
 *  - 본문 1MB 상한(SEC-004-03)은 main.ts 전역 파서가 담당한다(초과 413 EX-SEC-005).
 * 회원 키는 URL 쿼리가 아닌 본문으로 수신한다(access log 평문 노출 방지). 응답의 requestKey(UUID)만
 * 이후 URL 경로로 사용한다. 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('interlock')
export class InterlockController {
  constructor(private readonly interlockService: InterlockService) {}

  /** 진입·요청 키값 발급·연동이력 기록 개시(POST /interlock/entry). 성공 → { requestKey }. */
  @Post('entry')
  @HttpCode(200)
  async entry(@Body() dto: EntryDto): Promise<EntryResponse> {
    return this.interlockService.processEntry(dto);
  }
}
