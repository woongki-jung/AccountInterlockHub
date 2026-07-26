import { UndoIcon } from './icons';
import styles from './Badge.module.css';

interface BadgeProps {
  variant: 'required' | 'reannounce';
  children: string;
  /**
   * 호출측 배치 여백 추가용(선택) — Badge 자신의 색·모양(design-system-
   * components.md §Badge)은 바꾸지 않는다. 미지정 시 기존 렌더와 바이트
   * 동일(`ConsentItem` 의 `필수` 배지 등 기존 호출부는 이 prop 을 넘기지
   * 않아 영향이 없다). `ResultPanel`(P16, `#493`)이 재안내 배지의
   * 제목→배지 간격(`--space-sm`)을 붙이는 데 쓴다 — wrapper div 대신
   * Badge 자신에 여백을 실어 패널의 직계 flex 자식 구조를 유지한다.
   */
  className?: string;
}

/**
 * 필수 표시·확정 결과 재안내 보조 표시 — design-system-components.md §Badge.
 * 조작 요소가 아니므로 히트 영역 규칙을 적용하지 않는다. 글자를 그대로
 * 읽히게 두고(아이콘만 쓰지 않는다), 장식 아이콘은 aria-hidden.
 */
export function Badge({ variant, children, className }: BadgeProps) {
  const variantClass = variant === 'required' ? styles.required : styles.reannounce;
  return (
    <span className={[styles.badge, variantClass, className].filter(Boolean).join(' ')}>
      {variant === 'reannounce' ? <UndoIcon size={12} /> : null}
      <span>{children}</span>
    </span>
  );
}
