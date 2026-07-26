import { Fragment } from 'react';
import { useStageFocus } from '../hooks/useStageFocus';
import styles from './StageTitle.module.css';

/** 크기 변형 2종뿐 — design-system-components.md §StageTitle. 그 밖의 크기를 만들지 않는다. */
export type StageTitleVariant = 'default' | 'result';

/**
 * 배치 축(P16, `#493`) — 크기 축(`variant`)과 **직교**한다. `design-system-
 * components.md` §StageTitle "여백을 갖는 자리는 카드 직계뿐이다".
 * - `'card'`(기본): 카드의 직계 자식. 기존 여백(`--space-2xs`·`--space-lg`)
 *   그대로 — SCR-001·SCR-002 가 이 값을 쓰며 **거동 무변경**이다.
 * - `'panel'`: `ProgressPanel`·`ResultPanel` 안에 합성될 때. wrapper 를
 *   렌더하지 않고(Fragment) 자기 여백을 하나도 갖지 않는다 — 제목·보조
 *   설명이 **패널의 직계 flex 자식**으로 서야 패널의 간격 모델이 그 사이에
 *   적용된다(한 div 로 묶으면 그 간격이 패널 규칙 밖으로 빠진다).
 */
export type StageTitlePlacement = 'card' | 'panel';

interface StageTitleProps {
  title: string;
  subtitle?: string;
  /**
   * 기본(`--font-size-xl`, 화면 제목) 또는 결과(`--font-size-2xl`,
   * SCR-004 결과 제목). 미지정 시 기본(회귀 2회차 I-A — StageTitle 크기
   * 변형 신설).
   */
  variant?: StageTitleVariant;
  /** 배치 축 — 미지정 시 `'card'`(기존 카드 직계 거동 그대로). */
  placement?: StageTitlePlacement;
  /**
   * 이 마운트에서 제목 자동 포커스를 건너뛴다 — design-system.md §접근성
   * 기준(commit `a8058a0`) "단계 전환과 필드에 매인 안내가 겹치면
   * 포커스는 그 필드가 가져간다". 호출측(화면 컴포넌트)이 필드·첫
   * 미충족 항목 등으로 포커스를 직접 옮길 때만 true 로 넘긴다.
   * `document.title` 갱신은 이 값과 무관하게 항상 수행한다
   * (`useStageFocus`). 미지정 시 `false`(기존 거동 그대로 — SCR-003·
   * SCR-004 는 이 prop 을 넘기지 않아 전역 규칙이 유지된다).
   */
  skipFocus?: boolean;
}

/**
 * 화면 제목(h1) + 보조 설명 — design-system-components.md §StageTitle.
 *
 * 문서에 <h1> 은 하나이며 단계가 바뀌면 내용이 교체된다. 교체 시
 * tabindex="-1" 인 이 제목으로 포커스를 옮기고 document.title 도 같은
 * 문구로 맞춘다(useStageFocus). **ProgressPanel(기본 변형)·ResultPanel
 * (결과 변형)은 자기 제목 글꼴을 따로 규정하지 않고 이 컴포넌트를
 * 합성한다** — 그 제목이 문서의 유일한 <h1> 이자 포커스 대상이라 계약이
 * 두 곳으로 갈리면 안 된다(같은 문서 §StageTitle "합성해 쓰는 자리").
 *
 * 제목의 포커스 표시(2px 안쪽 여백+2px `--color-focus` 링)는 `design-
 * system.md` §접근성 기준 확정(commit `513aca6`, `#493` journal 3562)대로
 * `StageTitle.module.css` `.title:focus` 가 구현한다 — 탭 순서 밖(`tabindex
 * ="-1"`)인 이 제목은 단계 전환의 프로그램적 `.focus()` 가 포커스를 받는
 * 유일한 경로라 `:focus-visible` 하나에만 걸면 규칙이 닿지 않는다(같은
 * 문서 §접근성 기준 근거 문단).
 *
 * `skipFocus` — 단계 전환과 필드에 매인 안내가 겹치는 두 자리(`SCR-001`
 * `BackToIdentity`·`SCR-002` `BackToConsent`(`EX-BIZ-001`))에서는 호출측이
 * true 를 넘겨 이 제목이 포커스를 가져가지 않게 한다(design-system.md
 * §접근성 기준 확정, commit `a8058a0`). React effect 실행 순서(자식이
 * 부모보다 먼저 실행된다)에 기대어 "부모가 나중에 덮어써서 우연히
 * 맞는다"에 의존하지 않는다 — `useStageFocus` 참고.
 */
export function StageTitle({
  title,
  subtitle,
  variant = 'default',
  placement = 'card',
  skipFocus = false,
}: StageTitleProps) {
  const headingRef = useStageFocus(title, skipFocus);
  const sizeClassName = variant === 'result' ? styles.titleResult : styles.titleDefault;

  const heading = (
    <h1 ref={headingRef} tabIndex={-1} className={`${styles.title} ${sizeClassName}`}>
      {title}
    </h1>
  );
  const subtitleClassName =
    placement === 'card' ? `${styles.subtitle} ${styles.subtitleCardGap}` : styles.subtitle;
  const subtitleEl = subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null;

  if (placement === 'panel') {
    // wrapper 미렌더 — 제목·보조 설명이 패널의 직계 flex 자식으로 선다.
    return (
      <Fragment>
        {heading}
        {subtitleEl}
      </Fragment>
    );
  }

  return (
    <div className={styles.wrap}>
      {heading}
      {subtitleEl}
    </div>
  );
}
