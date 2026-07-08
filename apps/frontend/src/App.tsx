/*
 * 애플리케이션 루트 — 라우팅 구성(관리자 웹 SPA).
 * 백엔드(NestJS)가 /api·/interlock 을 제외한 경로를 index.html 로 폴백 서빙하므로
 * 클라이언트 라우팅(BrowserRouter)으로 화면을 분기한다. 경로는 same-origin 상대 경로.
 * 전역 Toast(ToastProvider)는 라우터 상위에 두어 화면 전환 후에도 토스트가 유지된다.
 */
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { setSessionExpiredHandler } from './lib/apiClient';
import { ToastProvider } from './components';
import LoginPage from './pages/LoginPage';
import ConfigsPage from './pages/ConfigsPage';
import ConfigFormPage from './pages/ConfigFormPage';
import ConfigDetailPage from './pages/ConfigDetailPage';
import ConsentPage from './pages/ConsentPage';

/** 화면 경로 상수(관리자 웹 + 사용자 이용 동의). */
const ROUTES = {
  login: '/admin/login',
  configs: '/admin/configs',
  configNew: '/admin/configs/new',
  configDetail: '/admin/configs/:id',
  configEdit: '/admin/configs/:id/edit',
  // 사용자 이용 동의(Public) — 서비스 A 진입 후 발급된 요청 키값으로 접근.
  consent: '/consent/:requestKey',
} as const;

/**
 * 세션 만료(401 EX-AUTH-002) 중앙 처리 등록.
 * 인증이 필요한 화면에서 세션 만료 응답을 받으면 로그인 화면으로 재인증을 유도한다(?expired=1).
 * 라우터 컨텍스트 안에서 navigate 를 사용하므로 별도 컴포넌트로 분리한다.
 */
function SessionExpiredBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const unregister = setSessionExpiredHandler(() => {
      navigate(`${ROUTES.login}?expired=1`, { replace: true });
    });
    return unregister;
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <SessionExpiredBridge />
        <Routes>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.configs} element={<ConfigsPage />} />
          {/* 정적 세그먼트(new)가 동적(:id)보다 우선 매칭된다(react-router 랭킹). */}
          <Route path={ROUTES.configNew} element={<ConfigFormPage mode="create" />} />
          <Route path={ROUTES.configEdit} element={<ConfigFormPage mode="edit" />} />
          <Route path={ROUTES.configDetail} element={<ConfigDetailPage />} />
          {/* 사용자 이용 동의(SCR-005) — 서비스 A 진입 후 발급된 요청 키값으로 접근(Public). */}
          {/* 결과 페이지(/consent/:requestKey/result)는 USR-P4 소관 — 본 Phase 미등록(제출 성공 시 경로 이동만). */}
          <Route path={ROUTES.consent} element={<ConsentPage />} />
          {/* 기본 진입은 로그인으로 유도(MVP 관리자 웹 기준). */}
          <Route path="/" element={<Navigate to={ROUTES.login} replace />} />
          {/* 미정의 경로 폴백 — 로그인으로 유도. */}
          <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
