import { useEffect, useRef } from 'react';

/**
 * 단계가 바뀔 때 새 제목(h1)으로 포커스를 옮기고 문서 제목을 같은 문구로
 * 맞춘다 — design-system.md §접근성 기준 "상태 알림".
 *
 * **직접 호출처는 StageTitle 하나뿐이다**(회귀 2회차 I-A 정정 — 이전에는
 * ResultPanel 도 자체 <h1> 을 그리며 이 훅을 직접 불렀으나, 그 계약이
 * design-system-components.md §StageTitle 위반이라 지금은 ResultPanel·
 * ProgressPanel 모두 StageTitle 을 합성해 쓸 뿐 이 훅을 직접 부르지
 * 않는다). StageTitle 은 크기 변형 2종(기본·결과) 모두에서 이 훅 하나로
 * 포커스 이동·문서 제목 일치를 수행해, 두 변형이 서로 다른 규칙으로
 * 어긋나지 않게 한다.
 *
 * @param title 지금 보이는 제목 문구. 빈 문자열이면 아무 것도 하지 않는다.
 * @param skipFocus design-system.md §접근성 기준(commit `a8058a0`) —
 *   "단계 전환과 필드에 매인 안내가 겹치면 포커스는 그 필드가 가져간다."
 *   true 면 `document.title` 갱신은 그대로 수행하되 `.focus()` 는 **아예
 *   호출하지 않는다**. 어떤 요소가 대신 포커스를 받을지는 이 훅이
 *   알지 못하고 알 필요도 없다 — 호출측(StageTitle → 화면 컴포넌트)이
 *   자기 소관 요소(필드·첫 미충족 항목)로 포커스를 옮길 책임을 진다.
 *
 *   🔴 React effect 실행 순서(자식이 부모보다 먼저 실행된다)에 기대어
 *   "어차피 부모 effect 가 나중에 덮어써서 우연히 맞는다"에 의존하지
 *   않는다 — 이 훅은 `skipFocus=true` 면 애초에 `focus()` 를 부르지
 *   않으므로, 화면 컴포넌트가 자기 effect 를 부모·자식 어느 순서로
 *   실행하든(향후 컴포넌트 트리가 바뀌어도) 결과가 흔들리지 않는다.
 */
export function useStageFocus(title: string, skipFocus = false) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!title) return;
    document.title = title;
    // 새 단계 진입 시 스크린리더 사용자에게 변화를 알리기 위해 제목으로
    // 포커스를 옮긴다. h1 은 tabindex="-1" 로 두어 포커스만 받고 탭
    // 순서에는 끼지 않는다(design-system-components.md §StageTitle).
    // 단, 필드에 매인 안내가 함께 뜨는 전환에서는 이 호출을 건너뛴다
    // (위 skipFocus 참고).
    if (!skipFocus) {
      headingRef.current?.focus();
    }
    // title 이 바뀔 때(= 화면이 바뀔 때)만 재실행해야 한다 — 그렇지
    // 않으면 사용자가 입력을 고치는 도중 알림이 해제되며 skipFocus 가
    // 바뀌는 것만으로 제목이 포커스를 다시 가로챌 위험이 있다. 그래서
    // skipFocus 를 의존성 배열에는 넣지 않되(회귀 1회차 재판정 S-1 —
    // 렌더 본문에서 ref 에 최신값을 미리 반영해 두는 대신) 위에서 직접
    // 읽는다 — deps 가 [title] 이라 이 effect 가 실행되는 시점의 클로저는
    // 그 렌더에서 캡처된 skipFocus 값을 그대로 담고 있어, ref 경유로
    // "실행 시점의 최신값"을 따로 확보할 필요가 없다(오히려 ref 는 여러
    // 렌더를 거치는 동안 effect 재실행 없이 조용히 최신값으로 갱신될 수
    // 있어 "전환 시점이 아닌 호출 시점"의 값을 읽는 셈이라 덜 정확하다).
    // headingRef 도 매 렌더 같은 ref 객체라 의존성에 넣을 필요가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return headingRef;
}
