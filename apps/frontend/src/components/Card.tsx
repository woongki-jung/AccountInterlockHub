/*
 * Card — 정보 묶음 표면(design-system.md §공통 컴포넌트: shadow-sm, radius-md, 내부 여백 24px).
 * 레이아웃(중앙 정렬·최대 폭 등)은 사용하는 화면이 래퍼로 지정한다.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  const classes = [styles.card, className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
