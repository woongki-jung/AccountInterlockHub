import type { EntryInitialStateDto } from './types';

// 진입 초기 상태 수화(hydration) — PROC-101 F1 "문서 수신 → 초기 상태 해석".
//
// 서버(BE B7)가 화면 문서 + 초기 상태를 함께 응답한다는 것은 확정
// 계약이지만(spec-functions-api-user.md §연동 요청 진입), **그 초기
// 상태를 HTML 문서 안 "어디에" "어떤 형태로" 심는지**는 정적 서빙 배선
// 소관(P16 — apps/backend, 상위 제약 14)이라 어떤 사양 문서에도 전송
// 형식이 못박혀 있지 않다.
//
// 이 모듈은 그 자리를 채우는 FE 쪽 계약이다 — 아래 스크립트 태그
// 관례(id="__INTERLOCK_INITIAL_STATE__"·type="application/json")를
// 표준으로 삼는다. P16 이 정적 서빙을 배선할 때 백엔드가 같은 id·형식으로
// 이 태그를 문서에 주입해야 한다(그렇지 않으면 아래 폴백이 대신 쓰인다).
export const INITIAL_STATE_ELEMENT_ID = '__INTERLOCK_INITIAL_STATE__';

const DEFAULT_INITIAL_STATE: EntryInitialStateDto = { stage: 'IDENTITY' };

/**
 * 문서에 주입된 초기 상태를 읽는다. 스켈레톤을 쓰지 않으므로(design-system.md
 * §상태 표현 "초기") 마운트 이전, 즉 첫 렌더의 initial state 계산 시점에
 * 동기로 호출한다 — useEffect 로 나중에 읽지 않는다.
 *
 * 값이 없거나 stage 가 두 값(IDENTITY·RESULT) 밖이면 PROC-101 F1 규칙대로
 * 결과 경로 ②로 다룬다("빈 화면을 만들지 않는다" — SVC-005 F-003).
 *
 * ⚠️ 임시 폴백: 태그가 없는 경우(`vite dev` 로 백엔드 주입 없이 직접 열람하는
 * 개발 환경 포함) `{ stage: 'IDENTITY' }` 로 시작한다 — PROC-101 이 규정한
 * "값이 없으면 결과 경로 ②" 규칙과 다르다. 진입 판정 실패를 흉내 내기보다
 * 로컬 개발에서 본인확인 화면부터 바로 확인할 수 있게 하려는 의도적 선택이며,
 * 실 배선(P16) 이후에는 백엔드가 항상 태그를 주입하므로 이 분기를 타지 않는다.
 */
export function readInitialState(): EntryInitialStateDto {
  const el = document.getElementById(INITIAL_STATE_ELEMENT_ID);
  if (!el || !el.textContent) {
    return DEFAULT_INITIAL_STATE;
  }

  try {
    const parsed: unknown = JSON.parse(el.textContent);
    if (isValidInitialState(parsed)) {
      return parsed;
    }
  } catch {
    // 파싱 실패 — 아래에서 결과 경로 ②로 처리한다.
  }

  // 태그는 있었지만 값이 두 값 밖이거나 해석할 수 없다 — PROC-101 F1.
  return { stage: 'RESULT', resultPath: 2, isReAnnouncement: false };
}

function isValidInitialState(value: unknown): value is EntryInitialStateDto {
  if (typeof value !== 'object' || value === null || !('stage' in value)) return false;
  const stage = (value as { stage: unknown }).stage;
  return stage === 'IDENTITY' || stage === 'RESULT';
}
