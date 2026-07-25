import { useStageFocus } from '../hooks/useStageFocus';
import styles from './StageTitle.module.css';

interface StageTitleProps {
  title: string;
  subtitle?: string;
}

/**
 * 화면 제목(h1) + 보조 설명 — design-system-components.md §StageTitle.
 *
 * 문서에 <h1> 은 하나이며 단계가 바뀌면 내용이 교체된다. 교체 시
 * tabindex="-1" 인 이 제목으로 포커스를 옮기고 document.title 도 같은
 * 문구로 맞춘다(useStageFocus).
 */
export function StageTitle({ title, subtitle }: StageTitleProps) {
  const headingRef = useStageFocus(title);

  return (
    <div className={styles.wrap}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </div>
  );
}
