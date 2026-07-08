/*
 * Skeleton — 초기 로딩(페이지 mount·상세 로드) 골격 표현(design-system.md §상태 표현: 초기 로딩=Skeleton).
 * 장식용이므로 aria-hidden 처리하고, 로딩 알림은 상위 컨테이너의 aria-busy 로 전달한다.
 */
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** CSS 폭(기본 100%). */
  width?: string;
  /** CSS 높이(기본 16px). */
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '16px', className }: SkeletonProps) {
  const classes = [styles.skeleton, className].filter(Boolean).join(' ');
  return <span className={classes} style={{ width, height }} aria-hidden="true" />;
}
