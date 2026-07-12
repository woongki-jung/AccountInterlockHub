/*
 * TextField — 라벨+입력+에러 캡션 3단 폼 필드(design-system.md §공통 컴포넌트).
 * 지원 타입 text·password·url·number·birthdate. 에러 시 경계 danger·aria-invalid·에러 캡션 role=alert.
 * 라벨은 label for/id 로 입력과 연결하고, 에러·힌트는 aria-describedby 로 연결한다(접근성 기준).
 *
 * birthdate 변형(SCR-005 본인확인, design-system.md §공통 컴포넌트 TextField) — 6자리 숫자 입력
 * (inputMode=numeric·maxLength=6·YYMMDD 플레이스홀더). 네이티브 input 은 항상 type="text"로 렌더한다
 * (브라우저 기본 date 피커·달력 UI 회피, 자유 형식 입력 유지). 본인확인용 민감값이라 값을 로그·URL·타
 * 화면에 노출하지 않고 제출 본문으로만 전송하는 책임은 사용처(화면)에 있다(AUTH-004·SEC-005-06).
 */
import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import styles from './TextField.module.css';

type TextFieldType = 'text' | 'password' | 'url' | 'number' | 'birthdate';

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

/** birthdate 변형 기본 속성 — 호출부가 명시적으로 넘긴 값(rest)이 있으면 그 값이 우선한다. */
const BIRTHDATE_DEFAULT_PROPS = {
  inputMode: 'numeric' as const,
  maxLength: 6,
  placeholder: 'YYMMDD',
  autoComplete: 'off',
};

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
  const isBirthdate = type === 'birthdate';

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
        type={isBirthdate ? 'text' : type}
        className={inputClasses}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        {...(isBirthdate ? BIRTHDATE_DEFAULT_PROPS : undefined)}
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
