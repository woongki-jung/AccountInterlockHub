import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApproveDto } from './dto/approve.dto';
import { ApproveResponse, InterlockService } from './interlock.service';

/**
 * 사용자 연동 승인 컨트롤러 — PROC-202(동의/거부·승인 게이팅) → PROC-203(승인 시 복호화·이력·전달·상태) /
 * SVC-004·SVC-005 / USR-01·USR-02.
 *
 * 진입점: POST /api/interlock/approve (Public — 발송처 링크 진입 흐름, 관리자 인증 경로와 분리).
 *  - 요청 제한(FN-014)은 EntryRateLimitMiddleware 가 선적용한다(InterlockModule.configure, scope=approve).
 *  - 입력 검증(FN-005)은 전역 ValidationPipe(ApproveDto)가 수행한다(위반 400 EX-SEC-004).
 *  - 본문 1MB 상한(SEC-004-03)은 main.ts 전역 파서가 담당한다(초과 413 EX-SEC-005).
 *
 * `#214` 로 구 `POST /interlock/entry`(요청 키값 발급)·`POST /api/consent/:requestKey`(동의/거부 제출)
 * 두 엔드포인트가 본 단일 엔드포인트로 통합됐다 — 진입은 무상태 조회(GET /api/consent/:accessAddressId,
 * ConsentController)로, 승인/거부 제출은 접근 컨텍스트(encX·encY·생년월일)를 본문에 실은 본 엔드포인트로
 * 재편됐다. 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/interlock')
export class InterlockController {
  constructor(private readonly interlockService: InterlockService) {}

  /**
   * 동의/거부 처리·승인 게이팅, 승인 시 연동 실행(복호화→이력→전달→상태). 성공 → { result }.
   * 거부·필수 미충족 → 200 { result:'REJECTED' }(정상 종료, EXC-BIZ-03). 승인 완료 → 200 { result:'COMPLETED' }.
   * 복호화 실패·링크 오류·전달 실패는 AppException(EX-SEC-006/007·EX-BIZ-008/004)이 전역 필터로 전파된다.
   */
  @Post('approve')
  @HttpCode(200)
  async approve(@Body() dto: ApproveDto): Promise<ApproveResponse> {
    return this.interlockService.approve(dto);
  }
}
