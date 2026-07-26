// 진입 응답(GET <INTERLOCK_ENTRY_PATH>)이 화면 문서에 싣는 초기 상태 — MDL-009 값 체계를 그대로
// 옮긴다(spec-functions-api-user.md §연동 요청 진입 §처리·응답 규약 5 · §초기 상태 주입 형식).
// 형상은 apps/frontend/src/api/types.ts `EntryInitialStateDto` 와 반드시 같아야 한다(서버가
// 싣는 값과 화면이 읽는 값의 계약이라 필드명·구조를 임의로 바꾸지 않는다).

/** MDL-009 결과 안내 정보 — PROC-105 산출물. `returnUrl` 은 경로 ①(연동 완료)에서만 나타난다. */
export interface ResultInfo {
  readonly resultPath: 1 | 2 | 3;
  readonly isReAnnouncement: boolean;
  readonly returnUrl?: string;
}

/**
 * 진입 응답 초기 상태(spec-functions-api-user.md §처리·응답 규약 5 예시 그대로).
 * `IDENTITY` 는 판정 통과 — `stage` 외 다른 필드를 두지 않는다(PROC-101 B6 "else initial =
 * { stage: 'IDENTITY' }"). `RESULT` 는 판정 실패 → 경로 ②이며 `reasonCode` 를 동반한다.
 * **`returnUrl` 은 이 접점에서 나타나지 않는다** — 진입 판정 실패는 항상 경로 ②라 §복귀 주소
 * 응답 규약의 동봉 조건(경로 ①)이 성립하지 않는다(BIZ-001-06). 계약 형상 자체(선택 필드)는
 * `ResultInfo` 를 그대로 재사용해 세 접점이 같은 모양을 쓰게 한다.
 */
export type EntryInitialState =
  | { readonly stage: 'IDENTITY' }
  | ({ readonly stage: 'RESULT'; readonly reasonCode?: string } & ResultInfo);
