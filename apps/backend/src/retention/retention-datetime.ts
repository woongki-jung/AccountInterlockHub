// PROC-304 B2(기준 일시 산정) · B6(요약 직렬화)이 쓰는 순수 날짜 함수 — NestJS 의존이 없다.

/**
 * `at` 에서 `months` 개월을 감산한 시각을 반환한다(PROC-304 B2 — `now − <RETENTION_MONTHS> 개월` 류).
 * TIMESTAMPTZ 컬럼(절대 시각)과의 비교에 쓰는 값이라 **UTC 달력 필드**로 계산한다 — 서버 OS 의
 * 로컬 시간대 설정에 의존하면 같은 상수·같은 실행 시각이라도 배포 환경에 따라 다른 임계값이
 * 나올 수 있다(records/metric-date.ts 의 "서버 로컬 시간대 설정과 무관하게 결정적이어야 한다"는
 * 원칙과 같은 이유 — 다만 그 파일은 달력 일자 경계 분류가 목적이고, 여기는 절대 시각 임계값
 * 산출이 목적이라 서로 다른 파일에 독립적으로 둔다).
 *
 * 월말 자리(예: 1월 31일 − 1개월)는 JS `Date.setUTCMonth` 기본 동작대로 다음 달로 넘어간다(2월에
 * 31일이 없으면 3월 2·3일로 자연 이월). PROC-304 사양은 이 경계의 반올림 방향을 명시하지 않으므로
 * 이 동작을 그대로 채택한다(빌드 결정 — 완료 보고에 기록).
 */
export function subtractMonths(at: Date, months: number): Date {
  const result = new Date(at.getTime());
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

/**
 * Asia/Seoul 지역 달력·시각 요소를 `formatToParts()` 로 뽑아내는 포맷터 — `.format()` 이 반환하는
 * 완성 문자열의 필드 배치에 기대지 않는다. 값(연·월·일·시·분·초) 자체는 로케일이 무엇으로
 * 폴백되든(영어권 로케일은 전부 그레고리력·서양 아라비아 숫자) 달라지지 않으므로 배포 ICU 빌드와
 * 무관하게 결정적이다 — records/metric-date.ts(P06, `toMetricDate`)가 이미 세운 것과 같은 기법을
 * 여기서도 그대로 쓴다(해당 파일은 다른 Phase 소유라 직접 import·수정하지 않고 같은 기법을
 * 독립적으로 다시 구현한다 — Phase 경계를 넘는 결합을 만들지 않기 위함, 완료 보고에 기록).
 */
const SEOUL_DATETIME_PART_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * `at` 을 Asia/Seoul 벽시계 기준 `YYYY-MM-DDTHH:mm:ss+09:00` 로 변환한다
 * (spec-functions-api-server.md §명령 진입점 §출력 스키마 예시 · PROC-304 B6 "ISO 8601 + 오프셋").
 * `Date.prototype.toISOString()` 을 쓰지 않는 이유 — 그 메서드는 항상 `Z`(UTC) 오프셋을 낸다.
 * Asia/Seoul 은 연중 고정 UTC+9(서머타임 없음)라 `+09:00` 리터럴 접미를 안전하게 고정할 수 있다.
 */
export function formatBaseAtIso(at: Date): string {
  const parts = SEOUL_DATETIME_PART_FORMATTER.formatToParts(at);
  const get = (type: string): string | undefined => parts.find((part) => part.type === type)?.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined) {
    // Intl 구현이 계약대로 파트를 반환하지 않는 비정상 상황 — 조용히 잘못된 시각을 만드는 대신
    // 즉시 실패시킨다(toMetricDate 와 같은 방어 원칙).
    throw new Error('formatBaseAtIso: Intl.DateTimeFormat 이 필요한 파트를 반환하지 않았다');
  }
  // en-US + hour12:false 조합은 자정을 '24'로 표기하는 알려진 ICU 동작이 있어 '00'으로 보정한다.
  if (hour === '24') hour = '00';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}
