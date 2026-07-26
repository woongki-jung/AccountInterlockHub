import { AppShell, ProgressPanel, ResultPanel } from '../components';
import { useInterlockFlow } from '../stage/useInterlockFlow';
import { ConsentScreen } from './ConsentScreen';
import { IdentityScreen } from './IdentityScreen';

/**
 * 복귀 이동 대기 시간(초) — 정본은 screen_SCR-004.md §복귀 이동 하나뿐이다.
 * ResultPanel 은 이 값을 스스로 정의하지 않고(같은 문서 "다른 절·다른
 * 도메인은 값이 아니라 이 이름으로 참조한다") 반드시 호출측이 넘겨야
 * 하므로, 이 화면 조립(P14 참조 구현)이 그 유일한 참조 지점이 된다.
 */
const RETURN_WAIT_SECONDS = 3;

/**
 * 단계 상태머신(useInterlockFlow) 을 공통 컴포넌트 11종에 얹은 참조
 * 조립이다. 사양·목업이 정한 정확한 레이아웃·카피·미세 인터랙션의
 * 최종 구현은 SCR-001·SCR-002 는 P15 가 완료했고(`#492`) SCR-003·SCR-004
 * 는 P16(`#493`) 소관이며, 이 파일은 "상태머신 + 접점 어댑터가 실제로
 * 화면 4개를 끝까지 이어 낸다"는 것을 증명하는 토대다(상위 맥락 "P15·
 * P16 이 화면만 얹으면 되게 하라").
 */
export function InterlockJourney() {
  const flow = useInterlockFlow();

  return (
    <AppShell>
      {flow.view.screen === 'SCR-001' && (
        <IdentityScreen
          view={flow.view}
          birthDate={flow.birthDate}
          onBirthDateChange={flow.setBirthDate}
          onVerify={() => void flow.verify()}
        />
      )}
      {flow.view.screen === 'SCR-002' && (
        <ConsentScreen
          view={flow.view}
          agreedCodes={flow.agreedCodes}
          onToggle={flow.toggleConsent}
          onApprove={() => void flow.approve()}
          onGated={flow.reportConsentValidationFailed}
        />
      )}
      {/* ProgressPanel(SCR-003) 에는 skipFocus 를 배선하지 않는다 — 진입
          응답이 산출할 수 있는 화면은 SCR-001·SCR-004 뿐이라
          (EntryInitialStateDto.stage 가 IDENTITY·RESULT 두 값뿐 —
          spec-functions-api-user.md §연동 요청 진입) SCR-003 은 진입으로
          그려질 수 없다. design-system.md §접근성 기준 "적용 대상은
          진입이 산출할 수 있는 화면 전부다"에 따라 이 규칙이 SCR-003 에는
          닿을 자리가 없어 배선하지 않아도 구현 갭이 아니다 — 배선해도
          항상 false 인 죽은 코드가 될 뿐이다(P16 `#493`, 교차검증 7회차
          E7-1). */}
      {flow.view.screen === 'SCR-003' && <ProgressPanel unconfirmed={flow.view.unconfirmed} />}
      {flow.view.screen === 'SCR-004' && (
        <ResultPanel
          resultPath={flow.view.result.resultPath}
          reasonCode={flow.view.result.reasonCode}
          isReAnnouncement={flow.view.result.isReAnnouncement}
          returnUrl={flow.view.result.returnUrl}
          returnWaitSeconds={RETURN_WAIT_SECONDS}
          skipFocus={flow.resultSkipFocus}
        />
      )}
    </AppShell>
  );
}
