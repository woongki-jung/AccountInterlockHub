import { useEffect, useRef, type FormEvent } from 'react';
import { Button, InlineAlert, StageTitle, TextField } from '../components';
import type { TextFieldHandle } from '../components';
import type { ScreenView } from '../stage/types';
import stack from './stack.module.css';

const ALERT_ID = 'scr001-alert';

interface IdentityScreenProps {
  view: Extract<ScreenView, { screen: 'SCR-001' }>;
  birthDate: string;
  onBirthDateChange: (value: string) => void;
  onVerify: () => void;
}

/**
 * SCR-001 본인확인 — screen_SCR-001.md 의 레이아웃·상태 전이를 컴포넌트
 * 11종으로 조립한 참조 구현이다. 정확한 카피·인터랙션 다듬기는 P15 가
 * 완료했다(`#492`).
 */
export function IdentityScreen({ view, birthDate, onBirthDateChange, onVerify }: IdentityScreenProps) {
  const fieldRef = useRef<TextFieldHandle>(null);

  useEffect(() => {
    // ReEntry(불일치) — 값 유지 + 전체 선택. ReEntry(형식) — 포커스만.
    // 진입 첫 그림에서는 alert 가 없으므로 자동 포커스가 없다
    // (design-system-components.md §TextField "자동 포커스를 주지 않는다").
    if (view.alert?.kind === 'mismatch') fieldRef.current?.focusAndSelectAll();
    else if (view.alert?.kind === 'format') fieldRef.current?.focus();
  }, [view.alert]);

  /**
   * 제목 자동 포커스를 건너뛰는가 — design-system.md §접근성 기준(commit
   * `a8058a0`). 이 화면이 새로 마운트되는 경로는 둘뿐이다(전이 그래프
   * 전수 확인 — `useInterlockFlow.ts` `applyNextView` 의 불변조건대로
   * `SCR-001` 을 목적지로 삼는 `setView` 는 그 함수 하나뿐이고, 그 함수가
   * `SCR-001` 로 보내는 호출자는 초기 상태(지연 초기화)와
   * `viewAfterVerify`·`viewAfterApprove` 의 `EX-AUTH-001`·`EX-AUTH-002`
   * 분기뿐이다):
   * ① 진입(최초 로드) — `alert === null`. 전환이 아니므로 자동 포커스를
   *    주지 않는다(위 §TextField 와 같은 원칙 — [X-2]).
   * ② `BackToIdentity`(ReEntry, `alert.kind` 가 `format`·`mismatch`) —
   *    필드에 매인 InlineAlert 가 함께 뜨는 전환이라 포커스는 위
   *    useEffect 가 필드로 옮긴다([X-1]).
   * 그 밖의 렌더(Submitting·Retryable 등)는 이 화면이 이미 마운트된
   * 상태의 갱신이라 `title` 이 바뀌지 않아 `useStageFocus` 의 effect 가
   * 애초에 재실행되지 않는다 — 그때는 이 값이 읽히지 않는다.
   */
  const skipTitleFocus = view.alert === null || view.alert.kind === 'format' || view.alert.kind === 'mismatch';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onVerify();
  }

  const isSubmitting = view.status === 'submitting';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StageTitle
        title="본인 확인"
        subtitle="생년월일 여섯 자리를 입력하면 연동을 계속할 수 있습니다."
        skipFocus={skipTitleFocus}
      />
      <TextField
        ref={fieldRef}
        id="birthDate"
        label="생년월일 여섯 자리"
        variant="birthDate"
        value={birthDate}
        onChange={onBirthDateChange}
        hint="예: 1990년 3월 5일 → 900305"
        invalid={view.alert?.kind === 'format' || view.alert?.kind === 'mismatch'}
        describedBy={view.alert ? ALERT_ID : undefined}
        readOnly={isSubmitting}
      />
      {view.alert ? (
        <div className={stack.body}>
          <InlineAlert id={ALERT_ID} message={view.alert.message} />
        </div>
      ) : null}
      <div className={stack.actions}>
        <Button type="submit" isLoading={isSubmitting} loadingText="확인 중">
          확인
        </Button>
      </div>
    </form>
  );
}
