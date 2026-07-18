/*
 * Button(user/primary·secondary·ghost-link) — 사용자 표면 전용 버튼(design-system.md §컴포넌트 사용자 변형).
 * 공통 Button(관리자, `components/Button.tsx`)은 그대로 두고 별도로 둔다 — 관리자 화면 렌더 불변 보장
 * (SCR-005 build 지침 §2-1). variant 종류·크기·모션이 관리자 Button 과 달라 additive prop 확장이 아니라
 * 완전히 분리된 컴포넌트로 구현한다.
 *
 * loading 스피너는 공통 Spinner(700ms linear)가 아니라 사용자 표면 전용 규격(800ms linear,
 * prefers-reduced-motion 시 정지)을 이 파일 안에서 별도로 구현한다(design-system.md §모션).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './UserButton.module.css';

type UserButtonVariant = 'primary' | 'secondary' | 'ghost-link';

export interface UserButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: UserButtonVariant;
  /** 제출 대기 — 스피너 노출 + 비활성 + aria-busy(승인·거부 버튼 전용, ghost-link 는 미사용). */
  loading?: boolean;
  children: ReactNode;
}

const variantClass: Record<UserButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  'ghost-link': styles.ghostLink,
};

export function UserButton({
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: UserButtonProps) {
  const classes = [styles.button, variantClass[variant], className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} role="status" aria-label="처리 중" />}
      <span className={loading ? styles.loadingLabel : undefined}>{children}</span>
    </button>
  );
}
