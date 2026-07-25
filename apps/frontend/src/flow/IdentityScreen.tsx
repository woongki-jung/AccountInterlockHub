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
 * 11종으로 조립한 참조 구현이다. 정확한 카피·인터랙션 다듬기는 P15 소관.
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onVerify();
  }

  const isSubmitting = view.status === 'submitting';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StageTitle title="본인 확인" subtitle="생년월일 여섯 자리를 입력하면 연동을 계속할 수 있습니다." />
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
