import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AuditService } from '../../common/audit/audit.service';
import { maskToken } from '../../common/audit/masking.util';
import { AppException } from '../../common/envelope/app.exception';

/**
 * 처리상태 조회·결과확인 갱신 서비스 — PROC-301 B4~B6 / FN-009(findByKey·confirmResult)·FN-010(응답 선별).
 *
 * 서비스 A 가 연동 추적 키로 처리·결과 확인 상태를 조회하는 API(API-01)의 도메인 계층이다.
 * 인증(FN-004)·요청제한(FN-014)·연동 추적 키 형식 검증(FN-007)은 상위(가드·컨트롤러)가 선행하고, 본 서비스는
 * 형식 검증을 통과한 연동 추적 키로 다음을 수행한다.
 *  - FN-009_findByKey(PROC-301 B4): (tracking_key, processed_at DESC) 최신 1건 조회(IX_STATUS_TRACKING —
 *    추적 키는 비유니크·재사용 대비, EXC-BIZ-12). 미존재(만료 삭제 포함) → 404 EX-DATA-003.
 *  - FN-009_confirmResult(PROC-401 / BR-301, 멱등): 최초 조회(is_result_confirmed=false)일 때만 내부
 *    surrogate `id` 대상 조건절 가드 UPDATE 로 결과 확인 여부·일시를 1회 갱신한다 — tracking_key 가 아닌
 *    id 로 스코프해 동일 추적 키를 공유하는 다른 행까지 오갱신하지 않는다. 재조회는 갱신 없이 현재 상태 반환.
 *  - FN-010_selectStatusResponse(MDL-302 / SEC-005-02): 상태 4항목 + 추적 키 에코(원문, 발송처 자신의 값)만
 *    담아 반환한다. configId·회원 키·개인정보 필드는 응답에서 원천 배제한다.
 *  - 조회 감사(STATUS_CHECK, OPS-002 적용 PROC-301) — 추적 키는 FN-010 마스킹(앞2·뒤2)해 target 에 남긴다
 *    (SEC-005-04). COMPLETION_CHECK(PROC-302)와 대칭 — PROC-301 BE 의사코드에 별도 FN-013 호출이
 *    명시되어 있지 않으나, OPS-002 적용 PROC 목록에 PROC-301 이 포함되어 있어 대칭 적용한다(완료 보고 WARN).
 *
 * `#214` 로 조회 키가 구 요청 키값(request_key PK)에서 연동 추적 키(tracking_key, 비유니크 조회 인덱스) +
 * 내부 surrogate uuid `id`(PK)로 전환됐다(ENT-004 §키 설계) — P5 가 저장(INSERT) 측을 재키잉했고, 본 Phase(P7)가
 * 조회·갱신(SELECT·UPDATE) 측을 재키잉해 스키마 정합을 완결한다.
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 조회는 단순 SELECT, 갱신은 단건 UPDATE(멱등 가드).
 * 반환값은 상위 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */

// ENT-004(TBL_INTERLOCK_PROCESS_STATUS) 조회 행. id 는 결과 확인 갱신 UPDATE 의 스코프 대상(surrogate PK).
// config_id 는 갱신 판정·매핑에 관여하지 않으나 스키마·조회 쿼리 정합을 위해 SELECT 하며 응답으로는
// 반출하지 않는다(SEC-005-02).
interface ProcessStatusRow {
  id: string;
  tracking_key: string;
  config_id: string;
  is_success: boolean;
  is_result_confirmed: boolean;
  processed_at: Date | string;
  result_confirmed_at: Date | string | null;
}

/**
 * 처리상태 조회 응답(MDL-302, ProcessStatusResponse) — 상태 4항목 + 연동 추적 키 에코.
 * configId·회원 키·개인정보 필드를 두지 않는다(SEC-005-02). 일시는 ISO8601 문자열, 미확인 시 null.
 */
export interface ProcessStatusResponse {
  trackingKey: string;
  isSuccess: boolean;
  isResultConfirmed: boolean;
  processedAt: string;
  resultConfirmedAt: string | null;
}

@Injectable()
export class StatusService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 처리상태 조회 + 최초 조회 시 결과 확인 갱신(PROC-301 B4~B6).
   * @param trackingKey 형식 검증(FN-007)을 통과한 연동 추적 키(불투명, 비유니크).
   * @throws AppException EX-DATA-003(404) 연동 추적 키 미존재(만료 삭제 포함).
   */
  async getStatus(trackingKey: string): Promise<ProcessStatusResponse> {
    // B4. FN-009_findByKey — (tracking_key, processed_at DESC) 최신 1건 조회(IX_STATUS_TRACKING).
    //     추적 키 재사용 시 처리 일시 최신 1건 규칙으로 단일화한다(EXC-BIZ-12). 미존재 → 404 EX-DATA-003
    //     (EXC-DATA-04 만료 삭제 포함).
    const rows: ProcessStatusRow[] = await this.dataSource.query(
      `SELECT id, tracking_key, config_id, is_success, is_result_confirmed, processed_at, result_confirmed_at
         FROM "TBL_INTERLOCK_PROCESS_STATUS"
        WHERE tracking_key = $1
        ORDER BY processed_at DESC
        LIMIT 1`, // IX_STATUS_TRACKING
      [trackingKey],
    );
    const row = rows[0];
    if (!row) {
      throw new AppException('EX-DATA-003');
    }

    // B5. FN-009_confirmResult(PROC-401 / BR-301, 멱등) — 최초 미확인일 때만 surrogate id 대상 조건절
    //     가드 UPDATE 로 1회 갱신한다(tracking_key 재사용으로 다른 행이 있어도 이 행만 갱신).
    let isResultConfirmed = row.is_result_confirmed;
    let resultConfirmedAt: Date | string | null = row.result_confirmed_at;
    if (!isResultConfirmed) {
      const now = new Date();
      await this.dataSource.query(
        `UPDATE "TBL_INTERLOCK_PROCESS_STATUS"
            SET is_result_confirmed = true, result_confirmed_at = $1
          WHERE id = $2 AND is_result_confirmed = false`, // surrogate id 대상 + 멱등 가드
        [now, row.id],
      );
      isResultConfirmed = true;
      resultConfirmedAt = now;
    }

    // B6. FN-010_selectStatusResponse(MDL-302 / SEC-005-02) — 4항목 + 추적 키 에코(원문). configId·회원 키 배제.
    const response: ProcessStatusResponse = {
      trackingKey: row.tracking_key,
      isSuccess: row.is_success,
      isResultConfirmed,
      // processed_at 은 NOT NULL(ENT-004) — 항상 값이 존재한다.
      processedAt: toIso8601(row.processed_at) as string,
      resultConfirmedAt: toIso8601(resultConfirmedAt),
    };

    // 조회 감사(STATUS_CHECK) — OPS-002-04/05, 추적 키는 마스킹해 target 에 남기고 원문은 기록하지 않는다.
    await this.auditService.write({
      eventType: AuditEventType.STATUS_CHECK,
      actorType: ActorType.SERVICE,
      target: maskToken(trackingKey),
      result: AuditResult.SUCCESS,
      detail: `isSuccess=${response.isSuccess}, confirmed=${response.isResultConfirmed}`,
    });

    return response;
  }
}

/**
 * timestamptz 값을 ISO8601 문자열로 직렬화한다. pg 드라이버는 timestamptz 를 Date 로 반환하나,
 * 갱신 시 대입한 Date 및 문자열 반환 케이스까지 방어적으로 처리한다. null 은 그대로 null.
 */
function toIso8601(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
