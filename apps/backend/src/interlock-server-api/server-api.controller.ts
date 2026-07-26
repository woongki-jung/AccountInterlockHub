// PROC-201·202·203 서버 대면 API 진입점 — POST /api/interlock/status·completion·callback
// (spec-functions-api-server.md §처리상태 확인 API·§연동 완료 확인 API·§완료 콜백 API). 인증
// 없음(AUTH-001) — 매 요청이 처음처럼 검증된다. 세 경로 모두 사양이 직접 고정한 리터럴 경로라
// (`<INTERLOCK_ENTRY_PATH>` 같은 런타임 상수가 아니다 — known-routes.ts §문서 주석과 같은 근거)
// `entry.controller.ts`·`verify.controller.ts`·`approve.controller.ts` 의 "경로를 인자로 받는
// 팩토리 함수" 관례를 따르지 않고 `@Controller()` 에 리터럴 경로를 직접 둔다.
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { parseTrackingKeyRequestBody } from './tracking-key-request.dto';
import type { StatusResponseBody } from './status-response.model';
import type { CompletionResponseBody } from './completion-response.model';
import { InterlockStatusService } from './interlock-status.service';
import { InterlockCompletionService } from './interlock-completion.service';
import { InterlockCallbackService } from './interlock-callback.service';

@Controller()
export class ServerApiController {
  constructor(
    private readonly status: InterlockStatusService,
    private readonly completion: InterlockCompletionService,
    private readonly callback: InterlockCallbackService,
  ) {}

  /**
   * PROC-201 `B1`(입력 DTO 형상 재검증)~`B6`(응답 송출). Nest 는 `@Post()` 핸들러의 기본 성공
   * 상태를 201 로 두므로, 사양이 요구하는 200 을 위해 `@HttpCode(200)` 을 명시한다
   * (verify.controller.ts·approve.controller.ts 와 같은 이유). 실패 경로(400·404·500)는 이
   * 메서드가 직접 상태를 정하지 않는다 — 도메인 예외(`exCode` 를 가진 값)를 던지면
   * `GlobalExceptionFilter` 가 카탈로그(`ex-catalog.ts`)로 상태·본문을 구성한다(FN-014). 캐시
   * 금지 헤더(main.ts `cacheControlMiddleware`)·FN-015 민감값 제거(`SanitizeResponseInterceptor`)
   * ·메서드 불일치 405(`route-guard.middleware.ts` — `known-routes.ts` 가 이미 이 경로를
   * POST 전용으로 등록해 두었다)는 전부 횡단 계층이 공통 처리한다 — 이 컨트롤러가 직접 다루지
   * 않는다.
   *
   * 요청 본문을 JSON 으로 해석할 수 없는 경우는 이 핸들러에 절대 도달하지 않는다 — Express
   * 본문 파서가 라우팅 자체를 건너뛰고, `common/http/body-parse-failure.ts` 의 접점별
   * 재분류(이 세 경로 → `EX-DATA-002`)가 전역 예외 필터 계층에서 이미 처리한다(구조적 제약 —
   * verify.controller.ts 와 같은 실측 근거).
   */
  @Post('/api/interlock/status')
  @HttpCode(200)
  async handleStatus(@Body() rawBody: unknown): Promise<StatusResponseBody> {
    const request = parseTrackingKeyRequestBody(rawBody); // B1 — 형상만(값 판정은 B2)
    return this.status.getStatus(request); // B2~B6
  }

  /** PROC-202 `B1`(형상 재검증)~`B5`(응답 구성). 위 handleStatus 문서 주석과 같은 근거로 200 고정. */
  @Post('/api/interlock/completion')
  @HttpCode(200)
  async handleCompletion(@Body() rawBody: unknown): Promise<CompletionResponseBody> {
    const request = parseTrackingKeyRequestBody(rawBody); // B1
    return this.completion.getCompletion(request); // B2~B5
  }

  /** PROC-203 `B1`(형상 재검증)~`B5`(응답 구성). 위 handleStatus 문서 주석과 같은 근거로 200 고정. */
  @Post('/api/interlock/callback')
  @HttpCode(200)
  async handleCallback(@Body() rawBody: unknown): Promise<CompletionResponseBody> {
    const request = parseTrackingKeyRequestBody(rawBody); // B1
    return this.callback.recordCallback(request); // B2~B5
  }
}
