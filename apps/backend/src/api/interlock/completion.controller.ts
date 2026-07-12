import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ServiceApi } from '../common/service-api.decorator';
import { ServiceApiGuard } from '../common/service-api.guard';
import { ServiceActor } from '../common/service-api.types';
import { CompletionService, CompletionCheckResponse } from './completion.service';
import { CompletionDto } from './dto/completion.dto';

/**
 * 연동 완료 확인 API 컨트롤러 — PROC-302 / SVC-008 / API-02.
 *
 * 진입점: POST /api/interlock/completion (서비스 A 서버 대면). ServeStatic 제외 경로(/api/**)라 본 컨트롤러가 처리한다.
 *  - 인증(FN-004)·요청제한(FN-014)은 ServiceApiGuard 가 선적용한다 — @ServiceApi 로 기대 주체(서비스 A)·
 *    요청제한 스코프(completion)를 지정한다. 서비스 B 자격 거부(SEC-003-03)는 가드가 처리한다.
 *  - 입력 형식 검증(FN-005)은 전역 ValidationPipe + CompletionDto 가 수행한다(위반 400 EX-SEC-004).
 *  - 완료 판정·응답 변환은 CompletionService(FN-017)에 위임한다(계층 분리). 읽기 전용.
 *
 * `#214` 개정(build P8): 조회 스코프를 구 {configCode, userKey} 복합에서 **연동 추적 키(trackingKey)
 * 단독**으로 전환했다(BIZ-004-10) — 구성 지정 여부 사전 검증(구 BIZ-004-05)은 폐기됐다.
 *
 * @HttpCode(200): NestJS POST 기본은 201 이나, 완료 판정 API 는 완료/미완료 둘 다 200 정상 응답이다(BR-302).
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/interlock')
@UseGuards(ServiceApiGuard)
@ServiceApi({ actor: ServiceActor.SERVICE_A, scope: 'completion' })
export class CompletionController {
  constructor(private readonly completionService: CompletionService) {}

  /** POST /api/interlock/completion — 연동 추적 키 스코프 최신 이력의 완료 여부 조회(읽기 전용). */
  @Post('completion')
  @HttpCode(200)
  async checkCompletion(@Body() dto: CompletionDto): Promise<CompletionCheckResponse> {
    return this.completionService.checkCompletion(dto.trackingKey);
  }
}
