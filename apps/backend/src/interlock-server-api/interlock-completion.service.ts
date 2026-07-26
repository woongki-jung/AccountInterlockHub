// PROC-202 연동 완료 확인(process_PROC-202.md) — POST /api/interlock/completion 의
// 오케스트레이션 지점. `B1`(호출측 — 컨트롤러의 `parseTrackingKeyRequestBody` 가 이미 수행)부터
// 이어지는 `B2`~`B5`. 인증 없음(AUTH-001). **읽기 전용** — 어떤 컬럼도 갱신하지 않아 보관
// 기산을 시작시키지 않는다(SVC-011 F-006) — DatabaseService 를 주입하지 않는다(트랜잭션을 열
// 자리가 없다).
import { Injectable } from '@nestjs/common';
import { isTrackingKeyFormatValid } from '../crypto/tracking-key.validator';
import { HttpMappedException } from '../common/errors/http-mapped.error';
import { TrackingRecordProcessService } from '../records/tracking-record.process';
import type { TrackingKeyRequestBody } from './tracking-key-request.dto';
import type { CompletionResponseBody } from './completion-response.model';
import { toIsoOrNull } from './iso-date';

@Injectable()
export class InterlockCompletionService {
  constructor(private readonly trackingProcess: TrackingRecordProcessService) {}

  async getCompletion(request: TrackingKeyRequestBody): Promise<CompletionResponseBody> {
    // B2 — FN-006 형식 판정 · POL DATA-004-03(validate).
    const { trackingKey } = request;
    if (!isTrackingKeyFormatValid(trackingKey)) {
      throw new HttpMappedException('EX-DATA-002', '연동 추적 키 형식이 올바르지 않습니다.', [
        { field: 'trackingKey', reason: 'FORMAT' },
      ]);
    }

    // B3 — 추적 키 사전 조회(PROC-301 LOOKUP 호출·POL BIZ-002-05, validate). exec 없음 — 트랜잭션을
    // 열지 않는 읽기 전용 접점이다.
    const lookup = await this.trackingProcess.record({ kind: 'LOOKUP', trackingKey });
    if (lookup.kind !== 'LOOKUP') {
      throw new Error(`InterlockCompletionService: PROC-301 LOOKUP 이 예상과 다른 kind(${lookup.kind})를 반환했다`);
    }
    if (lookup.branch === 'NONE') {
      throw new HttpMappedException('EX-DATA-001', '해당 연동 추적 키로 진입한 요청이 없습니다.');
    }
    const record = lookup.record;
    if (record === null) {
      throw new Error('InterlockCompletionService: NONE 이 아닌 branch 인데 record 가 null 이다');
    }

    // B4 — 완료 판정(validate). 완료 콜백 수신 여부 하나만 본다 — 결과 구분·처리 성공 여부를
    // 함께 보지 않는다(record.isCallbackReceived 는 FN-007 의 ENT→도메인 변환이 이미 산출했다).
    // 레코드를 갱신하지 않는다 — 이 조회는 보관 기산을 시작시키지 않는다(SVC-011 F-006).

    // B5 — 응답 구성 · POL DATA-004-01(mask). 결과 구분·처리 일시·결과 확인 상태를 담지 않는다.
    return {
      trackingKey,
      isCallbackReceived: record.isCallbackReceived,
      callbackReceivedAt: toIsoOrNull(record.callbackReceivedAt),
    };
  }
}
