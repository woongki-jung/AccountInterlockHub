/*
 * Button — 공통 버튼(design-system.md §공통 컴포넌트).
 * 변형 primary·secondary·danger·ghost / 크기 md(40px)·sm(32px).
 * 로딩 시 스피너 병기 + disabled(aria-busy). 최소 터치 영역 40x40px(md).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 전체 폭(카드 내 주요 액션 등). */
  fullWidth?: boolean;
  /** 로딩 상태 — 스피너 노출 + 비활성 + aria-busy. */
  loading?: boolean;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  ghost: styles.ghost,
};

const sizeClass: Record<ButtonSize, string> = {
  md: styles.sizeMd,
  sm: styles.sizeSm,
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variantClass[variant],
    sizeClass[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
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
      {loading && <Spinner size={size === 'sm' ? 'sm' : 'md'} />}
      <span className={loading ? styles.loadingLabel : undefined}>{children}</span>
    </button>
  );
}
