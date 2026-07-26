import { APPROVE_PATH, VERIFY_PATH } from './constants';
import { defaultMessageFor } from './errorMessages';
import type { ApproveResponseDto, ErrorResponseDto, VerifyResponseDto } from './types';

/**
 * 접점 호출 결과 — 세 갈래.
 * - `success`: 2xx, 계약대로 파싱됨.
 * - `http-error`: 4xx/5xx, FN-014 오류 응답 엔벨로프.
 * - `network-error`: 응답 자체를 받지 못함(전송 계층 단절) — SCR-003 의
 *   `Unconfirmed` 상태([`screen_SCR-003.md`](../../../docs/specs/screens/screen_SCR-003.md)
 *   §화면 상태 전이)가 구분해야 하는 경우라 `http-error` 와 분리한다.
 */
export type ApiOutcome<T> =
  | { kind: 'success'; data: T }
  | { kind: 'http-error'; status: number; error: ErrorResponseDto }
  | { kind: 'network-error' };

async function postJson<TResponse>(path: string, body: unknown): Promise<ApiOutcome<TResponse>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: 'network-error' };
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  if (response.ok) {
    // 계약 위반(본문이 JSON 이 아니거나 비어 있음) 방어 — 성공 상태인데
    // 본문이 없으면 화면이 다음 단계를 고를 수 없으므로 네트워크 오류와
    // 같은 방식(Unconfirmed/Retryable 취급)으로 물러난다.
    if (parsedBody === null) return { kind: 'network-error' };
    return { kind: 'success', data: parsedBody as TResponse };
  }

  if (isErrorEnvelope(parsedBody)) {
    return { kind: 'http-error', status: response.status, error: parsedBody };
  }

  // 본문이 FN-014 엔벨로프 형태가 아니다 — 상태 코드만으로 EX-OPS-002 대체.
  return {
    kind: 'http-error',
    status: response.status,
    error: { code: 'EX-OPS-002', message: defaultMessageFor('EX-OPS-002') },
  };
}

function isErrorEnvelope(value: unknown): value is ErrorResponseDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

export interface VerifyInput {
  encX: string;
  encY: string;
  birthDate: string;
}

/** 본인확인 제출 — POST <INTERLOCK_ENTRY_PATH>/verify (PROC-102). */
export function verifyIdentity(input: VerifyInput): Promise<ApiOutcome<VerifyResponseDto>> {
  return postJson<VerifyResponseDto>(VERIFY_PATH, input);
}

export interface ApproveInput {
  encX: string;
  encY: string;
  birthDate: string;
  agreedItemCodes: string[];
}

/** 동의·승인 제출 — POST <INTERLOCK_ENTRY_PATH>/approve (PROC-103). */
export function submitApproval(input: ApproveInput): Promise<ApiOutcome<ApproveResponseDto>> {
  return postJson<ApproveResponseDto>(APPROVE_PATH, input);
}
