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
      {flow.view.screen === 'SCR-003' && <ProgressPanel unconfirmed={flow.view.unconfirmed} />}
      {flow.view.screen === 'SCR-004' && (
        <ResultPanel
          resultPath={flow.view.result.resultPath}
          reasonCode={flow.view.result.reasonCode}
          isReAnnouncement={flow.view.result.isReAnnouncement}
          returnUrl={flow.view.result.returnUrl}
          returnWaitSeconds={RETURN_WAIT_SECONDS}
        />
      )}
    </AppShell>
  );
}
