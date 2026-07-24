/*
 * SCR-006 사용자 동의 결과 화면.
 * 정본: docs/specs/screens/screen_SCR-006.md · design-system.md(사용자 셸·Card(user)·ResultIcon(user)·
 *       Badge(user)·Banner(user)) · 서비스 근거 service_SVC-004.md·service_SVC-005.md.
 *
 * 흐름: SCR-005(ConsentPage) 가 승인/거부 제출 결과에 따라
 *   navigate('/interlock/result', { state: { result } }) 로 이동한다.
 *   본 화면은 그 네비게이션 상태(result)만 읽어 결과 유형을 렌더한다 —
 *   신규 서버 호출·PROC 트리거 없음(SCR-006 §개요·구현 가이드). 결과는 클라이언트 상태로만 표시.
 *
 * result 계약(SCR-005 발신부와 정합): 'completed' | 'rejected' | 'link-error'.
 *   `#215` 로 전달 실패(EX-BIZ-004)는 SCR-005 잔류 재시도로 이관되어 본 화면 결과 유형에서 제외됐다
 *   (SCR-006 §개요 2026-07-12 개정). 허용값 외/부재(새로고침·직접 URL 진입) → Fallback 안내.
 *
 * 무노출: 회원 키·연동 추적 키·처리 상태 4항목 값을 화면에 표시하지 않는다(SCR-006 §데이터 표시, DATA-001).
 *   결과 유형만 사용자 친화 문구로 안내하며, 상태를 색만이 아니라 텍스트(Badge·제목·문구)로 병기한다.
 *   내부 예외 코드(EX-SEC-007 등)도 사용자 문구에 노출하지 않는다.
 *
 * 시각 폴리시(`#408` — Phase 3/3): 사용자 표면 전용 컴포넌트(components/user/*)와 -u- 토큰(tokens.css
 *   Phase 1)으로 레이아웃·색·타이포·모션을 사양대로 구현한다. 결과 상태 아이콘 4종을 인라인 SVG 로
 *   신설(design-system.md §결과 상태 아이콘 — 기존 이모지 ✅·🚫·⛔·🔄 전량 교체, 특히 거부의 🚫 는
 *   오류·금지 기호라 사양이 명시적으로 금지)하고, 공통 Badge 대신 Badge(user) 를 쓴다(공통 Badge 는
 *   규격(radius-sm·24px·2색)이 달라 재사용 불가 — build 지침 §2-1). Banner(user) 는 Phase 2 가 만든
 *   UserBanner 를 그대로 재사용한다(danger 전용·role=alert 규격이 동일). 기능·플로우·트리거 PROC·API
 *   계약·민감값 노출 규칙은 이 개정에서 전혀 바뀌지 않는다 — 아래 result 판별 로직은 이전과 동일하다.
 */
import { useLocation } from 'react-router-dom';
import { Card } from '../components';
import { ResultIcon, UserBadge, UserBanner } from '../components/user';
import type { UserBadgeVariant } from '../components/user';
import styles from './ConsentResultPage.module.css';

/** SCR-005 제출 네비게이션 상태 계약(ConsentPage 발신부와 정합). */
type ConsentResultType = 'completed' | 'rejected' | 'link-error';

/** 허용 결과 값 집합(파싱 화이트리스트). */
const RESULT_VALUES: readonly ConsentResultType[] = ['completed', 'rejected', 'link-error'];

/** location.state 는 unknown 이므로 허용 3종만 통과시키는 타입 가드로 좁힌다. */
function isConsentResultType(value: unknown): value is ConsentResultType {
  return typeof value === 'string' && (RESULT_VALUES as readonly string[]).includes(value);
}

/** location.state 에서 result 값을 안전하게 획득한다. 허용값 외/부재 → null(Fallback). */
function readResult(state: unknown): ConsentResultType | null {
  if (typeof state !== 'object' || state === null) {
    return null;
  }
  const value = (state as { result?: unknown }).result;
  return isConsentResultType(value) ? value : null;
}

/**
 * 결과 유형별 표시 사양(SCR-006 §화면 상태 전이·§조건부 표시·§고정 문구 정본).
 * variant 는 ResultIcon(user)·Badge(user) 공용 — 두 컴포넌트가 항상 같은 3종 색 토큰 쌍을 쓴다
 * (design-system.md §결과 상태 아이콘: 완료=success·거부=info(중립)·링크오류=danger·Fallback=neutral).
 */
interface ResultContent {
  variant: UserBadgeVariant;
  badgeLabel: string;
  title: string;
  message: string;
  /** 링크 오류 전용 — Banner(user)(danger·role=alert)로 노출할 실행 안내(발송처 문의). */
  banner?: string;
  /** 안내 마무리 문구(§조건부 표시 — 연동완료·거부·링크오류만, Fallback 은 미렌더). */
  foot?: string;
}

/**
 * 결과 유형별 문구 — §고정 문구 정본 원문 그대로(띄어쓰기·마침표까지 복제). 회원 키·연동 추적 키·
 * 처리 상태 값·내부 예외 코드는 담지 않는다(무노출).
 */
const RESULT_CONTENT: Record<ConsentResultType, ResultContent> = {
  completed: {
    variant: 'success',
    badgeLabel: '연동 완료',
    title: '연동이 완료되었습니다.',
    message:
      '동의해 주셔서 감사합니다. 수신처로 요청이 정상 전달되었습니다. 이 창을 닫고 발송처 화면으로 돌아가셔도 됩니다.',
    foot: '처리 결과 안내 화면입니다. 회원 정보·연동 추적 키·처리 상태 값은 표시되지 않습니다.',
  },
  rejected: {
    variant: 'info',
    badgeLabel: '거부',
    title: '연동이 취소되었습니다.',
    message:
      '동의하지 않아 연동을 진행하지 않고 종료했습니다. 수신처로 전달된 정보는 없습니다. 이 창을 닫으셔도 됩니다.',
    foot: '거부는 정상 종료로 처리됩니다.',
  },
  'link-error': {
    variant: 'danger',
    badgeLabel: '링크 오류',
    title: '연동 링크가 올바르지 않습니다.',
    message:
      '암호화 파라미터 형식 오류 또는 연동에 필요한 값이 없어 처리를 진행할 수 없습니다. 재입력으로는 해결되지 않습니다.',
    banner: '발송처에 문의해 주세요.',
    foot: '발송처 링크·데이터 구성 문제로 직접 정정할 수 없습니다.',
  },
};

/**
 * Fallback(결과 상태 없음 — 새로고침·직접 URL 진입) 안내. 강제 이동 없음(SCR-006 §Fallback, 재진입
 * CTA 버튼·링크 미렌더 — 유효한 accessAddressId 가 없어 이동 대상을 제시할 수 없다).
 * [확인 필요] 결과 설명 문구를 정의서 §고정 문구 정본(단문)대로 적용했다 — 기 구축 FE 는 장문
 * ("동의 처리 결과 정보가 없습니다. 새로고침했거나 URL로 직접 접근한 경우일 수 있습니다. 발송처에서
 * 전달받은 링크로 다시 진입해 주세요.")이었다. 담당자 미확정 상태라 `#408` 은 정의서 원문을 그대로
 * 따랐다(screen_SCR-006.md §고정 문구 정본 각주). 안내 마무리 문구(foot)는 Fallback 에서 미렌더.
 */
const FALLBACK_CONTENT: ResultContent = {
  variant: 'neutral',
  badgeLabel: '안내',
  title: '표시할 결과가 없습니다.',
  message: '발송처에서 다시 진입해 주세요.',
};

export function ConsentResultPage() {
  const location = useLocation();
  // 결과는 SCR-005 제출 응답의 네비게이션 상태로만 전달된다(추가 서버 호출 없음).
  const result = readResult(location.state);
  const content = result ? RESULT_CONTENT[result] : FALLBACK_CONTENT;

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <ResultIcon variant={content.variant} />
        <UserBadge variant={content.variant}>{content.badgeLabel}</UserBadge>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.message}>{content.message}</p>
        {content.banner && <UserBanner className={styles.banner}>{content.banner}</UserBanner>}
        {content.foot && <p className={styles.foot}>{content.foot}</p>}
      </Card>
    </div>
  );
}

export default ConsentResultPage;
