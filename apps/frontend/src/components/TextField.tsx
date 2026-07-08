/*
 * TextField — 라벨+입력+에러 캡션 3단 폼 필드(design-system.md §공통 컴포넌트).
 * 지원 타입 text·password·url·number. 에러 시 경계 danger·aria-invalid·에러 캡션 role=alert.
 * 라벨은 label for/id 로 입력과 연결하고, 에러·힌트는 aria-describedby 로 연결한다(접근성 기준).
 */
import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import styles from './TextField.module.css';

type TextFieldType = 'text' | 'password' | 'url' | 'number';

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: string;
  type?: TextFieldType;
  /** 필수 표시(*)와 aria-required. */
  required?: boolean;
  /** 에러 메시지 — 있으면 캡션(role=alert)·경계 danger·aria-invalid 를 적용한다. */
  error?: string | null;
  /** 보조 안내(에러가 없을 때만 노출). */
  hint?: string;
  /** 외부에서 id 를 지정할 수 있게 허용(미지정 시 자동 생성). */
  id?: string;
}

export function TextField({
  label,
  type = 'text',
  required = false,
  error,
  hint,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const hasError = Boolean(error);

  const describedBy = hasError ? errorId : hint ? hintId : undefined;

  const inputClasses = [styles.input, hasError ? styles.inputInvalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={inputId}
        type={type}
        className={inputClasses}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hasError ? (
        <span id={errorId} className={`${styles.caption} ${styles.captionError}`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className={`${styles.caption} ${styles.captionHint}`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
