// 405(메서드 불일치) 판정의 유일한 근거표 — spec-functions-api.md §인터페이스 카탈로그의 고정
// 경로를 데이터로 옮긴 것이다. 실제 컨트롤러가 아직 배선되지 않은 접점이 있어도(후속 Phase
// 소관) 이 표는 "이 경로가 정의돼 있는가"를 판정하는 데 그 자체로 충분하다 — §구현 메모 참고.

export type KnownHttpMethod = 'GET' | 'POST';

export interface KnownRoute {
  readonly path: string;
  readonly method: KnownHttpMethod;
}

/**
 * spec-functions-api.md §인터페이스 카탈로그의 HTTP 표면 7종 중 **6종**을 담는다.
 *
 * - 사용자 진입 표면 3종: 연동 요청 진입(GET `<INTERLOCK_ENTRY_PATH>`) · 본인확인 제출(POST
 *   `<INTERLOCK_ENTRY_PATH>/verify`) · 동의·승인 제출(POST `<INTERLOCK_ENTRY_PATH>/approve`).
 * - 서버 대면 API 3종: 처리상태 확인(POST `/api/interlock/status`) · 연동 완료 확인(POST
 *   `/api/interlock/completion`) · 완료 콜백(POST `/api/interlock/callback`).
 *
 * `interlockEntryPath` 만 배포마다 달라지는 상수라 인자로 받는다(`OPS-001-04` — 값을 본문에
 * 복제하지 않는다). 그 밖의 경로(서버 대면 API 3종·`/verify`·`/approve` 접미사)는 사양이 직접
 * 고정한 리터럴 경로라 상수 주입 대상이 아니다(§인터페이스 카탈로그 표에 플레이스홀더 없이
 * 그대로 적혀 있다).
 *
 * **자가진단 경로(`<SELFCHECK_PATH>`)는 의도적으로 이 표에 넣지 않는다** — 넣으면 메서드가
 * 다를 때 405 를 돌려주게 되어 "이 경로가 존재한다"는 사실이 새어 나간다. 자가진단 경로는
 * 메서드가 달라도 항상 일반 404 여야 한다(`SEC-003-02` · spec-functions-api.md §경로·메서드
 * 규약 "자가진단 경로는 메서드가 달라도 일반 404"). 이 표에서 빠진 경로는 route-guard
 * 미들웨어를 그대로 통과해(next()) 전역 예외 필터의 "본문 없는 일반 404" 로 귀결되므로, 이
 * 제외 하나만으로 그 요구가 성립한다 — 별도 특례 분기를 두지 않는다.
 *
 * **컨트롤러 미배선 상태에서도 성립하는 이유** — 이 표는 "실제로 등록된 Nest 라우트 목록"이
 * 아니라 "사양이 정의한 경로 목록"이다. 아직 컨트롤러가 없는 경로는 메서드가 맞아도(next()
 * 이후) Nest 라우팅이 못 찾아 404 로 끝나지만, 메서드가 틀리면 이 표 덕분에 지금도 405 로
 * 정확히 끝난다. 후속 Phase 가 실제 컨트롤러를 추가하면 메서드가 맞는 요청은 Nest 라우팅이
 * 가로채 정상 처리하고(이 미들웨어는 next() 로 흘려보낼 뿐 응답을 만들지 않는다), 메서드가
 * 틀린 요청은 계속 이 표가 405 로 처리한다 — 등록 순서·타이밍에 의존하지 않는다.
 */
export function buildKnownRoutes(interlockEntryPath: string): KnownRoute[] {
  return [
    { path: interlockEntryPath, method: 'GET' },
    { path: `${interlockEntryPath}/verify`, method: 'POST' },
    { path: `${interlockEntryPath}/approve`, method: 'POST' },
    { path: '/api/interlock/status', method: 'POST' },
    { path: '/api/interlock/completion', method: 'POST' },
    { path: '/api/interlock/callback', method: 'POST' },
  ];
}
