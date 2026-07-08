/*
 * AdminNav — 관리자 화면 공통 상단 바(design-system.md §공통 컴포넌트·레이아웃, 높이 56px).
 * 제품명·계정(선택)·로그아웃으로 구성한다. 인증 세션에서만 렌더한다(호출 화면이 보장).
 * 로그아웃: POST /api/admin/auth/logout 후 로그인 화면으로 이동(실패해도 세션 무효로 간주해 이동).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { logoutRequest } from '../lib/authApi';
import styles from './AdminNav.module.css';

/** 제품명(브랜드) — CLAUDE.env.md <PROJECT>. */
const PRODUCT_NAME = 'AccountInterlockHub';
const LOGIN_PATH = '/admin/login';

export interface AdminNavProps {
  /** 로그인 계정명(있으면 표시). 세션 사용자 조회 API 부재 시 생략 가능. */
  account?: string;
}

export function AdminNav({ account }: AdminNavProps) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutRequest();
    } catch {
      // 세션이 이미 만료·무효여도 로그인 화면으로 이동(재인증 유도).
    } finally {
      navigate(LOGIN_PATH, { replace: true });
    }
  }

  return (
    <header className={styles.nav}>
      <span className={styles.logo}>{PRODUCT_NAME}</span>
      <span className={styles.spacer} />
      {account && <span className={styles.account}>{account}</span>}
      <Button variant="ghost" size="sm" onClick={handleLogout} loading={loggingOut}>
        로그아웃
      </Button>
    </header>
  );
}
