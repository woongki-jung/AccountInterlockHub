import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 진입 초기 상태 스크립트 요소 id — apps/frontend/src/api/hydration.ts 의
// INITIAL_STATE_ELEMENT_ID 와 반드시 같은 문자열이어야 한다. 이 파일은
// Node 실행 컨텍스트(vite.config.ts)라 브라우저 코드인 src/ 를 끌어오지
// 않고 리터럴로 중복한다 — 값 자체는 spec-functions-api-user.md §초기
// 상태 주입 형식이 확정한 고정 문자열이라("요소 id·형식은 바뀌지
// 않았다") 실제로 갈릴 위험은 낮다.
const INITIAL_STATE_ELEMENT_ID = '__INTERLOCK_INITIAL_STATE__';

// U+2028(LINE SEPARATOR)·U+2029(PARAGRAPH SEPARATOR) — 소스 코드에
// 리터럴로 박아 두면 편집기·도구를 거치며 다른 공백류 문자로 조용히
// 바뀔 위험이 있어(회귀 2회차 자체 발견 — 최초 시도에서 실제로 이 일이
// 일어났다), 코드 포인트로만 만든다.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * spec-functions-api-user.md §초기 상태 주입 형식 2 — 주입 측(서버)
 * 이스케이프 의무. 다섯 문자를 값의 출처를 따지지 않고 무조건 치환한다
 * (전부 유효한 JSON 이스케이프라 값이 바뀌지 않는다 — 화면은 역이스케이프를
 * 하지 않는다). 아래 dev 편의 값은 고정 어휘라 실제로는 no-op 이지만,
 * 주입 계층이 지켜야 할 계약을 그대로 따른다.
 */
function escapeForScriptTag(json: string): string {
  return json
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

/**
 * 개발 서버 전용 초기 상태 주입 — 회귀 2회차 I-B 시정.
 *
 * 운영 배선(P16 — apps/backend)이 진입 응답 문서에 항상 넣어 주는
 * `<script id="__INTERLOCK_INITIAL_STATE__" type="application/json">` 를
 * `vite dev`(백엔드 없이 index.html 을 직접 서빙하는 개발 서버)에서는
 * 아무도 넣어 주지 않는다. 이 공백을 (예전처럼) hydration.ts 의 판독
 * 함수 안에 `import.meta.env.DEV` 분기로 메우면 그 함수가 더 이상
 * 사양의 무조건 규칙(부재 판정 4조건 전건 → 경로 ②)을 그대로 구현하지
 * 않게 되고, dev 서버에서는 조건 ②③④·JSON.parse·normalizeResultPath 를
 * 포함한 수화 판독 경로 전체가 죽은 코드가 되어(개발 환경에서만) 배선
 * 오류 탐지 수단이 꺼진다(tc_USR-01.md 의 USR-01_014 가 dev 에서
 * 재현 불가해진다).
 *
 * 그래서 개발 편의는 판독 함수가 아니라 **주입 계층**(이 플러그인)에
 * 둔다 — dev 서버가 실제 배선이 하는 일(초기 상태 스크립트 주입)을
 * 흉내 내면, hydration.ts 는 dev·build·운영 어디서나 완전히 같은 코드
 * 경로로 판독한다(사양 일탈 0, 배선 오류 탐지력도 dev 에서 그대로 산다).
 *
 * `apply: 'serve'` — 개발 서버에서만 동작한다. `vite build` 산출물
 * (dist/index.html)에는 이 스크립트가 실리지 않는다(빌드 후 dist/index.html
 * 직접 열람으로 자가 확인 — 완료 보고 참고).
 */
function devOnlyInitialStatePlugin(): Plugin {
  return {
    name: 'dev-only-initial-state',
    apply: 'serve',
    transformIndexHtml() {
      // 개발 편의 값 — 백엔드 없이 SCR-001 부터 바로 확인한다(예전
      // DEV_ONLY_STARTING_STATE 와 같은 값). 부재 판정 4조건 자체는
      // hydration.ts 가 예외 없이 구현하므로, 이 태그가 없거나 둘 이상
      // 되거나 손상되면 dev 에서도 여느 환경과 똑같이 경로 ②로 떨어진다.
      const json = escapeForScriptTag(JSON.stringify({ stage: 'IDENTITY' }));
      return [
        {
          tag: 'script',
          attrs: { id: INITIAL_STATE_ELEMENT_ID, type: 'application/json' },
          children: json,
          injectTo: 'body',
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devOnlyInitialStatePlugin()],
});
