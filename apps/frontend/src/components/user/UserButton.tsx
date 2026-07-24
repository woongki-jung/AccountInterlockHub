/*
 * Button(user/primary·secondary·ghost-link) — 사용자 표면 전용 버튼(design-system.md §컴포넌트 사용자 변형).
 * 공통 Button(관리자, `components/Button.tsx`)은 그대로 두고 별도로 둔다 — 관리자 화면 렌더 불변 보장
 * (SCR-005 build 지침 §2-1). variant 종류·크기·모션이 관리자 Button 과 달라 additive prop 확장이 아니라
 * 완전히 분리된 컴포넌트로 구현한다.
 *
 * loading 스피너는 공통 Spinner(700ms linear)가 아니라 사용자 표면 전용 규격(800ms linear,
 * prefers-reduced-motion 시 정지)을 이 파일 안에서 별도로 구현한다(design-system.md §모션).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './UserButton.module.css';

type UserButtonVariant = 'primary' | 'secondary' | 'ghost-link';

export interface UserButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: UserButtonVariant;
  /** 제출 대기 — 스피너 노출 + 비활성 + aria-busy(승인·거부 버튼 전용, ghost-link 는 미사용). */
  loading?: boolean;
  /**
   * true 면 반응형 폭 규칙(폭 100% <640px·내용 맞춤 ≥640px)과 데스크톱 min-width(140px)를 모두
   * 무력화하고 항상 내용 맞춤(width:auto·min-width:0)으로 렌더한다. 약관 모달(Modal(user/terms)) 푸터
   * [동의]/[닫기] 전용 — design-system 의 "폭=100%(<640px)"는 카드 액션(승인/거부) 맥락이라 모달 푸터에는
   * 적용 근거가 없다(목업 SCR-005.html 모달 버튼 style="width:auto;min-width:0" 대응, 리뷰 S-1·S-3).
   */
  fitContent?: boolean;
  children: ReactNode;
}

const variantClass: Record<UserButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  'ghost-link': styles.ghostLink,
};

export function UserButton({
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  className,
  fitContent = false,
  children,
  ...rest
}: UserButtonProps) {
  const classes = [
    styles.button,
    variantClass[variant],
    fitContent ? styles.fitContent : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} role="status" aria-label="처리 중" />}
      <span className={loading ? styles.loadingLabel : undefined}>{children}</span>
    </button>
  );
}
