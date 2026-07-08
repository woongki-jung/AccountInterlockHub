/*
 * 사용자 이용 동의 API 호출 — SVC-004 / PROC-201(B1b 조회)·PROC-202(동의/거부) / FN-008.
 * 백엔드 계약(USR-P1~P2 구현)을 그대로 소비한다 — 엔드포인트·필드명·타입을 임의로 바꾸지 않는다.
 *  - VIEW:   GET  /api/consent/:requestKey  → { configCode, items: ConsentItem[] }
 *  - SUBMIT: POST /api/consent/:requestKey  본문 { decision, configCode } → { success:true }
 * configCode 는 구성 식별 메타(개인정보 아님)로, FE 가 제출(MDL-203)에 되돌려 보내기 위한 값이다.
 * 화면에는 표시하지 않고 메모리로만 보유한다(PROC-202 ctx.configCode 정합, SCR-005 §무노출).
 */
import { apiGet, apiPost } from './apiClient';

/** 동의 항목(ENT-002 파생) — SCR-005 렌더 모델. display_order 오름차순으로 내려온다. */
export interface ConsentItem {
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}

/** 동의 항목 조회 응답(GET). configCode 는 제출 회신용(화면 미표시·메모리 보유). */
export interface ConsentView {
  configCode: string;
  items: ConsentItem[];
}

/** 동의/거부 결정값(MDL-203 decision enum). 서버는 이 두 값만 처리한다. */
export type ConsentDecision = 'AGREE' | 'REJECT';

/**
 * 동의 항목 조회(GET /api/consent/:requestKey, PROC-201 B1b).
 * 진입 컨텍스트(요청 키값)로 구성을 특정해 그 구성 소속 동의 항목만 받는다.
 * 만료·미존재·불일치는 ApiError(400 EX-DATA-002), 요청 제한은 429 EX-OPS-001 로 던진다.
 */
export function getConsentView(requestKey: string): Promise<ConsentView> {
  return apiGet<ConsentView>(`/api/consent/${encodeURIComponent(requestKey)}`);
}

/**
 * 동의/거부 제출(POST /api/consent/:requestKey, PROC-202).
 * 성공(동의 전달 성공·거부) → 200 { success:true }. 동의 후 전달 실패 → 502 EX-BIZ-004(상태는 저장됨),
 * 만료·불일치 → 400 EX-DATA-002. 응답 본문은 사용하지 않으므로 void 로 반환한다.
 */
export function submitConsent(
  requestKey: string,
  decision: ConsentDecision,
  configCode: string,
): Promise<void> {
  return apiPost<{ success: true }>(`/api/consent/${encodeURIComponent(requestKey)}`, {
    decision,
    configCode,
  }).then(() => undefined);
}
