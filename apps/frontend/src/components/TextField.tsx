import { useImperativeHandle, useRef, type ChangeEvent, type Ref } from 'react';
import styles from './TextField.module.css';

export interface TextFieldHandle {
  /** 포커스만 옮긴다 — 형식 오류 재입력 안내(design-system-components.md §TextField "상태") */
  focus: () => void;
  /** 값을 지우지 않고 전체 선택 상태로 포커스를 준다 — 재입력(불일치) 안내.
   *  screen_SCR-001.md §구현 가이드: "한 자리 오타는 그대로 고치고,
   *  완전히 다시 넣을 사람은 바로 덮어쓸 수 있다." */
  focusAndSelectAll: () => void;
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: 'text' | 'birthDate';
  hint?: string;
  /**
   * 필드 아래 직접 렌더할 오류 문구(자기완결 모드) — aria-invalid 를
   * 함께 켠다. 화면의 공용 알림 영역(InlineAlert)에 같은 오류를 이미
   * 보여 주는 경우에는 이 prop 대신 `invalid` + `describedBy` 를 써서
   * 문구가 화면에 두 번 나타나지 않게 한다(design-system.md §접근성
   * 기준 "오류 안내" — 오류 문구는 aria-describedby 로 필드에
   * 연결하는 것이 원칙이며 화면마다 표시 자리를 새로 만들지 않는다).
   */
  errorMessage?: string;
  /** 오류 문구를 여기서 렌더하지 않고 외부(알림 영역)에서 보여줄 때 경계색·aria-invalid 만 켠다. */
  invalid?: boolean;
  /** aria-describedby 에 추가로 합칠 외부 요소 id(예: 알림 영역 InlineAlert 의 id). */
  describedBy?: string;
  /** 제출 중 잠금 — readonly 로 값은 유지한 채 편집만 막는다(design-system-components.md §TextField "상태: 잠금"). */
  readOnly?: boolean;
  ref?: Ref<TextFieldHandle>;
}

/**
 * 한 줄 입력 — design-system-components.md §TextField.
 * 생년월일 변형(`variant="birthDate"`)은 숫자만 최대 6자리로 받고, 값을
 * 가리지 않으며 자동 포커스를 주지 않는다(호출측이 마운트 시 focus 를
 * 부르지 않으면 자동 포커스가 없다 — 이 컴포넌트는 autoFocus 를 지원하지
 * 않는다).
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  variant = 'text',
  hint,
  errorMessage,
  invalid = false,
  describedBy: externalDescribedBy,
  readOnly = false,
  ref,
}: TextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      focusAndSelectAll: () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    }),
    [],
  );

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errorMessage ? `${id}-error` : undefined;
  const isInvalid = Boolean(errorMessage) || invalid;
  const describedBy = [errorId, hintId, externalDescribedBy].filter(Boolean).join(' ') || undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (variant === 'birthDate') {
      // 숫자 외 입력은 받는 즉시 걸러 낸다(붙여넣기 포함) — 최대 6자리.
      onChange(raw.replace(/\D/g, '').slice(0, 6));
      return;
    }
    onChange(raw);
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className={variant === 'birthDate' ? `${styles.input} ${styles.birthDate}` : styles.input}
        type="text"
        inputMode={variant === 'birthDate' ? 'numeric' : undefined}
        autoComplete="off"
        maxLength={variant === 'birthDate' ? 6 : undefined}
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={describedBy}
      />
      {errorMessage ? (
        <p id={errorId} className={styles.error}>
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
