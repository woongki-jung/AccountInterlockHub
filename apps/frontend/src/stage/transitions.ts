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
    // screen_SCR-001.md §화면 상태 전이 `Retryable` — "500 EX-BIZ-003,
    // 또는 본인확인 제출의 응답 미수신(전송 계층 단절)"을 이 상태의
    // 진입 조건으로 명시한다(같은 문서 70·75행 — 회귀 1회차 S-2, 이전
    // 주석의 "사양에 없다"는 낡은 서술이었다). 승인 요청과 달리 본인확인
    // 요청은 어떤 결과도 확정하지 않아(`BIZ-002-03` ②) 카드가 아직
    // 바뀌지 않은 이 화면에서 같은 값 그대로 다시 제출하는 것이 안전하다.
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
        // 회귀 2회차 S-1 — resultPath 를 다루는 지점은 hydration.ts·
        // ResultPanel 뿐 아니라 여기(응답 성공 분기)도 포함된다. HTTP
        // 응답 JSON 을 거쳐 온 값이라 정적 타입만으로는 런타임을
        // 보장하지 않는다(api/client.ts 의 무검증 캐스팅).
        resultPath: normalizeResultPath(data.resultPath),
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
      // 회귀 2회차 S-1 — 같은 이유로 여기도 정규화를 거친다(viewAfterVerify 참고).
      result: {
        resultPath: normalizeResultPath(data.resultPath),
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

/**
 * 생년월일 형식(6자리 숫자) 검증 — screen_SCR-001.md §입력 폼 정의
 * "유효성 규칙(FE 검증 의사코드)" `/^\d{6}$/.test(value)` 그대로다.
 * **달력 유효성(존재하지 않는 월·일)은 검사하지 않는다** — 같은 문서
 * "생년월일은 인증 자격이 아니라 복호화의 나머지 키이며, 발송처가 키
 * 원문에 쓴 값과 판정 기준이 갈리면 안 된다"(FN-005 구현 가이드 근거).
 */
export function isBirthDateFormatValid(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/**
 * 형식 위반 상태에서 확인 버튼을 눌렀을 때의 화면 게이팅 — 서버를 부르지
 * 않는 순수 클라이언트 전이다. screen_SCR-001.md §입력 폼 정의 "확인
 * 버튼은 입력이 비어 있어도 활성이다... 제출 시 형식 안내를 보여 주는
 * 쪽을 택했다"와 §조건부 표시 "InlineAlert(형식 안내) | 화면 검증 실패
 * 또는 직전 응답이 EX-AUTH-001"의 **"화면 검증 실패"** 갈래를 구현한다.
 * 문구는 `defaultMessageFor('EX-AUTH-001')` 하나로 단일화한다(회귀
 * 1회차 S-1) — 화면 검증이 잡아낸 위반과 서버가 돌려준 EX-AUTH-001 은
 * 같은 실패이므로, 문구 출처가 리터럴과 카탈로그 둘로 갈리면 나중에
 * 한쪽만 고쳐 어긋날 위험이 있다(screen_SCR-001.md §입력 폼 정의
 * "화면이 문구를 새로 만들면 같은 실패가 자리마다 달리 읽힌다").
 */
export function identityFormatInvalidView(): ScreenView {
  return { screen: 'SCR-001', status: 'idle', alert: { kind: 'format', message: defaultMessageFor('EX-AUTH-001') } };
}
