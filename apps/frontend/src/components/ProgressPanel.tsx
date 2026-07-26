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
 * 않고 StageTitle(기본 변형, `placement="panel"`)을 합성한다** — 카탈로그
 * §ProgressPanel "자체 제목 글꼴 규정을 버리고 StageTitle 합성으로
 * 바뀌었다"(회귀 1회차 R-2, 구 `--font-size-lg` 값 오류 시정 — 기본
 * 변형은 `--font-size-xl`). `placement="panel"` 은 wrapper 를 렌더하지
 * 않아(Fragment) 제목·보조 문구가 이 `.panel` 의 직계 flex 자식으로
 * 서고, 그 사이 간격은 아래 `--space-md` 균일 gap 이 정한다(P16, `#493`
 * — StageTitle 자신은 여백을 갖지 않는다).
 * role="status"·aria-live="polite" 는 대기·`Unconfirmed` 양쪽에서 계속
 * 라이브 리전으로 남기고(알림을 그 자리에서 읽혀야 한다), **`aria-busy`
 * 는 대기가 끝나면 푼다**(`design-system-components.md` §ProgressPanel
 * §접근성 — "대기가 끝나면 aria-busy 를 푼다(false 로 바꾸거나 속성을
 * 지운다) … 이 화면에 잔류하는 Unconfirmed 로 들어갈 때도 같다". 켠 채
 * 알림을 띄우면 보조기술이 재진입 안내를 미루거나 건너뛴다). 결과 화면
 * 으로 전이될 때는 이 패널 자체가 언마운트되어 별도 처리가 필요 없다.
 * 전환 시 제목으로 포커스를 옮기는 것과 문서 제목 일치는 StageTitle
 * 내부(useStageFocus)가 수행한다(screen_SCR-003.md §구현 가이드).
 */
export function ProgressPanel({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  unconfirmed = false,
}: ProgressPanelProps) {
  return (
    <div className={styles.panel} role="status" aria-live="polite" aria-busy={unconfirmed ? 'false' : 'true'}>
      <span className={styles.spinnerSlot}>
        <Spinner size={32} />
      </span>
      <StageTitle title={title} subtitle={subtitle} placement="panel" />
      {unconfirmed ? (
        <div className={styles.alert}>
          <InlineAlert message={UNCONFIRMED_MESSAGE} />
        </div>
      ) : null}
    </div>
  );
}
