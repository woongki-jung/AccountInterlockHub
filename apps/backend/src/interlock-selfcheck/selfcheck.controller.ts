// PROC-204 연동 규약 자가진단 API 진입점 — POST <SELFCHECK_PATH>(spec-functions-api-server.md
// §연동 규약 자가진단 API). 인증 없음(AUTH-001) — 경로 비공개가 유일한 완화 장치다(SEC-003).
import { Body, Controller, HttpCode, Post, Type } from '@nestjs/common';
import { parseSelfcheckRequestBody } from './selfcheck-request.dto';
import type { SelfcheckResponseBody } from './selfcheck-response.model';
import { ProtocolConformanceService } from './protocol-conformance.service';

/**
 * `<SELFCHECK_PATH>` 는 배포마다 달라지는 런타임 상수(`OPS-001-04`)이자 **비공개 경로**
 * (`SEC-003-01`·`SEC-003-02`)라 `@Post()` 데코레이터에 리터럴로 박을 수 없다 —
 * `verify.controller.ts` `createVerifyController()`·`approve.controller.ts`
 * `createApproveController()` 와 같은 이유로 "경로를 인자로 받는 팩토리 함수" 관례를 그대로
 * 따른다(`selfcheck.module.ts` 의 `forRoot()` 안에서만 호출된다). **이 컨트롤러 자신의 코드**는
 * 경로 값을 함수 인자·클로저 밖의 어떤 객체 속성으로도 옮기지 않는다 — 응답·오류 메시지
 * 어디에도 담지 않는다(FN-015 `FORBIDDEN_KEYS` 의 `selfcheckPath`·`SELFCHECK_PATH` 도 같은
 * 목적의 2차 방어 — 이 컨트롤러가 그 값을 어떤 객체 속성에도 실어 응답·로그 경로로 흘려보내지
 * 않으므로 여기서는 발동할 자리 자체가 없다).
 *
 * **로그는 예외였다(P12 회귀 1회차 C-1 실측)** — `@Post(selfcheckPath)` 로 이 값을 데코레이터
 * 인자에 리터럴로 넘기는 것 자체가, Nest 프레임워크의 `RouterExplorer` 로 하여금 기동 시
 * `Mapped {<경로>, POST} route` 를 표준출력에 **자동** 기록하게 만들었다 — 이 컨트롤러(과
 * `selfcheck.module.ts`)가 직접 호출하는 로그가 아니라 프레임워크가 라우트 등록을 관측해
 * 스스로 남기는 로그라, 이 파일들을 아무리 정적으로 읽어도 드러나지 않는다. 이 경로는
 * `main.ts` 가 `NestFactory.create()` 에 주입하는 `RedactingConsoleLogger`
 * (`common/logging/redacting-console-logger.ts`)가 값 기반으로 걸러 막는다 — 키 이름이
 * 아니라 로그 메시지 문자열에 그 값이 실제로 등장하는지를 본다는 점에서 FN-015 와는 다른
 * 층의 방어다.
 */
export function createSelfcheckController(selfcheckPath: string): Type<unknown> {
  @Controller()
  class SelfcheckController {
    constructor(private readonly protocolConformance: ProtocolConformanceService) {}

    /**
     * `B2`(컨트롤러 — 입력 존재 검증)~`B6`(응답 구성). Nest 는 `@Post()` 핸들러의 기본 성공
     * 상태를 201 로 두므로, 사양이 요구하는 200(부적합 판정도 200 — 인터페이스 §사유 코드
     * 체계)을 위해 `@HttpCode(200)` 을 명시한다(verify.controller.ts 와 같은 이유). `B2` 위반
     * (입력 부재 · `EX-SEC-003`)·`B3` 위반(생년월일 형식 · `EX-AUTH-001`)은 이 메서드가 직접
     * 상태를 정하지 않는다 — 둘 다 `exCode` 를 가져(덕 타이핑, `isHttpMappedError`)
     * `GlobalExceptionFilter` 가 카탈로그(`ex-catalog.ts`)로 상태·본문을 구성한다(FN-014).
     * `B4`·`B5` 의 부적합 판정은 예외가 아니라 이 메서드가 반환하는 본문 그대로 200 이 된다
     * (`ProtocolConformanceService.diagnose()` 가 그 넷을 예외로 던지지 않고 흡수한다). 순수
     * 판정이라 트랜잭션을 열지 않으므로(`PROC-204` §실행 제약사항) 비동기로 만들지 않는다.
     *
     * `B1`(경로 판정·라우팅)은 이 메서드가 다루지 않는다 — Nest 라우팅이 `<SELFCHECK_PATH>` 와
     * `POST` 를 함께 매치해야만 이 핸들러에 도달하고, 경로 불일치·메서드 불일치는
     * `common/http/known-routes.ts` 가 자가진단 경로를 **의도적으로 표에서 뺀** 덕에
     * `route-guard.middleware.ts`(405)를 거치지 않고 그대로 Nest 라우팅 실패 →
     * `GlobalExceptionFilter` 의 본문 없는 일반 404 로 귀결된다(`SEC-003-02` — 착수 전 인계
     * 사항이 지목한 P05 회귀 3회차 시정을 그대로 재사용한다. 이 컨트롤러가 새로 손댈 필요가
     * 없다 — 착수 후 디코이 대조로 실측 재확인했다).
     *
     * 요청 본문을 JSON 으로 해석할 수 없는 경우도 이 핸들러에 도달하지 않는다 — Express 본문
     * 파서가 라우팅 자체를 건너뛰고, `common/http/body-parse-failure.ts` 의 접점별 재분류
     * (자가진단 경로 + `POST` → `EX-SEC-003`, 그 밖의 메서드는 `NOT_FOUND`)가 전역 예외 필터
     * 계층에서 이미 처리한다(구조적 제약 — verify.controller.ts 와 같은 실측 근거).
     */
    @Post(selfcheckPath)
    @HttpCode(200)
    handleSelfcheck(@Body() rawBody: unknown): SelfcheckResponseBody {
      const request = parseSelfcheckRequestBody(rawBody); // B2
      return this.protocolConformance.diagnose(request); // B3~B6
    }
  }

  return SelfcheckController;
}
