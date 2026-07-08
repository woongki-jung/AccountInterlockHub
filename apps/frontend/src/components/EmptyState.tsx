/*
 * EmptyState — 목록 0건·대상 없음 안내(design-system.md §공통 컴포넌트: 아이콘·안내·CTA).
 * 목록이 비었을 때 생성 유도(CTA)를, 대상 없음일 때 복귀 경로를 함께 노출한다.
 */
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** 상단 아이콘(이모지·기호). 장식이므로 aria-hidden 처리한다. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** 하단 CTA(버튼 등). */
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.panel}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
