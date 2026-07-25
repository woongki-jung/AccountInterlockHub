import { useEffect, useRef } from 'react';

/**
 * 단계가 바뀔 때 새 제목(h1)으로 포커스를 옮기고 문서 제목을 같은 문구로
 * 맞춘다 — design-system.md §접근성 기준 "상태 알림".
 *
 * StageTitle·ResultPanel 양쪽이 각자의 <h1> 을 그리므로(전자는
 * --font-size-xl, 후자는 결과 패널 자체 구조의 --font-size-2xl —
 * design-system-components.md §StageTitle·§ResultPanel) 동작을 훅 하나로
 * 공유해 두 곳에서 같은 규칙이 어긋나지 않게 한다.
 *
 * @param title 지금 보이는 제목 문구. 빈 문자열이면 아무 것도 하지 않는다.
 */
export function useStageFocus(title: string) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!title) return;
    document.title = title;
    // 새 단계 진입 시 스크린리더 사용자에게 변화를 알리기 위해 제목으로
    // 포커스를 옮긴다. h1 은 tabindex="-1" 로 두어 포커스만 받고 탭
    // 순서에는 끼지 않는다(design-system-components.md §StageTitle).
    headingRef.current?.focus();
    // title 이 바뀔 때(= 화면이 바뀔 때)만 재실행한다. headingRef 는 매
    // 렌더 같은 ref 객체라 의존성에 넣을 필요가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return headingRef;
}
