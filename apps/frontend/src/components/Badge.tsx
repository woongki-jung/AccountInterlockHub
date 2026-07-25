import { UndoIcon } from './icons';
import styles from './Badge.module.css';

interface BadgeProps {
  variant: 'required' | 'reannounce';
  children: string;
}

/**
 * 필수 표시·확정 결과 재안내 보조 표시 — design-system-components.md §Badge.
 * 조작 요소가 아니므로 히트 영역 규칙을 적용하지 않는다. 글자를 그대로
 * 읽히게 두고(아이콘만 쓰지 않는다), 장식 아이콘은 aria-hidden.
 */
export function Badge({ variant, children }: BadgeProps) {
  const variantClass = variant === 'required' ? styles.required : styles.reannounce;
  return (
    <span className={`${styles.badge} ${variantClass}`}>
      {variant === 'reannounce' ? <UndoIcon size={12} /> : null}
      <span>{children}</span>
    </span>
  );
}
