// FN-014 §오류 메시지 기본값 — docs/specs/functions/function_FN-014-015.md.
// 화면은 오류 응답 엔벨로프의 message 필드를 그대로 쓰는 것이 원칙이다
// (screen_SCR-001.md §입력 폼 정의 — "화면이 문구를 새로 만들면 같은
// 실패가 자리마다 달리 읽힌다"). 이 카탈로그는 그 원칙의 **대체 출처가
// 아니라 방어적 폴백**이다 — 전송 계층이 끊겨 서버 message 자체를 받지
// 못했거나(네트워크 오류) 응답 본문이 계약과 다른 경우에만 쓴다.

export const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  'EX-AUTH-001': '생년월일을 여섯 자리 숫자로 입력해 주세요.',
  'EX-AUTH-002': '입력하신 생년월일로 확인되지 않았습니다. 다시 확인해 주세요.',
  'EX-SEC-001': '연동 링크가 올바르지 않습니다.',
  'EX-SEC-002': '연동 요청 정보가 규약과 맞지 않습니다.',
  'EX-SEC-003': '요청 값이 올바르지 않습니다.',
  'EX-SEC-004': '전달 정보가 허용 크기를 넘었습니다.',
  'EX-BIZ-001': '필수 동의 항목에 모두 동의해 주세요.',
  'EX-BIZ-002': '연동 대상 서비스에 전달하지 못했습니다.',
  'EX-BIZ-003': '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  'EX-DATA-001': '해당 연동 추적 키로 진입한 요청이 없습니다.',
  'EX-DATA-002': '연동 추적 키 형식이 올바르지 않습니다.',
  'EX-OPS-002': '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 카탈로그 밖 코드는 EX-OPS-002 문구로 수렴한다(FN-014 §처리 흐름 1). */
export function defaultMessageFor(code: string): string {
  return DEFAULT_ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGES['EX-OPS-002'];
}
