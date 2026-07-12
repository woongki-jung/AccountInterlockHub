/*
 * 발송처 접근 주소 구성 등록·편집·상세·목록·활성전환·삭제 API 호출 — SVC-001/SVC-002 / PROC-101·PROC-102·PROC-105·PROC-106.
 * 백엔드 계약(P3 개정판 — accountinterlockhub#227)을 그대로 소비한다 — 엔드포인트·필드명·타입을 임의로 바꾸지 않는다.
 *  - CREATE: POST   /api/admin/configs
 *  - EDIT:   PUT    /api/admin/configs/:id (config_code 는 서버 불변 — 제출해도 무시됨)
 *  - LIST:   GET    /api/admin/configs?active=&keyword=  (MDL-102[] 요약)
 *  - DETAIL: GET    /api/admin/configs/:id               (MDL-101 | null)
 *  - ACTIVE: PATCH  /api/admin/configs/:id/active         ({ id, isActive } | null)
 *  - DELETE: DELETE /api/admin/configs/:id                ({ id, deleted } | null)
 * 성공 응답 data 는 MDL-101(ConfigDetail) 또는 MDL-102(요약, ConfigListItem).
 * 대상 없음은 오류가 아니라 200 { data: null } 로 오므로 null 을 반환할 수 있다(상세·활성·삭제).
 *
 * `#214` 개정(P3): 입력이 단일 암호화 JSON(encX·encY)으로 바뀌어 serviceAEntryUrl·parameters[]·isUserKey·
 * userKeyParamId 를 전량 제거했다(EXC-BIZ-14 — 회원 키·연동 추적 키는 발송처가 전달 데이터 X 안에 담아 전달하며
 * 허브는 구성에 저장하지 않는다). `#215` 로 consentNotice(동의 대상 설명 문구, 선택·≤1000, BIZ-002-08)를 신설했다.
 */
import { apiGet, apiPost, apiRequest } from './apiClient';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

/** 요청·응답 공용 — 동의 항목(ENT-002). */
export interface ConsentItemPayload {
  label: string;
  description: string | null;
  termsContent: string | null;
  required: boolean;
  order: number;
}

/** 요청 DTO — MDL-101(SaveConfigDto 형상). */
export interface SaveConfigPayload {
  configCode: string;
  configName: string;
  consentNotice: string | null;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: HttpMethod;
  isActive: boolean;
  consentItems: ConsentItemPayload[];
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

/** 응답 DTO — MDL-101 상세(자식·타임스탬프 포함). */
export interface ConfigDetail {
  id: string;
  configCode: string;
  configName: string;
  consentNotice: string | null;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: HttpMethod;
  isActive: boolean;
  consentItems: ConsentItemResponse[];
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
 * 상세 조회(GET, PROC-102). 편집 진입 프리필·상세 화면(SCR-004) 공용.
 * 대상 없음은 오류가 아니라 200 { data: null } 로 오므로 null 을 반환할 수 있다.
 */
export function getConfigDetail(id: string): Promise<ConfigDetail | null> {
  return apiGet<ConfigDetail | null>(`${BASE}/${encodeURIComponent(id)}`);
}

/** 활성 필터(조회 조건) — 목록 화면(SCR-002)의 select 값. */
export type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** 목록 조회 조건(SCR-002 §입력 폼 정의). */
export interface ConfigListFilter {
  keyword?: string;
  active?: ActiveFilter;
}

/** 응답 DTO — MDL-102 목록 요약(회원 키·처리 상태 미포함). */
export interface ConfigListItem {
  id: string;
  configCode: string;
  configName: string;
  isActive: boolean;
  createdAt: string | null;
  consentItemCount: number;
}

/** 활성 전환 결과(PROC-105). */
export interface SetActiveResult {
  id: string;
  isActive: boolean;
}

/** 삭제 결과(PROC-106, 소프트 삭제). */
export interface DeleteConfigResult {
  id: string;
  deleted: boolean;
}

/**
 * 목록 조회(GET, PROC-102). 활성 필터·검색어를 query 로 변환한다.
 * active: 'ACTIVE'→'true' · 'INACTIVE'→'false' · 'ALL'/미지정→생략. keyword 는 trim 후 빈 값 생략.
 */
export function listConfigs(filter: ConfigListFilter = {}): Promise<ConfigListItem[]> {
  const params = new URLSearchParams();
  const keyword = filter.keyword?.trim();
  if (keyword) {
    params.set('keyword', keyword);
  }
  if (filter.active === 'ACTIVE') {
    params.set('active', 'true');
  } else if (filter.active === 'INACTIVE') {
    params.set('active', 'false');
  }
  const qs = params.toString();
  return apiGet<ConfigListItem[]>(qs ? `${BASE}?${qs}` : BASE);
}

/**
 * 활성/비활성 전환(PATCH, PROC-105). 대상 없음은 200 { data: null } → null 반환.
 * 실패(4xx/5xx)는 ApiError 로 던진다(세션 만료는 apiClient 중앙 훅이 리다이렉트).
 */
export function setConfigActive(id: string, isActive: boolean): Promise<SetActiveResult | null> {
  return apiRequest<SetActiveResult | null>(`${BASE}/${encodeURIComponent(id)}/active`, {
    method: 'PATCH',
    body: { isActive },
  });
}

/**
 * 소프트 삭제(DELETE, PROC-106). 대상 없음/이미 삭제됨은 200 { data: null } → null 반환.
 * 되돌릴 수 없으므로 화면에서 확인 Modal 을 강제한다.
 */
export function deleteConfig(id: string): Promise<DeleteConfigResult | null> {
  return apiRequest<DeleteConfigResult | null>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
