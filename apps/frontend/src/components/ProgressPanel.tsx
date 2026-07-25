import { useStageFocus } from '../hooks/useStageFocus';
import { InlineAlert } from './InlineAlert';
import { Spinner } from './Spinner';
import styles from './ProgressPanel.module.css';

const DEFAULT_TITLE = '연동을 진행하고 있습니다';
const DEFAULT_SUBTITLE = '창을 닫거나 새로 고치지 마세요. 잠시만 기다려 주세요.';
/** screen_SCR-003.md §조건부 표시 — InlineAlert(결과 확인 실패). */
const UNCONFIRMED_MESSAGE = '처리 결과를 확인하지 못했습니다. 받으신 링크로 다시 들어오면 결과를 확인할 수 있습니다.';

interface ProgressPanelProps {
  title?: string;
  subtitle?: string;
  /** 응답을 받지 못했을 때만 true — screen_SCR-003.md §화면 상태 전이 `Unconfirmed`. */
  unconfirmed?: boolean;
}

/**
 * 승인 후 대기 화면 본문 — design-system-components.md §ProgressPanel.
 * 조작 요소를 두지 않는다(취소 버튼 없음). role="status"·aria-live="polite"·
 * aria-busy="true" 를 영역에 주고 전환 시 제목으로 포커스를 옮긴다
 * (screen_SCR-003.md §구현 가이드).
 */
export function ProgressPanel({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  unconfirmed = false,
}: ProgressPanelProps) {
  const headingRef = useStageFocus(title);

  return (
    <div className={styles.panel} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinnerSlot}>
        <Spinner size={32} />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {unconfirmed ? (
        <div className={styles.alert}>
          <InlineAlert message={UNCONFIRMED_MESSAGE} />
        </div>
      ) : null}
    </div>
  );
}
