import { TRACKING_KEY_MAX_LENGTH } from './crypto.constants';

/**
 * FN-006 연동 추적 키 형식 판정(function_FN-005-006.md §FN-006). **예외를 던지지 않는다** —
 * 판정 결과 `false` 를 어느 EX 코드로 바꿀지는 호출측이 정한다(`EXC-DATA-11`): 조회·통지
 * 입력의 형식 위반은 `EX-DATA-002`, 복호화 판정 4단계의 형식 위반은 `EX-SEC-002` 로 각각
 * 다르게 분류된다.
 *
 * **값을 변형하지 않는다**(`DATA-004-01`) — `trim()` 은 판정용 임시 결과일 뿐 반환값에
 * 반영되지 않는다(반환 타입 자체가 `boolean`이라 값이 밖으로 나가지도 않는다). 길이는
 * **문자 수(코드포인트) 기준**으로 센다 — `ENT-001.tracking_key` 컬럼(Postgres
 * `character_length`, 코드포인트 단위)과 같은 단위를 맞추기 위해 UTF-16 코드 유닛 수
 * (`string.length`)가 아니라 코드포인트 수(`[...string].length`)로 센다 — 서로게이트 쌍으로
 * 표현되는 문자(예: 일부 이모지·확장 한자)에서 두 기준이 갈린다.
 *
 * @returns `true` = 1자 이상 255자 이하이며 공백만이 아닌 문자열.
 */
export function isTrackingKeyFormatValid(trackingKey: unknown): trackingKey is string {
  // 1. 타입·존재 검사 — DATA-004-03
  if (trackingKey == null || typeof trackingKey !== 'string') {
    return false;
  }

  // 2. 공백 검사 (값 자체는 변형하지 않는다 — DATA-004-01)
  if (trackingKey.trim() === '') {
    return false;
  }

  // 3. 길이 검사 (문자 수 기준 — ENT-001.tracking_key 와 같은 단위)
  if ([...trackingKey].length > TRACKING_KEY_MAX_LENGTH) {
    return false;
  }

  // 4. 판정 반환
  return true;
}
