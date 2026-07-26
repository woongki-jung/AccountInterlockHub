// PROC-102 본인확인 제출 진입점 — POST <INTERLOCK_ENTRY_PATH>/verify
// (spec-functions-api-user.md §본인확인 제출). 인증 없음(AUTH-001) — 매 요청이 처음처럼
// 검증된다.
import { Body, Controller, HttpCode, Post, Type } from '@nestjs/common';
import { parseVerifyRequestBody } from './verify-request.dto';
import type { VerifyResponseBody } from './verify-response.model';
import { IdentityVerificationService } from './identity-verification.service';

/**
 * `<INTERLOCK_ENTRY_PATH>` 는 배포마다 달라지는 런타임 상수(OPS-001-04)라 `@Post()` 데코레이터에
 * 리터럴로 박을 수 없다 — `entry.controller.ts` `createEntryController()`·`approve.controller.ts`
 * `createApproveController()` 와 같은 이유로 "경로를 인자로 받는 팩토리 함수" 관례를 그대로
 * 따른다(`verify.module.ts` 의 `forRoot()` 안에서만 호출된다).
 */
export function createVerifyController(entryPath: string): Type<unknown> {
  @Controller()
  class VerifyController {
    constructor(private readonly identityVerification: IdentityVerificationService) {}

    /**
     * `B1`(입력 DTO 형상 재검증)~`B8`(응답 구성). Nest 는 `@Post()` 핸들러의 기본 성공 상태를
     * 201 로 두므로, 사양이 요구하는 200(`stage` 다음 단계 상태 + `MDL-008`)을 위해
     * `@HttpCode(200)` 을 명시한다(approve.controller.ts 와 같은 이유). 실패 경로(400·500)는 이
     * 메서드가 직접 상태를 정하지 않는다 — 도메인 예외(`exCode` 를 가진 값)를 던지면
     * `GlobalExceptionFilter` 가 카탈로그(`ex-catalog.ts`)로 상태·본문을 구성한다(FN-014). 성공
     * 응답 본문의 FN-015(민감값 제거)도 전역 인터셉터(`SanitizeResponseInterceptor`)가 공통
     * 처리한다 — 이 컨트롤러가 직접 다루지 않는다.
     *
     * 요청 본문을 JSON 으로 해석할 수 없는 경우는 이 핸들러에 절대 도달하지 않는다 — Express
     * 본문 파서가 라우팅 자체를 건너뛰고, `common/http/body-parse-failure.ts` 의 접점별
     * 재분류(`/verify` 접미사 → `EX-AUTH-001`)가 전역 예외 필터 계층에서 이미 처리한다
     * (구조적 제약 — 실측 확인, P05 회귀 2·3회차에서 이미 시정 완료 — 착수 전 인계 사항 재확인).
     */
    @Post(`${entryPath}/verify`)
    @HttpCode(200)
    async handleVerify(@Body() rawBody: unknown): Promise<VerifyResponseBody> {
      const request = parseVerifyRequestBody(rawBody); // B1 — 형상만(값 판정은 B2~B3)
      return this.identityVerification.submit(request); // B2~B8
    }
  }

  return VerifyController;
}
