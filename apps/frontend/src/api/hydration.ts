import { normalizeResultPath } from './types';
import type { EntryInitialStateDto } from './types';

// 진입 초기 상태 수화(hydration) — PROC-101 F1 "문서 수신 → 초기 상태 해석".
//
// 서버(BE B7)가 화면 문서 + 초기 상태를 함께 응답하고, 그 초기 상태를 담는
// 형식은 spec-functions-api-user.md §초기 상태 주입 형식(확정)이 **정본**
// 이다 — <script id="__INTERLOCK_INITIAL_STATE__" type="application/json">
// 요소를 정확히 하나 두고, 텍스트 내용에 초기 상태 JSON 직렬화 문자열
// 1건(UTF-8)을 담는다. 이 모듈은 그 정본 계약을 그대로 구현한다.
// (이 자리의 과거 서술 — "사양에 형식이 없어 FE 가 임시 관례를 정했다" —
// 는 위 정본이 확정되며 사실이 아니게 됐다 — 회귀 1회차 정정.)
export const INITIAL_STATE_ELEMENT_ID = '__INTERLOCK_INITIAL_STATE__';

/**
 * 값 부재 4조건(spec-functions-api-user.md §초기 상태 주입 형식 3 ·
 * PROC-101 F1)에 해당할 때 공통으로 쓰는 폴백 — stage=RESULT·경로 ②이며
 * **reasonCode 를 만들지 않는다**(사유 코드가 없으면 SCR-004 가 EX-OPS-002
 * 문구로 수렴시킨다 — FN-014·SVC-005 F-003). `IDENTITY` 로 폴백하면
 * 사양 위반이다 — 서버 판정 통과 여부를 알 수 없는 채로 본인확인을 여는
 * 것은 화면이 결과 구분을 추측해 만들어 내는 것이다(BIZ-001-02).
 */
const ABSENT_INITIAL_STATE: EntryInitialStateDto = {
  stage: 'RESULT',
  resultPath: 2,
  isReAnnouncement: false,
};

/**
 * 개발 편의 전용 시작 상태 — `vite dev` 로 백엔드 주입 없이 문서를 직접
 * 열람할 때(스크립트 요소 자체가 없는 경우, 아래 조건 ①)만 쓴다.
 * `import.meta.env.DEV` 가드로 운영 빌드에는 실리지 않는다 — 운영 경로는
 * 조건 ①도 다른 세 조건과 똑같이 `ABSENT_INITIAL_STATE`(경로 ②)로
 * 떨어진다(PROC-101 F1 "IDENTITY 로 폴백하면 사양 위반이다"). 실 배선(P16)
 * 이후에는 백엔드가 항상 태그를 주입하므로 운영 빌드는 이 분기 자체가
 * 없다(`import.meta.env.DEV` 가 프로덕션 빌드에서 상수 false 로 치환돼
 * 번들에서 제거된다).
 */
const DEV_ONLY_STARTING_STATE: EntryInitialStateDto = { stage: 'IDENTITY' };

/**
 * 문서에 주입된 초기 상태를 읽는다. 스켈레톤을 쓰지 않으므로(design-system.md
 * §상태 표현 "초기") 마운트 이전, 즉 첫 렌더의 initial state 계산 시점에
 * 동기로 호출한다 — useEffect 로 나중에 읽지 않는다.
 *
 * 값 부재 4조건(spec-functions-api-user.md §초기 상태 주입 형식 3) — 넷
 * 중 하나면 초기 상태가 없는 것으로 보고 전건 stage=RESULT·경로 ②다.
 *   ① 요소가 없다
 *   ② 같은 id 요소가 둘 이상이다 — `document.getElementById` 는 첫
 *      요소만 돌려줘 이 조건을 절대 검출할 수 없으므로(같은 문서 §초기
 *      상태 주입 형식 1)-2 판독 수단 정본), id 속성 선택자로 전부 모아
 *      개수를 센다.
 *   ③ `JSON.parse` 가 실패한다(빈 텍스트 포함 — 빈 문자열은 유효한 JSON
 *      이 아니다)
 *   ④ `stage` 가 정의된 두 값(IDENTITY·RESULT) 밖이다
 * 위 4조건과 별개로, `stage='RESULT'` 인 값의 `resultPath` 가 1~3 밖이거나
 * 없으면 그 값만 경로 ②로 정규화한다(screen_SCR-004.md §구현 가이드 —
 * 미매핑 catch-all, normalizeResultPath).
 */
export function readInitialState(): EntryInitialStateDto {
  // id 가 일치하는 요소를 전부 모아 개수를 센다 — document.getElementById
  // 는 첫 요소만 반환해 조건 ②(둘 이상)를 절대 검출할 수 없다.
  const matches = document.querySelectorAll(`[id="${INITIAL_STATE_ELEMENT_ID}"]`);

  if (matches.length === 0) {
    // 조건 ① 요소가 없다.
    if (import.meta.env.DEV) {
      // ⚠️ 개발 편의 전용 분기 — 위 DEV_ONLY_STARTING_STATE 주석 참고.
      return DEV_ONLY_STARTING_STATE;
    }
    return ABSENT_INITIAL_STATE;
  }

  if (matches.length > 1) {
    // 조건 ② 같은 id 요소가 둘 이상이다.
    return ABSENT_INITIAL_STATE;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(matches[0].textContent ?? '');
  } catch {
    // 조건 ③ JSON.parse 실패.
    return ABSENT_INITIAL_STATE;
  }

  if (!isValidInitialState(parsed)) {
    // 조건 ④ stage 가 두 값 밖(그 밖의 형상 불일치 포함).
    return ABSENT_INITIAL_STATE;
  }

  if (parsed.stage === 'RESULT') {
    return { ...parsed, resultPath: normalizeResultPath(parsed.resultPath) };
  }
  return parsed;
}

function isValidInitialState(value: unknown): value is EntryInitialStateDto {
  if (typeof value !== 'object' || value === null || !('stage' in value)) return false;
  const stage = (value as { stage: unknown }).stage;
  return stage === 'IDENTITY' || stage === 'RESULT';
}
