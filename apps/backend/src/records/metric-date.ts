/**
 * ENT-003 §일자 경계 기준 — Asia/Seoul(UTC+09:00) 고정. 서버·세션 기본 시간대에 의존하지 않도록
 * IANA 시간대 이름으로 명시 변환한다(배포 환경의 로컬 시간대 설정과 무관하게 결정적이다 —
 * data_ENT-003.md·function_FN-012-013.md §구현 가이드 "일자 산출 시 시간대를 명시적으로 지정한다").
 *
 * `formatToParts()` 로 연·월·일 **값**만 이름으로 뽑아 직접 조립한다 — `.format()` 이 반환하는
 * 완성 문자열의 **배치**(구분자 위치·필드 순서)에 기대지 않는다. `small-icu` 로 빌드된 Node 는
 * `en-CA`(짧은 형식이 YYYY-MM-DD 인 로케일)처럼 흔치 않은 로케일의 데이터를 갖지 않을 수 있어
 * 조용히 `en-US`(MM/DD/YYYY)로 폴백할 수 있고, 그러면 `.format()` 의 반환 문자열 순서 자체가
 * 달라져 `MDL-003.metricDate`(`YYYY-MM-DD`) 형태가 깨진다 — DATE 컬럼에 잘못된 순서로 값이
 * 들어가거나 저장이 실패한다. `formatToParts()` 로 얻는 각 필드의 **값**(연·월·일 숫자)은
 * 로케일이 무엇으로 폴백되든(영어권 로케일은 전부 그레고리력·서양 아라비아 숫자를 쓴다)
 * 달라지지 않으므로, 이 방식은 배포 ICU 빌드와 무관하게 결정적이다. 로케일은 `small-icu` 에도
 * 항상 포함되는 `en-US` 를 명시해 로케일 자체의 미해석 여지도 없앤다.
 */
const METRIC_DATE_PART_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 계기 발생 시각(TIMESTAMPTZ)을 Asia/Seoul 기준 'YYYY-MM-DD' 로 변환한다(MDL-003.metricDate). */
export function toMetricDate(at: Date): string {
  const parts = METRIC_DATE_PART_FORMATTER.formatToParts(at);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    // Intl 구현이 계약대로 연·월·일 파트를 내놓지 않는 비정상 상황 — 조용히 잘못된 일자를
    // 만드는 대신 즉시 실패시킨다(일자 경계는 지표 정합의 기준이라 침묵 실패를 허용하지 않는다).
    throw new Error('toMetricDate: Intl.DateTimeFormat 이 연/월/일 파트를 반환하지 않았다');
  }

  return `${year}-${month}-${day}`;
}
