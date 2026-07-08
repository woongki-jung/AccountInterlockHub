/*
 * RepeatableRows — 동적 반복 입력 컨테이너(design-system.md §공통 컴포넌트).
 * 각 행 = 필드 그룹(renderRow) + 삭제 버튼, 하단 "행 추가" 버튼. 순서(order)는 배열 인덱스로 부여한다.
 * 데이터(추가·삭제·값)는 부모가 상태로 관리하고, 본 컴포넌트는 표현·행 조작 트리거만 담당한다.
 * 지정 강조(rowHighlighted)·삭제 비활성(removeDisabled)으로 화면별 규칙(예: 사용자 키값 지정 행 강조,
 * 최소 1행 유지)을 주입한다.
 */
import type { ReactNode } from 'react';
import styles from './RepeatableRows.module.css';

export interface RepeatableRowsProps<T> {
  items: T[];
  /** React key(안정 식별자) 추출기. */
  getKey: (item: T, index: number) => string;
  /** 행 헤더 좌측(제목·배지 등). 미지정 시 헤더 좌측 비움. */
  renderHeader?: (item: T, index: number) => ReactNode;
  /** 행 본문(필드 그룹). */
  renderRow: (item: T, index: number) => ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** 하단 추가 버튼 라벨(예: "+ 파라미터 행 추가"). */
  addLabel: string;
  /** 삭제 버튼 접근성 라벨(기본 "행 삭제"). */
  removeAriaLabel?: string;
  /** 행 강조 여부(예: 사용자 키값 지정 행). */
  rowHighlighted?: (item: T, index: number) => boolean;
  /** 삭제 비활성 여부(예: 최소 1행 유지). */
  removeDisabled?: (item: T, index: number) => boolean;
  /** 폼 전체 disabled(제출 중 등). */
  disabled?: boolean;
}

export function RepeatableRows<T>({
  items,
  getKey,
  renderHeader,
  renderRow,
  onAdd,
  onRemove,
  addLabel,
  removeAriaLabel = '행 삭제',
  rowHighlighted,
  removeDisabled,
  disabled = false,
}: RepeatableRowsProps<T>) {
  return (
    <div>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const highlighted = rowHighlighted?.(item, index) ?? false;
          const rmDisabled = disabled || (removeDisabled?.(item, index) ?? false);
          return (
            <li
              key={getKey(item, index)}
              className={[styles.row, highlighted ? styles.rowHighlighted : ''].join(' ')}
            >
              <div className={styles.rowHead}>
                <div className={styles.rowHeadMain}>{renderHeader?.(item, index)}</div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => onRemove(index)}
                  disabled={rmDisabled}
                  aria-label={`${removeAriaLabel} (${index + 1})`}
                >
                  삭제
                </button>
              </div>
              <div className={styles.rowBody}>{renderRow(item, index)}</div>
            </li>
          );
        })}
      </ol>
      <button type="button" className={styles.addBtn} onClick={onAdd} disabled={disabled}>
        {addLabel}
      </button>
    </div>
  );
}
