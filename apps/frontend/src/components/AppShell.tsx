import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

/**
 * 페이지 바탕 + 중앙 카드 — design-system-components.md §AppShell.
 *
 * 헤더 바·브랜드 로고·전역 네비게이션·사이드바·푸터 메뉴를 두지 않는다
 * (상위 제약 6 · design-system.md §레이아웃 "없는 것"). 카드는 `<main>`
 * 하나이고, 페이지에 `<header>`·`<nav>` 를 두지 않는다.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.page}>
      <main className={styles.card}>{children}</main>
    </div>
  );
}
