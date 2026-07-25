import { useStageFocus } from '../hooks/useStageFocus';
import styles from './StageTitle.module.css';

/** 크기 변형 2종뿐 — design-system-components.md §StageTitle. 그 밖의 크기를 만들지 않는다. */
export type StageTitleVariant = 'default' | 'result';

interface StageTitleProps {
  title: string;
  subtitle?: string;
  /**
   * 기본(`--font-size-xl`, 화면 제목) 또는 결과(`--font-size-2xl`,
   * SCR-004 결과 제목). 미지정 시 기본(회귀 2회차 I-A — StageTitle 크기
   * 변형 신설).
   */
  variant?: StageTitleVariant;
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
 */
export function StageTitle({ title, subtitle, variant = 'default' }: StageTitleProps) {
  const headingRef = useStageFocus(title);
  const sizeClassName = variant === 'result' ? styles.titleResult : styles.titleDefault;

  return (
    <div className={styles.wrap}>
      <h1 ref={headingRef} tabIndex={-1} className={`${styles.title} ${sizeClassName}`}>
        {title}
      </h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </div>
  );
}
