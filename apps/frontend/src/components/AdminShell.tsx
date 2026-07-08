/*
 * AdminShell — 관리자 셸 레이아웃(design-system.md §레이아웃·반응형).
 * 상단 AdminNav(56px) + 본문 컨테이너(최대 폭 1120px·좌우 중앙 정렬·좌우 여백 24px).
 * SCR-002~004 관리자 화면이 공통으로 감싸는 레이아웃이다.
 */
import type { ReactNode } from 'react';
import { AdminNav } from './AdminNav';
import styles from './AdminShell.module.css';

export interface AdminShellProps {
  /** 상단 바에 표시할 로그인 계정명(선택). */
  account?: string;
  children: ReactNode;
}

export function AdminShell({ account, children }: AdminShellProps) {
  return (
    <div className={styles.shell}>
      <AdminNav account={account} />
      <main className={styles.body}>{children}</main>
    </div>
  );
}
