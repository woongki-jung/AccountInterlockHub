import { ResultCode } from '../entities';

/** FN-013 입력 계기 종류(function_FN-012-013.md §입력/출력 정의). */
export const METRIC_EVENT_KIND_VALUES = ['REQUEST', 'UNIDENTIFIED_FAILURE', 'RESULT'] as const;
export type MetricEventKind = (typeof METRIC_EVENT_KIND_VALUES)[number];

/**
 * FN-013 입력(function_FN-012-013.md §입력/출력 정의) — `resultCode` 는 `kind = 'RESULT'` 일 때만
 * 존재한다. 사양의 조건부 필수(`event.resultCode: kind = RESULT 일 때만 필수`)를 식별 유니온으로
 * 표현해 타입 수준에서 강제한 것일 뿐, 사양을 확장·완화하지 않는다.
 */
export type MetricEvent =
  | { readonly kind: 'REQUEST'; readonly at: Date }
  | { readonly kind: 'UNIDENTIFIED_FAILURE'; readonly at: Date }
  | { readonly kind: 'RESULT'; readonly resultCode: ResultCode; readonly at: Date };
