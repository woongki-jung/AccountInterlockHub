import { InterlockTrackingModel, ResultCode } from '../entities';
import { QueryExecutor } from './query-executor';

/** FN-007 3분기 판정 결과값(BIZ-002-03 ①②③). */
export type TrackingBranch = 'NONE' | 'OPEN' | 'FIXED';

/** FN-007 출력(function_FN-007-008.md §시그니처) — 예외를 던지지 않는다(대상 없음도 정상 결과). */
export interface TrackingLookupResult {
  readonly branch: TrackingBranch;
  readonly record: InterlockTrackingModel | null;
}

/** FN-008 출력 — `NONE` 은 반환되지 않는다(확보 후 상태는 `OPEN`·`FIXED` 뿐). */
export interface TrackingSecureResult {
  readonly branch: 'OPEN' | 'FIXED';
  readonly record: InterlockTrackingModel;
  /** 이번 호출에서 새로 만들었는지 여부 — 요청 수 계수 여부와 같다. */
  readonly isCreated: boolean;
}

/**
 * PROC-301 §진입점의 다섯 계기(process_PROC-301.md §진입점 및 진입 조건 — 호출 지점·수행 단계는
 * 그 표가 정본이다). tracking-record.process.ts(TrackingRecordProcessService)의 `kind` 디스패처가
 * 이 값으로 분기한다.
 */
export const TRACKING_RECORD_KIND_VALUES = [
  'LOOKUP',
  'SECURE',
  'FIX_RESULT',
  'CONFIRM_RESULT',
  'RECORD_CALLBACK',
] as const;
export type TrackingRecordKind = (typeof TRACKING_RECORD_KIND_VALUES)[number];

/**
 * PROC-301 입력(process_PROC-301.md §입력/출력 정의) — kind 별로 필수 인자가 갈린다. `exec` 는
 * **`LOOKUP` 외 전부 필수**, `at` 도 **`LOOKUP` 외 전부 필수**다. 식별 유니온으로 표현해 컴파일
 * 타임에 kind 별 필수 인자를 강제한다(metric-event.types.ts 의 `MetricEvent` 와 같은 관례 — 사양을
 * 확장·완화하지 않고 타입 수준에서 그대로 옮긴 것 뿐이다).
 */
export type TrackingRecordInput =
  | { readonly kind: 'LOOKUP'; readonly trackingKey: string; readonly exec?: QueryExecutor }
  | { readonly kind: 'SECURE'; readonly trackingKey: string; readonly at: Date; readonly exec: QueryExecutor }
  | {
      readonly kind: 'FIX_RESULT';
      readonly trackingKey: string;
      readonly resultCode: ResultCode;
      readonly at: Date;
      readonly exec: QueryExecutor;
    }
  | { readonly kind: 'CONFIRM_RESULT'; readonly trackingKey: string; readonly at: Date; readonly exec: QueryExecutor }
  | {
      readonly kind: 'RECORD_CALLBACK';
      readonly trackingKey: string;
      readonly at: Date;
      readonly exec: QueryExecutor;
    };

/**
 * PROC-301 출력(§입력/출력 정의) — `kind` 로 태그해 호출측이 판별 유니온으로 분기할 수 있게 한다
 * (`B7` "기록 결과 반환 — 계기별 반환 값, 상위 프로세스가 응답을 만든다").
 */
export type TrackingRecordOutput =
  | ({ readonly kind: 'LOOKUP' } & TrackingLookupResult)
  | ({ readonly kind: 'SECURE' } & TrackingSecureResult)
  | { readonly kind: 'FIX_RESULT'; readonly record: InterlockTrackingModel }
  | { readonly kind: 'CONFIRM_RESULT'; readonly confirmedAt: Date | null }
  | { readonly kind: 'RECORD_CALLBACK'; readonly callbackReceivedAt: Date };
