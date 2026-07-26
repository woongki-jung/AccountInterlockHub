// PROC-103 동의·승인 제출 진입점 — POST <INTERLOCK_ENTRY_PATH>/approve
// (spec-functions-api-user.md §동의·승인 제출). 인증 없음(AUTH-001) — 매 요청이 처음처럼
// 검증된다.
import { Body, Controller, HttpCode, Post, Type } from '@nestjs/common';
import type { ResultInfo } from '../interlock-entry/entry-initial-state.model';
import { parseApproveRequestBody } from './approve-request.dto';
import { ConsentApprovalService } from './consent-approval.service';

/**
 * `<INTERLOCK_ENTRY_PATH>` 는 배포마다 달라지는 런타임 상수(OPS-001-04)라 `@Post()` 데코레이터에
 * 리터럴로 박을 수 없다 — `entry.controller.ts` `createEntryController()` 와 같은 이유로 "경로를
 * 인자로 받는 팩토리 함수" 관례를 그대로 따른다(`approve.module.ts` 의 `forRoot()` 안에서만
 * 호출된다).
 */
export function createApproveController(entryPath: string): Type<unknown> {
  @Controller()
  class ApproveController {
    constructor(private readonly consentApproval: ConsentApprovalService) {}

    /**
     * `B1`(입력 DTO 형상 재검증)~`B8`(결과 안내). Nest 는 `@Post()` 핸들러의 기본 성공 상태를
     * 201 로 두므로, 사양이 요구하는 200(`MDL-009` 그대로 실어 응답)을 위해 `@HttpCode(200)` 을
     * 명시한다. 실패 경로(400·500·502)는 이 메서드가 직접 상태를 정하지 않는다 — 도메인
     * 예외(`exCode` 를 가진 값)를 던지면 `GlobalExceptionFilter` 가 카탈로그(`ex-catalog.ts`)로
     * 상태·본문을 구성한다(FN-014). 성공 응답 본문의 FN-015(민감값 제거)도 전역
     * 인터셉터(`SanitizeResponseInterceptor`)가 공통 처리한다 — 이 컨트롤러가 직접 다루지
     * 않는다.
     *
     * 요청 본문을 JSON 으로 해석할 수 없는 경우는 이 핸들러에 절대 도달하지 않는다 — Express
     * 본문 파서가 라우팅 자체를 건너뛰고, `common/http/body-parse-failure.ts` 의 접점별
     * 재분류(`/approve` 접미사 → `EX-BIZ-001`)가 전역 예외 필터 계층에서 이미 처리한다
     * (구조적 제약 — 실측 확인, P05 회귀 2·3회차에서 이미 시정 완료).
     */
    @Post(`${entryPath}/approve`)
    @HttpCode(200)
    async handleApprove(@Body() rawBody: unknown): Promise<ResultInfo> {
      const request = parseApproveRequestBody(rawBody); // B1 — 형상만(값 판정은 B5b)
      return this.consentApproval.submit(request); // B2~B8
    }
  }

  return ApproveController;
}
