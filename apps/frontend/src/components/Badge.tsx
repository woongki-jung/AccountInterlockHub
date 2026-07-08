/*
 * Badge — 상태·분류 표기(design-system.md §공통 컴포넌트: active(초록)·inactive(회색)·성공·거부·실패 등).
 * 색만으로 의미를 전달하지 않도록 항상 텍스트 라벨을 담는다(접근성 §의미 전달).
 * dot(상태 점)·icon(선행 기호)은 보조 표식이며 aria-hidden 처리한다.
 */
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant =
  | 'active'
  | 'inactive'
  | 'userKey'
  | 'info'
  | 'neutral'
  | 'danger'
  | 'success';

export interface BadgeProps {
  variant?: BadgeVariant;
  /** 상태 점(dot) 병기 — 활성/비활성 상태 배지에 사용. */
  dot?: boolean;
  /** 선행 아이콘(텍스트·이모지). 예: 사용자 키값 🔑. */
  icon?: ReactNode;
  children: ReactNode;
}

const variantClass: Record<BadgeVariant, string> = {
  active: styles.active,
  inactive: styles.inactive,
  userKey: styles.userKey,
  info: styles.info,
  neutral: styles.neutral,
  danger: styles.danger,
  success: styles.success,
};

export function Badge({ variant = 'neutral', dot = false, icon, children }: BadgeProps) {
  return (
    <span className={[styles.badge, variantClass[variant]].join(' ')}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}
