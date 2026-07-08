/*
 * Toast — 저장·삭제·전환 결과 알림(design-system.md §공통 컴포넌트).
 * 표시/자동 소멸·aria-live 영역은 ToastProvider 가 관리하고, 본 컴포넌트는 표현만 담당한다.
 * 색만으로 의미를 전달하지 않도록 접두 기호를 병기한다(접근성 §의미 전달).
 */
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
}

const variantClass: Record<ToastVariant, string> = {
  success: styles.success,
  error: styles.error,
  info: styles.info,
};

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error: '⛔',
  info: 'ⓘ',
};

export function Toast({ message, variant = 'success' }: ToastProps) {
  return (
    <div className={[styles.toast, variantClass[variant]].join(' ')}>
      <span className={styles.icon} aria-hidden="true">
        {variantIcon[variant]}
      </span>
      <span>{message}</span>
    </div>
  );
}
