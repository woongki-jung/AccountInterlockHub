// PROC-203 완료 콜백(process_PROC-203.md) — POST /api/interlock/callback 의 오케스트레이션
// 지점. `B1`(호출측 — 컨트롤러의 `parseTrackingKeyRequestBody` 가 이미 수행)부터 이어지는
// `B2`~`B5`. 인증 없음(AUTH-001) — 통지자가 수신처인지 확인하지 않는다(위조 통지를 막을 수단이
// 없다 — OPS-002-02 수용 리스크).
import { Injectable } from '@nestjs/common';
import { isTrackingKeyFormatValid } from '../crypto/tracking-key.validator';
import { HttpMappedException } from '../common/errors/http-mapped.error';
import { DatabaseService } from '../database/database.service';
import { TrackingRecordProcessService } from '../records/tracking-record.process';
import type { TrackingKeyRequestBody } from './tracking-key-request.dto';
import type { CompletionResponseBody } from './completion-response.model';
import { toIsoOrNull } from './iso-date';

@Injectable()
export class InterlockCallbackService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trackingProcess: TrackingRecordProcessService,
  ) {}

  async recordCallback(request: TrackingKeyRequestBody): Promise<CompletionResponseBody> {
    // B2 — FN-006 형식 판정 · POL DATA-004-03(validate). 기록을 수행하지 않고 끝낸다. 추적 키
    // 외의 필드는 애초에 이 함수 시그니처에 들어오지 않는다(DTO 가 trackingKey 하나만 추출 —
    // POL DATA-001-01).
    const { trackingKey } = request;
    if (!isTrackingKeyFormatValid(trackingKey)) {
      throw new HttpMappedException('EX-DATA-002', '연동 추적 키 형식이 올바르지 않습니다.', [
        { field: 'trackingKey', reason: 'FORMAT' },
      ]);
    }

    // B3 — 추적 키 사전 조회(PROC-301 LOOKUP 호출·POL BIZ-002-03·BIZ-002-05, validate). exec 를
    // 넘기지 않는다 — 이 자리는 아직 경계를 열지 않았다(BEGIN 은 B4 다). LOOKUP 은 단독 읽기로
    // 성립한다(process_PROC-203.md B3 — 빠뜨린 것이 아니다).
    const lookup = await this.trackingProcess.record({ kind: 'LOOKUP', trackingKey });
    if (lookup.kind !== 'LOOKUP') {
      throw new Error(`InterlockCallbackService: PROC-301 LOOKUP 이 예상과 다른 kind(${lookup.kind})를 반환했다`);
    }
    if (lookup.branch === 'NONE') {
      // 없는 레코드를 새로 만들지 않는다 · 삭제된 레코드를 되살리지 않는다.
      throw new HttpMappedException('EX-DATA-001', '해당 연동 추적 키로 진입한 요청이 없습니다.');
    }

    // B4 — 완료 콜백 기록(PROC-301 RECORD_CALLBACK 호출·BR-012·POL BIZ-001-04, 트랜잭션).
    // 경계를 여는 자리는 여기다 — exec = 여기서 연 커넥션·실행자 그대로(참여의 성립 조건).
    // result_code 를 건드리지 않는다(BR-021 — 결과 확정과 완료 통지는 다른 사실이다).
    const at = new Date();
    const recorded = await this.db.withTransaction((client) =>
      this.trackingProcess.record({ kind: 'RECORD_CALLBACK', trackingKey, at, exec: client }),
    );
    if (recorded.kind !== 'RECORD_CALLBACK') {
      throw new Error(
        `InterlockCallbackService: PROC-301 RECORD_CALLBACK 이 예상과 다른 kind(${recorded.kind})를 반환했다`,
      );
    }

    // B5 — 응답 구성 · POL DATA-004-01(mask). MDL-013 재사용(새 모델을 만들지 않는다) — 기록
    // 후이므로 isCallbackReceived 는 항상 true, callbackReceivedAt 은 최초 수신 일시(중복 통지도
    // 같은 값 — FN-011 반환 계약상 null 이 아니다).
    return {
      trackingKey,
      isCallbackReceived: true,
      callbackReceivedAt: toIsoOrNull(recorded.callbackReceivedAt),
    };
  }
}
