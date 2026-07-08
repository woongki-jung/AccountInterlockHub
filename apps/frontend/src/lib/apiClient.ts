/*
 * API 클라이언트 — 공통 응답·에러 엔벨로프(FN-015)를 파싱하는 얇은 fetch 래퍼.
 * - 세션 쿠키(HttpOnly)를 항상 동봉한다(credentials: 'include').
 * - 성공 엔벨로프({ success:true, data })에서 data 만 타입 지정해 반환한다.
 * - 실패 엔벨로프({ success:false, error:{ code, message, details } })는 ApiError 로 던진다.
 * - 세션 만료(401 EX-AUTH-002)는 중앙 훅으로 재인증 유도(로그인 리다이렉트)한다.
 *   단, 로그인 호출처럼 리다이렉트가 부적절한 경우는 suppressSessionExpiredRedirect 로 끈다.
 */

/** FN-015 필드 오류 항목(검증 실패 details 배열의 원소). */
export interface FieldError {
  field: string;
  message: string;
}

/** 성공 엔벨로프. */
interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/** 실패 엔벨로프. */
interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: FieldError[] | null;
  };
}

/** 세션 만료로 취급하는 인증 코드(EXC-AUTH-02). */
export const SESSION_EXPIRED_CODE = 'EX-AUTH-002';

/**
 * API 실패를 나타내는 오류. 화면은 status·code 로 분기하고 message 를 사용자 문구로 노출한다
 * (design-system.md §상태 표현 — 엔벨로프 error.message 를 그대로 노출).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldError[] | null;

  constructor(status: number, code: string, message: string, details: FieldError[] | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** details 배열을 field → message 맵으로 변환(입력 필드 캡션 매핑용). */
  fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const item of this.details ?? []) {
      if (item.field && !(item.field in map)) {
        map[item.field] = item.message;
      }
    }
    return map;
  }
}

/** 네트워크 단절 등 엔벨로프를 받지 못한 경우의 폴백 문구. */
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const UNKNOWN_ERROR_MESSAGE = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 세션 만료 처리 훅. 인증이 필요한 화면(SCR-002~004)이 마운트 시 등록하며,
 * 401 EX-AUTH-002 응답을 받으면 이 훅이 호출돼 로그인 화면으로 재인증을 유도한다.
 */
type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/** 세션 만료 훅을 등록한다. 반환값은 해제 함수(등록 해제). */
export function setSessionExpiredHandler(handler: SessionExpiredHandler): () => void {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

/** 요청 옵션. */
export interface RequestOptions {
  /** HTTP 메서드(기본 GET). */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON 직렬화할 요청 본문. */
  body?: unknown;
  /** 세션 만료(EX-AUTH-002) 시 중앙 리다이렉트 훅을 억제한다(로그인 호출 등). */
  suppressSessionExpiredRedirect?: boolean;
  /** 추가 헤더. */
  headers?: Record<string, string>;
  /** AbortSignal(요청 취소). */
  signal?: AbortSignal;
}

/** 응답 본문을 JSON 으로 파싱한다(본문 없음/비 JSON 이면 null). */
async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === false &&
    typeof (body as { error?: unknown }).error === 'object'
  );
}

function isSuccessEnvelope<T>(body: unknown): body is SuccessEnvelope<T> {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === true
  );
}

/**
 * 공통 요청 실행. 성공 시 data<T>, 실패 시 ApiError 를 던진다.
 * 경로는 백엔드와 동일 출처(same-origin)이므로 상대 경로('/api/...')를 사용한다.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, suppressSessionExpiredRedirect = false, headers, signal } = options;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    // 네트워크 단절·CORS 등 fetch 자체 실패.
    throw new ApiError(0, 'EX-NETWORK', NETWORK_ERROR_MESSAGE, null);
  }

  const parsed = await parseJson(res);

  if (res.ok && isSuccessEnvelope<T>(parsed)) {
    return parsed.data;
  }

  // 실패 경로 — 엔벨로프가 있으면 그 코드·메시지를, 없으면 상태 기반 폴백을 사용한다.
  let code = 'EX-FN-999';
  let message = UNKNOWN_ERROR_MESSAGE;
  let details: FieldError[] | null = null;
  if (isErrorEnvelope(parsed)) {
    code = parsed.error.code || code;
    message = parsed.error.message || message;
    details = parsed.error.details ?? null;
  }

  // 세션 만료: 중앙 재인증 유도(억제 옵션이 없을 때만).
  if (code === SESSION_EXPIRED_CODE && !suppressSessionExpiredRedirect) {
    sessionExpiredHandler?.();
  }

  throw new ApiError(res.status, code, message, details);
}

/** GET 헬퍼. */
export function apiGet<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

/** POST 헬퍼(JSON 본문). */
export function apiPost<T>(
  path: string,
  body: unknown,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body });
}
