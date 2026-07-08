import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/envelope/app.exception';

/**
 * 처리상태 조회·결과확인 갱신 서비스 — PROC-301 B4~B6 / FN-009(findByKey·confirmResult)·FN-010(응답 선별).
 *
 * 서비스 A 가 요청 키값으로 처리·결과 확인 상태를 조회하는 API(API-01)의 도메인 계층이다.
 * 인증(FN-004)·요청제한(FN-014)·요청 키값 형식 검증(FN-007)은 상위(가드·컨트롤러)가 선행하고, 본 서비스는
 * 형식 검증을 통과한 요청 키값으로 다음을 수행한다.
 *  - FN-009_findByKey(PROC-301 B4): PK 단건 조회. 미존재(만료 삭제 포함) → 404 EX-DATA-003.
 *  - FN-009_confirmResult(PROC-401 B2 / BR-301, 멱등): 최초 조회(is_result_confirmed=false)일 때만
 *    조건절 가드 UPDATE 로 결과 확인 여부·일시를 1회 갱신한다. 재조회는 갱신 없이 현재 상태를 반환한다.
 *  - FN-010_selectStatusResponse(MDL-302 / SEC-005-02): 상태 4항목 + 요청 키값 에코만 담아 반환한다.
 *    configId·회원 키·개인정보 필드는 응답에서 원천 배제한다.
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 조회는 단순 SELECT, 갱신은 단건 UPDATE(멱등 가드).
 * 반환값은 상위 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */

// ENT-004(TBL_INTERLOCK_PROCESS_STATUS) 조회 행. config_id 는 갱신 판정·매핑에 관여하지 않으나
// 스키마·조회 쿼리 정합을 위해 SELECT 하며 응답으로는 반출하지 않는다(SEC-005-02).
interface ProcessStatusRow {
  request_key: string;
  config_id: string;
  is_success: boolean;
  is_result_confirmed: boolean;
  processed_at: Date | string;
  result_confirmed_at: Date | string | null;
}

/**
 * 처리상태 조회 응답(MDL-302, ProcessStatusResponse) — 상태 4항목 + 요청 키값 에코.
 * configId·회원 키·개인정보 필드를 두지 않는다(SEC-005-02). 일시는 ISO8601 문자열, 미확인 시 null.
 */
export interface ProcessStatusResponse {
  requestKey: string;
  isSuccess: boolean;
  isResultConfirmed: boolean;
  processedAt: string;
  resultConfirmedAt: string | null;
}

@Injectable()
export class StatusService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * 처리상태 조회 + 최초 조회 시 결과 확인 갱신(PROC-301 B4~B6).
   * @param requestKey 형식 검증(FN-007)을 통과한 요청 키값(UUID v4).
   * @throws AppException EX-DATA-003(404) 요청 키값 미존재(만료 삭제 포함).
   */
  async getStatus(requestKey: string): Promise<ProcessStatusResponse> {
    // B4. FN-009_findByKey — PK(request_key) 단건 조회. 미존재 → 404 EX-DATA-003(EXC-DATA-04 만료 삭제 포함).
    const rows: ProcessStatusRow[] = await this.dataSource.query(
      `SELECT request_key, config_id, is_success, is_result_confirmed, processed_at, result_confirmed_at
         FROM "TBL_INTERLOCK_PROCESS_STATUS" WHERE request_key = $1`, // PK_PROCESS_STATUS
      [requestKey],
    );
    const row = rows[0];
    if (!row) {
      throw new AppException('EX-DATA-003');
    }

    // B5. FN-009_confirmResult(PROC-401 / BR-301, 멱등) — 최초 미확인일 때만 조건절 가드 UPDATE 로 1회 갱신.
    let isResultConfirmed = row.is_result_confirmed;
    let resultConfirmedAt: Date | string | null = row.result_confirmed_at;
    if (!isResultConfirmed) {
      const now = new Date();
      await this.dataSource.query(
        `UPDATE "TBL_INTERLOCK_PROCESS_STATUS"
            SET is_result_confirmed = true, result_confirmed_at = $1
          WHERE request_key = $2 AND is_result_confirmed = false`, // 멱등 가드(WHERE is_result_confirmed=false)
        [now, requestKey],
      );
      isResultConfirmed = true;
      resultConfirmedAt = now;
    }

    // B6. FN-010_selectStatusResponse(MDL-302 / SEC-005-02) — 4항목 + 요청 키값 에코. configId·회원 키 배제.
    return {
      requestKey: row.request_key,
      isSuccess: row.is_success,
      isResultConfirmed,
      // processed_at 은 NOT NULL(ENT-004) — 항상 값이 존재한다.
      processedAt: toIso8601(row.processed_at) as string,
      resultConfirmedAt: toIso8601(resultConfirmedAt),
    };
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
