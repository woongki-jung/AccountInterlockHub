import styles from './Spinner.module.css';

interface SpinnerProps {
  /** 20px(버튼 안) 또는 32px(진행 화면) — design-system-components.md §Spinner */
  size?: 20 | 32;
}

/**
 * 원형 진행 표시 — design-system-components.md §Spinner.
 * 상태는 곁의 문구가 전달하므로 aria-hidden 이다. 진행률을 알 수 없으므로
 * 퍼센트·남은 시간을 표시하지 않는다.
 */
export function Spinner({ size = 20 }: SpinnerProps) {
  const borderWidth = size === 32 ? 3 : 2;
  return (
    <span
      className={styles.spinner}
      aria-hidden="true"
      style={{ width: size, height: size, borderWidth, color: 'currentColor' }}
    />
  );
}
