/*
 * Checkbox — 불리언 입력(design-system.md §공통 컴포넌트).
 * 동의 항목 필수 여부·서비스 B 전달 여부 등에 사용한다. 라벨 클릭 영역을 포함한다(접근성 §터치 영역).
 * 제어 컴포넌트로 checked/onChange 를 부모가 관리한다.
 */
import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: string;
  /** 외부에서 id 를 지정할 수 있게 허용(미지정 시 자동 생성). */
  id?: string;
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const classes = [styles.wrapper, className ?? ''].filter(Boolean).join(' ');
  return (
    <label className={classes} htmlFor={inputId}>
      <input id={inputId} type="checkbox" className={styles.input} {...rest} />
      <span className={styles.text}>{label}</span>
    </label>
  );
}
