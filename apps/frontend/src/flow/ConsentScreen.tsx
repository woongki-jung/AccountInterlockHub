import { useEffect, useRef } from 'react';
import { Button, ConsentList, InlineAlert, NoticeBlock, StageTitle } from '../components';
import type { ConsentListHandle } from '../components';
import { isAllRequiredMet } from '../stage/transitions';
import type { ScreenView } from '../stage/types';
import stack from './stack.module.css';

const ALERT_ID = 'scr002-alert';
/** screen_SCR-002.md §입력 폼 정의 — 문구 정본(BR-004, 화면 게이팅). 서버 호출 없이 화면이 직접 띄운다. */
const GATED_MESSAGE = '모든 항목에 동의해 주셔야 합니다';

interface ConsentScreenProps {
  view: Extract<ScreenView, { screen: 'SCR-002' }>;
  /** 동의 체크 상태 — 흐름 훅(useInterlockFlow) 소유(회귀 2회차 I-3). */
  agreedCodes: ReadonlySet<string>;
  onToggle: (code: string) => void;
  onApprove: () => void;
  onGated: (message: string) => void;
}

/**
 * SCR-002 동의·승인 — screen_SCR-002.md 조립 참조 구현. 체크 상태
 * (agreedCodes) 는 이 컴포넌트가 아니라 상위 흐름 훅(useInterlockFlow)
 * 이 소유하는 **controlled** 값이다 — 이전엔 이 컴포넌트의 로컬
 * `useState` 였는데, 승인 발신 즉시 SCR-003 으로 전환돼 이 컴포넌트가
 * 언마운트되므로 `EX-BIZ-003`(Retryable)·`EX-BIZ-001`(Blocked) 로
 * SCR-002 에 되돌아올 때 재마운트와 함께 체크가 사라지는 결함이 있었다
 * (회귀 1회차 재판정 I-3 — "본인확인으로 되돌아갈 때만 마운트가 새로
 * 된다"는 옛 주석은 사실이 아니었다: SCR-002 를 떠나는 **모든** 전이가
 * 언마운트를 일으킨다). 훅은 본인확인으로 되돌아갈 때(BackToIdentity)와
 * 결과 도달 시점에만 agreedCodes 를 비운다(process_PROC-103.md F5
 * "본인확인으로 되돌아가면 agreed 를 비운다" · screen_SCR-002.md §구현
 * 가이드 "본인확인으로 되돌아가면 동의 선택 상태를 비운다" — 비우는
 * 경우는 이 하나로 한정된다. Retryable·Blocked 로 이 화면에 남는
 * 전이는 해당하지 않아 agreedCodes 가 그대로 유지된다 — screen_SCR-002.md
 * §화면 상태 전이 `Retryable` "결과 미확정이라 그대로 다시 제출할 수
 * 있다").
 */
export function ConsentScreen({ view, agreedCodes, onToggle, onApprove, onGated }: ConsentScreenProps) {
  const consentListRef = useRef<ConsentListHandle>(null);

  useEffect(() => {
    if (view.alert?.kind === 'gated' || view.alert?.kind === 'blocked') {
      consentListRef.current?.focusFirstUnmet();
    }
  }, [view.alert]);

  const allRequiredMet = isAllRequiredMet(view.consent.items, agreedCodes);

  /**
   * 제목 자동 포커스를 건너뛰는가 — design-system.md §접근성 기준(commit
   * `a8058a0`) "단계 전환과 필드에 매인 안내가 겹치면 포커스는 그 필드가
   * 가져간다"의 두 자리 중 `BackToConsent`(`SCR-003` → `SCR-002` ·
   * 400 `EX-BIZ-001`) 쪽 — 도착 상태 `Blocked` 는 "첫 미충족 항목으로
   * 포커스"이므로 위 useEffect 가 그 항목으로 옮긴다. `Retryable`
   * (`EX-BIZ-003`)·`Gated`(화면 게이팅)는 이 예외에 해당하지 않는다 —
   * 전자는 사양이 그대로 제목으로 보내고, 후자는 이미 마운트된 화면의
   * 갱신이라(`title` 불변) `useStageFocus` 의 effect 가 애초에 재실행되지
   * 않아 이 값이 읽히지 않는다.
   */
  const skipTitleFocus = view.alert?.kind === 'blocked';

  function handleApproveClick() {
    if (!allRequiredMet) {
      onGated(GATED_MESSAGE);
      return;
    }
    onApprove();
  }

  return (
    <div>
      <StageTitle
        title="연동 동의"
        subtitle="아래 내용을 확인하고 모든 항목에 동의해 주세요."
        skipFocus={skipTitleFocus}
      />
      <NoticeBlock notice={view.consent.notice} />
      <ConsentList ref={consentListRef} items={view.consent.items} agreedCodes={agreedCodes} onToggle={onToggle} />
      {view.alert ? (
        <div className={stack.body}>
          <InlineAlert id={ALERT_ID} message={view.alert.message} />
        </div>
      ) : null}
      <div className={stack.actions}>
        {/* 필수 미충족이어도 aria-disabled 로만 두어 클릭을 받는다 —
            클릭은 항상 handleApproveClick 을 부르고, 그 안에서 게이팅
            여부를 가른다(상위 제약 12). */}
        <Button ariaDisabled={!allRequiredMet} onClick={handleApproveClick}>
          동의하고 연동하기
        </Button>
      </div>
    </div>
  );
}
