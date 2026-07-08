import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/envelope/all-exceptions.filter';
import { SuccessInterceptor } from './common/envelope/success.interceptor';
import { validationExceptionFactory } from './common/validation/validation.util';

// 애플리케이션 부트스트랩. 단일 App Service 가 API + React 정적 서빙을 함께 제공한다
// (devspec/infra.md §애플리케이션 구성). 공통 기반(엔벨로프·입력검증·예외)을 전역 부착한다.
async function bootstrap(): Promise<void> {
  // 기본 body parser 를 끄고 본문 크기 상한 1MB 로 재등록한다(SEC-004-03 — 초과 시 413 → EX-SEC-005).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // FN-005 공통 입력 검증: 화이트리스트·변환, 검증 실패는 400 EX-SEC-004(필드 details)로 변환.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // FN-015 공통 응답·에러 엔벨로프: 성공 래핑 인터셉터 + 전역 예외 필터.
  app.useGlobalInterceptors(new SuccessInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

void bootstrap();
