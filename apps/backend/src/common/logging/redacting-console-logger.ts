// 기동 로그의 비공개 값 노출 차단 — 값 기반 2차 방어(P12 회귀 1회차 C-1,
// process_PROC-204.md §보안 요구 "경로 값을 응답·오류 메시지·로그에 담지 않는다" `SEC-003-02`).
//
// **왜 필요한가**: `<SELFCHECK_PATH>` 는 애플리케이션 코드 어디에도 로그로 출력하는 호출이
// 없다(selfcheck.controller.ts 는 그 값을 함수 인자·클로저 밖으로 내보내지 않는다). 그런데도
// `@Post(selfcheckPath)` 로 라우트를 등록하는 것 자체가, Nest 프레임워크 내부
// `RouterExplorer`(`@nestjs/core/router/router-explorer.js`)로 하여금 기동 시
// `Mapped {<경로>, POST} route` 를 표준출력에 **자동** 기록하게 만든다(실측 확인 —
// `router-explorer.js` 가 라우트 등록마다 `this.logger.log(ROUTE_MAPPED_MESSAGE(path, method))`
// 를 직접 호출한다). 이 로그 호출은 우리 코드가 만든 것이 아니라서 정적 읽기로 검출할 수
// 없고, FN-015(`common/security/sanitize-value.ts`)의 **키 이름 기반** 방어도 원리상 닿지
// 않는다 — 로그 메시지는 "속성이 있는 객체"가 아니라 이미 조립된 문자열이라 지울 "키"가
// 없다. 그래서 이 값 기반 방어는 FN-015 와 다른 층에서 동작한다: 메시지 **문자열 안에** 주입된
// 비밀 값이 부분 문자열로 등장하는지를 본다.
//
// **주입 지점**: `NestFactory.create(module, adapter, { logger })` 의 `logger` 옵션은
// `Logger.overrideLogger()`(`@nestjs/common/services/logger.service.js`)를 거쳐
// `Logger.staticInstanceRef` 를 이 인스턴스로 바꾼다 — 이후 앱 전역에서 만들어지는 모든
// `new Logger(context)`(RouterExplorer 를 포함해 Nest 내부 전체가 이 방식을 쓴다)가 결국 이
// 인스턴스의 메서드로 위임된다(`Logger.prototype.log` → `this.localInstance.log(...)`). 즉
// 이 클래스 하나를 부트스트랩에 한 번 주입하는 것으로 **애플리케이션 수명 전체**(기동 시점의
// RouterExplorer 로그뿐 아니라 런타임 중 어떤 Nest 컴포넌트가 실수로 같은 값을 로그에 실어도)
// 에 걸쳐 값 기반 방어가 유지된다.
//
// Nest v9 부터는 `extends Logger` 로 커스텀 로거를 만드는 것을 금지한다(`Logger.overrideLogger`
// 가 "Please, use extends ConsoleLogger instead" 예외를 던진다) — 그래서 기본 콘솔 출력
// 포맷·색상·타임스탬프를 그대로 유지하는 `ConsoleLogger` 를 상속한다.
//
// **가로채는 지점 — `printMessages`/`printStackTrace`**: `ConsoleLogger` 의 `log`·`warn`·
// `debug`·`verbose`·`fatal`·`error` 여섯 메서드는 실측 확인 결과(`console-logger.service.js`)
// 전부 `printMessages()` 를 거쳐 실제 출력을 만든다(`error` 는 그 뒤에 별도로
// `printStackTrace()` 도 부른다) — 이 두 지점만 가로채면 모든 레벨·모든 호출자를 한 번에
// 덮는다.
//
// **부분 마스킹을 하지 않는다** — 비밀 값을 포함한 메시지는 (별표 등으로 값만 지우지 않고)
// 메시지 전체를 통째로 버린다. `common/security/sanitize-value.ts` 가 이미 같은 태도를 취하고
// 있다("부분 마스킹 없이 속성째 제거") — 남은 일부가 오프라인 전수대입의 탐색 공간을
// 좁히는 단서가 될 수 있어서다(`OPS-002-01`). 같은 로그 호출에 비밀 값을 담지 않은 다른
// 메시지가 함께 있으면 그 메시지만 남긴다(전체 호출을 지우지 않는다).
//
// **P12 회귀 2회차 [I-1] 시정 — 문자열이 아닌 메시지도 검사한다**: 회귀 1회차의
// `containsSecretValue` 는 `typeof message === 'string'` 인 경우만 검사하고, "객체·함수 등은
// FN-015(키 이름 기반)의 몫" 이라고 단정했다 — 이 단정은 실측 없이 세운 보호 가정이었다
// (애초에 위 `[C-1]` 을 낳은 것과 같은 유형의 오류). 실측 결과 FN-015(`sanitizeValue`,
// `common/security/sanitize-value.ts`)는 **응답 경로에만** 배선돼 있다
// (`common/errors/error-envelope.ts` 의 오류 응답 `details` 재구성, `common/interceptors/
// sanitize-response.interceptor.ts` 의 성공 응답 인터셉터) — 로그 호출부 어디에도 걸려
// 있지 않다. 즉 이 클래스가 문자열 아닌 로그 인자에 대해서도 **유일한** 방어선이다. 이 공백은
// 실제로 도달 가능하다: Nest 부트스트랩 실패 경로 — 초기화 예외를 잡는
// `ExceptionsZone.asyncRun()`(`@nestjs/core/errors/exceptions-zone.js` 실측)의
// catch 블록이 `ExceptionHandler.handle()` →
// `ExceptionHandler.logger.error(exception)`(정적 필드)를 호출하며, 이 호출부는
// **Error 객체 하나만** 인자로 넘긴다(실측 확인). 그런데 `ExceptionHandler.logger` 는
// `new Logger(ExceptionHandler.name)` 로 만들어져 **항상 컨텍스트를 가진 인스턴스**다
// (`exception-handler.js:11` 실측) — `Logger.prototype.error` 가 `optionalParams` 에
// `[undefined, context]` 를 이어 붙여(`logger.service.js` 실측) `ConsoleLogger.error`
// 가 실제로 받는 인자는 3개(`Error, undefined, 'ExceptionHandler'`)다. 이 경우
// `ConsoleLogger.getContextAndStackAndMessagesToPrint` 는 `messages.length<=1` 분기
// (`console-logger.service.js:335`)가 아니라 **마지막 원소가 `undefined` 인 분기**
// (`:341-348`)를 타 `errorStack` 을 분리하지 못한다 — `printStackTrace()` 도 타지
// 않는다는 결론은 그대로다. 문자열 전용 검사와 스택 전용 검사 **둘 다** 비켜 간다.
// `<SELFCHECK_PATH>` 형식 검증
// (`config/interlock-config.validators.ts` `isPathFormat`)이 `:`·`*`·`(` 같은
// path-to-regexp 메타문자를 막지 않으므로, 그런 값이 오면 라우트 등록 자체가 기동 예외를
// 던지고 그 Error 의 message·stack 에 경로 원문이 실린 채 바로 이 경로로 흐른다. 아래
// `containsSecretValue` 는 문자열이 아닌 값도 base 가 실제로 쓰는 것과 같은
// `this.inspectOptions` 로 `util.inspect` 해 펼친 뒤 검사한다(세부 근거는 그 메서드의 문서
// 주석).
import { inspect } from 'node:util';
import { ConsoleLogger } from '@nestjs/common';
import type { LogLevel } from '@nestjs/common';

export class RedactingConsoleLogger extends ConsoleLogger {
  private readonly secretValues: readonly string[];

  /** `secretValues` 중 빈 문자열은 제외한다 — 빈 문자열을 그대로 두면 모든 메시지가 매치돼 로그 전체가 사라진다. */
  constructor(secretValues: readonly string[]) {
    super();
    this.secretValues = secretValues.filter((value) => value.length > 0);
  }

  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
  ): void {
    const safeMessages = messages.filter((message) => !this.containsSecretValue(message));
    if (safeMessages.length === 0) {
      return; // 이 호출의 메시지 전부가 비밀 값을 담고 있었다 — 아무것도 출력하지 않는다.
    }

    // P12 회귀 2회차 [I-1] 시정 — context·errorStack 슬롯도 같은 판정을 거친다. 이 둘은
    // messages 와 달리 배열이 아니라 값 하나뿐이라 "원소 단위" 필터링이 적용되지 않는다 —
    // 오염되면 그 슬롯 값 자체를 통째로 버린다(undefined 로 치환할 뿐이다 — 값 일부만
    // 별표로 지우는 부분 마스킹이 아니라 위 §부분 마스킹을 하지 않는다 와 같은 태도). 슬롯
    // 하나가 오염됐다고 해서 이미 개별 검사를 통과한 safeMessages 까지 함께 지우지는
    // 않는다 — 이 슬롯이 안전하지 않다는 사실이 이미 안전하다고 판정된 다른 슬롯의
    // 안전성을 바꾸지 않기 때문이다(messages 배열에서 안전한 원소를 유지하는 것과 같은
    // 이유 — 과잉 차단을 피한다). context 는 보통 Nest 가
    // `new Logger('RouterExplorer')` 식으로 고정 부여하는 모듈/클래스명이라 이 경로로
    // 걸릴 일이 실질적으로 없지만, 호출 시그니처에 있는 슬롯인 이상 예외를 두지 않는다.
    const safeContext = this.containsSecretValue(context) ? undefined : context;
    const safeErrorStack = this.containsSecretValue(errorStack) ? undefined : errorStack;

    super.printMessages(safeMessages, safeContext, logLevel, writeStreamType, safeErrorStack);
  }

  /** `error()` 의 스택 트레이스 출력 — `printMessages` 와 별도 경로라 따로 가로챈다(위 파일 상단 근거). */
  protected printStackTrace(stack: string): void {
    if (this.containsSecretValue(stack)) {
      return;
    }
    super.printStackTrace(stack);
  }

  /**
   * `value` 가 화면에 찍힐 때 비밀 값을 부분 문자열로 담는지 검사한다(P12 회귀 2회차 [I-1]
   * 시정 — 위 파일 상단 근거).
   *
   * 문자열은 그대로 검사한다. 그 밖의 값(Error·일반 객체·배열 등)은
   * base(`ConsoleLogger.stringifyMessage`, `console-logger.service.js` 실측)가 실제
   * 출력을 만들 때 쓰는 것과 **동일한** `this.inspectOptions`(protected 상속 필드 —
   * `depth` 등 base 생성자가 정한 값을 그대로 공유하므로 여기서 따로 옵션을 정의·동기화할
   * 필요가 없다)로 `util.inspect` 해 그 결과 문자열을 검사한다. Error 인스턴스는
   * `stringifyMessage` 에서 접두어 없이 이 `inspect` 결과를 그대로 쓰므로(순수 객체·배열만
   * `isPlainObject`/`Array.isArray` 분기에서 `Object(N)`/`Array(N)` 접두가 붙는다 —
   * `shared.utils.js` 실측, Error 는 생성자가 `Object` 가 아니라 `isPlainObject` 가
   * false 다) base 가 실제로 찍는 텍스트와 1:1로 일치한다 —
   * `ExceptionHandler.logger.error(exception)` 처럼 Error 객체 하나만 인자로 오는 경로가
   * 이 경로로 잡힌다.
   *
   * `util.inspect` 는 순환 참조를 자체 탐지해 무한 재귀 없이 `[Circular *1]` 로 표기하고,
   * `depth`(기본 5)·`maxArrayLength`·`maxStringLength` 로 출력 크기를 유한하게 자르므로
   * (이 옵션들이 없으면 Node 자체 기본값이 적용된다 — base 의 `getInspectOptions()` 도
   * 같은 계약) 순환 참조·거대 객체에도 안전하다. base 자신도 안전 판정을 통과한 값을 실제
   * 출력할 때 같은 옵션으로 같은 값을 한 번 더 `inspect` 하므로, 이 필터가 base 보다 더 큰
   * 계산 비용을 새로 만들지는 않는다(같은 크기의 계산을 최대 한 번 더 할 뿐이다).
   *
   * **함수 값은 실행하지 않는다** — base 는 클래스가 아닌 함수 메시지를 실제로 **호출해서**
   * 그 반환값을 찍지만(`stringifyMessage` 의 `message()` 재귀 호출), 이 필터가 검사를
   * 위해 같은 함수를 먼저 호출해 버리면 부작용 있는 함수가 의도치 않게 두 번(검사 1회 +
   * base 출력 1회) 실행되거나, 로깅 안전 계층 자신이 임의 코드를 실행하는 부작용을 갖게
   * 된다 — 그 위험이 원래 막으려는 위험보다 크다고 보아 실행하지 않는 쪽을 택했다.
   * `util.inspect` 는 함수를 호출하지 않고 `[Function: name]`/`[class Name]` 형태로만
   * 보여주므로(클로저로 캡처된 값까지는 이 경로로 잡지 못하는 잔여 한계가 있다 — 함수를
   * 로그 메시지로 직접 넘기는 호출 자체가 이 코드베이스·Nest 내부 어디에도 없어 현재는
   * 이론상의 잔여 한계다) 이 필터도 실행 없이 소스 형태만 본다.
   *
   * `inspect` 자체가 던지면(커스텀 `[util.inspect.custom]` 등) 안전 여부를 판별할 수 없다
   * — 판별 불능을 "안전"으로 낙관하지 않고 **비밀 값을 포함할 수 있다**고 보수적으로
   * 판정한다(안전 우선 원칙, 위 §부분 마스킹을 하지 않는다 와 같은 태도).
   */
  private containsSecretValue(value: unknown): boolean {
    if (this.secretValues.length === 0 || value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return this.secretValues.some((secret) => value.includes(secret));
    }
    let rendered: string;
    try {
      rendered = inspect(value, this.inspectOptions);
    } catch {
      return true; // 펼쳐볼 수 없으면 안전을 낙관하지 않고 비밀 값을 담고 있다고 본다.
    }
    return this.secretValues.some((secret) => rendered.includes(secret));
  }
}
