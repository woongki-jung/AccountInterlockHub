/*
 * ToastProvider — 앱 전역 토스트 표시·자동 소멸 관리(design-system.md §공통 컴포넌트 Toast).
 * 라우팅(BrowserRouter) 바깥/상위에 두어 화면 전환(예: 저장 성공 후 상세 이동) 이후에도 토스트가 유지된다.
 * aria-live="polite" 영역에 렌더해 스크린리더에 결과를 전달하고, 4초 뒤 자동 소멸한다.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Toast } from './Toast';
import type { ToastVariant } from './Toast';
import styles from './ToastProvider.module.css';

/** 토스트 자동 소멸 시간(ms) — design-system.md: 4초 자동 소멸. */
const AUTO_DISMISS_MS = 4000;

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ id: Date.now(), message, variant });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.region} aria-live="polite" aria-atomic="true">
        {toast && <Toast key={toast.id} message={toast.message} variant={toast.variant} />}
      </div>
    </ToastContext.Provider>
  );
}

/** 토스트 표시 훅. ToastProvider 하위에서만 사용한다. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast 는 ToastProvider 하위에서만 사용할 수 있습니다.');
  }
  return ctx;
}
