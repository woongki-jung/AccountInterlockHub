import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// 애플리케이션 부트스트랩. 단일 App Service 가 API + React 정적 서빙을 함께 제공한다
// (devspec/infra.md §애플리케이션 구성). 전역 파이프·필터·인터셉터 등 공통 기반은 후속 Phase(F3)에서 부착한다.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

void bootstrap();
