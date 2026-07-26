// 정책 예외 코드 카탈로그의 HTTP 매핑(spec-policies.md §예외(EX) 코드 카탈로그). 후행 도메인은
// 이 표를 참조만 하고 코드를 새로 만들지 않는다 — 본 파일이 그 참조의 실제 구현이다.

/**
 * 카탈로그 13종 중 **HTTP 상태로 매핑되는 12종**. `EX-OPS-001`(필수 상수 미주입)은 기동 중단
 * 사유라 HTTP 응답이 없으므로(`OPS-001-02`, PROC-901/main.ts 가 표준 출력으로만 처리) 이
 * 유니온·카탈로그의 대상이 아니다 — 누락이 아니라 범위 밖이다.
 */
export type MappedExCode =
  | 'EX-AUTH-001'
  | 'EX-AUTH-002'
  | 'EX-SEC-001'
  | 'EX-SEC-002'
  | 'EX-SEC-003'
  | 'EX-SEC-004'
  | 'EX-BIZ-001'
  | 'EX-BIZ-002'
  | 'EX-BIZ-003'
  | 'EX-DATA-001'
  | 'EX-DATA-002'
  | 'EX-OPS-002';

interface ExCatalogEntry {
  readonly httpStatus: number;
  readonly message: string;
}

/**
 * function_FN-014-015.md §오류 메시지 기본값 표를 그대로 옮긴 단일 출처. `message` 는 화면이
 * 그대로 쓰거나 자기 문구로 대체할 수 있는 **기본값**이다(화면 표시 형식은 화면 도메인 소관).
 * `httpStatus` 는 FN-014 §처리 흐름 5 "HTTP 상태는 카탈로그가 정한 값을 그대로 쓴다"의 근거다.
 */
export const EX_CODE_CATALOG: Readonly<Record<MappedExCode, ExCatalogEntry>> = Object.freeze({
  'EX-AUTH-001': { httpStatus: 400, message: '생년월일을 여섯 자리 숫자로 입력해 주세요.' },
  'EX-AUTH-002': { httpStatus: 400, message: '입력하신 생년월일로 확인되지 않았습니다. 다시 확인해 주세요.' },
  'EX-SEC-001': { httpStatus: 400, message: '연동 링크가 올바르지 않습니다.' },
  'EX-SEC-002': { httpStatus: 400, message: '연동 요청 정보가 규약과 맞지 않습니다.' },
  'EX-SEC-003': { httpStatus: 400, message: '요청 값이 올바르지 않습니다.' },
  'EX-SEC-004': { httpStatus: 400, message: '전달 정보가 허용 크기를 넘었습니다.' },
  'EX-BIZ-001': { httpStatus: 400, message: '필수 동의 항목에 모두 동의해 주세요.' },
  'EX-BIZ-002': { httpStatus: 502, message: '연동 대상 서비스에 전달하지 못했습니다.' },
  'EX-BIZ-003': { httpStatus: 500, message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
  'EX-DATA-001': { httpStatus: 404, message: '해당 연동 추적 키로 진입한 요청이 없습니다.' },
  'EX-DATA-002': { httpStatus: 400, message: '연동 추적 키 형식이 올바르지 않습니다.' },
  'EX-OPS-002': { httpStatus: 500, message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
});

/**
 * 카탈로그 밖 코드를 대체하는 "인터페이스 수준의 마지막 방어"(spec-policies.md §예외(EX) 코드
 * 카탈로그 · function_FN-014-015.md §처리 흐름 1). 위 12종 중 어떤 코드로도 분류되지 않는 실패
 * 전부가 이 코드로 수렴한다.
 */
export const FALLBACK_EX_CODE: MappedExCode = 'EX-OPS-002';

/** `code` 가 카탈로그 12종 중 하나인지 판정한다(FN-014 §처리 흐름 1의 "코드 유효성 판정"). */
export function isMappedExCode(code: string): code is MappedExCode {
  return Object.prototype.hasOwnProperty.call(EX_CODE_CATALOG, code);
}
