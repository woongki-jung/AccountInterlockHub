/*
 * Toggle — 활성/비활성 상태 전환 스위치(design-system.md §공통 컴포넌트).
 * 구성 활성 상태 등 불리언 전환에 사용하며 상태 라벨(활성/비활성)을 병기한다(접근성 §의미 전달).
 * role="switch" + aria-checked 로 스크린리더에 상태를 전달한다.
 */
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 스위치 자체의 접근성 라벨(예: "활성 여부"). */
  ariaLabel?: string;
  /** 켜짐/꺼짐 상태 텍스트(기본 활성/비활성). */
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  onLabel = '활성',
  offLabel = '비활성',
  disabled = false,
  id,
}: ToggleProps) {
  const stateLabel = checked ? onLabel : offLabel;
  return (
    <span className={styles.cell}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        className={[styles.track, checked ? styles.on : styles.off].join(' ')}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} aria-hidden="true" />
      </button>
      <span className={styles.stateLabel}>{stateLabel}</span>
    </span>
  );
}
