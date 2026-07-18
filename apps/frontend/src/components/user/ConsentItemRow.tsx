/*
 * ConsentItem(user) — SCR-005 동의 항목 1행(design-system.md §컴포넌트 사용자 변형).
 * 히트 영역 = 항목 행 전체(최소 48px) — 체크박스+라벨+설명을 하나의 label 로 묶어 어디를 눌러도
 * 토글되게 한다. [상세] 버튼은 label 바깥의 형제 요소로 둬 클릭이 체크 토글과 분리되게 한다(전파
 * 차단 트릭 불필요 — DOM 상 label 의 자식이 아니므로 자연히 분리된다).
 * 체크박스 자체는 appearance:none 네이티브 input(포커스·키보드 동작은 브라우저 기본 유지) 위에
 * 커스텀 글리프(SVG)를 얹는 방식으로 20x20·radius-sm·2px 경계 규격을 구현한다.
 */
import { UserButton } from './UserButton';
import type { ConsentItem } from '../../lib/consentApi';
import styles from './ConsentItemRow.module.css';

export interface ConsentItemRowProps {
  item: ConsentItem;
  checked: boolean;
  disabled: boolean;
  onToggle: (order: number, value: boolean) => void;
  onOpenDetail: (order: number) => void;
}

export function ConsentItemRow({
  item,
  checked,
  disabled,
  onToggle,
  onOpenDetail,
}: ConsentItemRowProps) {
  const inputId = `consent-item-${item.order}`;
  const descId = `consent-item-desc-${item.order}`;

  return (
    <li className={[styles.row, checked ? styles.rowSelected : ''].filter(Boolean).join(' ')}>
      <label className={styles.main} htmlFor={inputId}>
        <span className={styles.checkboxWrap}>
          <input
            id={inputId}
            type="checkbox"
            className={styles.checkboxInput}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onToggle(item.order, e.target.checked)}
            aria-required={item.required || undefined}
            aria-describedby={item.description ? descId : undefined}
          />
          {checked && (
            <svg
              className={styles.checkGlyph}
              viewBox="0 0 12 10"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M1 5 L4.5 8.5 L11 1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className={styles.copy}>
          <span className={styles.topRow}>
            <span className={styles.itemLabel}>{item.label}</span>
            <span className={item.required ? styles.reqTag : styles.optTag}>
              {item.required ? '필수' : '선택'}
            </span>
          </span>
          {item.description && (
            <span id={descId} className={styles.desc}>
              {item.description}
            </span>
          )}
        </span>
      </label>
      {item.termsContent && (
        <UserButton
          type="button"
          variant="ghost-link"
          disabled={disabled}
          className={styles.detailButton}
          onClick={() => onOpenDetail(item.order)}
        >
          상세
        </UserButton>
      )}
    </li>
  );
}
