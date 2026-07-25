// 공통 인라인 SVG 아이콘 — design-system.md §결과 3경로의 시각 구분 ·
// design-system-components.md §Badge·§InlineAlert.
// 외부 아이콘 글꼴·이미지를 쓰지 않는다(상위 제약 2). 뜻은 곁의 문구가
// 전달하므로 전 아이콘 aria-hidden="true"(design-system.md §안내 영역 …
// "아이콘은 인라인 SVG 로 넣고 aria-hidden="true" 로 감춘다").

interface IconProps {
  size?: number;
  className?: string;
}

/** 결과 경로 ① — 원 안 체크. */
export function CheckCircleIcon({ size = 40, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M12 20.5l5.5 5.5L28 14"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 결과 경로 ② — 원 안 느낌표. */
export function ExclaimCircleIcon({ size = 40, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5" />
      <line x1="20" y1="11" x2="20" y2="23" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="20" cy="28.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** 결과 경로 ③ — 삼각형 안 느낌표. */
export function ExclaimTriangleIcon({ size = 40, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path d="M20 6.5 L36 32.5 L4 32.5 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="20" y1="16.5" x2="20" y2="24.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="20" cy="28.2" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** InlineAlert 아이콘 — 작은 원 안 느낌표. */
export function AlertIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10" y1="5.5" x2="10" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

/** Badge `재안내` 되돌림 아이콘. */
export function UndoIcon({ size = 12, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className={className} fill="none">
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8a5 5 0 1 0 1.6-3.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
