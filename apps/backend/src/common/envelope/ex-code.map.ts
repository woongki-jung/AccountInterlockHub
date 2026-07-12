import { HttpStatus } from '@nestjs/common';

// EX 코드 → { HTTP 상태, 사용자 메시지 } 매핑의 단일 출처(FN-015).
// 코드·HTTP·요지는 공통 기능 정의서 §에러(EX) 코드 카탈로그(spec-functions.md)를 인용한다.
// 사용자 메시지는 사양이 명시한 것(EX-FN-999·EX-SEC-004/005·EX-SEC-001)은 그대로 쓰고,
// 나머지는 build 기본안 문구다(민감정보 비노출). 사양이 문구를 확정하면 본 맵을 리비전한다.

export interface ExCodeEntry {
  httpStatus: number;
  message: string;
}

// 미매핑·미분류 오류의 공통 종착 코드(FN-015).
export const DEFAULT_EX_CODE = 'EX-FN-999';

export const EX_CODE_MAP: Record<string, ExCodeEntry> = {
  'EX-SEC-001': { httpStatus: HttpStatus.FORBIDDEN, message: '접근이 허용되지 않습니다.' },
  'EX-AUTH-001': { httpStatus: HttpStatus.UNAUTHORIZED, message: '로그인이 필요합니다.' },
  'EX-AUTH-002': {
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: '세션이 만료되었습니다. 다시 로그인해주세요.',
  },
  // 423 Locked — HttpStatus enum 미포함이라 상태 코드를 직접 지정한다.
  'EX-AUTH-003': {
    httpStatus: 423,
    message: '로그인 시도가 많아 계정이 잠금되었습니다. 잠시 후 다시 시도해주세요.',
  },
  'EX-AUTH-004': {
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: '비밀번호가 복잡도 요건을 충족하지 않습니다.',
  },
  'EX-SEC-003': { httpStatus: HttpStatus.UNAUTHORIZED, message: '인증에 실패했습니다.' },
  'EX-SEC-004': { httpStatus: HttpStatus.BAD_REQUEST, message: '입력 형식이 올바르지 않습니다.' },
  'EX-SEC-005': { httpStatus: HttpStatus.PAYLOAD_TOO_LARGE, message: '요청이 너무 큽니다.' },
  // FN-020 허브 복호화(SEC-006-05) — 패딩·키 불일치=생년월일 오류. 재입력 재시도 유도(AUTH-004-02, 하드 잠금 없음).
  'EX-SEC-006': {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: '사용자 정보가 일치하지 않습니다.',
  },
  // FN-020 허브 복호화(SEC-006-05) — 암호 파라미터(encX·encY) 누락·Base64URL 형식 오류. 발송처 링크 구성 오류(재입력 불가).
  'EX-SEC-007': { httpStatus: HttpStatus.BAD_REQUEST, message: '요청이 올바르지 않습니다.' },
  'EX-BIZ-001': {
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    message: '연동 구성 입력이 올바르지 않습니다.',
  },
  'EX-BIZ-002': { httpStatus: HttpStatus.CONFLICT, message: '이미 사용 중인 구성 코드입니다.' },
  'EX-BIZ-004': {
    httpStatus: HttpStatus.BAD_GATEWAY,
    message: '연동 대상 서비스 전달에 실패했습니다.',
  },
  'EX-BIZ-005': { httpStatus: HttpStatus.NOT_FOUND, message: '완료 확인 대상을 찾을 수 없습니다.' },
  'EX-BIZ-006': { httpStatus: HttpStatus.NOT_FOUND, message: '완료 처리 대상을 찾을 수 없습니다.' },
  // 사양 문구 정정: SVC-004/FN-016/PROC-201 은 "연동에 필요한 값이 누락되었습니다."로 확정(지정 파라미터 값 누락).
  'EX-BIZ-007': { httpStatus: HttpStatus.BAD_REQUEST, message: '연동에 필요한 값이 누락되었습니다.' },
  // FN-020 허브 복호화(BIZ-004-08·EXC-BIZ-13) — 복호화된 X 파싱 실패·연동 추적 키 필드 누락·공백. 발송처 데이터 오류(재입력 불가).
  'EX-BIZ-008': { httpStatus: HttpStatus.BAD_REQUEST, message: '연동에 필요한 값이 없습니다.' },
  // 진입 컨텍스트 만료·미존재·불일치 케이스(PROC-201 B1b·FN-008) 사양 문구로 정정. 형식 오류(FN-007 조회, 후속 Phase)와 코드 공유.
  'EX-DATA-002': { httpStatus: HttpStatus.BAD_REQUEST, message: '요청이 올바르지 않습니다.' },
  'EX-DATA-003': { httpStatus: HttpStatus.NOT_FOUND, message: '요청 정보를 찾을 수 없습니다.' },
  'EX-OPS-001': {
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },
  'EX-FN-999': {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '잠시 후 다시 시도해주세요.',
  },
};

// 프레임워크·전송 계층에서 발생하는 상태 코드를 도메인 EX 로 환원하는 최소 매핑
// (본문 초과 413 → EX-SEC-005, 요청 제한 429 → EX-OPS-001).
export const TRANSPORT_STATUS_TO_CODE: Record<number, string> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'EX-SEC-005',
  [HttpStatus.TOO_MANY_REQUESTS]: 'EX-OPS-001',
};
