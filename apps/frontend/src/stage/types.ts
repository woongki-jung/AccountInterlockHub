import type { ConsentConfigDto, ResultPath } from '../api/types';

// 화면 도메인 4단계 — spec-screens.md §화면 코드 체계.
// `PROCESSING`(SCR-003) 은 화면이 소유한 단계라 서버 stage 값에 대응이
// 없다(같은 문서 · 상위 제약 3).

export interface IdentityAlert {
  kind: 'format' | 'mismatch' | 'retryable';
  message: string;
}

export interface ConsentAlert {
  kind: 'gated' | 'blocked' | 'retryable';
  message: string;
}

export interface ResultViewData {
  resultPath: ResultPath;
  /** 경로 ②의 설명 문구 선택에만 쓴다 — 화면에 그리지 않는다(`SEC-002-05`). */
  reasonCode?: string;
  isReAnnouncement: boolean;
  returnUrl?: string;
}

/**
 * 지금 사용자에게 보일 화면과 그 화면의 표시 상태. 네 화면 모두 같은
 * 경로 위의 네 단계이며(상위 제약 9) 이 태그는 라우팅이 아니라 순수
 * 판별값이다 — 이 값이 바뀌어도 URL 은 바뀌지 않는다.
 */
export type ScreenView =
  | { screen: 'SCR-001'; status: 'idle' | 'submitting'; alert: IdentityAlert | null }
  | { screen: 'SCR-002'; consent: ConsentConfigDto; status: 'idle' | 'submitting'; alert: ConsentAlert | null }
  | { screen: 'SCR-003'; unconfirmed: boolean }
  | { screen: 'SCR-004'; result: ResultViewData };
