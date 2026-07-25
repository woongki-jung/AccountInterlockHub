/**
 * ENT-003 §일자 경계 기준 — Asia/Seoul(UTC+09:00) 고정. 서버·세션 기본 시간대에 의존하지 않도록
 * IANA 시간대 이름으로 명시 변환한다(배포 환경의 로컬 시간대 설정과 무관하게 결정적이다 —
 * data_ENT-003.md·function_FN-012-013.md §구현 가이드 "일자 산출 시 시간대를 명시적으로 지정한다").
 * en-CA 로케일의 날짜 전용 포맷이 'YYYY-MM-DD' 그대로라 별도 문자열 조립이 필요 없다.
 */
const METRIC_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 계기 발생 시각(TIMESTAMPTZ)을 Asia/Seoul 기준 'YYYY-MM-DD' 로 변환한다(MDL-003.metricDate). */
export function toMetricDate(at: Date): string {
  return METRIC_DATE_FORMATTER.format(at);
}
