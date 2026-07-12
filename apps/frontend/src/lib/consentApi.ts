/*
 * 사용자 이용 동의·승인 API 호출 — SVC-004/005 · PROC-201(조회)·PROC-202(승인 게이팅, 내부 PROC-203) ·
 * FN-008·FN-020. 백엔드 계약(P5 구현)을 그대로 소비한다 — 엔드포인트·필드명·타입을 임의로 바꾸지 않는다.
 *  - VIEW:    GET  /api/consent/:accessAddressId
 *             → { consentNotice: string|null, items: ConsentItem[] }
 *  - APPROVE: POST /api/interlock/approve
 *             본문 { decision, accessAddressId, requiredConsentMet, encX?, encY?, birthDate? }
 *             (encX·encY·birthDate 는 decision='AGREE' 일 때만 포함 — REJECT 는 미포함)
 *             → { result: 'COMPLETED' | 'REJECTED' }
 *
 * accessAddressId 는 URL 경로(발송처 판별값), encX·encY 는 URL 쿼리에서 읽어 호출부(ConsentPage)가
 * 메모리로만 보유한 값을 그대로 전달한다 — 본 모듈은 값을 검사·가공하지 않고 그대로 중계한다
 * (SCR-005 §구현 가이드, DATA-001-04·SEC-005-06 — 로그·URL 어디에도 남기지 않음).
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

/** 동의 화면 조회 응답(GET) — 동의 대상 설명 문구(선택, BIZ-002-08) + 구성 소속 동의 항목. */
export interface ConsentView {
  consentNotice: string | null;
  items: ConsentItem[];
}

/** 동의/거부 결정값(MDL-203 decision enum). 서버는 이 두 값만 처리한다. */
export type ConsentDecision = 'AGREE' | 'REJECT';

/** 승인 처리 결과(MDL-203 처리 결과, SEC-007-02 — 원문·회원 키·추적 키 미포함). */
export interface ApproveResult {
  result: 'COMPLETED' | 'REJECTED';
}

/** POST /api/interlock/approve 승인(AGREE) 본문 — 접근 컨텍스트(encX·encY·birthDate) 동봉 필수. */
export interface ApproveAgreeParams {
  decision: 'AGREE';
  accessAddressId: string;
  requiredConsentMet: boolean;
  encX: string;
  encY: string;
  birthDate: string;
}

/** POST /api/interlock/approve 거부(REJECT) 본문 — 접근 컨텍스트 미포함(복호화 요소 불필요). */
export interface ApproveRejectParams {
  decision: 'REJECT';
  accessAddressId: string;
  requiredConsentMet: false;
}

export type ApproveParams = ApproveAgreeParams | ApproveRejectParams;

/**
 * 동의 대상 설명 문구·동의 항목 조회(GET /api/consent/:accessAddressId, PROC-201).
 * 진입한 접근 주소 고유 ID(발송처 판별값)로 활성 구성을 특정해 그 구성 소속 항목만 받는다.
 * 무효·비활성 접근 주소는 400 EX-SEC-004, 요청 제한은 429 EX-OPS-001 로 던진다.
 */
export function getConsentView(accessAddressId: string): Promise<ConsentView> {
  return apiGet<ConsentView>(`/api/consent/${encodeURIComponent(accessAddressId)}`);
}

/**
 * 동의/거부 제출·승인 게이팅(POST /api/interlock/approve, PROC-202 — 승인 시 내부 PROC-203).
 * 성공(승인 완료·거부 정상 종료) → 200 { result }. 실패는 ApiError 로 던지며 화면(ConsentPage)이
 * code 별로 분기한다: EX-SEC-006(복호화 실패·재입력) · EX-SEC-007/EX-BIZ-008(링크 오류) ·
 * EX-BIZ-004(전달 실패·재시도) · EX-OPS-001(요청 제한) · EX-SEC-004/EX-SEC-005(형식·크기 오류).
 */
export function submitApproval(params: ApproveParams): Promise<ApproveResult> {
  return apiPost<ApproveResult>('/api/interlock/approve', params);
}
