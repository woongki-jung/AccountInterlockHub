/*
 * SCR-006 사용자 동의 결과 화면.
 * 정본: docs/specs/screens/screen_SCR-006.md · design-system.md(사용자 셸·Card·Badge·Banner) ·
 *       서비스 근거 service_SVC-004.md·service_SVC-005.md.
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
 */
import { useLocation } from 'react-router-dom';
import { Badge, Banner, Card } from '../components';
import type { BadgeVariant } from '../components';
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

/** 결과 유형별 표시 사양(아이콘은 장식용 aria-hidden — 의미는 Badge·제목·문구 텍스트로 전달). */
interface ResultContent {
  icon: string;
  badgeVariant: BadgeVariant;
  badgeLabel: string;
  title: string;
  message: string;
  /** 링크 오류 전용 — error Banner(role=alert)로 노출할 실행 안내(발송처 문의). */
  banner?: string;
  /** 마무리 보조 문구(선택). */
  foot?: string;
}

/**
 * 결과 유형별 문구(SCR-006 §화면 상태 전이·조건부 표시).
 * - 연동완료=success · 거부(취소)=info(중립) · 링크 오류=error Badge + Banner(발송처 문의, 재입력 불가).
 * - 회원 키·연동 추적 키·처리 상태 값·내부 예외 코드는 담지 않는다(무노출).
 */
const RESULT_CONTENT: Record<ConsentResultType, ResultContent> = {
  completed: {
    icon: '✅',
    badgeVariant: 'success',
    badgeLabel: '연동 완료',
    title: '연동이 완료되었습니다.',
    message:
      '동의해 주셔서 감사합니다. 수신처로 요청이 정상 전달되었습니다. 이 창을 닫고 발송처 화면으로 돌아가셔도 됩니다.',
    foot: '처리 결과 안내 화면입니다. 회원 정보·연동 추적 키·처리 상태 값은 표시되지 않습니다.',
  },
  rejected: {
    icon: '🚫',
    badgeVariant: 'info',
    badgeLabel: '거부',
    title: '연동이 취소되었습니다.',
    message:
      '동의하지 않아 연동을 진행하지 않고 종료했습니다. 수신처로 전달된 정보는 없습니다. 이 창을 닫으셔도 됩니다.',
    foot: '거부는 정상 종료로 처리됩니다.',
  },
  'link-error': {
    icon: '⛔',
    badgeVariant: 'danger',
    badgeLabel: '링크 오류',
    title: '연동 링크가 올바르지 않습니다.',
    message: '암호화 파라미터 형식 오류 또는 연동에 필요한 값이 없어 처리를 진행할 수 없습니다. 재입력으로는 해결되지 않습니다.',
    banner: '발송처에 문의해 주세요.',
    foot: '발송처 링크·데이터 구성 문제로 직접 정정할 수 없습니다.',
  },
};

/** Fallback(결과 상태 없음 — 새로고침·직접 URL 진입) 안내. 강제 이동 없음(SCR-006 §Fallback). */
const FALLBACK_CONTENT: ResultContent = {
  icon: '🔄',
  badgeVariant: 'neutral',
  badgeLabel: '안내',
  title: '표시할 결과가 없습니다.',
  message:
    '동의 처리 결과 정보가 없습니다. 새로고침했거나 URL로 직접 접근한 경우일 수 있습니다. 발송처에서 전달받은 링크로 다시 진입해 주세요.',
};

export function ConsentResultPage() {
  const location = useLocation();
  // 결과는 SCR-005 제출 응답의 네비게이션 상태로만 전달된다(추가 서버 호출 없음).
  const result = readResult(location.state);
  const content = result ? RESULT_CONTENT[result] : FALLBACK_CONTENT;

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          {content.icon}
        </div>
        <div className={styles.badgeRow}>
          <Badge variant={content.badgeVariant}>{content.badgeLabel}</Badge>
        </div>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.message}>{content.message}</p>
        {content.banner && (
          <div className={styles.banner}>
            {/* error Banner 는 role=alert 를 컴포넌트가 제공한다(§접근성). */}
            <Banner variant="error">{content.banner}</Banner>
          </div>
        )}
        {content.foot && <p className={styles.foot}>{content.foot}</p>}
      </Card>
    </div>
  );
}

export default ConsentResultPage;
