import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AppException } from '../../common/envelope/app.exception';
import { ServiceApi } from '../common/service-api.decorator';
import { ServiceApiGuard } from '../common/service-api.guard';
import { ServiceActor } from '../common/service-api.types';
import { ProcessStatusResponse, StatusService } from './status.service';

/**
 * 처리상태 확인 API 컨트롤러 — PROC-301 / SVC-006 / API-01.
 *
 * 진입점: GET /api/status/:requestKey (서비스 A 서버 대면). ServeStatic 제외 경로(/api/**)라 본 컨트롤러가 처리한다.
 *  - 인증(FN-004)·요청제한(FN-014)은 ServiceApiGuard 가 선적용한다 — @ServiceApi 로 기대 주체(서비스 A)·
 *    요청제한 스코프(status)를 지정한다. 서비스 B 자격 거부(SEC-003-03)는 가드가 처리한다.
 *  - 요청 키값 UUID v4 형식 검증(FN-007)만 컨트롤러가 수행하고(불일치 400 EX-DATA-002), 조회·갱신·응답 변환은
 *    StatusService 에 위임한다(계층 분리). GET 이므로 기본 200.
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */

// UUID v4 형식 판정(FN-007). Nest ParseUUIDPipe 는 EX-DATA-002 엔벨로프로 매핑되지 않으므로 직접 판정한다.
// 버전 nibble=4, variant nibble ∈ [89ab] 강제(허브 발급 요청 키값은 randomUUID() = UUID v4).
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('api/status')
@UseGuards(ServiceApiGuard)
@ServiceApi({ actor: ServiceActor.SERVICE_A, scope: 'status' })
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /** GET /api/status/:requestKey — 처리·결과 확인 상태 조회(최초 조회 시 결과 확인 갱신). */
  @Get(':requestKey')
  async getStatus(@Param('requestKey') requestKey: string): Promise<ProcessStatusResponse> {
    // B3. FN-007 요청 키값 형식 검증 — UUID v4 불일치 시 400 EX-DATA-002(USR 진입 흐름과 공유되는 코드·문구).
    if (!UUID_V4_PATTERN.test(requestKey)) {
      throw new AppException('EX-DATA-002');
    }
    return this.statusService.getStatus(requestKey);
  }
}
