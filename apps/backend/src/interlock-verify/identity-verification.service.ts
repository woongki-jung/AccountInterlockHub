// PROC-102 본인확인(복호화 판정, process_PROC-102.md) — POST <INTERLOCK_ENTRY_PATH>/verify 의
// 오케스트레이션 지점. 복호화 판정 4단계 → 추적 레코드 확보(PROC-301, 같은 트랜잭션에서 PROC-303
// 요청 수 계수까지) → 확정 결과 재안내 분기 또는 동의 항목 구성 응답을 차례로 수행한다.
import { Injectable, Logger } from '@nestjs/common';
import { InterlockConfigService } from '../config/interlock-config.service';
import { DatabaseService } from '../database/database.service';
import { validateBirthDateFormat } from '../crypto/birth-date.validator';
import { judgeDecryption } from '../crypto/decryption-judgment';
import { ProtocolFormatError, ProtocolViolationError } from '../crypto/crypto.errors';
import { MetricCounterService } from '../records/metric-counter.service';
import { TrackingRecordProcessService } from '../records/tracking-record.process';
import { ResultInfoBuilder } from '../interlock-entry/result-info.builder';
import { toEncPair } from './verify-request.dto';
import type { VerifyRequestBody } from './verify-request.dto';
import type { VerifyResponseBody } from './verify-response.model';

@Injectable()
export class IdentityVerificationService {
  private readonly logger = new Logger('IdentityVerificationService');

  constructor(
    private readonly db: DatabaseService,
    private readonly trackingProcess: TrackingRecordProcessService,
    private readonly metricCounter: MetricCounterService,
    private readonly resultInfoBuilder: ResultInfoBuilder,
    private readonly interlockConfig: InterlockConfigService,
  ) {}

  /**
   * `B1`(호출측 — 컨트롤러의 `parseVerifyRequestBody` 가 이미 수행)부터 이어지는 `B2`~`B8`.
   * 인증 없음(`AUTH-001`) — 앞 단계(PROC-101)의 통과 사실도 신뢰하지 않고 매 요청이 처음처럼
   * 검증된다(§진입점 및 진입 조건 — 세션이 없다).
   */
  async submit(request: VerifyRequestBody): Promise<VerifyResponseBody> {
    // B2~B5 — 입력 검증·복호화 판정·추적 키 추출(+ 실패 분류·계수).
    const trackingKey = await this.runIdentityCheckGate(request);

    // B6 — 추적 레코드 확보(PROC-301 SECURE 호출·POL BIZ-002-01·BIZ-002-03, 트랜잭션 시작).
    // 경계를 여는 자리는 여기다 — exec = 여기서 연 커넥션·실행자 그대로(참여의 성립 조건).
    // PROC-301 이 이미 있으면 이어쓰기(OPEN)라 요청 수는 다시 오르지 않는다. 최초 생성이면
    // PROC-301 B3 내부에서 이미 PROC-303({kind:'REQUEST'}, exec) 를 같은 트랜잭션으로 호출한다
    // (records/tracking-record.service.ts `secure()` 참고 — 이 계층이 따로 부르지 않는다).
    const at = new Date();
    const secured = await this.db.withTransaction((client) =>
      this.trackingProcess.record({ kind: 'SECURE', trackingKey, at, exec: client }),
    );
    // TrackingRecordProcessService.record() 는 kind 별 오버로드를 두지 않아(단일 시그니처가
    // TrackingRecordInput 전체를 받아 TrackingRecordOutput 전체를 반환) 호출 시 넘긴 리터럴
    // kind 로 반환 타입이 자동으로 좁혀지지 않는다 — 런타임 판별로 좁힌다
    // (interlock-approve/consent-approval.service.ts 와 같은 관례).
    if (secured.kind !== 'SECURE') {
      throw new Error(`IdentityVerificationService: PROC-301 SECURE 가 예상과 다른 kind(${secured.kind})를 반환했다`);
    }

    // B7 — 확정 결과 재안내 분기(POL BIZ-002-03 ③ · BIZ-002-04, validate).
    if (secured.branch === 'FIXED') {
      const resultCode = secured.record.resultCode;
      if (resultCode === null) {
        // branch === 'FIXED' 는 FN-007 정의상 result_code !== null 을 함의한다(BIZ-002-03) —
        // 방어적 분기다.
        throw new Error('IdentityVerificationService: FIXED 분기인데 resultCode 가 null 이다');
      }
      // 레코드를 갱신하지 않는다(보관 기산점이 밀리지 않는다) · 요청 수를 계수하지 않는다
      // (POL BIZ-005-03) — 이 분기가 별도 쓰기를 하지 않는 것 자체로 그 불변식을 지킨다.
      // 동봉 판정은 PROC-105 B3 한 곳(returnUrl 은 경로 ① 에서만 실린다) — 여기서 다시 판정하지
      // 않는다.
      const resultInfo = this.resultInfoBuilder.build({ source: 'RECORD', resultCode, isReAnnouncement: true });
      return { stage: 'RESULT', ...resultInfo };
    }

    // B8 — 동의 항목 구성 응답(POL DATA-003-01 · SEC-002-05, mask). PROC-901 이 기동 시 산출한
    // MDL-008 을 그대로 읽는다(재파싱하지 않는다) — 필드 셋을 명시로 다시 골라 담아 향후
    // ConsentConfig 에 필드가 늘어도 의도치 않게 새 값이 새지 않게 한다.
    const { version, notice, items } = this.interlockConfig.consent;
    return { stage: 'CONSENT', consent: { version, notice, items } };
  }

  /**
   * `B2`(FN-005 입력 검증)~`B5`(추적 키 추출·원문 즉시 폐기)를 수행한다. 실패하면 `B4a`
   * (`EX-AUTH-002` — 계수 없이 그대로 전파) 또는 `B4b`(`EX-SEC-001`·`EX-SEC-002` — PROC-303
   * `UNIDENTIFIED_FAILURE` 계수 후 전파)로 갈린다.
   *
   * `judgeDecryption()` 이 반환하는 `rawPlaintext`(P09 확장분 — PROC-104 B3 전용, 재직렬화 없는
   * 전달 페이로드 구성에만 필요)는 이 접점에 필요 없다 — **구조 분해에서 아예 받지 않는다.**
   * 받으면 그 뒤로 "로그·응답에 싣지 않는다"는 책임이 새로 생기므로, 애초에 참조를 만들지 않는
   * 편이 가장 안전한 차단이다(민감 원문 — `judgeDecryption` 문서 주석 · PROC-102 착수 전 인계
   * 참고).
   */
  private async runIdentityCheckGate(request: VerifyRequestBody): Promise<string> {
    // B2 — FN-005. 실패하면 복호화를 시도하지 않고 그대로 전파한다(400 EX-AUTH-001).
    validateBirthDateFormat(request.birthDate);
    const birthDate = request.birthDate as string; // 위 호출이 던지지 않았다면 string 이 확정된다.

    const encPair = toEncPair(request);

    // B3 — FN-004(복호화 판정 4단계, 내부에서 FN-003·FN-001·FN-006 을 호출한다).
    try {
      const { payload } = judgeDecryption(encPair, birthDate);
      // B5 — 추적 키만 취하고 payload(및 그 안의 X 나머지 필드)는 이 지역 스코프를 벗어나며
      // 폐기된다(POL BIZ-002-06 · DATA-004-01) — 별도로 저장·전역화하지 않는다.
      return payload.trackingKey;
    } catch (error) {
      // B4b — EX-SEC-001(구조 위반)·EX-SEC-002(판정 3·4단계 실패) 둘 다 추적 키를 알 수 없어
      // 레코드를 만들지 않고 지표만 계수한다(process_PROC-102-logic.md B4b — PROC-104 B2 와
      // 달리 **EX-SEC-001 도 계수 대상**이다. 진입 단계에서 이미 계수됐을 수 있으나 같은
      // 요청인지 판정할 수단이 없어 시도마다 계수되는 중복은 수용 한계다 — POL BIZ-005-05).
      if (error instanceof ProtocolFormatError || error instanceof ProtocolViolationError) {
        await this.countUnidentifiedFailure();
      }
      // B4a — EX-AUTH-002(판정 1·2단계 실패, 생년월일 불일치와 구별 불가)는 결과 구분을
      // 확정하지 않고 추적 레코드·지표 어느 것도 건드리지 않는다(POL BIZ-001-05) — 계수 없이
      // 그대로 전파한다.
      throw error;
    }
  }

  /** B4b — PROC-303 호출(FN-013 `UNIDENTIFIED_FAILURE`). 계수 실패가 응답을 막지 않는다(OPS-003-03). */
  private async countUnidentifiedFailure(): Promise<void> {
    try {
      // UNIDENTIFIED_FAILURE 계기는 executor 를 생략한다 — 이 호출 지점(PROC-102 B4b)은
      // 트랜잭션을 열지 않는 자리라 넘길 실행 문맥이 없다(LOOKUP 과 같은 원리 — records/
      // metric-counter.service.ts 자신의 문서 주석 "그 계기의 호출 지점(PROC-101 B5·PROC-102
      // B4b·PROC-104 B2)은 호출측이 트랜잭션을 열지 않는 자리라 넘길 실행 문맥이 없고... 생략
      // 시 커넥션 풀에서 단독 갱신한다"). exec 를 억지로 채워 넣지 않는다.
      await this.metricCounter.recordEvent({ kind: 'UNIDENTIFIED_FAILURE', at: new Date() });
    } catch (error) {
      this.logger.error(`PROC-303 UNIDENTIFIED_FAILURE 계수 실패 — ${this.describeError(error)}`);
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }
}
