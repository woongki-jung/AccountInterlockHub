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
    super.printMessages(safeMessages, context, logLevel, writeStreamType, errorStack);
  }

  /** `error()` 의 스택 트레이스 출력 — `printMessages` 와 별도 경로라 따로 가로챈다(위 파일 상단 근거). */
  protected printStackTrace(stack: string): void {
    if (this.containsSecretValue(stack)) {
      return;
    }
    super.printStackTrace(stack);
  }

  private containsSecretValue(message: unknown): boolean {
    if (typeof message !== 'string') {
      return false; // 이 방어는 문자열 메시지만 본다 — 객체·함수 등은 FN-015(키 이름 기반)의 몫이다.
    }
    return this.secretValues.some((secret) => message.includes(secret));
  }
}
