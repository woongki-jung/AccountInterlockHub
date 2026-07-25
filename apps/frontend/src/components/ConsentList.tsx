import { useImperativeHandle, useRef, type Ref } from 'react';
import type { ConsentItemDto } from '../api/types';
import { Badge } from './Badge';
import styles from './ConsentList.module.css';

export interface ConsentListHandle {
  /** 필수 항목 중 아직 체크되지 않은 첫 항목으로 포커스를 옮긴다.
   *  Gated(화면 게이팅)·Blocked(서버 재검증) 유효성 안내가 함께 부른다
   *  (screen_SCR-002.md §화면 상태 전이). */
  focusFirstUnmet: () => void;
}

interface ConsentListProps {
  items: ConsentItemDto[];
  agreedCodes: ReadonlySet<string>;
  onToggle: (code: string) => void;
  ref?: Ref<ConsentListHandle>;
}

/**
 * 동의 항목 목록 — design-system-components.md §ConsentList·ConsentItem.
 * 항목 1건이어도 목록 구조로 렌더한다. 잠금(제출 중) 상태를 두지 않는다
 * — 승인은 발신 즉시 카드 내용이 SCR-003 으로 바뀌어 이 목록이 화면에서
 * 사라지므로 잠글 대상이 없다(같은 문서 "잠금 상태가 사라진 이유").
 */
export function ConsentList({ items, agreedCodes, onToggle, ref }: ConsentListProps) {
  const checkboxRefs = useRef(new Map<string, HTMLInputElement>());

  useImperativeHandle(
    ref,
    () => ({
      focusFirstUnmet: () => {
        const target = items.find((item) => item.required && !agreedCodes.has(item.code));
        if (target) checkboxRefs.current.get(target.code)?.focus();
      },
    }),
    [items, agreedCodes],
  );

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const checked = agreedCodes.has(item.code);
        return (
          <li key={item.code} className={styles.item}>
            <label className={styles.row}>
              <input
                ref={(el) => {
                  if (el) checkboxRefs.current.set(item.code, el);
                  else checkboxRefs.current.delete(item.code);
                }}
                type="checkbox"
                className={styles.checkbox}
                checked={checked}
                onChange={() => onToggle(item.code)}
              />
              <span className={styles.body}>
                <span className={styles.labelRow}>
                  <span>{item.label}</span>
                  {item.required ? <Badge variant="required">필수</Badge> : null}
                </span>
                <span className={styles.description}>{item.description}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
