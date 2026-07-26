import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { SanitizeResponseInterceptor } from './interceptors/sanitize-response.interceptor';

/**
 * P05 횡단 계층 모듈 — FN-014(오류 응답 엔벨로프)·FN-015(민감값 제거)를 실제로 응답에 적용하는
 * 두 전역 프로바이더를 등록한다. `APP_FILTER`(`GlobalExceptionFilter`)는 실패 응답을, `APP_
 * INTERCEPTOR`(`SanitizeResponseInterceptor`, 회귀 1회차 I-1 추가)는 **성공 응답 본문**을
 * 각각 담당한다 — FN-015 는 "모든 응답"에 적용돼야 하므로 이 둘이 함께 있어야 완전하다. 두
 * 토큰 모두 어느 모듈이 선언하든 애플리케이션 전역에 적용되는 특수 토큰이라 이 모듈을
 * `@Global()` 로 둘 필요가 없다(Nest 표준 동작).
 *
 * 캐시 금지 헤더·405 판정 미들웨어(`common/http/**`)는 Nest DI 가 필요 없는 순수 Express
 * 미들웨어라 이 모듈에 넣지 않고 `main.ts` 가 `app.use()` 로 직접 배선한다(§main.ts 참고 —
 * Nest 라우팅보다 먼저 걸어야 하는 순서 제약이 있어 모듈 등록 방식보다 명시적인 배선이 더
 * 안전하다).
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SanitizeResponseInterceptor },
  ],
})
export class CommonModule {}
