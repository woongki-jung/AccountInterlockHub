/*
 * Badge(user) — SCR-006 결과 유형 배지(design-system.md §컴포넌트 사용자 변형 Badge(user)).
 * radius-u-pill·높이 28px·좌우 여백 12px·텍스트 12px/700, 배경 -bg+텍스트 -fg+1px -border 3종 쌍.
 * 공통 Badge(관리자, `components/Badge.tsx`)는 규격(radius-sm·24px·2색)이 달라 그대로 두고 별도로
 * 둔다(build 지침 §2-1, Phase 2 UserButton·UserBanner 와 같은 방식). 상태 텍스트 라벨을 항상 포함해
 * 색만으로 의미를 전달하지 않는다(§접근성).
 */
import type { ReactNode } from 'react';
import styles from './UserBadge.module.css';

export type UserBadgeVariant = 'success' | 'info' | 'danger' | 'neutral';

export interface UserBadgeProps {
  variant: UserBadgeVariant;
  children: ReactNode;
}

const variantClass: Record<UserBadgeVariant, string> = {
  success: styles.success,
  info: styles.info,
  danger: styles.danger,
  neutral: styles.neutral,
};

export function UserBadge({ variant, children }: UserBadgeProps) {
  return <span className={`${styles.badge} ${variantClass[variant]}`}>{children}</span>;
}
