/**
 * DB 쿼리 결과 형상 유틸 — TypeORM(dataSource.query/queryRunner.query)+node-postgres 결과의 형상 차이를
 * 흡수한다. UPDATE...RETURNING·INSERT...RETURNING·SELECT 가 서로 다른 형상으로 반환되는 문제(회귀 #43)를
 * 단일 지점에서 처리한다.
 */

/**
 * `UPDATE ... RETURNING` (dataSource.query/queryRunner.query 공통) 결과에서 첫 행을 형상 안전하게 추출한다.
 *
 * ⚠ 형상 주의(회귀 #43): 이 TypeORM+node-postgres 조합에서 UPDATE...RETURNING 은 **평탄한 행 배열이 아니라
 * `[행배열, affected건수]` 튜플**을 반환한다 — 매칭 시 `[[{...}], 1]`, 매칭 없음 시 `[[], 0]`. 실측 결과
 * 이 튜플 형상은 dataSource.query 든 queryRunner.query 든 동일하다(문 종류가 UPDATE 이기 때문).
 * 반면 INSERT...RETURNING·SELECT 는 평탄 배열(`[{...}]`)이라 create/조회 경로는 rows[0] 로 그대로 읽는다.
 *
 * 과거 결함: `rows[0]` 로 읽어 튜플의 겉배열 `[]`(빈, 그러나 truthy)을 "행 있음"으로 오판 → 대상 없음 분기 사문화.
 * 여기서 겉배열 안의 실제 행 유무로 판별하므로 매칭 없음은 undefined 로 정규화된다(200 data:null·감사 미기록).
 */
export function firstUpdatedRow<T>(result: unknown): T | undefined {
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return (result[0] as T[])[0]; // 튜플 [행배열, affected] — 안쪽 행배열의 첫 행(없으면 undefined)
  }
  if (Array.isArray(result)) {
    return (result as T[])[0]; // 평탄 배열 방어(향후 형상 변동 대비)
  }
  return undefined;
}

/**
 * `UPDATE`/`DELETE`(RETURNING 유무 무관) 결과에서 영향 행 수(affected)를 형상 안전하게 추출한다.
 *
 * ⚠ 형상 주의: 이 TypeORM+node-postgres 조합에서 UPDATE·DELETE 는 **`[행배열, affected건수]` 튜플**을
 * 반환한다 — RETURNING 없는 DELETE 는 `[[], n]`(빈 행배열 + 삭제 건수 n). 튜플 2번째 원소가 곧 affected 다.
 * 청크 DELETE 루프(PROC-402)에서 삭제 건수 n 을 읽어 n=0 이 될 때까지 반복하는 데 쓴다.
 */
export function affectedCount(result: unknown): number {
  if (Array.isArray(result) && typeof result[1] === 'number') {
    return result[1]; // 튜플 [행배열, affected] — 2번째 원소가 영향 행 수
  }
  return 0;
}
