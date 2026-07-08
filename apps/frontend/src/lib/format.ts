/*
 * 표시 포맷 헬퍼 — 응답 DTO(ISO8601 등)를 화면 표기 형식으로 변환한다.
 * PROC-102 §데이터 변환: createdAt ISO8601 → 지역 일시 포맷.
 */

/** 2자리 0 패딩. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * ISO8601 일시 → 'YYYY-MM-DD HH:mm'(지역 시간). null·빈 값·비정상 값은 '-'.
 * 목록·상세의 생성 일시 표기에 사용한다.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '-';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}
