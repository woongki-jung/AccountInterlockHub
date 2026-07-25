import { InterlockTrackingModel } from '../entities';

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
