/*
 * TextField(user/birthdate) — SCR-005 본인확인 전용 생년월일 입력(design-system.md §컴포넌트 사용자 변형).
 * 공통 TextField(관리자, `components/TextField.tsx`)는 required 시 별표(*)를 렌더하며 관리자 폼
 * (ConfigFormPage)이 이 동작에 의존한다 — 그 컴포넌트를 건드리지 않고 별도로 둔다(build 지침 §2-1).
 * "필수" 텍스트 태그(별표 미사용)를 쓰면서도 aria-required 접근성은 그대로 유지한다.
 *
 * 복호화 실패(EX-SEC-006) 시 값 유지 + 포커스 이동 + 값 전체 선택(SCR-005 §구현 가이드 AUTH-004-02)을
 * 위해 호출부(ConsentPage)가 ref 로 입력 DOM 을 직접 조회할 수 있도록 forwardRef 로 노출한다.
 */
import { forwardRef, useId } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import styles from './BirthDateField.module.css';

export interface BirthDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** 에러 메시지(FE 형식 위반 또는 서버 복호화 실패) — 있으면 danger 경계·aria-invalid. */
  error?: string | null;
  /**
   * true 면 에러 캡션에 role=alert 를 적용한다 — SCR-005 §고정 문구 정본상 서버 복호화 실패
   * (EX-SEC-006)만 role=alert 이고 FE 형식 위반은 아니다(사용자가 입력 중 매 blur 마다 assertive
   * 인터럽트가 발생하는 것을 피하기 위함). 기본값 false.
   */
  errorIsAlert?: boolean;
  /** 에러가 없을 때 노출하는 보조 캡션(고정 문구 정본 — 마침표 없이 원문 그대로). */
  hint: string;
  disabled?: boolean;
}

export const BirthDateField = forwardRef<HTMLInputElement, BirthDateFieldProps>(
  function BirthDateField(
    { id, value, onChange, onBlur, error, errorIsAlert = false, hint, disabled = false },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const captionId = `${inputId}-caption`;
    const hasError = Boolean(error);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      onChange(event.target.value);
    }
    function handleBlur(_event: FocusEvent<HTMLInputElement>) {
      onBlur?.();
    }

    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={inputId}>
          생년월일(YYMMDD)
          <span className={styles.requiredTag}>필수</span>
        </label>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="YYMMDD"
          autoComplete="off"
          className={[styles.input, hasError ? styles.inputError : ''].filter(Boolean).join(' ')}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-required="true"
          aria-invalid={hasError || undefined}
          aria-describedby={captionId}
        />
        <p
          key={hasError ? 'error' : 'hint'}
          id={captionId}
          className={[styles.caption, hasError ? styles.captionError : '']
            .filter(Boolean)
            .join(' ')}
          role={hasError && errorIsAlert ? 'alert' : undefined}
        >
          {hasError ? error : hint}
        </p>
      </div>
    );
  },
);
