import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AppException } from '../../common/envelope/app.exception';
import { ServiceApi } from '../common/service-api.decorator';
import { ServiceApiGuard } from '../common/service-api.guard';
import { ServiceActor } from '../common/service-api.types';
import { ProcessStatusResponse, StatusService } from './status.service';

/**
 * 처리상태 확인 API 컨트롤러 — PROC-301 / SVC-006 / API-01.
 *
 * 진입점: GET /api/status/:trackingKey (서비스 A 서버 대면). ServeStatic 제외 경로(/api/**)라 본 컨트롤러가 처리한다.
 *  - 인증(FN-004)·요청제한(FN-014)은 ServiceApiGuard 가 선적용한다 — @ServiceApi 로 기대 주체(서비스 A)·
 *    요청제한 스코프(status)를 지정한다. 서비스 B 자격 거부(SEC-003-03)는 가드가 처리한다.
 *  - 연동 추적 키 형식 검증(FN-007, 비어있지 않음·최대 길이 255)만 컨트롤러가 수행하고(위반 400 EX-DATA-002),
 *    조회·갱신·응답 변환은 StatusService 에 위임한다(계층 분리). GET 이므로 기본 200.
 *
 * `#214` 개정: 조회 키를 허브 발급 요청 키값(UUID)에서 **연동 추적 키**(trackingKey, 발송처가 전달 데이터 X 에
 * 구성한 불투명 문자열·비유니크)로 전환했다 — UUID v4 형식 강제(구 UUID_V4_PATTERN)를 폐기하고 FN-007 형식
 * 검증(비어있지 않음·최대 길이)만 적용한다(DATA-002-06/07).
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/status')
@UseGuards(ServiceApiGuard)
@ServiceApi({ actor: ServiceActor.SERVICE_A, scope: 'status' })
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /** GET /api/status/:trackingKey — 처리·결과 확인 상태 조회(최초 조회 시 결과 확인 갱신). */
  @Get(':trackingKey')
  async getStatus(@Param('trackingKey') rawTrackingKey: string): Promise<ProcessStatusResponse> {
    // B3. FN-007_validateTrackingKeyFormat — 위반 시 400 EX-DATA-002.
    const trackingKey = validateTrackingKeyFormat(rawTrackingKey);
    return this.statusService.getStatus(trackingKey);
  }
}

/**
 * FN-007_validateTrackingKeyFormat(raw) — 연동 추적 키 형식 검증(비어있지 않음·최대 길이 255).
 * 발송처가 전달 데이터 X 내부에 구성하는 불투명 문자열이라 UUID 등 특정 형식을 강제하지 않는다
 * (발송처 구성 자유, DATA-002-06). 미존재(404 EX-DATA-003)는 본 함수가 아닌 FN-009 상태 조회에서 판정한다.
 */
function validateTrackingKeyFormat(raw: string): string {
  if (raw == null || raw.trim().length === 0 || raw.length > 255) {
    throw new AppException('EX-DATA-002');
  }
  return raw;
}
