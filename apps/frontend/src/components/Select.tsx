/*
 * Select — 라벨+단일 선택(enum)+에러 캡션 3단 폼 필드(design-system.md §공통 컴포넌트).
 * 허용값 목록(options)을 바인딩한다(예: 서비스 B 전달 방식 HTTP 메서드).
 * 에러 시 경계 danger·aria-invalid·에러 캡션 role=alert(TextField 와 동일 규칙).
 */
import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import styles from './Select.module.css';

/** 선택 옵션(값-표시 라벨 쌍). */
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: SelectOption[];
  /** 필수 표시(*)와 aria-required. */
  required?: boolean;
  /** 에러 메시지 — 있으면 캡션(role=alert)·경계 danger·aria-invalid 를 적용한다. */
  error?: string | null;
  /** 보조 안내(에러가 없을 때만 노출). */
  hint?: string;
  /** 외부에서 id 를 지정할 수 있게 허용(미지정 시 자동 생성). */
  id?: string;
}

export function Select({
  label,
  options,
  required = false,
  error,
  hint,
  id,
  className,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const hasError = Boolean(error);
  const describedBy = hasError ? errorId : hint ? hintId : undefined;

  const selectClasses = [styles.select, hasError ? styles.selectInvalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        id={selectId}
        className={selectClasses}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
