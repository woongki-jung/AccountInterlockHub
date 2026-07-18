/*
 * ResultIcon(user) — SCR-006 결과 상태 아이콘(design-system.md §결과 상태 아이콘).
 * 원형 64x64px 채움 + 글리프 28x28px(선 굵기 2.5px·선 끝 둥글게), 결과 유형별 형태·색 토큰 4종.
 * 인라인 SVG 로 구현(특정 아이콘 라이브러리 비강제). 장식용이라 aria-hidden 처리 — 의미 전달은
 * Badge(user) 텍스트 라벨과 결과 제목이 담당한다(§접근성 "색·형태 단독 전달 금지").
 * 등장은 motion-u-slow·ease-u-decelerate(불투명도 0→1 + Y 8px) 1회 — mount 시 자연히 1회만 재생된다.
 */
import styles from './ResultIcon.module.css';

export type ResultIconVariant = 'success' | 'info' | 'danger' | 'neutral';

export interface ResultIconProps {
  variant: ResultIconVariant;
}

const variantClass: Record<ResultIconVariant, string> = {
  success: styles.success,
  info: styles.info,
  danger: styles.danger,
  neutral: styles.neutral,
};

export function ResultIcon({ variant }: ResultIconProps) {
  return (
    <div className={`${styles.icon} ${variantClass[variant]}`} aria-hidden="true">
      <Glyph variant={variant} />
    </div>
  );
}

/**
 * 결과 유형별 글리프(design-system.md §결과 상태 아이콘 형태 서술 그대로):
 * 완료=체크 표시(꺾인 선 1개) · 거부=가로 막대 1개(중립 종료 — 오류 기호·X 표 금지) ·
 * 링크오류=느낌표(세로 막대+점) · Fallback=물음표. 색은 부모(.icon)의 variant 클래스가 지정하는
 * currentColor 를 그대로 상속한다(-fg 토큰).
 */
function Glyph({ variant }: { variant: ResultIconVariant }) {
  switch (variant) {
    case 'success':
      return (
        <svg
          className={styles.glyph}
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M7 15l5 5 10-11"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'info':
      return (
        <svg
          className={styles.glyph}
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 14h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'danger':
      return (
        <svg
          className={styles.glyph}
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M14 6v11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="14" cy="21.5" r="1.4" fill="currentColor" />
        </svg>
      );
    case 'neutral':
      return (
        <svg
          className={styles.glyph}
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M10.6 10.5a3.5 3.5 0 0 1 6.8 1.2c0 2.3-3.5 3.5-3.5 3.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="13.9" cy="21.5" r="1.4" fill="currentColor" />
        </svg>
      );
  }
}
