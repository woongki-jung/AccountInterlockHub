// PROC-104 연동 실행(복호화·수신처 전달, process_PROC-104.md). 외부 표면을 갖지 않는다 —
// PROC-103(ConsentApprovalService)이 두 구간으로 나눠 호출한다(§진입점 및 진입 조건):
// - 복호화 구간(runDecryptionGate, B1·B2) — PROC-103 B2 가 동의 재검증 이전에 호출한다.
// - 전달 구간(runDeliverySegment, B3~B8) — PROC-103 B7 이 승인 확정·증적 기록 이후에 호출한다.
import { Injectable, Logger } from '@nestjs/common';
import type { ResultCode } from '../entities';
import { InterlockConfigService } from '../config/interlock-config.service';
import { DatabaseService } from '../database/database.service';
import { validateBirthDateFormat } from '../crypto/birth-date.validator';
import { judgeDecryption } from '../crypto/decryption-judgment';
import { ProtocolViolationError } from '../crypto/crypto.errors';
import type { EncPair } from '../models/enc-pair.model';
import type { TransferPayload } from '../models/transfer-payload.model';
import { MetricCounterService } from '../records/metric-counter.service';
import { TrackingRecordProcessService } from '../records/tracking-record.process';
import {
  DELIVERY_PER_ATTEMPT_TIMEOUT_MS,
  DELIVERY_RETRY_INTERVALS_MS,
  DELIVERY_TOTAL_ATTEMPTS,
} from './delivery.constants';

/** PROC-104 복호화 구간(B1·B2) 출력 — PROC-103 B2 가 소비한다. */
export interface DecryptionGateResult {
  readonly trackingKey: string;
  /** 메모리 전용(DATA-001-03) — 어떤 저장소에도 넣지 않는다. */
  readonly payload: TransferPayload;
  /** B3 전달 페이로드 구성 전용(재직렬화 금지) — B7 에서 폐기된다. */
  readonly rawPlaintext: Buffer;
}

/** PROC-104 전달 구간(B3~B8) 출력 — PROC-103 B7 이 소비한다. */
export interface DeliverySegmentResult {
  readonly resultCode: ResultCode;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class InterlockDeliveryService {
  private readonly logger = new Logger('InterlockDeliveryService');

  constructor(
    private readonly db: DatabaseService,
    private readonly trackingProcess: TrackingRecordProcessService,
    private readonly metricCounter: MetricCounterService,
    private readonly interlockConfig: InterlockConfigService,
  ) {}

  /**
   * 복호화 구간 — `B1`(FN-005 형식 검증)·`B2`(FN-004 재복호화). 앞 단계(PROC-102)의 통과 사실을
   * 신뢰하지 않는다 — 매 요청이 처음처럼 검증된다(§진입점 및 진입 조건). 인증 없음(`AUTH-001`).
   *
   * @throws {BirthDateFormatError} `EX-AUTH-001` — `B1`. 재복호화를 시도하지 않는다.
   * @throws {IdentityMismatchError} `EX-AUTH-002` — `B2` 판정 1·2단계. 본인확인 재입력으로 되돌린다.
   * @throws {ProtocolFormatError} `EX-SEC-001` — `B2` 내부 구조 판정(FN-003 경유).
   * @throws {ProtocolViolationError} `EX-SEC-002` — `B2` 판정 3·4단계. `DECRYPT_FAILED` 계수(아래).
   */
  async runDecryptionGate(input: {
    readonly encX: string | undefined;
    readonly encY: string | undefined;
    readonly birthDate: unknown;
  }): Promise<DecryptionGateResult> {
    // B1 — FN-005. 실패하면 재복호화를 시도하지 않고 그대로 전파한다(EX-AUTH-001).
    validateBirthDateFormat(input.birthDate);
    const birthDate = input.birthDate as string; // 위 호출이 던지지 않았다면 string 이 확정된다.

    // 반환 형은 EncPair(두 속성 모두 string 필수)이지만 실제로 undefined 일 수 있다 —
    // FN-003(parseCipherPair, judgeDecryption 내부 0단계)가 encPair.encX == null 로 런타임에
    // 그 경우를 검사하므로 타입 단언으로 경계를 넘긴다(entry-query.ts readEncPairFromQuery 와
    // 같은 관례). encX·encY 의 "문자열이 아닌 원시 JSON 값 → undefined" 좁히기는 호출측
    // (approve-request.dto.ts parseApproveRequestBody)이 이미 수행했다.
    const encPair = { encX: input.encX, encY: input.encY } as EncPair;

    // B2 — FN-004.
    try {
      const { payload, rawPlaintext } = judgeDecryption(encPair, birthDate);
      return { trackingKey: payload.trackingKey, payload, rawPlaintext };
    } catch (error) {
      if (error instanceof ProtocolViolationError) {
        // 판정 3·4단계 실패 — 추적 키를 얻지 못해 레코드는 만들지 않고 지표만 계수한다
        // (process_PROC-104.md B2 "catch (EX-SEC-002) → PROC-303({kind:'UNIDENTIFIED_FAILURE'})").
        // exec 를 넘기지 않는다 — 이 호출 지점은 트랜잭션을 열지 않는 자리라 넘길 실행 문맥이
        // 없다(function_FN-012-013.md FN-013 §시그니처 — LOOKUP 과 같은 원리, 누락이 아니라
        // 사양). EX-SEC-001(구조 위반)은 이 계수 대상이 아니다 — process_PROC-104.md B2 는
        // EX-SEC-002 갈래에서만 PROC-303 을 부른다.
        await this.countUnidentifiedFailure();
      }
      throw error; // EX-AUTH-002 · EX-SEC-001 · EX-SEC-002 그대로 전파(위 계수는 부수 효과일 뿐).
    }
  }

  /** 계수 실패가 응답을 막지 않는다(PROC-101 B5·entry.controller.ts countUnidentifiedFailure 와 같은 관례). */
  private async countUnidentifiedFailure(): Promise<void> {
    try {
      await this.metricCounter.recordEvent({ kind: 'UNIDENTIFIED_FAILURE', at: new Date() });
    } catch (error) {
      this.logger.error(`PROC-303 UNIDENTIFIED_FAILURE 계수 실패 — ${this.describeError(error)}`);
    }
  }

  /**
   * 전달 구간 — `B3`(페이로드 구성)~`B8`(결과 반환). **승인 확정·동의 증적 기록 이후에만**
   * 호출된다(PROC-103 `B6` 완료 후 — 증적 없는 전달을 만들지 않는다, `BIZ-003-04`). 전달 호출
   * 자체는 트랜잭션 밖이고 `B6`(결과 확정)만 새 트랜잭션을 연다 — 재시도 총 소요 상한(20초)만큼
   * 커넥션을 점유시키지 않기 위해서다.
   */
  async runDeliverySegment(trackingKey: string, rawPlaintext: Buffer): Promise<DeliverySegmentResult> {
    // B3 — 전달 페이로드 구성(POL BIZ-004-05). rawPlaintext 는 이미 UTF-8 바이트열이다 —
    // 재직렬화하지 않는다(파싱한 객체를 다시 직렬화하면 숫자 표현·유니코드 이스케이프·필드
    // 순서가 달라져 발송처가 만든 바이트열과 어긋난다).
    const url = this.interlockConfig.receiverDeliveryUrl;
    const headers = { 'Content-Type': 'application/json; charset=utf-8' } as const;

    // B4·B5 — 수신처 전달 호출 + 즉시 재시도(POL BIZ-004-01·BIZ-004-02).
    let delivered = false;
    for (let attempt = 1; attempt <= DELIVERY_TOTAL_ATTEMPTS; attempt += 1) {
      delivered = await this.attemptDelivery(url, headers, rawPlaintext);
      if (delivered) break;
      if (attempt < DELIVERY_TOTAL_ATTEMPTS) {
        // 재시도 중에도 rawPlaintext 는 메모리에만 둔다 — 큐·파일에 적재하지 않는다(DATA-001-03).
        await sleep(DELIVERY_RETRY_INTERVALS_MS[attempt - 1]);
      }
    }
    const resultCode: ResultCode = delivered ? 'SUCCESS' : 'DELIVERY_FAILED';

    // B6 — 결과 확정·기록(POL BIZ-004-03·BIZ-001-04). 경계를 여는 자리는 여기다 — PROC-301·
    // PROC-303 은 새 트랜잭션을 열지 않고 이 경계에 참여만 한다(exec = 여기서 연 client 그대로).
    await this.db.withTransaction((client) =>
      this.trackingProcess.record({
        kind: 'FIX_RESULT',
        trackingKey,
        resultCode,
        at: new Date(),
        exec: client,
      }),
    );

    // B7 — 복호화 결과 폐기(POL DATA-001-03). payload·rawPlaintext 는 이 함수도, 호출측
    // (ConsentApprovalService.submit)도 지역 변수로만 들고 있었다 — 반환·예외 발생과 함께
    // 지역 스코프를 벗어나 폐기된다. 전역 상태·요청 컨텍스트 저장소로 옮겨 담지 않는다.

    // B8 — 결과 안내 이관(호출측이 PROC-105 로 구성한다).
    return { resultCode };
  }

  /**
   * `B4` 1회 시도 + `B4`의 성공/실패 판정. 성공 판정은 HTTP 200~299 뿐이다(본문 미사용).
   * `redirect: 'manual'` 로 3xx 를 추종하지 않는다 — 추종하면 `opaqueredirect` 응답
   * (`status === 0`)이 되어 200~299 판정에서 자연히 탈락한다(데이터가 예상치 못한 곳으로 나가는
   * 것을 막는 효과와 같다). 연결 실패·이름 해석 실패·보안 연결 실패·응답 대기 상한 초과는
   * `fetch` 자체가 예외를 던지므로 하나의 catch 로 묶는다(process_PROC-104.md B4 의 catch 절과
   * 같은 분류 — `B5` 재시도로 보낸다).
   */
  private async attemptDelivery(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: Buffer,
  ): Promise<boolean> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        // 타입 충돌(실측) — 이 프로젝트의 tsconfig 는 lib 를 명시하지 않아 DOM lib 가 기본
        // 포함되고, @types/node 의 전역 fetch 선언(web-globals/fetch.d.ts)과 DOM lib 의 전역
        // fetch 선언이 오버로드로 병합된다. 두 선언이 참조하는 BodyInit/ArrayBufferView 계열
        // 제네릭 타입(TS 5.7+ 의 Uint8Array<TArrayBuffer> 변경)이 서로 완전히 맞물리지 않아
        // Buffer·Uint8Array 를 그대로 넘기면 컴파일 오류가 난다 — Node 런타임(undici)은
        // Uint8Array 본문을 아무 문제 없이 받아들인다(이 프로젝트의 의존성 변경 없이 tsconfig
        // lib 조정으로 해소 가능하나, 그 조정은 이 Phase 의 구현 항목 밖이다). 넓히는 캐스트
        // 하나로 이 호출부에만 국한해 우회한다 — 값 자체는 바뀌지 않는다(재직렬화가 아니다,
        // BIZ-004-05).
        body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as BodyInit,
        redirect: 'manual',
        signal: AbortSignal.timeout(DELIVERY_PER_ATTEMPT_TIMEOUT_MS),
      });
    } catch {
      return false;
    }
    // 응답 본문을 읽지도 저장하지도 않는다(DATA-001-04 · MDL-010 구현 가이드 — 전달한 원문이
    // 되비쳐 로그에 남을 위험을 없앤다) — 판정에 쓰지 않는 스트림을 명시적으로 취소해 커넥션을
    // 되돌려 준다(cancel() 자체의 실패는 판정에 영향을 주지 않으므로 무시한다).
    await response.body?.cancel().catch(() => undefined);
    return response.status >= 200 && response.status <= 299;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
