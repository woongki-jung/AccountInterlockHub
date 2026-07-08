/*
 * Table — 목록 표시(design-system.md §공통 컴포넌트: 헤더 배경 color-bg-subtle·행 hover·행 클릭·정렬).
 * 컬럼 정의(render 함수)로 셀을 구성하므로 상호작용 셀(Toggle·Badge·버튼)도 담을 수 있다.
 * 좁은 폭 보호를 위해 가로 스크롤 컨테이너(overflow-x:auto)로 감싼다(§레이아웃·반응형).
 * hideOnMobile 컬럼은 mobile(<640px)에서 접는다(관리자 테이블 주요 열만 노출).
 */
import type { ReactNode } from 'react';
import styles from './Table.module.css';

export interface TableColumn<T> {
  /** 컬럼 식별 키(React key·안정 식별자). */
  key: string;
  header: ReactNode;
  /** 셀 렌더러. index 는 정렬된 표시 순서(0-based)로 '순서' 열 등에 사용한다. */
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** mobile(<640px)에서 접기. */
  hideOnMobile?: boolean;
  /** 셀 줄바꿈 억제(코드·일시 등). */
  nowrap?: boolean;
}

export interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  /** 행 클릭 핸들러(있으면 hover 커서·행 클릭 활성). */
  onRowClick?: (row: T) => void;
  /** 표 전체의 접근성 라벨. */
  ariaLabel?: string;
}

function alignClass(align: TableColumn<unknown>['align']): string {
  if (align === 'right') return styles.alignRight;
  if (align === 'center') return styles.alignCenter;
  return '';
}

function cellClasses(col: TableColumn<unknown>): string {
  return [
    alignClass(col.align),
    col.hideOnMobile ? styles.hideOnMobile : '',
    col.nowrap ? styles.nowrap : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Table<T>({ columns, rows, getRowKey, onRowClick, ariaLabel }: TableProps<T>) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cellClasses(col as TableColumn<unknown>)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row)}
              className={onRowClick ? styles.clickable : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={cellClasses(col as TableColumn<unknown>)}>
                  {col.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
