// PROC-201 처리상태 확인(process_PROC-201.md) — POST /api/interlock/status 의 오케스트레이션
// 지점. `B1`(호출측 — 컨트롤러의 `parseTrackingKeyRequestBody` 가 이미 수행)부터 이어지는
// `B2`~`B6`. 인증 없음(AUTH-001) — 매 요청이 처음처럼 검증된다.
import { Injectable } from '@nestjs/common';
import { isTrackingKeyFormatValid } from '../crypto/tracking-key.validator';
import { HttpMappedException } from '../common/errors/http-mapped.error';
import { DatabaseService } from '../database/database.service';
import { TrackingRecordProcessService } from '../records/tracking-record.process';
import type { TrackingKeyRequestBody } from './tracking-key-request.dto';
import type { StatusResponseBody } from './status-response.model';
import { toIsoOrNull } from './iso-date';

@Injectable()
export class InterlockStatusService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trackingProcess: TrackingRecordProcessService,
  ) {}

  async getStatus(request: TrackingKeyRequestBody): Promise<StatusResponseBody> {
    // B2 — FN-006 형식 판정 · POL DATA-004-03(validate). 위반이면 조회를 수행하지 않고 끝낸다.
    const { trackingKey } = request;
    if (!isTrackingKeyFormatValid(trackingKey)) {
      throw new HttpMappedException('EX-DATA-002', '연동 추적 키 형식이 올바르지 않습니다.', [
        { field: 'trackingKey', reason: 'FORMAT' },
      ]);
      // details 에 값 자체를 담지 않는다(FN-014 §구현 가이드).
    }
    // 위 가드를 통과했으면 타입 가드(trackingKey is string)로 string 이 확정된다. 이하 입력값을
    // 그대로 쓴다 — 정규화하지 않는다(DATA-004-01).

    // B3 — 추적 키 사전 조회(PROC-301 LOOKUP 호출·POL BIZ-002-05·DATA-002-05, validate). exec 를
    // 넘기지 않는다 — 이 자리는 아직 경계를 열지 않았다(BEGIN 은 B5 다). LOOKUP 은 단독 읽기로
    // 성립한다(process_PROC-201.md B3 — 빠뜨린 것이 아니다).
    const lookup = await this.trackingProcess.record({ kind: 'LOOKUP', trackingKey });
    if (lookup.kind !== 'LOOKUP') {
      // TrackingRecordProcessService.record() 는 kind 별 오버로드를 두지 않아 반환 타입이 자동으로
      // 좁혀지지 않는다 — 런타임 판별로 좁힌다(identity-verification.service.ts 와 같은 관례).
      throw new Error(`InterlockStatusService: PROC-301 LOOKUP 이 예상과 다른 kind(${lookup.kind})를 반환했다`);
    }
    if (lookup.branch === 'NONE') {
      // 미진입과 보관 만료 삭제를 구별하지 않는다(DATA-002-05).
      throw new HttpMappedException('EX-DATA-001', '해당 연동 추적 키로 진입한 요청이 없습니다.');
    }
    const record = lookup.record;
    if (record === null) {
      // FN-007 계약상 branch !== 'NONE' 이면 record 는 항상 채워진다 — 방어적 분기.
      throw new Error('InterlockStatusService: NONE 이 아닌 branch 인데 record 가 null 이다');
    }

    // B4 — 응답 값 산출 · POL BIZ-001-03(mask). 결과 구분·처리 성공 여부는 변환 없이 그대로
    // 싣는다(record.isSuccess·record.resultCode 는 FN-007 의 ENT→도메인 변환이 이미 산출했다).
    let isResultConfirmed = record.isResultConfirmed;
    let resultConfirmedAt = record.resultConfirmedAt;

    // B5 — 결과 확인 표시(PROC-301 CONFIRM_RESULT 호출·POL DATA-002-01 ①·BR-010, 트랜잭션).
    // §결과 확인 표시 판정 기준(function_FN-009-011.md) = "응답의 resultCode 가 null 이 아닌
    // 경우"에만 최초 1회 기록한다.
    if (record.resultCode !== null) {
      const at = new Date();
      // 경계를 여는 자리는 여기다 — exec = 여기서 연 커넥션·실행자 그대로(참여의 성립 조건).
      // 실패(EX-BIZ-003)는 withTransaction() 이 롤백 후 그대로 던진다 — 이 아래로 내려오지
      // 않아 200 응답도 나가지 않는다(B4~B6 이 같은 처리 경계 — "표시가 실패하면 응답도 내보내지
      // 않는다").
      const confirmed = await this.db.withTransaction((client) =>
        this.trackingProcess.record({ kind: 'CONFIRM_RESULT', trackingKey, at, exec: client }),
      );
      if (confirmed.kind !== 'CONFIRM_RESULT') {
        throw new Error(
          `InterlockStatusService: PROC-301 CONFIRM_RESULT 가 예상과 다른 kind(${confirmed.kind})를 반환했다`,
        );
      }
      resultConfirmedAt = confirmed.confirmedAt;
      isResultConfirmed = true;
    }
    // else — 결과 미확정 레코드 조회는 표시하지 않는다(갱신하지 않는다) — 발송처가 결과를 받아
    // 간 것이 아니다.

    // B6 — 응답 송출 · POL DATA-004-01(mask). 추적 키는 입력값 그대로 · 그 밖의 금지 값은 담을
    // 속성이 모델에 없다.
    return {
      trackingKey,
      isSuccess: record.isSuccess,
      resultCode: record.resultCode,
      isResultConfirmed,
      resultAt: toIsoOrNull(record.resultAt),
      resultConfirmedAt: toIsoOrNull(resultConfirmedAt),
    };
  }
}
