import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ServiceApi } from '../common/service-api.decorator';
import { ServiceApiGuard } from '../common/service-api.guard';
import { ServiceActor } from '../common/service-api.types';
import { CallbackService } from './callback.service';
import { CallbackDto } from './dto/callback.dto';

/**
 * 완료 콜백 API 컨트롤러 — PROC-303 / SVC-009 / API-03(API-P4).
 *
 * 진입점: POST /api/interlock/callback (서비스 B 서버 대면 콜백). ServeStatic 제외 경로(/api/**)라 본 컨트롤러가 처리한다.
 *  - 인증(FN-004)·요청제한(FN-014)은 ServiceApiGuard 가 선적용한다 — @ServiceApi 로 기대 주체(서비스 B)·
 *    요청제한 스코프(callback)를 지정한다. 서비스 A 자격 거부(SEC-003-03)는 가드가 처리한다.
 *  - 입력 형식 검증(FN-005)은 전역 ValidationPipe + CallbackDto 가 수행한다(위반 400 EX-SEC-004).
 *  - 대상 특정·완료 기록·재통지 멱등·감사는 CallbackService(FN-018)에 위임한다(계층 분리).
 *
 * @HttpCode(200): NestJS POST 기본은 201 이나, 완료 콜백은 완료 기록·재통지 멱등 성공 둘 다 200 정상 응답이다(BR-303).
 * 응답 본문에 데이터 페이로드가 없다 — 전역 SuccessInterceptor(FN-015)가 { success:true, data:null }로 감싼다.
 */
@Controller('api/interlock')
@UseGuards(ServiceApiGuard)
@ServiceApi({ actor: ServiceActor.SERVICE_B, scope: 'callback' })
export class CallbackController {
  constructor(private readonly callbackService: CallbackService) {}

  /** POST /api/interlock/callback — 연동 추적 키 스코프 미수신 최신 1건에 완료 콜백 수신 기록. */
  @Post('callback')
  @HttpCode(200)
  async callback(@Body() dto: CallbackDto): Promise<void> {
    await this.callbackService.recordCompletionCallback(dto, new Date());
  }
}
