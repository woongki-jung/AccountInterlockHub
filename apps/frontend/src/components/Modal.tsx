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
  /** 다이얼로그 최대 폭 — sm(확인 420px)·md(콘텐츠 480px). chrome='userTerms' 일 때는 무시된다. */
  size?: 'sm' | 'md';
  /**
   * 시각 규격 변형 — 기본값 'standard'(관리자 화면과 100% 동일 렌더, 값을 넘기지 않으면 이 값이 적용
   * 된다). 'userTerms' 는 design-system.md `Modal(user/terms)`(SCR-005 약관 상세 전용) 시각 규격을
   * 추가로 입힌다. 포커스 트랩·ESC·배경 클릭·스크롤 잠금 접근성 로직은 변형과 무관하게 100% 재사용된다
   * — 아래에서 재구현하지 않는다. 관리자 화면 호출부는 이 prop 을 넘기지 않으므로 렌더가 기존과
   * 완전히 동일하다(build 지침 §2-1 — 관리자 화면 렌더 불변).
   */
  chrome?: 'standard' | 'userTerms';
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
  chrome = 'standard',
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

  // chrome='userTerms' 일 때만 추가 클래스를 얹는다 — 기본값('standard')에서는 각 className 이
  // 기존과 완전히 동일한 문자열로 계산돼(빈 문자열은 filter(Boolean) 로 제거) 관리자 화면 렌더가
  // 바이트 단위로 불변이다(build 지침 §2-1).
  const isUserChrome = chrome === 'userTerms';

  return createPortal(
    <div
      className={[styles.scrim, isUserChrome ? styles.scrimUser : ''].filter(Boolean).join(' ')}
      onMouseDown={handleScrimClick}
    >
      <div
        ref={dialogRef}
        className={[
          styles.modal,
          isUserChrome ? styles.modalUser : size === 'md' ? styles.sizeMd : styles.sizeSm,
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2
          id={titleId}
          className={[styles.title, isUserChrome ? styles.titleUser : '']
            .filter(Boolean)
            .join(' ')}
        >
          {title}
        </h2>
        <div
          className={[
            scrollBody ? styles.scrollBody : styles.body,
            isUserChrome ? styles.bodyUser : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
        {footer && (
          <div
            className={[styles.actions, isUserChrome ? styles.actionsUser : '']
              .filter(Boolean)
              .join(' ')}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
