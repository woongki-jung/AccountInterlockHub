// PROC-101 연동 링크 진입·형식 판정 — BE B1~B7(process_PROC-101.md). 진입점
// GET <INTERLOCK_ENTRY_PATH>(spec-functions-api-user.md §연동 요청 진입). 생년월일 없이 판정
// 가능한 것만 먼저 판정하고 화면 문서를 돌려준다 — 복호화를 시도하지 않고 추적 레코드도 만들지
// 않는다(BIZ-002-02).
import { Controller, Get, Header, Logger, Req, Type } from '@nestjs/common';
import type { Request } from 'express';
import { INTERLOCK_REQUEST_URL_MAX_LENGTH_CHARS } from '../crypto/crypto.constants';
import { ProtocolFormatError } from '../crypto/crypto.errors';
import { parseCipherPair } from '../crypto/cipher-pair';
import { MetricCounterService } from '../records/metric-counter.service';
import { HARD_FALLBACK_DOCUMENT, renderEntryDocument } from './entry-document';
import { buildFullRequestUrl, readEncPairFromQuery } from './entry-query';
import { ResultInfoBuilder } from './result-info.builder';
import type { EntryInitialState } from './entry-initial-state.model';

/** B2·B4 판정 실패 사유 — process_PROC-101.md §분기 및 예외 흐름. */
type JudgmentFailureReason = 'EX-SEC-001' | 'EX-SEC-004';
/** 화면 문서에 싣는 reasonCode 전체 — 위 둘 + 분류되지 않은 내부 실패(EX-OPS-002). */
type EntryReasonCode = JudgmentFailureReason | 'EX-OPS-002';

/**
 * `<INTERLOCK_ENTRY_PATH>` 는 배포마다 달라지는 런타임 상수(OPS-001-04)라 `@Get()` 데코레이터에
 * 리터럴로 박을 수 없다 — `main.ts` 가 `loadInterlockConfig()` 로 검증을 마친 뒤에야 값을 안다.
 * `common/http/known-routes.ts`·`route-guard.middleware.ts`·`static-assets.ts` 가 이미 같은
 * 문제를 "경로를 인자로 받는 팩토리 함수"로 풀어 둔 관례가 있으나, 이 접점은 진짜 Nest
 * 컨트롤러여야 한다 — 전역 인터셉터(`SanitizeResponseInterceptor`)·전역 필터가 다른 접점과
 * 같은 파이프라인을 타야 하기 때문이다(§인계 사항 5 — 문자열 반환은 이 인터셉터를 거쳐도
 * 무손상임이 실측됐다). 그래서 데코레이터를 "런타임 값을 받아 그 자리에서 클래스에 적용하는"
 * 형태로 같은 관례를 적용한다(`config/interlock-config.module.ts` `forRoot()` 동적 모듈과 같은
 * 결의 해법 — 이 함수도 `entry.module.ts` 의 `forRoot()` 안에서만 호출된다).
 */
export function createEntryController(entryPath: string): Type<unknown> {
  @Controller()
  class EntryController {
    private readonly logger = new Logger('EntryController');

    constructor(
      private readonly metricCounter: MetricCounterService,
      private readonly resultInfoBuilder: ResultInfoBuilder,
    ) {}

    /**
     * B1~B7 전체. **가장 바깥을 try/catch 로 감싸 어떤 내부 실패도 4xx/5xx 로 새지 않게 한다**
     * (§인계 사항 3 — 진입 접점 200 폴백은 P07 배정). 안쪽 judge() 의 실패(EX-SEC-001·004)는
     * 정상 판정 결과이고, 바깥 catch 는 그 밖의 분류되지 않은 실패(EX-OPS-002 — 문서 조립·
     * 결과 안내 구성 단계의 예상 밖 오류 포함)를 흡수한다.
     */
    @Get(entryPath)
    @Header('Content-Type', 'text/html; charset=utf-8')
    async handleEntry(@Req() req: Request): Promise<string> {
      try {
        let reasonCode: EntryReasonCode | undefined;

        try {
          reasonCode = this.judge(req); // B2~B4
        } catch (error) {
          if (error instanceof ProtocolFormatError) {
            reasonCode = 'EX-SEC-001'; // B3 중복 파라미터 또는 B4 구조 위반 — 둘 다 같은 코드.
          } else {
            this.logUnexpected(req, error);
            reasonCode = 'EX-OPS-002'; // 분류되지 않은 내부 처리 실패.
          }
        }

        if (reasonCode === undefined) {
          // B6(판정 통과) — stage 외 다른 필드를 두지 않는다.
          return renderEntryDocument({ stage: 'IDENTITY' });
        }

        if (reasonCode !== 'EX-OPS-002') {
          // B5 — EX-SEC-001·EX-SEC-004 만 PROC-303 UNIDENTIFIED_FAILURE 로 계수한다. spec
          // §분기 및 예외 흐름의 EX-OPS-002 행은 계수를 언급하지 않는다 — 어디서 실패했는지
          // 특정할 수 없는 상태에서 계수를 시도하지 않는다.
          await this.countUnidentifiedFailure();
        }

        // B6(판정 실패) — PROC-105 로 결과 경로 산출 → B7 화면 문서 응답.
        const resultInfo = this.resultInfoBuilder.build({ source: 'ENTRY_FAILURE', reasonCode });
        const state: EntryInitialState = { stage: 'RESULT', reasonCode, ...resultInfo };
        return renderEntryDocument(state);
      } catch (fatalError) {
        // 문서 조립 자체(renderEntryDocument)·결과 안내 구성(resultInfoBuilder.build)이 던지는
        // 예상 밖 실패까지 흡수하는 최종 안전망 — 여기서도 4xx·5xx 를 내지 않는다.
        this.logUnexpected(req, fatalError);
        return HARD_FALLBACK_DOCUMENT;
      }
    }

    /**
     * B2(요청 URL 길이 판정)~B4(구조 판정, FN-003)를 순서대로 수행한다. 통과하면 `undefined`.
     * **길이 판정을 구조 판정보다 먼저 한다**(process_PROC-101.md §구현 가이드 — 상한을 넘은
     * URL 은 파싱 비용을 들일 이유가 없다).
     *
     * @throws {ProtocolFormatError} B3(파라미터 중복)·B4(FN-003 구조 위반) — 둘 다 `EX-SEC-001`.
     */
    private judge(req: Request): JudgmentFailureReason | undefined {
      // B2. 요청 URL 길이 판정 — POL SEC-001-10.
      const fullUrl = buildFullRequestUrl(req);
      if (fullUrl.length > INTERLOCK_REQUEST_URL_MAX_LENGTH_CHARS) {
        return 'EX-SEC-004';
      }

      // B3. 진입 파라미터 파싱 — 대소문자 구분·중복 거부(POL SEC-001-08). 중복이면
      // ProtocolFormatError 를 던진다(호출측이 EX-SEC-001 로 흡수).
      const encPair = readEncPairFromQuery(req.query);

      // B4. 진입 파라미터 구조 판정 — FN-003. 복호화를 시도하지 않는다(생년월일이 없다).
      // 판정 결과(cipher 바이트열)는 이 단계 이후 쓰지 않고 버린다(DATA-001-03).
      parseCipherPair(encPair);

      return undefined; // 판정 통과.
    }

    /** B5 — PROC-303 호출(FN-013 `UNIDENTIFIED_FAILURE`). 실패해도 응답을 막지 않는다(OPS-003-03). */
    private async countUnidentifiedFailure(): Promise<void> {
      try {
        // UNIDENTIFIED_FAILURE 계기는 executor 를 생략한다 — 이 호출 지점(PROC-101 B5)은
        // 트랜잭션을 열지 않는 자리라 넘길 실행 문맥이 없다(records/metric-counter.service.ts
        // 자신의 문서 주석 — "그 계기의 호출 지점(PROC-101 B5·PROC-102 B4b·PROC-104 B2)은
        // 호출측이 트랜잭션을 열지 않는 자리라 넘길 실행 문맥이 없고... 생략 시 커넥션 풀에서
        // 단독 갱신한다"). LOOKUP 과 같은 원리로 exec 를 억지로 채워 넣지 않는다.
        await this.metricCounter.recordEvent({ kind: 'UNIDENTIFIED_FAILURE', at: new Date() });
      } catch (error) {
        this.logger.error(`PROC-303 UNIDENTIFIED_FAILURE 계수 실패 — ${this.describeError(error)}`);
      }
    }

    /**
     * 내부 사유·스택을 담지 않는다(OPS-003-05) — 예외 이름만, 요청 URL 전체가 아니라 경로만
     * 남긴다(FN-015 §구현 가이드 "요청 URL 을 로그에 남기지 않는다. 필요하면 경로만 남긴다" —
     * URL 자체가 encX·encY 를 담고 있다).
     */
    private logUnexpected(req: Request, error: unknown): void {
      this.logger.error(`GET ${req.path} -> 200(EX-OPS-002 폴백) (${this.describeError(error)})`);
    }

    private describeError(error: unknown): string {
      return error instanceof Error ? error.name : typeof error;
    }
  }

  return EntryController;
}
