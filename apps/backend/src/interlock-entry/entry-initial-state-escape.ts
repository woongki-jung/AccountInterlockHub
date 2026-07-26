// 진입 화면 문서에 초기 상태를 담는 그릇 — spec-functions-api-user.md §초기 상태 주입 형식(확정).
// `<script id="__INTERLOCK_INITIAL_STATE__" type="application/json">` 요소를 정확히 하나 두고,
// 텍스트 내용에 초기 상태의 JSON 직렬화 1건(UTF-8)을 담는다. 전역 변수 주입(`window.__X = {…}`)·
// 별도 API 를 쓰지 않는다(같은 절 1) 3·5 — 데이터 블록은 미평가, 첫 그림 공백 방지).
//
// 화면 판독측(apps/frontend/src/api/hydration.ts INITIAL_STATE_ELEMENT_ID)·개발 서버 주입측
// (apps/frontend/vite.config.ts escapeForScriptTag)과 **같은 id·같은 이스케이프 규칙**을 쓴다 —
// 세 자리가 각자 다른 언어(TS 서버/브라우저 번들/Node 빌드 도구)로 갈라져 있어 코드 공유가
// 불가능하므로, 규칙 자체가 정본(spec-functions-api-user.md §초기 상태 주입 형식)이고 세 구현이
// 각자 그대로 옮긴다.
import type { EntryInitialState } from './entry-initial-state.model';

/** 화면(hydration.ts)·개발 서버(vite.config.ts)와 반드시 같은 문자열이어야 한다. */
export const INITIAL_STATE_ELEMENT_ID = '__INTERLOCK_INITIAL_STATE__';

// U+2028(LINE SEPARATOR)·U+2029(PARAGRAPH SEPARATOR) — 소스에 리터럴로 박아 두면 편집기·도구를
// 거치며 다른 공백류 문자로 조용히 바뀔 위험이 있다(apps/frontend/vite.config.ts 의 같은 주석 —
// 실제로 한 번 일어났던 사고다). 정규식·문자열 리터럴에 직접 타이핑하지 않고 코드 포인트로만
// 만든다(accountinterlockhub#484 인계 사항 — P14 doer 가 정확히 이 함정에 걸렸다).
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * 주입 측(서버) 이스케이프 의무(spec-functions-api-user.md §초기 상태 주입 형식 2) — JSON
 * 직렬화 결과에서 다섯 문자를 **값의 출처·내용을 따지지 않고 무조건** 치환한다. 다섯 표기 모두
 * 유효한 JSON 문자열 이스케이프라 `JSON.parse` 가 원래 문자로 복원한다(값이 바뀌지 않는다) —
 * 화면은 역이스케이프를 하지 않는다.
 *
 * **조건부 이스케이프를 만들지 않는 이유** — 지금은 서버 고정 어휘(`stage`·`resultPath` 등
 * 열거값)뿐이지만, 계약에 자리를 둔 `returnUrl` 은 출처 자체가 미확정이라(PRD §미결·확인 필요
 * ⑦) 외부 입력이 될 수 있다. 출처를 따지는 방어는 출처가 바뀌는 순간 조용히 무력화된다.
 */
export function escapeInitialStateJson(json: string): string {
  return json
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

/**
 * `state` 를 §초기 상태 주입 형식이 정한 `<script>` 요소 문자열로 렌더링한다. 호출측
 * (`entry-document.ts`)이 이 문자열을 진입 화면 문서(정확히 한 자리)에 삽입한다.
 */
export function renderInitialStateScript(state: EntryInitialState): string {
  const json = JSON.stringify(state);
  const escaped = escapeInitialStateJson(json);
  return `<script id="${INITIAL_STATE_ELEMENT_ID}" type="application/json">${escaped}</script>`;
}
