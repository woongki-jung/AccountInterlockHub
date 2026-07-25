import type { ApiOutcome } from '../api/client';
import { defaultMessageFor } from '../api/errorMessages';
import { normalizeResultPath } from '../api/types';
import type { ApproveResponseDto, ConsentConfigDto, EntryInitialStateDto, VerifyResponseDto } from '../api/types';
import type { ConsentAlert, ScreenView } from './types';

// 단계 상태머신 — 서버 응답이 다음 화면을 정한다(화면이 스스로 단계를
// 건너뛰지 않는다 — 상위 제약 3). 각 함수는 순수 함수라 단위 테스트가
// 쉽고, 훅(useInterlockFlow)은 이 결과를 그대로 상태에 반영하기만 한다.
//
// 정본: spec-screens.md §화면 간 이동 경로, screen_SCR-001~004.md
// §화면 상태 전이, spec-functions-api-user.md 세 접점의 에러 처리 표.

/** 진입 응답의 초기 상태 → 첫 화면(PROC-101 F1·F3). */
export function initialViewFromEntryState(initial: EntryInitialStateDto): ScreenView {
  if (initial.stage === 'IDENTITY') {
    return { screen: 'SCR-001', status: 'idle', alert: null };
  }
  return {
    screen: 'SCR-004',
    result: {
      // 경로 값이 1~3 밖이거나 없으면 경로 ②로 그린다(screen_SCR-004.md
      // §구현 가이드 — 미매핑 catch-all). hydration.ts 가 이미 정규화해
      // 넘기더라도 그 타입 선언이 런타임을 보장하지 않으므로 이 지점에서
      // 다시 거친다 — RESULT_PATH_META 조회(ResultPanel) 이전 단일 관문.
      resultPath: normalizeResultPath(initial.resultPath),
      reasonCode: initial.reasonCode,
      isReAnnouncement: initial.isReAnnouncement,
      returnUrl: initial.returnUrl,
    },
  };
}

/** 본인확인 제출(POST .../verify) 응답 → 다음 화면. */
export function viewAfterVerify(outcome: ApiOutcome<VerifyResponseDto>): ScreenView {
  if (outcome.kind === 'network-error') {
    // SCR-001 에는 SCR-003 의 `Unconfirmed` 같은 전용 상태가 사양에 없다
    // — 승인 요청과 달리 본인확인 요청은 카드가 아직 바뀌지 않은
    // 상태라 사용자가 같은 화면에서 바로 다시 시도할 수 있다. 재시도
    // 가능한 처리 오류(EX-BIZ-003)와 같은 방식으로 안내한다(방어적
    // 폴백 — 완료 보고 WARN 참고).
    return { screen: 'SCR-001', status: 'idle', alert: { kind: 'retryable', message: defaultMessageFor('EX-BIZ-003') } };
  }

  if (outcome.kind === 'success') {
    const data = outcome.data;
    if (data.stage === 'CONSENT') {
      return { screen: 'SCR-002', consent: data.consent, status: 'idle', alert: null };
    }
    return {
      screen: 'SCR-004',
      result: {
        resultPath: data.resultPath,
        isReAnnouncement: data.isReAnnouncement,
        returnUrl: data.returnUrl,
      },
    };
  }

  const { code, message } = outcome.error;
  if (code === 'EX-AUTH-001') return { screen: 'SCR-001', status: 'idle', alert: { kind: 'format', message } };
  if (code === 'EX-AUTH-002') return { screen: 'SCR-001', status: 'idle', alert: { kind: 'mismatch', message } };
  if (code === 'EX-SEC-001' || code === 'EX-SEC-002') {
    return { screen: 'SCR-004', result: { resultPath: 2, reasonCode: code, isReAnnouncement: false } };
  }
  // EX-BIZ-003 + 계약 밖 미상 코드에 대한 방어적 폴백.
  return { screen: 'SCR-001', status: 'idle', alert: { kind: 'retryable', message } };
}

/**
 * 동의·승인 제출(POST .../approve) 응답 → 다음 화면.
 * @param lastConsent BackToConsent(EX-BIZ-001·EX-BIZ-003) 시 다시 그릴
 *   동의 항목 구성 — 승인 요청은 발신 즉시 SCR-003 으로 전환되므로
 *   이 시점의 "현재 화면"에는 동의 항목이 없다. 훅이 마지막으로 받은
 *   구성을 기억해 뒀다가 넘겨준다.
 */
export function viewAfterApprove(
  outcome: ApiOutcome<ApproveResponseDto>,
  lastConsent: ConsentConfigDto | null,
): ScreenView {
  if (outcome.kind === 'network-error') {
    // screen_SCR-003.md §화면 상태 전이 `Unconfirmed`.
    return { screen: 'SCR-003', unconfirmed: true };
  }

  if (outcome.kind === 'success') {
    const data = outcome.data;
    return {
      screen: 'SCR-004',
      result: { resultPath: data.resultPath, isReAnnouncement: data.isReAnnouncement, returnUrl: data.returnUrl },
    };
  }

  const { code, message } = outcome.error;
  if (code === 'EX-AUTH-001') return { screen: 'SCR-001', status: 'idle', alert: { kind: 'format', message } };
  if (code === 'EX-AUTH-002') return { screen: 'SCR-001', status: 'idle', alert: { kind: 'mismatch', message } };
  if (code === 'EX-SEC-001' || code === 'EX-SEC-002') {
    return { screen: 'SCR-004', result: { resultPath: 2, reasonCode: code, isReAnnouncement: false } };
  }
  if (code === 'EX-BIZ-002') {
    // 502 도 정상 종료다 — 결과 경로 ③(spec-functions-api-user.md §동의·승인 제출 에러 처리).
    return { screen: 'SCR-004', result: { resultPath: 3, isReAnnouncement: false } };
  }
  if (code === 'EX-BIZ-001') {
    return backToConsentOrFallback(lastConsent, { kind: 'blocked', message });
  }
  // EX-BIZ-003 + 계약 밖 미상 코드에 대한 방어적 폴백.
  return backToConsentOrFallback(lastConsent, { kind: 'retryable', message });
}

function backToConsentOrFallback(lastConsent: ConsentConfigDto | null, alert: ConsentAlert): ScreenView {
  if (lastConsent) {
    return { screen: 'SCR-002', consent: lastConsent, status: 'idle', alert };
  }
  // 이론상 도달하지 않는다 — SCR-002 를 거쳐야만 approve() 를 호출할 수
  // 있으므로 lastConsent 는 항상 있다. 방어적으로 미매핑 catch-all 과
  // 같은 정신으로 결과 경로 ②를 안내한다(SVC-005 F-003).
  return { screen: 'SCR-004', result: { resultPath: 2, isReAnnouncement: false } };
}

/**
 * 화면 게이팅(BR-004) — 필수 미충족 상태에서 aria-disabled 승인 버튼을
 * 눌렀을 때. 서버를 부르지 않는 순수 클라이언트 전이다
 * (screen_SCR-002.md §화면 상태 전이 `Gated`).
 */
export function consentGatedView(consent: ConsentConfigDto, message: string): ScreenView {
  return { screen: 'SCR-002', consent, status: 'idle', alert: { kind: 'gated', message } };
}
