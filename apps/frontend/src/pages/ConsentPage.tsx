/*
 * SCR-005 사용자 이용 동의 화면.
 * 정본: docs/specs/screens/screen_SCR-005.md · design-system.md(사용자 셸) ·
 *       docs/specs/processes/{process_PROC-201.md(F1·F2), process_PROC-202.md(F1·F2)} · function_FN-008.md.
 *
 * 흐름: mount 시 GET /api/consent/:requestKey 로 구성 소속 동의 항목만 조회(PROC-201 B1b) →
 *   Checkbox 목록 렌더(약관 컨텐츠가 있는 항목만 [상세]→약관 모달) → 필수 항목 전부 체크 시에만 동의 활성 →
 *   동의(AGREE)/거부(REJECT) 제출(PROC-202) → 결과 페이지(USR-P4)로 네비게이션(state.result).
 *
 * 무노출: 회원 키·요청 키값·configCode 를 화면에 표시하지 않는다(SCR-005 §무노출, DATA-001).
 *   requestKey 는 URL 경로 컨텍스트로만 사용하고 로컬 저장하지 않으며, configCode 는 제출용으로 메모리만 보유한다.
 * 결과 라우트(/consent/:requestKey/result)는 USR-P4 소관이라 본 Phase 에서 만들지 않는다 — 문자열 경로 이동만 한다.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banner, Button, Card, Modal, Skeleton } from '../components';
import { ApiError } from '../lib/apiClient';
import { getConsentView, submitConsent } from '../lib/consentApi';
import type { ConsentDecision, ConsentItem, ConsentView } from '../lib/consentApi';
import styles from './ConsentPage.module.css';

/** 결과 페이지 경로·네비게이션 상태 계약(USR-P4 SCR-006 와 정합). */
type ConsentResult = 'AGREED' | 'REJECTED' | 'DELIVERY_FAILED';

/** 조회(GET) 진행 상태. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; view: ConsentView }
  | { phase: 'error'; message: string };

/** 오류 코드 → 사용자 문구 매핑(조회·제출 공통, SCR-005 §화면 상태 전이). */
const MESSAGE_INVALID = '요청이 올바르지 않습니다.';
const MESSAGE_RATE_LIMIT = '잠시 후 다시 시도해주세요.';
const MESSAGE_GENERIC = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

/** ApiError 를 사용자 배너 문구로 변환한다(EX-DATA-002·EX-OPS-001 우선, 그 외 엔벨로프 메시지). */
function toUserMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return MESSAGE_GENERIC;
  }
  if (error.code === 'EX-DATA-002') {
    return MESSAGE_INVALID;
  }
  if (error.code === 'EX-OPS-001') {
    return MESSAGE_RATE_LIMIT;
  }
  return error.message || MESSAGE_GENERIC;
}

export function ConsentPage() {
  const navigate = useNavigate();
  // requestKey 는 경로 컨텍스트로만 사용한다(화면 미표시·무저장).
  const { requestKey = '' } = useParams<{ requestKey: string }>();

  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
  // 동의 항목 체크 상태(order 기준). 서버 재검증 전 FE 1차 방어(BIZ-002-02).
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  // 약관 상세 모달 대상(해당 항목 order). null 이면 닫힘.
  const [detailOrder, setDetailOrder] = useState<number | null>(null);
  // 제출 진행 중인 결정(AGREE/REJECT). null 이면 제출 중 아님.
  const [pending, setPending] = useState<ConsentDecision | null>(null);
  // 제출 실패 배너 문구(전달 실패는 배너가 아니라 결과 페이지로 이동).
  const [submitError, setSubmitError] = useState<string | null>(null);

  // mount(또는 requestKey 변경) 시 동의 항목 조회. 언마운트·키 변경 시 응답 무시(경합 방지).
  useEffect(() => {
    let active = true;
    setLoad({ phase: 'loading' });
    getConsentView(requestKey)
      .then((view) => {
        if (active) {
          setLoad({ phase: 'loaded', view });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoad({ phase: 'error', message: toUserMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [requestKey]);

  function setItemChecked(order: number, value: boolean) {
    setChecked((prev) => ({ ...prev, [order]: value }));
  }

  function submit(decision: ConsentDecision, configCode: string) {
    setPending(decision);
    setSubmitError(null);
    submitConsent(requestKey, decision, configCode)
      .then(() => {
        const result: ConsentResult = decision === 'AGREE' ? 'AGREED' : 'REJECTED';
        navigate(`/consent/${requestKey}/result`, { state: { result } });
      })
      .catch((error: unknown) => {
        // 전달 실패(502 EX-BIZ-004)는 상태가 저장되므로 결과 페이지로 이동(전달실패 유형).
        if (error instanceof ApiError && error.code === 'EX-BIZ-004') {
          navigate(`/consent/${requestKey}/result`, {
            state: { result: 'DELIVERY_FAILED' satisfies ConsentResult },
          });
          return;
        }
        // 그 외(만료·불일치·요청 제한·일반 오류)는 배너로 안내하고 재시도를 허용한다.
        setSubmitError(toUserMessage(error));
        setPending(null);
      });
  }

  const submitting = pending !== null;

  return (
    <div className={styles.page}>
      <Card className={styles.card} aria-busy={(load.phase === 'loading' || submitting) || undefined}>
        {load.phase === 'loading' && <LoadingSkeleton />}

        {load.phase === 'error' && (
          <>
            <h1 className={styles.title}>요청을 확인할 수 없습니다</h1>
            <Banner variant="error">{load.message}</Banner>
          </>
        )}

        {load.phase === 'loaded' && (
          <LoadedView
            view={load.view}
            checked={checked}
            submitting={submitting}
            pending={pending}
            submitError={submitError}
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

/** 초기 로딩 골격(제목·안내·항목·버튼 자리). 장식용이므로 상위 Card 의 aria-busy 로 로딩을 알린다. */
function LoadingSkeleton() {
  return (
    <div className={styles.skeletonWrap}>
      <Skeleton width="60%" height="22px" />
      <Skeleton width="90%" />
      <Skeleton width="80%" />
      <Skeleton width="100%" height="72px" className={styles.skeletonBlock} />
      <Skeleton width="100%" height="72px" />
      <Skeleton width="100%" height="40px" className={styles.skeletonBlock} />
      <Skeleton width="100%" height="40px" />
    </div>
  );
}

interface LoadedViewProps {
  view: ConsentView;
  checked: Record<number, boolean>;
  submitting: boolean;
  pending: ConsentDecision | null;
  submitError: string | null;
  onToggle: (order: number, value: boolean) => void;
  onOpenDetail: (order: number) => void;
  onCloseDetail: () => void;
  onAgreeTerms: (order: number) => void;
  detailItem: ConsentItem | null;
  onSubmit: (decision: ConsentDecision, configCode: string) => void;
}

/** 로드 완료 화면 — 안내·동의 항목 목록·동의/거부 버튼·약관 상세 모달. */
function LoadedView({
  view,
  checked,
  submitting,
  pending,
  submitError,
  onToggle,
  onOpenDetail,
  onCloseDetail,
  onAgreeTerms,
  detailItem,
  onSubmit,
}: LoadedViewProps) {
  // 필수 항목이 모두 체크됐는지(동의 버튼 활성 조건, BIZ-002-02). 필수 항목이 없으면 true.
  const requiredMet = view.items.filter((i) => i.required).every((i) => checked[i.order]);

  return (
    <>
      <h1 className={styles.title}>서비스 연동 동의</h1>
      <p className={styles.lead}>
        아래 항목을 확인하고 서비스 연동 진행 여부를 선택해 주세요. 동의 시 연동이 진행되며, 동의하지
        않으면 전달 없이 종료됩니다.
      </p>

      {submitError && (
        <div className={styles.banner}>
          <Banner variant="error">{submitError}</Banner>
        </div>
      )}

      <ul className={styles.itemList}>
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

      <div className={styles.actions}>
        <Button
          variant="primary"
          fullWidth
          loading={pending === 'AGREE'}
          disabled={!requiredMet || submitting}
          aria-describedby={!requiredMet ? 'consent-agree-hint' : undefined}
          onClick={() => onSubmit('AGREE', view.configCode)}
        >
          동의하고 계속
        </Button>
        <Button
          variant="secondary"
          fullWidth
          loading={pending === 'REJECT'}
          disabled={submitting}
          onClick={() => onSubmit('REJECT', view.configCode)}
        >
          동의하지 않고 종료
        </Button>
      </div>

      {!requiredMet && (
        <p id="consent-agree-hint" className={styles.hint}>
          필수 동의 항목에 모두 동의해야 계속할 수 있습니다.
        </p>
      )}

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

interface ConsentItemRowProps {
  item: ConsentItem;
  checked: boolean;
  disabled: boolean;
  onToggle: (order: number, value: boolean) => void;
  onOpenDetail: (order: number) => void;
}

/**
 * 동의 항목 1행 — 체크박스 + 라벨(필수/선택 텍스트 병기) + 설명 + (약관 있으면) [상세].
 * design-system Checkbox 는 문자열 라벨 단일 행 전용이라, 라벨·설명·[상세] 복합 구성을 위해
 * 토큰으로 스타일된 네이티브 체크박스를 label 연결(htmlFor)로 구성한다(라벨 클릭 영역 포함).
 */
function ConsentItemRow({ item, checked, disabled, onToggle, onOpenDetail }: ConsentItemRowProps) {
  const inputId = `consent-item-${item.order}`;
  const descId = `consent-item-desc-${item.order}`;
  return (
    <li className={styles.item}>
      <input
        id={inputId}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(item.order, e.target.checked)}
        aria-describedby={item.description ? descId : undefined}
      />
      <div className={styles.itemBody}>
        <div className={styles.itemHeader}>
          <label htmlFor={inputId} className={styles.itemLabel}>
            {item.label}
            {item.required ? (
              <span className={styles.required}>
                <span aria-hidden="true">*</span> (필수)
              </span>
            ) : (
              <span className={styles.optional}>(선택)</span>
            )}
          </label>
          {item.termsContent && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onOpenDetail(item.order)}
              className={styles.detailButton}
            >
              상세
            </Button>
          )}
        </div>
        {item.description && (
          <p id={descId} className={styles.itemDesc}>
            {item.description}
          </p>
        )}
      </div>
    </li>
  );
}

interface TermsModalProps {
  item: ConsentItem;
  onClose: () => void;
  onAgree: () => void;
}

/**
 * 약관 상세 모달(콘텐츠 변형) — 제목=항목 라벨, 스크롤 본문=약관 컨텐츠, 하단 [동의](primary)·[닫기](secondary).
 * [동의]=해당 항목 체크(동의) 후 닫기, [닫기]=닫기만(체크 불변). 둘 다 서버 호출 없음(EXC-BIZ-08).
 * ESC·배경 클릭·포커스 트랩은 Modal 컴포넌트가 제공하며 onClose([닫기]와 동일) 로 연결된다.
 */
function TermsModal({ item, onClose, onAgree }: TermsModalProps) {
  return (
    <Modal
      open
      size="md"
      scrollBody
      title={item.label}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button variant="primary" onClick={onAgree}>
            동의
          </Button>
        </>
      }
    >
      {item.termsContent}
    </Modal>
  );
}

export default ConsentPage;
