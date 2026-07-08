/*
 * Modal — 확인·경고 / 콘텐츠(약관 상세) 변형(design-system.md §공통 컴포넌트 Modal).
 * 공통: 배경 스크림, ESC·배경 클릭 닫기, 포커스 트랩(접근성 §키보드 탐색).
 * 확인·경고: 제목 + 본문 + 하단 액션(danger·secondary). 삭제 확인 등 파괴적 액션에 사용.
 * 콘텐츠: scrollBody=true 로 제목 + 스크롤 본문(max-height 내 overflow-y:auto) + 닫기 액션(약관 열람).
 *
 * 포커스 관리는 open 진입 시 1회만 수행하고(이전 포커스 저장·복원), ESC·Tab 트랩은
 * onKeyDown 에서 처리해 onClose 신원 변화로 인한 effect 재실행을 피한다(안티패턴 방지).
 */
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 하단 액션 영역(버튼 등). */
  footer?: ReactNode;
  /** 콘텐츠 변형 — 본문 스크롤(max-height·overflow-y:auto). */
  scrollBody?: boolean;
  /** 다이얼로그 최대 폭 — sm(확인 420px)·md(콘텐츠 480px). */
  size?: 'sm' | 'md';
}

/** 포커스 가능한 요소 셀렉터(포커스 트랩 순회 대상). */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  scrollBody = false,
  size = 'sm',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // open 진입 시 1회: 이전 포커스 저장 → 다이얼로그로 포커스 이동, 종료 시 복원 + 스크롤 잠금.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // 다이얼로그 내 첫 포커스 대상(없으면 다이얼로그 자체).
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    // 포커스 트랩 — 다이얼로그 내부 포커스 요소 사이만 순회.
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    // 모달 내부 포커스 요소(항상 표시 상태). fixed 서브트리에서 offsetParent 가 null 이 될 수 있어
    // 가시성 필터 없이 매칭 요소를 그대로 순회한다.
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === firstEl || active === dialog)) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && active === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  }

  function handleScrimClick(event: MouseEvent<HTMLDivElement>) {
    // 배경(스크림) 자체 클릭만 닫기 — 다이얼로그 내부 클릭은 무시.
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div className={styles.scrim} onMouseDown={handleScrimClick}>
      <div
        ref={dialogRef}
        className={[styles.modal, size === 'md' ? styles.sizeMd : styles.sizeSm].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={scrollBody ? styles.scrollBody : styles.body}>{children}</div>
        {footer && <div className={styles.actions}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
