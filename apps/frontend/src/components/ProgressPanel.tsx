import { InlineAlert } from './InlineAlert';
import { Spinner } from './Spinner';
import { StageTitle } from './StageTitle';
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
 * 조작 요소를 두지 않는다(취소 버튼 없음). **자체 제목 글꼴을 규정하지
 * 않고 StageTitle(기본 변형)을 합성한다** — 카탈로그 §ProgressPanel "자체
 * 제목 글꼴 규정을 버리고 StageTitle 합성으로 바뀌었다"(회귀 1회차 R-2,
 * 구 `--font-size-lg` 값 오류 시정 — 기본 변형은 `--font-size-xl`).
 * role="status"·aria-live="polite"·aria-busy="true" 는 이 패널 영역에
 * 그대로 두고, 전환 시 제목으로 포커스를 옮기는 것과 문서 제목 일치는
 * StageTitle 내부(useStageFocus)가 수행한다(screen_SCR-003.md §구현 가이드).
 */
export function ProgressPanel({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  unconfirmed = false,
}: ProgressPanelProps) {
  return (
    <div className={styles.panel} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinnerSlot}>
        <Spinner size={32} />
      </span>
      <StageTitle title={title} subtitle={subtitle} />
      {unconfirmed ? (
        <div className={styles.alert}>
          <InlineAlert message={UNCONFIRMED_MESSAGE} />
        </div>
      ) : null}
    </div>
  );
}
