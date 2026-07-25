import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  /** 처리 중 — Spinner + 문구 교체·중복 제출 차단(네이티브 disabled). SCR-001 확인 버튼에만 쓰인다. */
  isLoading?: boolean;
  loadingText?: string;
  /**
   * 비활성(필수 미충족) 상태 — **네이티브 `disabled` 를 쓰지 않는다.**
   * `aria-disabled="true"` 만 두어 포커스·클릭을 계속 받는다. 클릭은
   * 무시되지 않는다 — 호출측 onClick 이 그대로 실행되므로, 그 안에서
   * 유효성 안내를 띄우는 것은 호출측(화면)의 몫이다
   * (design-system-components.md §Button "접근성" · 상위 제약 12).
   */
  ariaDisabled?: boolean;
}

/**
 * 주 액션·보조 액션 버튼 — design-system-components.md §Button.
 * 카드 폭을 채우는 전체 폭이 기본이다. 이 표면에 위험(빨강) 버튼을 두지
 * 않는다 — 파괴적 조작이 없다.
 */
export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  loadingText,
  ariaDisabled = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const variantClass = variant === 'primary' ? styles.primary : styles.secondary;
  const classes = [styles.btn, variantClass, className].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={isLoading}
      aria-disabled={ariaDisabled ? 'true' : undefined}
      aria-busy={isLoading ? 'true' : undefined}
      {...rest}
    >
      {isLoading ? (
        <>
          <span className={styles.spinnerSlot}>
            <Spinner size={20} />
          </span>
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
