import { Injectable } from '@nestjs/common';
import { TrackingRecordService } from './tracking-record.service';
import { RecordWriteError } from './records.errors';
import { TRACKING_RECORD_KIND_VALUES, TrackingRecordInput, TrackingRecordOutput } from './tracking-record.types';

/**
 * PROC-301 연동 추적 기록(process_PROC-301.md) — `kind` 기준 진입점(§진입점 및 진입 조건).
 * 본 프로세스는 외부 표면을 갖지 않는다 — **상위 프로세스가 기록 계기(`kind`)를 붙여 호출**한다.
 *
 * FN-007~011(tracking-record.service.ts, P04)이 이미 PROC-301 `B2`~`B6` 각 단계의 구현이다 — 그
 * 파일 자신의 문서 주석이 "메서드명은 PROC-301 §진입점의 kind 값과 그대로 대응시켰다 … 그 kind
 * 디스패처(PROC-301 자체의 배선)는 후속 Phase 소관"이라고 명시한 대로, 이 클래스가 그 배선이다
 * (P06 — accountinterlockhub#483). `B1`(기록 계기 수신 — kind·resultCode 재검증)과 `B7`(기록 결과
 * 반환 — 계기별 반환 값 조립)만 이 계층에 새로 추가되고, `B2`~`B6` 실행 자체는 전부 기존 서비스
 * 메서드에 위임한다(계층 분리 — 같은 판정을 두 곳에 두지 않는다).
 *
 * PROC-302·PROC-303 은 이런 별도 디스패처가 없다 — 두 프로세스 모두 진입 계기가 하나뿐이라(PROC-302
 * 는 PROC-103 `B6` 유일, PROC-303 은 kind 분기가 이미 FN-013 자신의 시그니처에 있다) `B1`~`B4`(또는
 * `B5`) 전체가 이미 FN-012(`ConsentProofRecordService.recordConsentProof`)·FN-013
 * (`MetricCounterService.recordEvent`) 하나로 완결된다 — 새 코드가 필요 없다(완료 보고 참고).
 *
 * §진입점 표(process_PROC-301.md) — 이 메서드가 그대로 구현하는 다섯 경로:
 * | kind             | 수행 단계         | exec 필수 | at 필수 |
 * |------------------|--------------------|-----------|---------|
 * | LOOKUP           | B1 → B2 → B7       | 아니오(생략 시 커넥션 풀 단독 조회) | 아니오 |
 * | SECURE           | B1 → B2 → B3 → B7  | 예        | 예      |
 * | FIX_RESULT       | B1 → B4 → B7       | 예        | 예      |
 * | CONFIRM_RESULT   | B1 → B5 → B7       | 예        | 예      |
 * | RECORD_CALLBACK  | B1 → B6 → B7       | 예        | 예      |
 */
@Injectable()
export class TrackingRecordProcessService {
  constructor(private readonly tracking: TrackingRecordService) {}

  /**
   * `B1` 기록 계기 수신 → 계기별 `B2`~`B6` 하나로 분기 → `B7` 기록 결과 반환.
   *
   * 트랜잭션 경계는 이 메서드도 열지 않는다(process_PROC-301.md §실행 제약사항 "호출측 트랜잭션에
   * 참여한다 · 새 트랜잭션을 열지 않는다") — `exec` 를 그대로 하위 서비스 메서드에 전달할 뿐이다.
   */
  async record(input: TrackingRecordInput): Promise<TrackingRecordOutput> {
    // B1. 기록 계기 수신 — 입력 재검증(process_PROC-301.md B1).
    //   TrackingRecordInput 은 식별 유니온이라 TS 호출부는 이미 kind 5종으로 제한되지만, 이 메서드는
    //   PROC-301 의 유일한 진입점이라 비-TS 경계(향후 컨트롤러·다른 언어 호출부 등)에서도 불릴 수
    //   있어 런타임 방어를 유지한다(metric-counter.service.ts 의 같은 관례).
    if (!TRACKING_RECORD_KIND_VALUES.includes(input.kind)) {
      throw new RecordWriteError('TRACKING_RECORD_INVALID_KIND');
    }
    // exec 는 LOOKUP 외 전부 필수다(§입력/출력 정의). TS 타입이 이미 강제하지만, 같은 이유로 런타임
    // 가드도 둔다 — 누락 시 하위 메서드가 `executor.query is not a function` 류의 불명확한 TypeError
    // 로 실패하는 대신, 이 계층에서 바로 원인을 특정해 던진다(이 이음매를 놓치면 "자기 스냅샷 밖을
    // 읽는다"는 인계 경고 그대로 재현된다).
    if (input.kind !== 'LOOKUP' && input.exec === undefined) {
      throw new RecordWriteError('TRACKING_RECORD_MISSING_EXEC');
    }

    switch (input.kind) {
      case 'LOOKUP': {
        // B1 → B2 → B7 — FN-007 하나만 수행한다.
        const result = await this.tracking.lookup(input.trackingKey, input.exec);
        return { kind: 'LOOKUP', ...result };
      }
      case 'SECURE': {
        // B1 → B2 → B3 → B7 — secure() 가 사전 조회(FN-007)와 확보(FN-008)를 함께 수행한다
        // (FN-008 처리 흐름 1단계가 곧 FN-007 호출이다 — 이 계층에서 따로 lookup 을 앞세우지 않는다).
        const result = await this.tracking.secure(input.exec, input.trackingKey, input.at);
        return { kind: 'SECURE', ...result };
      }
      case 'FIX_RESULT': {
        // B1 → B4 → B7. resultCode 3종 재검증은 FN-009(fixResult) 자신이 이미 수행한다
        // (FIX_RESULT_INVALID_RESULT_CODE) — 같은 판정을 이 계층에 다시 두지 않는다(계층 분리).
        const record = await this.tracking.fixResult(input.exec, input.trackingKey, input.resultCode, input.at);
        return { kind: 'FIX_RESULT', record };
      }
      case 'CONFIRM_RESULT': {
        // B1 → B5 → B7.
        const confirmedAt = await this.tracking.confirmResult(input.exec, input.trackingKey, input.at);
        return { kind: 'CONFIRM_RESULT', confirmedAt };
      }
      case 'RECORD_CALLBACK': {
        // B1 → B6 → B7.
        const callbackReceivedAt = await this.tracking.recordCallback(input.exec, input.trackingKey, input.at);
        return { kind: 'RECORD_CALLBACK', callbackReceivedAt };
      }
    }
  }
}
