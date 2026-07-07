import { Controller, Get } from '@nestjs/common';

// 애플리케이션 기동·정적 서빙 제외 경로 확인용 헬스 체크. 도메인 API 는 후속 Phase 에서 추가된다.
@Controller('api')
export class AppController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
