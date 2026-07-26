import type { ResultPath } from '../api/types';

// 결과 3경로의 확정 문구 — 정본: docs/specs/screens/design-system.md
// §결과 3경로의 시각 구분 · docs/specs/screens/screen_SCR-004.md §결과
// 3경로 · §확정 결과 재안내 · §복귀 이동. spec-screens.md §확정 사항이
// "확정"(미정 아님)으로 못박은 값이라 컴포넌트 기본값으로 안전하게 굳힌다
// — 화면(P15·P16)이 그대로 쓰거나 필요하면 props 로 덮어쓸 수 있다.

export type ResultKind = 'success' | 'danger' | 'warning';

interface ResultPathMeta {
  kind: ResultKind;
  title: string;
  nextNote: string;
}

export const RESULT_PATH_META: Record<ResultPath, ResultPathMeta> = {
  1: { kind: 'success', title: '연동이 완료되었습니다', nextNote: '이 화면에서 더 하실 일은 없습니다.' },
  2: {
    kind: 'danger',
    title: '연동을 진행할 수 없습니다',
    nextNote: '연동을 요청한 서비스에서 새 링크를 받아 다시 진행해 주세요.',
  },
  3: {
    kind: 'warning',
    title: '연동을 마치지 못했습니다',
    nextNote: '다시 연동하려면 연동을 요청한 서비스에서 새로 요청해 주세요.',
  },
};

/**
 * 경로 ② 의 설명 — 사유 코드별 선택(screen_SCR-004.md §결과 3경로).
 * 표에 없는 코드는 EX-OPS-002 문구로 수렴한다(같은 문서 "매핑되지 않는
 * 상태는 경로 ②로 안내한다" · FN-014 의 미상 코드 수렴 규칙과 같은 정신).
 */
const PATH2_REASON_DESCRIPTIONS: Record<string, string> = {
  'EX-SEC-001': '연동 링크가 올바르지 않습니다.',
  'EX-SEC-004': '전달 정보가 허용 크기를 넘었습니다.',
  'EX-SEC-002': '연동 요청 정보가 규약과 맞지 않습니다.',
  'EX-OPS-002': '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 경로별 기본 설명 문단. 경로 ②는 사유 코드로 고른다(reasonCode 없으면 EX-OPS-002 문구). */
export function defaultDescriptionFor(resultPath: ResultPath, reasonCode?: string): string {
  if (resultPath === 1) return '요청하신 연동이 정상적으로 처리되었습니다.';
  if (resultPath === 3) return '연동 대상 서비스에 전달하지 못했습니다.';
  return PATH2_REASON_DESCRIPTIONS[reasonCode ?? ''] ?? PATH2_REASON_DESCRIPTIONS['EX-OPS-002'];
}

/** 확정 결과 재안내 — 설명 문단 끝에 붙는 문장(대상 경로 ①·③ 뿐 — EXC-BIZ-14). */
export const RE_ANNOUNCEMENT_SUFFIX =
  '이 연동은 앞서 처리가 끝났고, 지금 보시는 결과가 그때 확정된 결과입니다.';

export const RE_ANNOUNCEMENT_BADGE_LABEL = '이미 처리된 요청입니다';

/** 복귀 안내 영역 고지 문구. */
export const RETURN_NOTICE = '잠시 후 원래 화면으로 자동으로 돌아갑니다.';

/** 복귀 안내 영역 수동 이동 링크 라벨. */
export const RETURN_LINK_LABEL = '지금 돌아가기';

/** "N초 후 이동합니다" — 카운트다운 문구 포맷. */
export function formatReturnCountdown(secondsLeft: number): string {
  return `${secondsLeft}초 후 이동합니다`;
}

/** `returnUrl` 절대 URL 재확인 — 화면이 다시 확인한다(screen_SCR-004.md §복귀 이동). */
export function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}
