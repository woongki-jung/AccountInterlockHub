import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { normalizeResultPath } from '../api/types';
import type { ResultPath } from '../api/types';
import { Badge } from './Badge';
import { CheckCircleIcon, ExclaimCircleIcon, ExclaimTriangleIcon } from './icons';
import {
  RESULT_PATH_META,
  RE_ANNOUNCEMENT_BADGE_LABEL,
  RE_ANNOUNCEMENT_SUFFIX,
  RETURN_LINK_LABEL,
  RETURN_NOTICE,
  defaultDescriptionFor,
  formatReturnCountdown,
  isAbsoluteHttpUrl,
} from './resultContent';
import { StageTitle } from './StageTitle';
import styles from './ResultPanel.module.css';

interface ResultPanelProps {
  resultPath: ResultPath;
  /** 경로 ②의 설명 문구를 고르는 사유 코드. 화면에는 그리지 않는다(`SEC-002-05`). */
  reasonCode?: string;
  isReAnnouncement?: boolean;
  /** 존재 + 절대 URL 확인 통과 시에만 복귀 안내 영역이 나타난다(`BIZ-001-06`). */
  returnUrl?: string;
  /**
   * 복귀 이동 대기 시간(초). **기본값을 두지 않는다** — 정본은
   * screen_SCR-004.md §복귀 이동 하나뿐이며 값을 다른 곳에 복제하지
   * 않기 위해서다(같은 문서 "다른 절·다른 도메인은 값이 아니라 이
   * 이름으로 참조한다"). `returnUrl` 이 있어도 이 값이 없으면 복귀
   * 안내 영역을 그리지 않는다.
   */
  returnWaitSeconds?: number;
  /**
   * 결과 제목 자동 포커스를 건너뛰는가 — design-system.md §접근성 기준
   * "진입(최초 로드)에는 제목으로 포커스를 옮기지 않는다". 이 패널이
   * 진입(수화)으로 첫 화면이 되면 true, SCR-001·SCR-002·SCR-003 에서
   * 전환으로 도착하면(확정 결과 재안내 포함 전부) false — 값의 정본
   * 판정은 `useInterlockFlow.ts`(P14 `#491`)의 구별 신호이며 이 패널은
   * 그 값을 그대로 StageTitle 로 전달할 뿐 스스로 진입·전환을 가르지
   * 않는다(P16 `#493`, 교차검증 7회차 E7-1). `document.title` 갱신은
   * 이 값과 무관하게 항상 수행된다(StageTitle → useStageFocus). 미지정
   * 시 `false`(기존 거동 — 항상 포커스 이동).
   */
  skipFocus?: boolean;
  title?: string;
  description?: string;
  nextNote?: string;
}

/**
 * 결과 3경로 표시 + 복귀 안내 영역 — design-system-components.md §ResultPanel.
 * 경로별 아이콘·색·기본 제목은 design-system.md §결과 3경로의 시각 구분을
 * 그대로 따른다(resultContent.ts). 애니메이션 없이 텍스트만 갱신하고,
 * 카운트다운 영역은 aria-hidden 이다. **자체 제목을 그리지 않고
 * StageTitle(결과 변형, `placement="panel"`)을 합성한다**(회귀 2회차 I-A
 * 시정 — 회귀 1회차의 "값이 같아 재작업 없음" 판단은 오판이었다.
 * §StageTitle 이 신설한 크기 변형은 값이 아니라 **계약을 한 곳에 두는
 * 것**이 목적이라 값이 같아도 합성이 필요했다). `placement="panel"` 은
 * wrapper 를 렌더하지 않아(Fragment) 제목이 이 `.panel` 의 직계 flex
 * 자식으로 서고, 아래 §간격(P16, `#493`)이 그 뒤 요소와의 간격을 정한다.
 * 포커스 이동·문서 제목 일치는 StageTitle 내부(useStageFocus)가 수행한다.
 * `skipFocus` 는 그 이동 여부를 그대로 StageTitle 로 전달할 뿐 — 진입
 * (경로 ② 하나뿐)·전환 구별 판정은 이 컴포넌트가 하지 않는다(정본은
 * useInterlockFlow.ts 의 구별 신호 — P16 `#493`, 교차검증 7회차 E7-1).
 */
export function ResultPanel({
  resultPath,
  reasonCode,
  isReAnnouncement = false,
  returnUrl,
  returnWaitSeconds,
  skipFocus = false,
  title,
  description,
  nextNote,
}: ResultPanelProps) {
  // 경로 값이 1~3 밖이거나 없으면 경로 ②로 그린다(screen_SCR-004.md §구현
  // 가이드 — 미매핑 catch-all). 앞선 단계(hydration·transitions)에서 이미
  // 정규화했더라도 그 타입 선언이 런타임을 보장하지 않으므로(JSON.parse
  // 경계) 이 컴포넌트도 다시 거친다 — RESULT_PATH_META 조회 직전의 단일
  // 관문이라 자리를 옮기지 않는다.
  const resolvedResultPath = normalizeResultPath(resultPath);
  const meta = RESULT_PATH_META[resolvedResultPath];
  const resolvedTitle = title ?? meta.title;
  const resolvedDescription = description ?? defaultDescriptionFor(resolvedResultPath, reasonCode);
  const resolvedNextNote = nextNote ?? meta.nextNote;

  const canReturn =
    typeof returnUrl === 'string' &&
    isAbsoluteHttpUrl(returnUrl) &&
    typeof returnWaitSeconds === 'number' &&
    returnWaitSeconds > 0;

  const [secondsLeft, setSecondsLeft] = useState(returnWaitSeconds ?? 0);
  const navigatedRef = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);

  // returnUrl 이 바뀔 때만 참조가 바뀌는 안정 콜백으로 만들어 아래 효과의
  // 의존성 배열을 완전하게 채운다(exhaustive-deps 억제 주석 없이).
  const navigateToReturnUrl = useCallback(() => {
    if (navigatedRef.current || !returnUrl) return;
    navigatedRef.current = true;
    // 브라우저 이력 치환 — 뒤로 가기가 결과 화면으로 돌아오지 않는다
    // (screen_SCR-004.md §복귀 이동).
    window.location.replace(returnUrl);
  }, [returnUrl]);

  useEffect(() => {
    if (!canReturn) return undefined;

    navigatedRef.current = false;
    let remaining = returnWaitSeconds as number;
    setSecondsLeft(remaining);

    intervalRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(intervalRef.current);
        setSecondsLeft(0);
        navigateToReturnUrl();
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalRef.current);
    };
  }, [canReturn, returnWaitSeconds, navigateToReturnUrl]);

  function handleManualReturn(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.clearInterval(intervalRef.current);
    navigateToReturnUrl();
  }

  return (
    <div className={`${styles.panel} ${styles[meta.kind]}`} role="status">
      <ResultIcon kind={meta.kind} />
      <StageTitle title={resolvedTitle} variant="result" placement="panel" skipFocus={skipFocus} />
      {isReAnnouncement ? (
        <Badge variant="reannounce" className={styles.reannounceBadge}>
          {RE_ANNOUNCEMENT_BADGE_LABEL}
        </Badge>
      ) : null}
      <p className={styles.description}>
        {resolvedDescription}
        {isReAnnouncement ? ` ${RE_ANNOUNCEMENT_SUFFIX}` : ''}
      </p>
      <p className={styles.nextNote}>{resolvedNextNote}</p>
      {canReturn ? (
        <div className={styles.returnArea}>
          <p className={styles.returnNotice}>{RETURN_NOTICE}</p>
          <p className={styles.returnCountdown} aria-hidden="true">
            {formatReturnCountdown(secondsLeft)}
          </p>
          <a href={returnUrl} className={styles.returnLink} onClick={handleManualReturn}>
            {RETURN_LINK_LABEL}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function ResultIcon({ kind }: { kind: 'success' | 'danger' | 'warning' }) {
  if (kind === 'success') return <CheckCircleIcon size={40} />;
  if (kind === 'warning') return <ExclaimTriangleIcon size={40} />;
  return <ExclaimCircleIcon size={40} />;
}
