/*
 * SCR-003 발송처 접근 주소 구성 폼 상태·검증·직렬화 순수 헬퍼 — PROC-101 §FE 측 처리.
 * 화면 컴포넌트(ConfigFormPage)가 상태 관리·렌더에 집중하도록 초기화·검증·요청 DTO 변환·프리필 매핑을 분리한다.
 * 유효성 규칙·에러 메시지는 SCR-003 §입력 폼 정의를 정본으로 한다(서버 재검증 전제의 1차 방어).
 *
 * `#214`(P3) 로 서비스 A 진입 주소·전달 파라미터 정의·사용자 키값 exactly-one 지정을 전량 제거했다(EXC-BIZ-14
 * — 회원 키·연동 추적 키는 발송처가 암호화 JSON(encX·encY)에 담아 전달). `#215` 로 consentNotice(동의 대상
 * 설명 문구, 선택·≤1000, BIZ-002-08)를 신설했다.
 */
import type { ConfigDetail, HttpMethod, SaveConfigPayload } from './configApi';

/** 전달 방식 옵션(Select 바인딩). */
export const HTTP_METHOD_OPTIONS: Array<{ value: HttpMethod; label: string }> = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
];

/** 필드 길이 상한(SCR-003 §입력 폼 정의). */
export const LIMITS = {
  configCode: 64,
  configName: 100,
  consentNotice: 1000,
  url: 2048,
  consentLabel: 200,
  consentDescription: 1000,
} as const;

const URL_RE = /^https?:\/\/\S+$/;

/** 동의 항목 행(폼 상태 — key 는 React 안정 식별자, 서버 전송 안 함). */
export interface ConsentItemForm {
  key: string;
  label: string;
  description: string;
  termsContent: string;
  required: boolean;
}

/** SCR-003 폼 전체 상태. */
export interface ConfigFormState {
  configCode: string;
  configName: string;
  consentNotice: string;
  serviceBDeliveryUrl: string;
  serviceBHttpMethod: HttpMethod;
  isActive: boolean;
  consentItems: ConsentItemForm[];
}

export interface RowConsentErrors {
  label?: string;
  description?: string;
}

/** 폼 에러 집합(스칼라 필드·목록 수준·행 수준). */
export interface FormErrors {
  configCode?: string;
  configName?: string;
  consentNotice?: string;
  serviceBDeliveryUrl?: string;
  serviceBHttpMethod?: string;
  consentItems?: string;
  consentRows?: RowConsentErrors[];
}

// 행 key 시퀀스(세션 내 유일하면 충분 — React 재정렬 방지 목적).
let rowKeySeq = 0;
function nextKey(prefix: string): string {
  rowKeySeq += 1;
  return `${prefix}-${rowKeySeq}`;
}

/** 신규 동의 항목 행(기본값). */
export function newConsentRow(): ConsentItemForm {
  return { key: nextKey('consent'), label: '', description: '', termsContent: '', required: false };
}

/** 등록(신규) 초기 상태 — 동의 항목 1행. */
export function createInitialFormState(): ConfigFormState {
  return {
    configCode: '',
    configName: '',
    consentNotice: '',
    serviceBDeliveryUrl: '',
    serviceBHttpMethod: 'POST', // MDL-101 기본값
    isActive: true,
    consentItems: [newConsentRow()],
  };
}

/** 편집 진입 프리필 — 상세(MDL-101) → 폼 상태. */
export function formStateFromDetail(detail: ConfigDetail): ConfigFormState {
  const consentItems: ConsentItemForm[] = (detail.consentItems ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      key: nextKey('consent'),
      label: c.label,
      description: c.description ?? '',
      termsContent: c.termsContent ?? '',
      required: c.required,
    }));
  return {
    configCode: detail.configCode,
    configName: detail.configName,
    consentNotice: detail.consentNotice ?? '',
    serviceBDeliveryUrl: detail.serviceBDeliveryUrl,
    serviceBHttpMethod: detail.serviceBHttpMethod,
    isActive: detail.isActive,
    consentItems: consentItems.length > 0 ? consentItems : [newConsentRow()],
  };
}

/** FE 1차 검증(SCR-003 §입력 폼 정의). 위반 항목만 채운 FormErrors 반환. */
export function validateForm(state: ConfigFormState): FormErrors {
  const errors: FormErrors = {};

  if (state.configCode.trim().length === 0 || state.configCode.length > LIMITS.configCode) {
    errors.configCode = '접근 주소 고유 ID 를 입력해 주세요(최대 64자).';
  }
  if (state.configName.trim().length === 0 || state.configName.length > LIMITS.configName) {
    errors.configName = '구성명을 입력해 주세요(최대 100자).';
  }
  if (state.consentNotice.length > LIMITS.consentNotice) {
    errors.consentNotice = '동의 대상 설명 문구가 너무 깁니다(최대 1000자).';
  }
  if (!URL_RE.test(state.serviceBDeliveryUrl) || state.serviceBDeliveryUrl.length > LIMITS.url) {
    errors.serviceBDeliveryUrl = 'http/https 로 시작하는 수신처 B 주소를 입력해 주세요.';
  }
  if (!HTTP_METHOD_OPTIONS.some((o) => o.value === state.serviceBHttpMethod)) {
    errors.serviceBHttpMethod = '전달 방식을 선택해 주세요.';
  }

  // 동의 항목(목록·행)
  if (state.consentItems.length < 1) {
    errors.consentItems = '동의 항목을 1개 이상 등록해 주세요.';
  }
  const consentRows: RowConsentErrors[] = state.consentItems.map((c) => {
    const rowErr: RowConsentErrors = {};
    if (c.label.trim().length === 0 || c.label.length > LIMITS.consentLabel) {
      rowErr.label = '동의 항목 라벨을 입력해 주세요.';
    }
    if (c.description.length > LIMITS.consentDescription) {
      rowErr.description = '설명이 너무 깁니다(최대 1000자).';
    }
    return rowErr;
  });
  if (consentRows.some((r) => r.label || r.description)) {
    errors.consentRows = consentRows;
  }

  return errors;
}

/** FormErrors 에 하나라도 오류가 있는지. */
export function hasAnyError(errors: FormErrors): boolean {
  if (
    errors.configCode ||
    errors.configName ||
    errors.consentNotice ||
    errors.serviceBDeliveryUrl ||
    errors.serviceBHttpMethod ||
    errors.consentItems
  ) {
    return true;
  }
  return errors.consentRows?.some((r) => r.label || r.description) ?? false;
}

/** 폼 상태 → 요청 DTO(SaveConfigPayload). 트림·order 부여·boolean 정규화·consentNotice 빈값→null. */
export function buildPayload(state: ConfigFormState): SaveConfigPayload {
  const consentNotice = state.consentNotice.trim();
  return {
    configCode: state.configCode.trim(),
    configName: state.configName.trim(),
    consentNotice: consentNotice.length > 0 ? consentNotice : null,
    serviceBDeliveryUrl: state.serviceBDeliveryUrl.trim(),
    serviceBHttpMethod: state.serviceBHttpMethod,
    isActive: state.isActive,
    consentItems: state.consentItems.map((c, i) => ({
      label: c.label.trim(),
      description: c.description.trim().length > 0 ? c.description.trim() : null,
      // 약관 컨텐츠는 본문 서식 보존을 위해 트림하지 않되, 공백뿐이면 null(선택 입력·BIZ-001-06).
      termsContent: c.termsContent.trim().length > 0 ? c.termsContent : null,
      required: c.required,
      order: i,
    })),
  };
}
