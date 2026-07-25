import { ConsentItemConfig } from './interlock-config.types';

/**
 * PROC-901 B3(기동 시 상수 형식 검증)에 쓰는 순수 판정 함수 모음.
 * 값이 아니라 형태만 검사한다(상수표가 정의한 형태 기준) — NestJS 의존이 없어 단독으로 단위 검증할 수 있다.
 */

export function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** 경로 형태 — '/' 로 시작하고 공백·제어문자를 담지 않는다(진입 경로·자가진단 경로). */
export function isPathFormat(value: string): boolean {
  return /^\/[!-~]*$/.test(value);
}

/** URL 형태 — http(s):// 로 시작하는 절대 URL(수신처 전달 주소·복귀 주소). */
export function isUrlFormat(value: string): boolean {
  if (!/^https?:\/\//.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** 개월 수의 양의 정수 — 부호·소수점 없는 십진 정수 문자열만 허용한다(0 이하는 불허). */
export function parsePositiveInteger(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * `<CONSENT_ITEMS>` 파싱 — JSON 배열 구조와 필수 속성(MDL-008)을 검사한다.
 * 형식을 벗어나면 null 을 반환한다(호출측이 미충족 목록에 담는다).
 */
export function parseConsentItems(raw: string): ConsentItemConfig[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 1) return null;

  const items: ConsentItemConfig[] = [];
  const seenCodes = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const { code, label, required, description } = record;
    if (typeof code !== 'string' || code.length === 0) return null;
    if (typeof label !== 'string' || label.length === 0) return null;
    if (typeof required !== 'boolean') return null;
    if (typeof description !== 'string' || description.length === 0) return null;
    if (seenCodes.has(code)) return null; // 항목 코드는 항목 안에서 유일해야 한다(MDL-008)
    seenCodes.add(code);
    items.push({ code, label, required, description });
  }
  return items;
}

/** 항목 코드 오름차순 정렬(MDL-008 · data_ENT-002.md §버전 식별자 산출 규칙 3). */
export function sortConsentItemsByCode<T extends { code: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}
