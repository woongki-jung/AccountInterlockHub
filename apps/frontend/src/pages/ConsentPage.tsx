/*
 * SCR-005 사용자 이용 동의 화면.
 * 정본: docs/specs/screens/screen_SCR-005.md · design-system.md(사용자 표면 확장·TextField(birthdate)) ·
 *       docs/specs/processes/{process_PROC-201.md, process_PROC-202.md, process_PROC-203.md} ·
 *       function_FN-008.md·function_FN-020.md.
 *
 * 흐름(`#214` 개정 — 발송처 링크 진입, 요청 키값 경로 폐기): mount 시 경로 :accessAddressId(발송처
 * 판별값)로 GET /api/consent/:accessAddressId 조회(PROC-201) → consentNotice(있으면)·본인확인(생년월일)·
 * 동의 항목 렌더 → 생년월일 형식 유효 + 필수 동의 전부 체크 시에만 승인 활성 → 승인(AGREE)/거부(REJECT)
 * 제출(PROC-202, 승인 시 내부 PROC-203 복호화·이력·전달) → 결과(SCR-006)로 네비게이션(state.result) 또는
 * 본 화면 유지(재입력·재시도) — §화면 상태 전이의 전 분기를 그대로 구현한다.
 *
 * 무노출: encX·encY(URL 쿼리)·생년월일을 화면에 렌더하지 않는다 — encX·encY 는 mount 시 1회만 읽어
 *   컴포넌트 상태(메모리)로 보유하고 URL 재기록·로컬 저장을 하지 않으며, 제출 시 요청 본문에만 싣는다
 *   (SCR-005 §데이터 표시·구현 가이드, DATA-001-04·SEC-005-06). 생년월일도 입력 필드 상태로만 두고
 *   로그·URL·제출 후 화면 어디에도 남기지 않는다.
 *
 * 시각 폴리시(`#408` — Phase 2/3): 사용자 표면 전용 컴포넌트(components/user/*)와 -u- 토큰(tokens.css
 * Phase 1)으로 레이아웃·색·타이포·모션을 사양대로 구현한다. 기능·플로우·유효성 규칙·트리거 PROC·API
 * 계약·민감값 노출 규칙은 이 개정에서 전혀 바뀌지 않는다 — 아래 상태·핸들러 로직은 이전과 동일하다.
 */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, Modal, Skeleton } from '../components';
import { BirthDateField, ConsentItemRow, UserBanner, UserButton } from '../components/user';
import { ApiError } from '../lib/apiClient';
import { getConsentView, submitApproval } from '../lib/consentApi';
import type { ConsentDecision, ConsentItem, ConsentView } from '../lib/consentApi';
import styles from './ConsentPage.module.css';

/** 결과 페이지(SCR-006) 네비게이션 상태 계약 — ConsentResultPage 의 수신부와 정합. */
type ConsentResultState = 'completed' | 'rejected' | 'link-error';

/** 조회(GET) 진행 상태. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; view: ConsentView }
  | { phase: 'error'; message: string };

/** 생년월일 캡션 에러 상태 — role=alert 여부는 코드별로 다르다(§고정 문구 정본, EX-SEC-006 만 alert). */
type BirthDateErrorState = { message: string; alert: boolean } | null;

/** 화면 문구(SCR-005 §화면 상태 전이·입력 폼 정의·고정 문구 정본 — 표기 그대로). */
const MESSAGE_INVALID = '요청이 올바르지 않습니다.';
const MESSAGE_RATE_LIMIT = '잠시 후 다시 시도해 주세요.';
const MESSAGE_DELIVERY_FAILED = '동의 처리에 실패했습니다. 다시 시도해주세요.';
const MESSAGE_GENERIC = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const BIRTHDATE_FORMAT_ERROR = '생년월일 6자리(YYMMDD)를 정확히 입력해 주세요.';
const BIRTHDATE_DECRYPT_ERROR = '사용자 정보가 일치하지 않습니다.';
// 안내 캡션(§레이아웃 구성·목업 SCR-005 — 마침표 없이 원문 그대로. 개정 전 코드는 마침표가 있었다).
const BIRTHDATE_HINT = '연동 값 복원을 위한 본인확인입니다';
const REQUIRED_CONSENT_ERROR = '필수 동의 항목에 동의해 주세요.';

/** GET 조회 실패 → 카드 배너 문구(EX-OPS-001·EX-SEC-004/005 우선, 그 외 엔벨로프 메시지). */
function toLoadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return MESSAGE_GENERIC;
  }
  if (error.code === 'EX-OPS-001') {
    return MESSAGE_RATE_LIMIT;
  }
  if (error.code === 'EX-SEC-004' || error.code === 'EX-SEC-005') {
    return MESSAGE_INVALID;
  }
  return error.message || MESSAGE_GENERIC;
}

/** 생년월일 FE 형식 검증(AUTH-004-01 의사코드) — 값의 정오(본인 일치 여부)는 서버 복호화로만 귀결한다. */
function isBirthDateFormatValid(value: string): boolean {
  if (!/^\d{6}$/.test(value)) {
    return false;
  }
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function ConsentPage() {
  const navigate = useNavigate();
  // accessAddressId 는 경로 파라미터(발송처 판별값) — 화면에 표시하지 않고 조회·제출에만 사용한다.
  const { accessAddressId = '' } = useParams<{ accessAddressId: string }>();
  const [searchParams] = useSearchParams();
  // encX·encY 는 URL 쿼리에서 mount 시 1회만 읽어 메모리(state)로 고정한다 — 화면 미렌더,
  // URL 재기록·localStorage 저장 없음(SCR-005 §데이터 표시·구현 가이드).
  const [accessContext] = useState(() => ({
    encX: searchParams.get('encX') ?? '',
    encY: searchParams.get('encY') ?? '',
  }));

  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
  // 동의 항목 체크 상태(order 기준). 서버 재검증 전 FE 1차 방어(BIZ-002-06).
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  // 약관 상세 모달 대상(해당 항목 order). null 이면 닫힘.
  const [detailOrder, setDetailOrder] = useState<number | null>(null);
  // 생년월일 입력값(메모리 전용) — 제출 본문에만 실어 보내고 화면에 에코하지 않는다.
  const [birthDate, setBirthDate] = useState('');
  // 생년월일 인라인 에러 — FE 형식 위반과 서버 복호화 실패(EX-SEC-006)가 같은 캡션 영역을 공유한다
  // (문구만 교체, SCR-005 §구현 가이드). alert 플래그는 §고정 문구 정본상 EX-SEC-006 에만 해당한다.
  const [birthDateError, setBirthDateError] = useState<BirthDateErrorState>(null);
  // 생년월일 입력 DOM — 복호화 실패(EX-SEC-006) 시 포커스 이동 + 값 전체 선택(AUTH-004-02)에 사용.
  const birthDateInputRef = useRef<HTMLInputElement>(null);
  // 제출 진행 중인 결정(AGREE/REJECT). null 이면 제출 중 아님.
  const [pending, setPending] = useState<ConsentDecision | null>(null);
  // 제출 실패 배너 문구(EX-SEC-004/005·EX-OPS-001·EX-BIZ-004 — 본 화면 유지 + 재시도).
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // mount(또는 accessAddressId 변경) 시 동의 대상 설명 문구·동의 항목 조회. 언마운트·변경 시 응답 무시(경합 방지).
  useEffect(() => {
    let active = true;
    setLoad({ phase: 'loading' });
    getConsentView(accessAddressId)
      .then((view) => {
        if (active) {
          setLoad({ phase: 'loaded', view });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoad({ phase: 'error', message: toLoadErrorMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [accessAddressId]);

  // 복호화 실패(EX-SEC-006) 시 값 유지 + 포커스 이동 + 값 전체 선택(SCR-005 §구현 가이드 AUTH-004-02).
  // 필드가 재활성화(disabled 해제)된 뒤에 실행돼야 하므로 setState 호출부가 아니라 커밋 후 effect 에서
  // 수행한다 — DOM 포커스 이동은 React 문서가 명시하는 effect 의 정상 용례(외부 시스템 동기화)다.
  useEffect(() => {
    if (birthDateError?.alert) {
      birthDateInputRef.current?.focus();
      birthDateInputRef.current?.select();
    }
  }, [birthDateError]);

  // 필수 항목이 모두 체크됐는지(승인 게이팅의 절반, BIZ-002-06). 로드 전에는 항상 false(제출 불가).
  const requiredMet =
    load.phase === 'loaded'
      ? load.view.items.filter((i) => i.required).every((i) => checked[i.order])
      : false;
  const submitting = pending !== null;

  function setItemChecked(order: number, value: boolean) {
    setChecked((prev) => ({ ...prev, [order]: value }));
  }

  function handleBirthDateChange(raw: string) {
    // 숫자만 최대 6자리 — 재입력 시 서버 판정 오류도 즉시 해제한다(하드 잠금 없음, AUTH-004-02).
    setBirthDate(raw.replace(/[^0-9]/g, '').slice(0, 6));
    setBirthDateError(null);
  }

  function handleBirthDateBlur() {
    if (birthDate.length === 0) {
      setBirthDateError(null);
      return;
    }
    setBirthDateError(
      isBirthDateFormatValid(birthDate) ? null : { message: BIRTHDATE_FORMAT_ERROR, alert: false },
    );
  }

  /** 승인/거부 제출(PROC-202, 승인 시 내부 PROC-203) — SCR-005 §화면 상태 전이 전 분기를 처리한다. */
  function submit(decision: ConsentDecision) {
    if (pending) {
      return; // 버튼도 비활성화되지만 이중 제출을 방어적으로 재차 차단한다.
    }
    setPending(decision);
    setBannerMessage(null);
    if (decision === 'AGREE') {
      setBirthDateError(null); // 이전 시도의 서버 판정 오류(EX-SEC-006)를 새 시도 시작 시 초기화.
    }

    const request =
      decision === 'AGREE'
        ? submitApproval({
            decision: 'AGREE',
            accessAddressId,
            requiredConsentMet: requiredMet,
            encX: accessContext.encX,
            encY: accessContext.encY,
            birthDate,
          })
        : submitApproval({ decision: 'REJECT', accessAddressId, requiredConsentMet: false });

    request
      .then((result) => {
        const resultState: ConsentResultState =
          result.result === 'COMPLETED' ? 'completed' : 'rejected';
        navigate('/interlock/result', { state: { result: resultState } });
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError)) {
          setBannerMessage(MESSAGE_GENERIC);
          setPending(null);
          return;
        }
        switch (error.code) {
          case 'EX-SEC-006':
            // 복호화 실패(생년월일 불일치) — 본 화면 유지, 인라인 에러(role=alert), 재입력·재제출 허용.
            setBirthDateError({ message: BIRTHDATE_DECRYPT_ERROR, alert: true });
            setPending(null);
            return;
          case 'EX-SEC-007':
          case 'EX-BIZ-008':
            // 링크 오류(암호 파라미터 형식·추적 키 필드 누락) — 재입력 무의미, 결과 화면으로 종료 안내.
            navigate('/interlock/result', {
              state: { result: 'link-error' satisfies ConsentResultState },
            });
            return;
          case 'EX-BIZ-004':
            // 전달 실패 — 처리 상태·연동이력은 이미 저장됨. 본 화면 유지, 승인 재제출(재승인) 허용.
            setBannerMessage(MESSAGE_DELIVERY_FAILED);
            setPending(null);
            return;
          case 'EX-OPS-001':
            setBannerMessage(MESSAGE_RATE_LIMIT);
            setPending(null);
            return;
          case 'EX-SEC-004':
          case 'EX-SEC-005':
            setBannerMessage(MESSAGE_INVALID);
            setPending(null);
            return;
          default:
            setBannerMessage(error.message || MESSAGE_GENERIC);
            setPending(null);
        }
      });
  }

  return (
    <div className={styles.page}>
      <Card className={styles.card} aria-busy={load.phase === 'loading' || submitting || undefined}>
        {load.phase === 'loading' && <LoadingSkeleton />}

        {load.phase === 'error' && <UserBanner>{load.message}</UserBanner>}

        {load.phase === 'loaded' && (
          <LoadedView
            view={load.view}
            checked={checked}
            requiredMet={requiredMet}
            birthDate={birthDate}
            birthDateError={birthDateError}
            birthDateInputRef={birthDateInputRef}
            submitting={submitting}
            pending={pending}
            bannerMessage={bannerMessage}
            onBirthDateChange={handleBirthDateChange}
            onBirthDateBlur={handleBirthDateBlur}
            onToggle={setItemChecked}
            onOpenDetail={setDetailOrder}
            onCloseDetail={() => setDetailOrder(null)}
            onAgreeTerms={(order) => {
              setItemChecked(order, true);
              setDetailOrder(null);
            }}
            detailItem={
              detailOrder === null
                ? null
                : load.view.items.find((i) => i.order === detailOrder) ?? null
            }
            onSubmit={submit}
          />
        )}
      </Card>
    </div>
  );
}

/** 초기 로딩 골격(제목·안내·본인확인·항목·버튼 자리). 장식용이므로 상위 Card 의 aria-busy 로 로딩을 알린다. */
function LoadingSkeleton() {
  return (
    <div className={styles.skeletonWrap}>
      <Skeleton width="55%" height="24px" />
      <Skeleton width="90%" />
      <Skeleton width="35%" height="13px" className={styles.skeletonBlock} />
      <Skeleton width="160px" height="48px" />
      <Skeleton width="35%" height="13px" className={styles.skeletonBlock} />
      <Skeleton width="100%" height="58px" />
      <Skeleton width="100%" height="58px" />
      <Skeleton width="140px" height="48px" className={styles.skeletonBlock} />
    </div>
  );
}

interface LoadedViewProps {
  view: ConsentView;
  checked: Record<number, boolean>;
  requiredMet: boolean;
  birthDate: string;
  birthDateError: BirthDateErrorState;
  birthDateInputRef: RefObject<HTMLInputElement>;
  submitting: boolean;
  pending: ConsentDecision | null;
  bannerMessage: string | null;
  onBirthDateChange: (value: string) => void;
  onBirthDateBlur: () => void;
  onToggle: (order: number, value: boolean) => void;
  onOpenDetail: (order: number) => void;
  onCloseDetail: () => void;
  onAgreeTerms: (order: number) => void;
  detailItem: ConsentItem | null;
  onSubmit: (decision: ConsentDecision) => void;
}

/** 로드 완료 화면 — 제목(+동의 대상 설명 문구)·본인확인·동의 항목 목록·승인/거부 버튼·약관 상세 모달. */
function LoadedView({
  view,
  checked,
  requiredMet,
  birthDate,
  birthDateError,
  birthDateInputRef,
  submitting,
  pending,
  bannerMessage,
  onBirthDateChange,
  onBirthDateBlur,
  onToggle,
  onOpenDetail,
  onCloseDetail,
  onAgreeTerms,
  detailItem,
  onSubmit,
}: LoadedViewProps) {
  const birthDateValid = isBirthDateFormatValid(birthDate);
  const canApprove = birthDateValid && requiredMet && !submitting;

  return (
    <>
      {/* 상단 블록(제목·consentNotice·오류 Banner) — 본인확인 사이에 구분선 1(§섹션 구분선). */}
      <div className={styles.topBlock}>
        <h1 className={styles.title}>서비스 연동 동의</h1>

        {view.consentNotice && (
          <div className={`${styles.scrollFadeWrap} ${styles.noticeWrap}`}>
            <div className={styles.notice} tabIndex={0} role="group" aria-label="동의 대상 설명 문구">
              {view.consentNotice}
            </div>
          </div>
        )}

        {bannerMessage && <UserBanner>{bannerMessage}</UserBanner>}
      </div>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>본인확인</h2>
        <BirthDateField
          ref={birthDateInputRef}
          id="consent-birthdate"
          value={birthDate}
          onChange={onBirthDateChange}
          onBlur={onBirthDateBlur}
          error={birthDateError?.message ?? null}
          errorIsAlert={birthDateError?.alert ?? false}
          hint={BIRTHDATE_HINT}
          disabled={submitting}
        />
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>동의 항목</h2>
        <div className={`${styles.scrollFadeWrap} ${styles.itemListWrap}`}>
          <ul className={styles.itemList} tabIndex={0} role="group" aria-label="동의 항목 목록">
            {view.items.map((item) => (
              <ConsentItemRow
                key={item.order}
                item={item}
                checked={!!checked[item.order]}
                disabled={submitting}
                onToggle={onToggle}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </ul>
        </div>
        {!requiredMet && (
          <p id="consent-agree-hint" className={styles.consentHint}>
            {REQUIRED_CONSENT_ERROR}
          </p>
        )}
      </section>

      {/* 액션 — 동의 항목과의 사이에는 구분선을 두지 않는다(§레이아웃 구성, space-u-section 간격만). */}
      <div className={styles.actions}>
        <UserButton
          variant="primary"
          loading={pending === 'AGREE'}
          disabled={!canApprove}
          aria-describedby={!requiredMet ? 'consent-agree-hint' : undefined}
          onClick={() => onSubmit('AGREE')}
        >
          승인(동의)
        </UserButton>
        <UserButton
          variant="secondary"
          loading={pending === 'REJECT'}
          disabled={submitting}
          onClick={() => onSubmit('REJECT')}
        >
          거부
        </UserButton>
      </div>

      {detailItem && (
        <TermsModal
          item={detailItem}
          onClose={onCloseDetail}
          onAgree={() => onAgreeTerms(detailItem.order)}
        />
      )}
    </>
  );
}

interface TermsModalProps {
  item: ConsentItem;
  onClose: () => void;
  onAgree: () => void;
}

/**
 * 약관 상세 모달(Modal(user/terms)) — 제목=항목 라벨, 스크롤 본문=약관 컨텐츠, 하단 [동의](primary)·
 * [닫기](secondary), 좌→우 동의→닫기(§레이아웃 구성·목업 순서 — 개정 전 코드는 순서가 반대였다).
 * [동의]=해당 항목 체크(동의) 후 닫기, [닫기]=닫기만(체크 불변). 둘 다 서버 호출 없음(EXC-BIZ-08).
 * ESC·배경 클릭·포커스 트랩·스크롤 잠금은 공통 Modal 컴포넌트를 그대로 재사용하고(재구현 금지),
 * chrome="userTerms" 로 시각 규격만 사용자 표면용으로 입힌다(관리자 호출부 렌더는 불변).
 */
function TermsModal({ item, onClose, onAgree }: TermsModalProps) {
  return (
    <Modal
      open
      chrome="userTerms"
      scrollBody
      title={item.label}
      onClose={onClose}
      footer={
        <>
          {/* 모달 푸터는 카드 액션(승인/거부)과 달리 항상 내용 맞춤 — fitContent(리뷰 S-1). */}
          <UserButton variant="primary" fitContent onClick={onAgree}>
            동의
          </UserButton>
          <UserButton variant="secondary" fitContent onClick={onClose}>
            닫기
          </UserButton>
        </>
      }
    >
      {item.termsContent}
    </Modal>
  );
}

export default ConsentPage;
