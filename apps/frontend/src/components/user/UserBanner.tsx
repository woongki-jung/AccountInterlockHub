/*
 * Banner(user) — SCR-005 카드 상단 안내(design-system.md §컴포넌트 사용자 변형).
 * 사용자 화면의 Banner 인스턴스는 전부 4xx/5xx 오류 알림이라 danger 변형만 존재한다(role=alert 고정).
 * 공통 Banner(관리자, `components/Banner.tsx`)는 그대로 두고 별도로 둔다 — 색 토큰(-u-danger-*)·아이콘
 * (SVG vs 텍스트 글리프)이 달라 별도 컴포넌트로 구현한다(build 지침 §2-1). 현재 관리자 화면에는 Banner
 * 호출부가 없지만, 향후 신설되더라도 영향이 없도록 안전하게 분리해 둔다.
 */
import type { ReactNode } from 'react';
import styles from './UserBanner.module.css';

export interface UserBannerProps {
  children: ReactNode;
  className?: string;
}

export function UserBanner({ children, className }: UserBannerProps) {
  const classes = [styles.banner, className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes} role="alert">
      <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="13.4" r="1" fill="currentColor" />
      </svg>
      <span className={styles.content}>{children}</span>
    </div>
  );
}
