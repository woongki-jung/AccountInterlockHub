import { SetMetadata } from '@nestjs/common';
import { ServiceApiMetadata } from './service-api.types';

/**
 * 서비스 대면 API 라우트 메타데이터 키. ServiceApiGuard 가 Reflector 로 읽는다.
 */
export const SERVICE_API_METADATA = 'service-api:metadata';

/**
 * 서비스 대면 API 진입 가드 메타데이터 데코레이터.
 *
 * 라우트(핸들러 또는 컨트롤러)에 기대 주체·요청제한 스코프를 지정한다. ServiceApiGuard 와 함께 쓴다.
 *
 * @example
 *   // API-01 처리상태 확인 (서비스 A 자격)
 *   @UseGuards(ServiceApiGuard)
 *   @ServiceApi({ actor: ServiceActor.SERVICE_A, scope: 'status' })
 *   @Get('status/:requestKey')
 *   getStatus(...) { ... }
 *
 *   // API-03 완료 콜백 (서비스 B 자격)
 *   @UseGuards(ServiceApiGuard)
 *   @ServiceApi({ actor: ServiceActor.SERVICE_B, scope: 'callback' })
 *   @Post('interlock/callback')
 *   callback(...) { ... }
 */
export const ServiceApi = (metadata: ServiceApiMetadata): MethodDecorator & ClassDecorator =>
  SetMetadata(SERVICE_API_METADATA, metadata);
