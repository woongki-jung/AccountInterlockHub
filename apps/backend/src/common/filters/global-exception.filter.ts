// 전역 예외 필터 — FN-014(오류 응답 엔벨로프)·EX-OPS-002(마지막 방어)·정의되지 않은 경로의
// 본문 없는 일반 404(SEC-003-02)·본문 파싱 실패 접점별 재분류(회귀 1회차 I-3)를 한 곳에서
// 처리한다.
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { InterlockConfigService } from '../../config/interlock-config.service';
import { buildErrorEnvelope } from '../errors/error-envelope';
import { FALLBACK_EX_CODE } from '../errors/ex-catalog';
import { isHttpMappedError } from '../errors/http-mapped.error';
import { applyNoStoreHeaders } from '../http/cache-control';
import { classifyBodyParseFailure } from '../http/body-parse-failure';
import { buildKnownRoutes, buildMethodsByPath, normalizePath } from '../http/known-routes';

interface MinimalRequest {
  readonly method?: string;
  readonly path?: string;
}

/**
 * `APP_FILTER` 로 등록해(`common.module.ts`) 컨트롤러가 던진 예외뿐 아니라 **Nest 라우터
 * 자신이 매치 실패 시 내부적으로 던지는 `NotFoundException`도, Express 본문 파서가 던지는
 * `BadRequestException`(회귀 1회차 I-3, 아래 참고)도 함께 받는다.** Nest 는 아무 라우트도
 * 매치하지 못하면 `@nestjs/core` `RoutesResolver.registerNotFoundHandler()` 가
 * `new NotFoundException(\`Cannot ${method} ${url}\`)` 을 던지고, 이 예외는
 * `RouterExceptionFilters.create()` → `BaseExceptionFilterContext.createContext()` 경로로
 * **전역 필터 목록과 병합되어** 전달된다(소스 확인:
 * `node_modules/@nestjs/core/router/routes-resolver.js` · `router-exception-filters.js` ·
 * `helpers/context-creator.js`) — 즉 컨트롤러 예외와 "경로 자체가 없음" 예외가 같은 지점에서
 * 갈린다는 뜻이라 별도 Express 404 핸들러를 추가로 배선할 필요가 없다.
 *
 * 판별 순서:
 *   1) `exCode` 를 가진 예외(크립토·레코드 등 기존 도메인 예외, 덕 타이핑 — `isHttpMappedError`)
 *      → FN-014 엔벨로프.
 *   2) `exCode` 가 없는 `BadRequestException`(요청 본문 JSON 파싱 실패 — 아래 §본문 파싱 실패
 *      참고) → 접점별 재분류(`classifyBodyParseFailure`). 처리되면 종료, `UNCLASSIFIED` 면
 *      3)·4)·5)로 흘려보낸다.
 *   3) 그 밖의 `NotFoundException`(= 위에서 설명한 라우팅 자체의 매치 실패) → 본문 없는 일반
 *      404(EX 코드 없음).
 *   4) 그 밖의 예외 중, **사양이 정의한 접점이 아니면서(`isKnownRequestPath`) 동시에 라우팅에
 *      도달하기도 전에 끝난 실패인 것(`isRoutingUnreachedFailure`)** → 본문 없는 일반 404
 *      (회귀 3회차 [C-1]·[I-1], 아래 §자가진단 경로 은닉 참고).
 *   5) 그 밖의 모든 예외(카탈로그 어떤 코드로도 분류되지 않음) → `EX-OPS-002` 500(마지막 방어).
 *
 * 어떤 분기도 원본 예외의 `message`·`stack`·`cause` 를 응답에 옮기지 않는다(`SEC-002-05`·
 * `DATA-001-04`) — 1)의 `message` 는 항상 카탈로그 기본값이고, 그 밖은 응답 본문에 원본
 * 정보를 아예 담지 않는다.
 *
 * **§본문 파싱 실패(회귀 1회차 I-3)** — Express 본문 파서는 Nest 라우터보다 먼저 걸리고,
 * JSON 파싱에 실패하면 `next(err)` 로 라우팅 자체를 건너뛴다(컨트롤러가 존재해도 실행되지
 * 않는다 — 실측 확인). 그 실패는 `mapExternalException()` 이 `SyntaxError` 를 exCode 없는
 * `BadRequestException` 으로 바꿔 던지므로, 컨트롤러 쪽에서는 절대 해결할 수 없고 이 전역
 * 계층이 `request.path`·`method` 만으로 접점을 재구성해 판정해야 한다
 * (spec-functions-api.md §경로·메서드 규약).
 *
 * **§자가진단 경로 은닉(회귀 3회차 [C-1]+[I-1])** — 회귀 2회차의 `isKnownRequestPath()` 는
 * 자가진단 경로를 메서드와 무관하게 무조건 "알려진 경로"로 쳤다. `PayloadTooLargeError`·깨진
 * gzip 등 exCode 없는 예외(§본문 파싱 실패의 `BadRequestException` 이 아닌 그 밖의 본문 파서
 * 오류)가 자가진단 경로에 오면 그 판정 하나 때문에 4)를 건너뛰고 5)의 `EX-OPS-002`/500 으로
 * 떨어져, 같은 예외를 던지는 디코이 경로(404)와 상태·본문이 갈리며 **인증 없는 요청 1회로
 * 경로 존재를 확증**시켰다(`SEC-003-02`·spec-functions-api.md:52-53 위반 — 코드리뷰 회귀
 * 2회차 재판정 실측, `PUT`·`GET`·`DELETE`·`HEAD`·`OPTIONS` 전 메서드 재현). 3회차는 자가진단
 * 경로를 `isKnownRequestPath()` 표에서 완전히 뺀다 — 그래서 자가진단 경로도 디코이와 똑같이
 * 4)의 대상이 된다.
 * 다만 "표에 없으면 무조건 404"만으로 되돌리면 반대 사고가 난다 — 후속 Phase 가 실 컨트롤러를
 * `known-routes.ts` 표 갱신 없이 붙였을 때, 그 컨트롤러가 던지는 미분류 예외까지 표만 보고
 * 조용히 삼켜 로그도 남기지 않는다(`OPS-003-05`·`OPS-003-03` 이탈). 그래서 4)는 "표에 없음"과
 * "라우팅에 아예 닿지 못한 실패"(본문 파서 계열, `isRoutingUnreachedFailure`) **둘 다** 참일
 * 때만 조용한 404 로 수렴시킨다 — 실제로 무언가 실행되어 던져진 예외는 표 상태와 무관하게
 * 계속 5)의 마지막 방어(500+로그)로 흘러간다. `POST` + 깨진 JSON(자가진단 자신의 정상 동작,
 * `EX-SEC-003`)은 2)에서 이미 끝나므로 이 변경의 영향을 받지 않는다.
 */
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');
  // route-guard.middleware.ts 와 같은 이유로 요청마다 다시 만들지 않고 한 번만 계산해 둔다
  // (§본문 파싱 실패 이외의 파서 오류, 회귀 2회차 I-B 에서 매 오류 응답마다 참조한다). 원본
  // `KnownRoute[]` 배열은 이 맵을 만드는 데만 쓰여 필드로 남기지 않는다(회귀 3회차 S-1 —
  // `classifyBodyParseFailure` 도 이제 배열이 아니라 이 맵을 직접 받는다, 아래 참고).
  private readonly methodsByPath: ReadonlyMap<string, ReadonlySet<string>>;

  constructor(private readonly interlockConfig: InterlockConfigService) {
    this.methodsByPath = buildMethodsByPath(buildKnownRoutes(interlockConfig.interlockEntryPath));
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<MinimalRequest>();

    // 캐시 금지 헤더 — cacheControlMiddleware 가 이미 걸었을 것이나, 이 필터가 응답을 만드는
    // 경로가 그 미들웨어 체인을 벗어나는 예외적 상황에 대비해 여기서도 재적용한다(멱등).
    applyNoStoreHeaders(response);

    const mapped = isHttpMappedError(exception) ? exception : undefined;

    if (!mapped && exception instanceof BadRequestException) {
      const handled = this.tryHandleBodyParseFailure(request, response);
      if (handled) return;
      // UNCLASSIFIED(사용자 진입 표면 등) — 아래 일반 처리로 흘러 EX-OPS-002 로 수렴한다.
    }

    if (!mapped && exception instanceof NotFoundException) {
      // 정의되지 않은 경로 — 본문 없는 일반 404(spec-functions-api.md §경로·메서드 규약,
      // SEC-003-02 "경로의 존재를 드러내지 않는 일반 404"). EX 코드를 담지 않는다.
      response.status(404).end();
      return;
    }

    // 회귀 2회차 I-B — 정의되지 않은 경로는 EX 코드 본문을 절대 만들지 않는다(SEC-003-02, 경로
    // 기준 불변식). `SyntaxError` 는 위 `BadRequestException` 분기 → `classifyBodyParseFailure`
    // 의 `NOT_FOUND` 로 이미 걸리지만, Nest 의 `mapExternalException()` 은 `SyntaxError` **만**
    // `BadRequestException` 으로 바꾼다 — `PayloadTooLargeError`(413)·gzip 해제 실패 등 그 밖의
    // 본문 파서 오류는 원형 그대로 이 지점까지 흘러 들어온다(실측 확인).
    //
    // 회귀 3회차 [C-1]+[I-1] — "경로가 표에 있는가" 하나만으로는 두 사고가 났다(파일 상단
    // §자가진단 경로 은닉 참고). ① 자가진단 경로를 무조건 표에 있는 것으로 치면 그 경로만
    // `EX-OPS-002`/500 으로 응답해 디코이(404)와 갈리는 경로 존재 오라클이 된다. ② 반대로
    // "표에 없으면 무조건 404"로 되돌리면 향후 `known-routes.ts` 표 갱신을 빠뜨린 실 컨트롤러의
    // 진짜 5xx 까지 로그 없이 삼켜진다(`OPS-003-05`·`OPS-003-03`). 그래서 **"표에 없는 경로"와
    // "라우팅에 아예 닿지 못한 실패" 둘 다 참일 때만** 조용한 404 로 수렴시킨다 — 실제로 무언가
    // 실행되어 던져진 예외는 표 상태와 무관하게 계속 아래 마지막 방어(500+로그)로 흘러간다.
    if (!mapped && !this.isKnownRequestPath(request) && this.isRoutingUnreachedFailure(exception)) {
      response.status(404).end();
      return;
    }

    const envelope = mapped
      ? buildErrorEnvelope(mapped.exCode, mapped.details ?? [])
      : buildErrorEnvelope(FALLBACK_EX_CODE); // 마지막 방어 — 카탈로그 어떤 코드로도 분류되지 않음.

    if (envelope.httpStatus >= 500) {
      // OPS-003-03 운영 로그 — 요청 처리의 기술적 실패만 남기고 금지 항목을 담지 않는다. 경로만
      // 남기고(전체 URL·쿼리 금지 — encX·encY 노출 방지, FN-015 구현 가이드) 예외 message·
      // stack 은 담지 않는다 — 분류되지 않은 예외의 message 에 어떤 값이 섞였을지 이 계층은
      // 보장할 수 없다(SEC-002-05). 4xx(사용자 입력 오류)는 일상적인 처리 결과라 로그 대상이
      // 아니다 — 5xx(기술적 실패)만 남긴다.
      this.logger.error(this.describeForLog(exception, envelope.httpStatus, request));
    }

    response.status(envelope.httpStatus).json(envelope.body);
  }

  /**
   * 본문 파싱 실패를 `classifyBodyParseFailure` 로 접점별 재분류해 응답을 완성한다. 처리했으면
   * `true` — 호출측은 더 진행하지 않는다. `UNCLASSIFIED` 면 `false` 를 돌려주고 아무 응답도
   * 만들지 않는다(호출측이 기존 마지막 방어 경로로 계속 진행한다).
   */
  private tryHandleBodyParseFailure(request: MinimalRequest, response: Response): boolean {
    const path = normalizePath(request.path ?? '');
    const method = request.method ?? '';
    const classification = classifyBodyParseFailure(
      path,
      method,
      this.methodsByPath, // 회귀 3회차 S-1 — 요청마다 buildMethodsByPath() 를 다시 만들지 않는다.
      this.interlockConfig.selfcheckPath,
      this.interlockConfig.interlockEntryPath,
    );

    switch (classification.kind) {
      case 'NOT_FOUND':
        // 정의되지 않은 경로이거나, 자가진단 경로인데 메서드가 다르다 — 본문이 깨졌다는
        // 사실과 무관하게 항상 같은 본문 없는 일반 404(SEC-003-02).
        response.status(404).end();
        return true;
      case 'METHOD_NOT_ALLOWED':
        response.set('Allow', classification.allowedMethods.join(', '));
        response.status(405).end();
        return true;
      case 'EX_CODE': {
        const envelope = buildErrorEnvelope(classification.exCode);
        response.status(envelope.httpStatus).json(envelope.body);
        return true;
      }
      case 'UNCLASSIFIED':
        return false;
    }
  }

  /**
   * `path` 가 사양이 정의한 경로 목록(§인터페이스 카탈로그 6종)에 있는지 판정한다(회귀 2회차
   * I-B). `methodsByPath` 는 메서드를 묻지 않고 "경로 자체가 알려졌는가"만 본다 — 메서드
   * 불일치는 이미 앞선 분기(route-guard 미들웨어 · `tryHandleBodyParseFailure` 의
   * `METHOD_NOT_ALLOWED`)가 405 로 먼저 걸러내므로 이 시점엔 관여하지 않는다.
   *
   * **자가진단 경로는 회귀 3회차부터 이 표에 없다([C-1] 수정).** 자가진단 경로는 애초에
   * `methodsByPath`(= `known-routes.ts`, SEC-003-02 에 따른 의도적 제외)에 없어 route-guard의
   * 405 선점을 받지 않는다 — 회귀 2회차까지는 이 메서드가 `path === selfcheckPath` 를 메서드와
   * 무관하게 더해 그 경로만 따로 "알려진 경로"로 되살렸고, 그 결과 자가진단 경로에서만
   * "라우팅에 도달하지 못한 실패"가 여전히 `EX-OPS-002`/500 으로 응답해(디코이는 404) 경로
   * 존재를 드러냈다(코드리뷰 회귀 2회차 재판정 실측 — `PUT`·`GET`·`DELETE`·`HEAD`·`OPTIONS` +
   * 대형 본문/깨진 gzip 전 메서드). `POST` + 깨진 JSON(자가진단 자신의 정상 동작, `EX-SEC-003`)
   * 은 이 메서드보다 먼저 `classifyBodyParseFailure()` 가 처리해 끝내므로 이 표에서 자가진단을
   * 완전히 빼도 영향받지 않는다 — `catch()` §자가진단 경로 은닉 참고.
   */
  private isKnownRequestPath(request: MinimalRequest): boolean {
    const path = normalizePath(request.path ?? '');
    return this.methodsByPath.has(path);
  }

  /**
   * 예외가 라우팅·컨트롤러에 도달하기도 전에 끝난 실패인지 판정한다(회귀 3회차 [I-1]). Express
   * 본문 파서(`body-parser`/`raw-body`)는 어떤 실패든 `http-errors` 의 `createError()` 로 예외를
   * 만들거나 감싸므로 `.status`(숫자)·`.expose`(불리언) 두 속성을 항상 갖는다(`http-errors`
   * 소스(`index.js` `createError()`) 직접 확인 — 새로 만드는 에러는 그 자리에서 대입하고,
   * 이미 그 모양을 갖춘 에러는 값을 유지한 채 그대로 반환한다). 반면 Nest `HttpException`(그
   * 하위의 모든 내장 예외 포함)은 `.status` 는 갖지만 `.expose` 를 어떤 경로로도 설정하지
   * 않는다(`@nestjs/common/exceptions/http.exception.js` 직접 확인) — 평범한 `Error`·`TypeError`
   * 등 애플리케이션 예외도 물론 `.expose` 가 없다. 즉 이 판정은 "본문 파서 계층의 실패"와
   * "그 밖의 모든 예외"를 안정적으로 가른다.
   *
   * 오늘(P05, 컨트롤러 0개)은 본문 파서 실패만 `catch()` 의 이 지점까지 도달할 수 있어 실제로
   * 갈리는 사례가 없다 — 후속 Phase 가 실 컨트롤러를 붙였을 때를 대비한 판정이다. 그 컨트롤러가
   * (사양상 던지면 안 되지만) exCode 없는 예외를 던지면, `known-routes.ts` 표 갱신을 빠뜨렸어도
   * `isKnownRequestPath()` 표 상태와 무관하게 마지막 방어(500+로그)로 흘러간다(`OPS-003-05`).
   */
  private isRoutingUnreachedFailure(exception: unknown): boolean {
    if (typeof exception !== 'object' || exception === null) {
      return false;
    }
    const candidate = exception as { status?: unknown; expose?: unknown };
    return typeof candidate.status === 'number' && typeof candidate.expose === 'boolean';
  }

  private describeForLog(exception: unknown, httpStatus: number, request: MinimalRequest): string {
    const exceptionName = exception instanceof Error ? exception.name : typeof exception;
    return `${request.method ?? '?'} ${request.path ?? '?'} -> ${httpStatus} (${exceptionName})`;
  }
}
