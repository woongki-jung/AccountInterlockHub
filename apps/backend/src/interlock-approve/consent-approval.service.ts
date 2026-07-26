// PROC-103 동의·승인 제출(process_PROC-103.md) — POST <INTERLOCK_ENTRY_PATH>/approve 의
// 오케스트레이션 지점. 재복호화·증적 기록·수신처 전달·결과 확정을 차례로 발화시킨다.
import { Injectable } from '@nestjs/common';
import { CONSENT_PROOF_TABLE, INTERLOCK_TRACKING_TABLE, InterlockTrackingModel, InterlockTrackingRow, toInterlockTrackingModel } from '../entities';
import { InterlockConfigService } from '../config/interlock-config.service';
import { DatabaseService } from '../database/database.service';
import { ConsentProofRecordService } from '../records/consent-proof-record.service';
import { TrackingRecordProcessService } from '../records/tracking-record.process';
import { ResultInfoBuilder } from '../interlock-entry/result-info.builder';
import type { ResultInfo } from '../interlock-entry/entry-initial-state.model';
import type { ApproveRequestBody } from './approve-request.dto';
import { ConsentValidationError, DeliveryFailedError, DeliveryInProgressError, LockTargetMissingError } from './approve.errors';
import { InterlockDeliveryService } from './interlock-delivery.service';

/**
 * `B6` 전달 시도 표지 검사의 트랜잭션 내부 귀결 — `withTransaction()` 밖(트랜잭션 COMMIT 후)에서
 * 200 재안내·500 `EX-BIZ-003` 여부를 가른다(process_PROC-103-logic.md B6 "COMMIT; // 아무것도
 * 쓰지 않고 잠금만 놓는다"가 분기 **이전**에 COMMIT 하므로, 예외 던지기로 트랜잭션을 되돌리지
 * 않고 정상 반환값으로 결과를 밖으로 전달한다).
 */
type ConsentProofLockOutcome =
  | { readonly kind: 'PROOF_RECORDED' }
  | { readonly kind: 'ALREADY_ATTEMPTED'; readonly locked: InterlockTrackingModel };

@Injectable()
export class ConsentApprovalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trackingProcess: TrackingRecordProcessService,
    private readonly consentProofRecord: ConsentProofRecordService,
    private readonly delivery: InterlockDeliveryService,
    private readonly resultInfoBuilder: ResultInfoBuilder,
    private readonly interlockConfig: InterlockConfigService,
  ) {}

  /**
   * `B1`(호출측 — 컨트롤러의 `parseApproveRequestBody` 가 이미 수행)부터 이어지는 `B2`~`B8`.
   * 인증 없음(`AUTH-001`) — 매 요청이 처음처럼 검증된다.
   */
  async submit(request: ApproveRequestBody): Promise<ResultInfo> {
    // B2 — 복호화 구간 호출(PROC-104 B1·B2, 동기). 실패 시 EX-AUTH-001·EX-AUTH-002·EX-SEC-001·
    // EX-SEC-002 가 그대로 전파된다(InterlockDeliveryService.runDecryptionGate 참고).
    const gate = await this.delivery.runDecryptionGate({
      encX: request.encX,
      encY: request.encY,
      birthDate: request.birthDate,
    });

    // B3 — 추적 레코드 확보(PROC-301 SECURE 호출·POL BIZ-002-03, 트랜잭션 1). 경계를 여는
    // 자리는 여기다 — exec = 여기서 연 커넥션·실행자 그대로(참여의 성립 조건). PROC-301 은
    // 이미 있으면 이어쓰기(OPEN)라 요청 수는 다시 오르지 않는다.
    const secureAt = new Date();
    const secured = await this.db.withTransaction((client) =>
      this.trackingProcess.record({ kind: 'SECURE', trackingKey: gate.trackingKey, at: secureAt, exec: client }),
    );
    // TrackingRecordProcessService.record() 는 kind 별 오버로드를 두지 않아(단일 시그니처가
    // TrackingRecordInput 전체를 받아 TrackingRecordOutput 전체를 반환) 호출 시 넘긴 리터럴
    // kind 로 반환 타입이 자동으로 좁혀지지 않는다 — 런타임 판별로 좁힌다.
    if (secured.kind !== 'SECURE') {
      throw new Error(`ConsentApprovalService: PROC-301 SECURE 가 예상과 다른 kind(${secured.kind})를 반환했다`);
    }

    // B4 — 확정 결과 재안내 분기(POL BIZ-002-04, validate).
    if (secured.branch === 'FIXED') {
      // gate.payload · gate.rawPlaintext 를 폐기한다 — 아래로 넘기지 않는다(이 분기에서 함수가
      // 끝나 지역 스코프를 벗어나며 자연히 폐기된다).
      const resultCode = secured.record.resultCode;
      if (resultCode === null) {
        // branch === 'FIXED' 는 FN-007 정의상 result_code !== null 을 함의한다(BIZ-002-03) —
        // 방어적 분기다.
        throw new Error('ConsentApprovalService: FIXED 분기인데 resultCode 가 null 이다');
      }
      // 동봉 판정은 PROC-105 B3 한 곳(returnUrl 은 경로 ① 에서만 실린다) — 여기서 다시 판정하지
      // 않는다. 갱신·계수·증적·전달 어느 것도 수행하지 않는다(이 분기에서 함수가 끝난다).
      return this.resultInfoBuilder.build({ source: 'RECORD', resultCode, isReAnnouncement: true });
    }

    // B5b — 승인 요청 재검증(POL BIZ-003-02, validate). 화면 게이팅(BR-004, 1차 방어)이 있어도
    // 서버 재검증(BR-005, 실제 게이트)을 생략하지 않는다 — 화면이 보낸 목록을 신뢰하지 않는다.
    this.revalidateConsent(request.agreedItemCodes);

    // B6 — 승인 확정·동의 증적 기록(PROC-302 호출·POL BIZ-003-04, 트랜잭션 2 — B3 와 별개의
    // 경계). 같은 추적 키의 동시 승인을 추적 레코드 행을 잠근 상태에서 직렬화하고, **그 잠금
    // 안에서 이번 레코드의 전달 시도 표지(기존 증적) 유무를 확인한다** — 잠금은 두 요청의
    // 순서만 세울 뿐 뒤선 요청을 멈추지 않으므로, 존재 검사 없이는 동시 승인 2건이 증적 2행·
    // 수신처 이중 전달을 만든다(process_PROC-103-logic.md B6 · 2026-07-26 spec 회귀 964e8d0 —
    // build tester 실측 재현, 사양 결함 5·9). B3 의 secured.record 를 재사용하지 않는다 — 그
    // 사이 상대 요청이 결과를 확정했을 수 있다.
    const lockOutcome = await this.db.withTransaction(async (client): Promise<ConsentProofLockOutcome> => {
      // 행 전체를 잠근 채로 읽는다(MDL-001 구성에 쓴다 — process_PROC-103-logic.md B6 "행 전체를
      // 읽는다"). tracking_key 뿐이던 이전 잠금 조회를 6컬럼 전체로 넓혔다 — result_code 를 알아야
      // 아래 ALREADY_ATTEMPTED 분기에서 확정 재안내와 결과 미확정을 가를 수 있다.
      const lockResult = await client.query<InterlockTrackingRow>(
        `SELECT tracking_key, result_code, result_at, result_confirmed_at, callback_received_at, created_at
         FROM ${INTERLOCK_TRACKING_TABLE}
         WHERE tracking_key = $1
         FOR UPDATE`,
        [gate.trackingKey],
      );
      const lockedRow = lockResult.rows[0];
      if (lockedRow === undefined) {
        // 방어적 분기 — B3(PROC-301 SECURE)가 이 요청 안에서 이미 행을 확보했으므로 정상
        // 호출에서는 도달하지 않는다(LockTargetMissingError 문서 주석 참고).
        throw new LockTargetMissingError();
      }
      const locked = toInterlockTrackingModel(lockedRow);

      // 전달 시도 표지 확인 — 잠금을 쥔 채로 본다. 증적은 B7 전달 직전에 커밋되므로 그 존재가
      // 곧 "이 레코드로 전달을 시도했다"는 표지다(BIZ-003-04). 이번 레코드에 속한 증적만
      // 센다 — consented_at >= 잠근 레코드의 created_at(§구현 가이드). 두 시각 모두 같은 DB
      // 시계에서 나온다 — ENT-001.created_at·ENT-002.consented_at 모두 컬럼 기본값 now() 가
      // 쓰고 어느 쪽도 응용 시계(new Date())를 싣지 않는다. B3 트랜잭션(이 행을 만든 트랜잭션)이
      // 이 트랜잭션(B6)보다 먼저 커밋되므로, consented_at >= created_at 은 시계 정합에 기대지
      // 않고 구조로 성립한다(process_PROC-103-logic.md B6 127~133행). tracking_key 만으로
      // 세면 앞선 보관 주기의 증적(EXC-BIZ-04 — 증적이 추적 레코드보다 오래 남는다)에 걸려
      // 삭제 후 재수신된 정상 연동이 영구히 승인되지 않는다(매 제출이 500 으로 끝난다). 한
      // 레코드의 생애에 승인 주기는 하나뿐이라 이 조건이 "이번 레코드에 속한 증적"과 정확히
      // 같다. tbl_consent_proof(tracking_key) 유일 제약으로 대신하지 않는다 — 같은 키의 증적이
      // 보관 주기를 넘어 공존하는 것이 정상이라(DATA-002-02) 제약 자체가 성립하지 않는다.
      const markerResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${CONSENT_PROOF_TABLE} WHERE tracking_key = $1 AND consented_at >= $2`,
        [gate.trackingKey, locked.createdAt],
      );
      const existingProofCount = Number(markerResult.rows[0]?.count ?? '0');

      if (existingProofCount > 0) {
        // 이미 전달을 시도한 승인이다 — 증적을 만들지 않고 B7 전달도 수행하지 않으며 B5b 이후
        // 단계로 내려가지 않는다. 트랜잭션은 그대로 COMMIT 한다(아무것도 쓰지 않고 잠금만
        // 놓는다 — process_PROC-103-logic.md B6). 200/500 분기는 COMMIT 뒤 트랜잭션 밖에서 한다.
        return { kind: 'ALREADY_ATTEMPTED', locked };
      }

      // exec = 여기서 연 커넥션·실행자를 그대로 넘긴다 — 행 잠금을 건 커넥션과 같아야 직렬화가
      // 성립한다(이 전달이 참여의 성립 조건이다 — ConsentProofRecordService.recordConsentProof
      // 의 시그니처는 executor 를 첫 인자로 받는다. PROC-302 는 트랜잭션을 새로 열지 않는다).
      await this.consentProofRecord.recordConsentProof(client, {
        trackingKey: gate.trackingKey,
        submission: { agreedItemCodes: request.agreedItemCodes },
        consent: this.interlockConfig.consent,
      });
      return { kind: 'PROOF_RECORDED' };
    });
    // 실패(EX-BIZ-003)는 ConsentProofRecordService 나 위 방어적 분기가 던지고 withTransaction()
    // 이 ROLLBACK 후 그대로 재전파한다 — 결과를 확정하지 않고 전달도 수행하지 않는다(이 함수가
    // 여기서 끝난다).

    if (lockOutcome.kind === 'ALREADY_ATTEMPTED') {
      // gate.payload · gate.rawPlaintext 를 폐기한다 — 아래로 넘기지 않는다(B7 를 호출하지
      // 않고 이 분기에서 함수가 끝나 지역 스코프를 벗어나며 자연히 폐기된다).
      if (lockOutcome.locked.resultCode !== null) {
        // 확정 — B4 와 완전히 같은 귀결(경로 ①·③). 새 EX 코드를 만들지 않는다.
        return this.resultInfoBuilder.build({
          source: 'RECORD',
          resultCode: lockOutcome.locked.resultCode,
          isReAnnouncement: true,
        });
      }
      // 미확정 — 선행 요청이 아직 PROC-104 전달 구간에 있다. 재시도는 안전하다 — 이 검사가
      // 다시 증적·전달을 막고, 그사이 확정됐으면 위 분기가 대신 재안내한다.
      throw new DeliveryInProgressError();
    }

    // B7 — 연동 실행 이관(PROC-104 전달 구간 호출, 동기). B3 전달 페이로드 구성 → B4 수신처
    // 전달 호출 → B5 재시도 → B6 결과 확정(PROC-301+PROC-303) → B7 원문 폐기.
    const outcome = await this.delivery.runDeliverySegment(gate.trackingKey, gate.rawPlaintext);

    // B8 — 결과 안내 이관·응답(PROC-105 호출·POL SEC-002-05, mask). 실어 보내는 값은 SUCCESS·
    // DELIVERY_FAILED 뿐이다 — 이 접점이 만드는 경로는 ①·③ 이다.
    const resultInfo = this.resultInfoBuilder.build({ source: 'RESULT_CODE', resultCode: outcome.resultCode });
    if (resultInfo.resultPath === 3) {
      // 경로 ③ — 정상 종료이며 화면이 code 로 경로를 고른다. 엔벨로프에 returnUrl 을 담지
      // 않는다(POL BIZ-001-06) — DeliveryFailedError 는 결과가 이미 확정된 뒤에 던져지므로
      // "오류"가 아니라 502 로 화면에 옮기는 절차일 뿐이다(그 클래스의 문서 주석 참고).
      throw new DeliveryFailedError();
    }
    return resultInfo; // MDL-009 그대로 — 경로 ① 이면 returnUrl 이 함께 나간다.
  }

  /**
   * `B5b` — process_PROC-103-logic.md 의 순서 그대로: **미지의 코드 검사가 먼저**, **필수
   * 미충족 검사가 나중**이다.
   *
   * ```
   * if (agreedItemCodes 에 consent.items 의 코드가 아닌 값이 있다) → 400 EX-BIZ-001
   * missing = consent.items.filter(i => i.required && !agreedItemCodes.includes(i.code))
   * if (LENGTH(missing) > 0)                        → 400 EX-BIZ-001
   * ```
   *
   * 여기서 걸러지지 않은 제출만 `PROC-302`(`ConsentProofRecordService`)에 도달한다 — 그
   * 서비스 자신도 같은 두 조건을 다시 검사하지만(FN-012 §처리 흐름 1·2), 그건 "마지막 방어"라
   * 여기까지 온 미충족 제출은 호출측 결함으로 보아 500 `EX-BIZ-003` 으로 다룬다
   * (function_FN-012-013.md FN-012 §에러 처리) — 이 함수가 그 500 을 정상 트래픽에서 막는
   * 실제 게이트다.
   */
  private revalidateConsent(agreedItemCodes: readonly string[]): void {
    const { items } = this.interlockConfig.consent;
    const validCodes = new Set(items.map((item) => item.code));
    if (agreedItemCodes.some((code) => !validCodes.has(code))) {
      throw new ConsentValidationError('AGREED_ITEM_CODES_UNKNOWN_CODE');
    }
    const missingRequired = items.some((item) => item.required && !agreedItemCodes.includes(item.code));
    if (missingRequired) {
      throw new ConsentValidationError('AGREED_ITEM_CODES_MISSING_REQUIRED');
    }
    // 선택 항목의 체크 여부는 승인을 막지 않는다(EXC-BIZ-06) — 위 두 검사 모두 선택 항목을
    // 참조하지 않는다.
  }
}
