import { useRef, useState } from 'react';
import { submitApproval, verifyIdentity } from '../api/client';
import { readEncPairFromLocation, type EncPair } from '../api/entryParams';
import { readInitialState } from '../api/hydration';
import type { ConsentConfigDto } from '../api/types';
import { consentGatedView, initialViewFromEntryState, viewAfterApprove, viewAfterVerify } from './transitions';
import type { ScreenView } from './types';

const EMPTY_ENC_PAIR: EncPair = { encX: '', encY: '' };

export interface InterlockFlow {
  /** 지금 보여야 할 화면과 그 표시 상태. */
  view: ScreenView;
  /** 본인확인에서 입력받아 승인 제출까지 페이지 메모리로만 보유하는 생년월일. */
  birthDate: string;
  setBirthDate: (value: string) => void;
  /** SCR-001 확인 버튼 — POST .../verify(PROC-102). */
  verify: () => Promise<void>;
  /** SCR-002 승인 버튼(활성) — POST .../approve(PROC-103). 발신 즉시 SCR-003 으로 전환된다. */
  approve: (agreedItemCodes: string[]) => Promise<void>;
  /**
   * SCR-002 화면 게이팅(BR-004) — 필수 미충족 상태에서 aria-disabled
   * 승인 버튼을 눌렀을 때 호출한다. 서버를 부르지 않는다.
   */
  reportConsentValidationFailed: (message: string) => void;
}

/**
 * 단계 상태머신 — IDENTITY → CONSENT → PROCESSING → RESULT.
 *
 * 단계는 서버 응답이 정하며 화면은 스스로 단계를 건너뛰지 않는다(상위
 * 제약 3). 진입 초기 상태 수화는 첫 렌더의 지연 초기화 시점에 동기로
 * 수행한다 — useEffect 로 나중에 읽지 않는다(스켈레톤 없음 원칙,
 * design-system.md §상태 표현 "초기").
 *
 * 암호값 쌍·생년월일은 이 훅의 메모리 상태로만 존재한다(`ref`·`useState`) —
 * URL 파라미터·숨은 필드·`localStorage`·`sessionStorage`·쿠키 어디에도
 * 옮기지 않는다(`DATA-001-02`·`DATA-001-03`). 결과 화면에 도달하면
 * 더 들고 있을 이유가 없으므로 즉시 폐기한다(screen_SCR-004.md §구현 가이드).
 */
export function useInterlockFlow(): InterlockFlow {
  // 암호값 쌍 — 진입 시 자기 URL 쿼리에서 한 번만 읽는다(PROC-101 F2).
  // useRef 지연 초기화 패턴 — 매 렌더 location.search 를 다시 읽지 않는다.
  const encRef = useRef<EncPair | null>(null);
  if (encRef.current === null) encRef.current = readEncPairFromLocation();

  // BackToConsent(EX-BIZ-001·EX-BIZ-003) 시 다시 그릴 동의 항목 구성.
  // 승인 요청은 발신 즉시 SCR-003 으로 전환되므로 그 시점엔 화면에 동의
  // 항목이 없다 — 마지막으로 받은 구성을 별도로 기억해 둔다.
  const lastConsentRef = useRef<ConsentConfigDto | null>(null);

  const [birthDate, setBirthDate] = useState('');
  const [view, setView] = useState<ScreenView>(() => {
    const initial = initialViewFromEntryState(readInitialState());
    if (initial.screen === 'SCR-004') {
      // 수화(hydration) 경로로 첫 렌더부터 곧장 RESULT 에 진입하는
      // 경우다 — 아래 applyNextView() 를 거치지 않는 유일한 경로라
      // 여기서 따로 폐기한다(DATA-001-03, screen_SCR-004.md §구현
      // 가이드 "결과를 표시한 뒤에도 페이지 메모리의 암호값·생년월일을
      // 계속 들고 있을 이유가 없다"). birthDate 는 이 시점까지 입력받은
      // 적이 없어(useState('') 초기값 그대로) 별도로 비울 것이 없다.
      encRef.current = EMPTY_ENC_PAIR;
    }
    return initial;
  });

  /** lastConsent 동기화 + 결과 도달 시 메모리 폐기를 한 곳에 모은다. */
  function applyNextView(next: ScreenView) {
    if (next.screen === 'SCR-002') {
      lastConsentRef.current = next.consent;
    }
    if (next.screen === 'SCR-004') {
      encRef.current = EMPTY_ENC_PAIR;
      setBirthDate('');
    }
    setView(next);
  }

  async function verify() {
    if (view.screen === 'SCR-001' && view.status === 'submitting') return; // 중복 제출 차단
    const enc = encRef.current ?? EMPTY_ENC_PAIR;
    setView({ screen: 'SCR-001', status: 'submitting', alert: null });
    const outcome = await verifyIdentity({ encX: enc.encX, encY: enc.encY, birthDate });
    applyNextView(viewAfterVerify(outcome));
  }

  async function approve(agreedItemCodes: string[]) {
    if (view.screen !== 'SCR-002' || view.status === 'submitting') return; // 중복 제출 차단
    const enc = encRef.current ?? EMPTY_ENC_PAIR;
    // 요청 발신 즉시 카드 내용이 SCR-003 으로 바뀐다 — 응답을 기다리지
    // 않는다(screen_SCR-002.md §화면 상태 전이 `SubmittingApprove`).
    setView({ screen: 'SCR-003', unconfirmed: false });
    const outcome = await submitApproval({ encX: enc.encX, encY: enc.encY, birthDate, agreedItemCodes });
    applyNextView(viewAfterApprove(outcome, lastConsentRef.current));
  }

  function reportConsentValidationFailed(message: string) {
    setView((prev) => (prev.screen === 'SCR-002' ? consentGatedView(prev.consent, message) : prev));
  }

  return { view, birthDate, setBirthDate, verify, approve, reportConsentValidationFailed };
}
