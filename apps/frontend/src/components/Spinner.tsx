/*
 * Spinner — 액션 대기(로딩) 표현(design-system.md §상태 표현: 액션 대기 = Spinner).
 * 색상은 currentColor 를 따르므로 버튼 등 부모의 텍스트 색을 그대로 사용한다.
 */
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** 접근성 라벨. 장식용이면 label 을 비우고 aria-hidden 처리한다. */
  label?: string;
  className?: string;
}

const sizeClass: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const classes = [styles.spinner, sizeClass[size], className].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
