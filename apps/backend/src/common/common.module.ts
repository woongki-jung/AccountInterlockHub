import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ResultInfoBuilder } from '../interlock-entry/result-info.builder';
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
 *
 * `ResultInfoBuilder`(PROC-105, accountinterlockhub#487 P10 회귀 1회차)를 이 모듈이 독립
 * provider 로 둔다 — `GlobalExceptionFilter` 의 진입 경로 폴백(그 파일의
 * `respondEntryPathFallback` 참고)이 `MDL-009` 결과 안내 정보를 더 이상 리터럴로 인라인하지
 * 않고 이 빌더를 호출해야 하기 때문이다("결과 구분 → 경로 번호 대응은 한 곳에만" — `process_PROC-105.md`
 * §개요·`MDL-009` §구현 가이드). `EntryModule`·`VerifyModule`·`ApproveModule` 3곳이 이미 같은
 * 이유(그쪽은 `exports` 하지 않아 재사용 불가)로 독립적으로 이 클래스를 provider 로 두는 것과
 * 같은 결이다 — 상태를 갖지 않는 순수 계산 클래스(유일한 의존성 `InterlockConfigService` 도
 * 전역 싱글턴)라 여러 인스턴스가 동시에 존재해도 안전하다(그쪽 모듈들의 문서 주석 참고). DI 는
 * 애플리케이션 기동 시 한 번만 해석되므로("마지막 방어선이 런타임에 남의 실패를 탄다"는 우려는
 * 성립하지 않는다), `GlobalExceptionFilter` 자신의 `try/catch` + `HARD_FALLBACK_DOCUMENT` 가
 * 이 호출이 실패하는 극단적 상황까지 흡수한다(그 자리 자체는 무변경).
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SanitizeResponseInterceptor },
    ResultInfoBuilder,
  ],
})
export class CommonModule {}
