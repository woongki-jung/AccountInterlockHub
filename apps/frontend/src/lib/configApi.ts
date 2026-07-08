/*
 * 연동 구성 등록·편집·상세 API 호출 — SVC-001 / PROC-101 · PROC-102.
 * 백엔드 계약(ADM-P4 config.controller/service)을 그대로 소비한다 — 엔드포인트·필드명·타입을 임의로 바꾸지 않는다.
 *  - CREATE: POST /api/admin/configs
 *  - EDIT:   PUT  /api/admin/configs/:id (config_code 는 서버 불변 — 제출해도 무시됨)
 *  - DETAIL: GET  /api/admin/configs/:id (PROC-102, ADM-P6 착수 예정 — 착수 전에는 오류)
 * 성공 응답 data 는 MDL-101(ConfigDetail, 자식·userKeyParamId 포함).
 */
import { apiGet, apiPost, apiRequest } from './apiClient';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

/** 요청 DTO — 동의 항목(ENT-002). */
export interface ConsentItemPayload {
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}

/** 요청 DTO — 전달 파라미터(ENT-003). isUserKey 는 지정 행만 true(정확히 1개). */
export interface ParameterPayload {
  name: string;
  sourceKeyA: string;
  deliverToB: boolean;
  required: boolean;
  order: number;
  isUserKey: boolean;
}

/** 요청 DTO — MDL-101(SaveConfigDto 형상). */
export interface SaveConfigPayload {
  configCode: string;
  configName: string;
  serviceAEntryUrl: string;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: HttpMethod;
  isActive: boolean;
  consentItems: ConsentItemPayload[];
  parameters: ParameterPayload[];
}

/** 응답 DTO — 동의 항목(id 포함). */
export interface ConsentItemResponse {
  id: string;
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}

/** 응답 DTO — 전달 파라미터(id·isUserKey 포함). */
export interface ParameterResponse {
  id: string;
  name: string;
  sourceKeyA: string;
  deliverToB: boolean;
  required: boolean;
  order: number;
  isUserKey: boolean;
}

/** 응답 DTO — MDL-101 상세(자식·지정 참조·타임스탬프 포함). */
export interface ConfigDetail {
  id: string;
  configCode: string;
  configName: string;
  serviceAEntryUrl: string;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: HttpMethod;
  isActive: boolean;
  userKeyParamId: string | null;
  consentItems: ConsentItemResponse[];
  parameters: ParameterResponse[];
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const BASE = '/api/admin/configs';

/** 신규 등록(POST). 성공 → 저장된 구성(id 포함). 실패 → ApiError(422/409/400/401). */
export function createConfig(payload: SaveConfigPayload): Promise<ConfigDetail> {
  return apiPost<ConfigDetail>(BASE, payload);
}

/** 편집(PUT). config_code 는 서버 불변(제출값 무시). 실패 → ApiError(422/409/400/401). */
export function updateConfig(id: string, payload: SaveConfigPayload): Promise<ConfigDetail> {
  return apiRequest<ConfigDetail>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
}

/**
 * 상세 조회(GET, PROC-102). 편집 진입 프리필·상세 화면 공용.
 * 대상 없음은 오류가 아니라 200 { data: null } 로 오므로 null 을 반환할 수 있다.
 * ⚠️ GET 상세 엔드포인트는 ADM-P6 에서 구현된다 — 착수 전에는 ApiError(404/500 등)로 실패한다.
 */
export function getConfigDetail(id: string): Promise<ConfigDetail | null> {
  return apiGet<ConfigDetail | null>(`${BASE}/${encodeURIComponent(id)}`);
}
