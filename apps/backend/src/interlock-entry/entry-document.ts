// 진입 화면 문서 조립 — 허브가 React 빌드 산출물(apps/frontend/dist/index.html)을 읽어 초기
// 상태 스크립트 요소를 끼워 넣은 문서를 만든다(spec-functions-api-user.md §초기 상태 주입 형식
// 4) 정적 서빙 배선 "이 스크립트 요소는 진입 경로 처리(허브)가 문서를 만들 때 넣는다"). 순수
// 함수 위주라 DI 가 필요 없다 — 컨트롤러(entry.controller.ts)와 전역 예외 필터의 진입 경로
// 한정 폴백(common/filters/global-exception.filter.ts) 양쪽이 이 모듈을 그대로 가져다 쓴다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INITIAL_STATE_ELEMENT_ID, renderInitialStateScript } from './entry-initial-state-escape';
import type { EntryInitialState } from './entry-initial-state.model';

/**
 * React 빌드 산출물 폴더 계산 — main.ts `FRONTEND_DIST_DIR` 와 같은 근거(그 파일 상단 주석 참고
 * — `__dirname` 기준 계산이 `nest start`(ts-node, src 실행)·`node dist/main`(컴파일 산출물) 두
 * 실행 방식 모두에서 같은 상대 위치를 가리킨다). 이 파일은 `src/interlock-entry/`(또는 컴파일된
 * `dist/interlock-entry/`) 에 있어 main.ts 보다 한 단계 더 깊다 — 그래서 `..` 가 main.ts 의
 * `../../frontend/dist` 보다 하나 더 필요하다(`interlock-entry` → `src|dist` → `backend` →
 * `apps` → `frontend/dist`).
 */
const FRONTEND_DIST_DIR = resolve(__dirname, '../../../frontend/dist');
const INDEX_HTML_PATH = resolve(FRONTEND_DIST_DIR, 'index.html');

const BODY_CLOSE_TAG = '</body>';

// 기동 후 첫 호출에서 한 번만 동기 읽기 — 이후 요청은 메모리 사본만 쓴다. Node 는 단일 스레드로
// readFileSync() 를 끝까지 실행하므로 동시 요청 사이에서도 이 대입이 두 번 일어나지 않는다.
// 배포 단위가 단일(infra.md §애플리케이션 구성)이라 재배포는 곧 프로세스 재기동이며, 프로세스
// 수명 동안 산출물이 바뀔 일이 없다 — "기동 시 한 번 읽어 보유하는 불변 값" 관례(config/ 의
// InterlockConfigService 와 같은 태도)를 이 파일 자신의 지연 캐시로 구현한다.
let cachedTemplate: string | undefined;

function loadTemplate(): string {
  if (cachedTemplate === undefined) {
    cachedTemplate = readFileSync(INDEX_HTML_PATH, 'utf-8');
  }
  return cachedTemplate;
}

/**
 * 진입 화면 문서를 조립한다 — React 빌드 셸(`index.html`)의 `</body>` 직전에 초기 상태
 * `<script>` 요소를 끼워 넣는다. 문서 안 위치는 화면(hydration.ts)이 `id` 로 찾아 판독하므로
 * 임의다(spec-functions-api-user.md §초기 상태 주입 형식 1) 2 "문서 안 위치·순서에 의존하지
 * 않는다") — `</body>` 직전은 개발 서버 플러그인(vite.config.ts `injectTo: 'body'`)과 같은
 * 자리를 골라 두 경로의 결과 문서가 구조적으로 닮게 했을 뿐, 사양이 강제하는 자리는 아니다.
 *
 * `</body>` 를 찾지 못하면(비정상 빌드 산출물) 문서 끝에 그대로 이어 붙인다 — 초기 상태
 * 요소 자체는 항상 정확히 하나 존재해야 하므로(§초기 상태 주입 형식 1) 1) 위치를 못 찾았다고
 * 요소 삽입을 포기하지 않는다.
 */
export function renderEntryDocument(state: EntryInitialState): string {
  const template = loadTemplate();
  const script = renderInitialStateScript(state);
  const insertAt = template.lastIndexOf(BODY_CLOSE_TAG);
  if (insertAt === -1) {
    return template + script;
  }
  return template.slice(0, insertAt) + script + template.slice(insertAt);
}

/**
 * `renderEntryDocument()` 자신이 실패하는(예: `apps/frontend/dist` 결손) 극단적 상황에서 쓰는
 * 최종 폴백 — 파일 읽기를 다시 타지 않는 순수 문자열 리터럴이라 이 자체가 또 실패할 경로가
 * 없다. 두 호출측이 공유한다: (1) `entry.controller.ts` `handleEntry()` 가장 바깥 catch, (2)
 * `common/filters/global-exception.filter.ts` 의 진입 경로 한정 폴백(핸들러 밖 — Express 본문
 * 파서가 라우팅 자체를 건너뛰는 경우, accountinterlockhub#484 §인계 사항 3). 두 자리 모두
 * "판정과 무관하게 200 + 화면 문서"를 지켜야 하므로 같은 상수 하나를 쓴다(단일 출처).
 */
export const HARD_FALLBACK_DOCUMENT =
  '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>AccountInterlockHub</title></head>' +
  `<body><div id="root"></div><script id="${INITIAL_STATE_ELEMENT_ID}" type="application/json">` +
  '{"stage":"RESULT","reasonCode":"EX-OPS-002","resultPath":2,"isReAnnouncement":false}</script></body></html>';
