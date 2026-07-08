// FN-015 공통 응답·에러 엔벨로프 타입. 전 API 응답은 성공/실패 모두 이 구조로 감싼다.

// 검증 실패 등에서 필드별 오류를 담는 항목.
export interface FieldError {
  field: string;
  message: string;
}

// 성공 엔벨로프 — 핸들러 반환 DTO 를 data 로 감싼다.
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

// 실패 엔벨로프 — EX 코드·사용자 메시지·필드 오류 배열(없으면 null).
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: FieldError[] | null;
  };
}
