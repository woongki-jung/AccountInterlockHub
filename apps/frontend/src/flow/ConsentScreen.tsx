import { useEffect, useRef, useState } from 'react';
import { Button, ConsentList, InlineAlert, NoticeBlock, StageTitle } from '../components';
import type { ConsentListHandle } from '../components';
import type { ConsentItemDto } from '../api/types';
import type { ScreenView } from '../stage/types';
import stack from './stack.module.css';

const ALERT_ID = 'scr002-alert';
/** screen_SCR-002.md §입력 폼 정의 — 문구 정본(BR-004, 화면 게이팅). 서버 호출 없이 화면이 직접 띄운다. */
const GATED_MESSAGE = '모든 항목에 동의해 주셔야 합니다';

/**
 * 필수 충족 판정 — 버튼 활성 여부·클릭 시 게이팅·체크 시 Gated 알림
 * 해제가 전부 이 하나의 판정 결과를 쓴다(screen_SCR-002.md §구현 가이드
 * "필수 충족 판정을 한 곳에 둔다" · 회귀 1회차 I-2). 두 곳에서 따로
 * 계산하면 버튼은 활성인데 안내가 남는 어긋남이 재발한다.
 */
function isAllRequiredMet(items: ConsentItemDto[], agreedCodes: ReadonlySet<string>): boolean {
  return items.filter((item) => item.required).every((item) => agreedCodes.has(item.code));
}

interface ConsentScreenProps {
  view: Extract<ScreenView, { screen: 'SCR-002' }>;
  onApprove: (agreedItemCodes: string[]) => void;
  onGated: (message: string) => void;
  /** 필수 항목이 전부 충족된 시점에 호출 — Gated 알림 해제(회귀 1회차 I-2). */
  onRequiredSatisfied: () => void;
}

/**
 * SCR-002 동의·승인 — screen_SCR-002.md 조립 참조 구현. 체크 상태는 이
 * 화면(SCR-002) 이 마운트돼 있는 동안만 존재하는 순수 로컬 UI 상태다 —
 * 본인확인으로 되돌아가면(BackToIdentity) 컴포넌트가 새로 마운트되어
 * 자동으로 빈 상태가 된다(screen_SCR-002.md §구현 가이드 "본인확인으로
 * 되돌아가면 동의 선택 상태를 비운다").
 */
export function ConsentScreen({ view, onApprove, onGated, onRequiredSatisfied }: ConsentScreenProps) {
  const [agreedCodes, setAgreedCodes] = useState<ReadonlySet<string>>(new Set());
  const consentListRef = useRef<ConsentListHandle>(null);

  useEffect(() => {
    if (view.alert?.kind === 'gated' || view.alert?.kind === 'blocked') {
      consentListRef.current?.focusFirstUnmet();
    }
  }, [view.alert]);

  /**
   * 회귀 1회차 I-2 — 값 반영(`setAgreedCodes`)과 "필수 충족 시 Gated
   * 알림 해제" 부수효과를 별개의 순차 호출로 둔다(updater 함수 자체는
   * 여전히 순수하다 — `setState` updater 안에 부수효과를 넣지 않는다).
   * "next 충족 여부" 판정은 `isAllRequiredMet` 하나만 쓴다.
   */
  function toggle(code: string) {
    const next = new Set(agreedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setAgreedCodes(next);
    if (isAllRequiredMet(view.consent.items, next)) onRequiredSatisfied();
  }

  const allRequiredMet = isAllRequiredMet(view.consent.items, agreedCodes);

  function handleApproveClick() {
    if (!allRequiredMet) {
      onGated(GATED_MESSAGE);
      return;
    }
    onApprove(Array.from(agreedCodes));
  }

  return (
    <div>
      <StageTitle title="연동 동의" subtitle="아래 내용을 확인하고 모든 항목에 동의해 주세요." />
      <NoticeBlock notice={view.consent.notice} />
      <ConsentList ref={consentListRef} items={view.consent.items} agreedCodes={agreedCodes} onToggle={toggle} />
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
