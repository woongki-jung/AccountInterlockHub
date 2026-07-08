/*
 * Banner — 화면 상단 안내(info·warning·error). design-system.md §공통 컴포넌트.
 * 오류 배너는 role=alert 로, 정보·경고 배너는 role=status 로 노출한다(스크린리더 전달).
 * 색만으로 의미를 전달하지 않도록 접두 텍스트 아이콘을 병기한다(§의미 전달).
 */
import type { ReactNode } from 'react';
import styles from './Banner.module.css';

type BannerVariant = 'info' | 'warning' | 'error';

export interface BannerProps {
  variant?: BannerVariant;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<BannerVariant, string> = {
  info: styles.info,
  warning: styles.warning,
  error: styles.error,
};

/** 색맹 대비 접두 기호(의미 병기). */
const variantIcon: Record<BannerVariant, string> = {
  info: 'ⓘ',
  warning: '⚠',
  error: '⛔',
};

export function Banner({ variant = 'info', children, className }: BannerProps) {
  const classes = [styles.banner, variantClass[variant], className].filter(Boolean).join(' ');
  return (
    <div className={classes} role={variant === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon} aria-hidden="true">
        {variantIcon[variant]}
      </span>
      <span className={styles.content}>{children}</span>
    </div>
  );
}
