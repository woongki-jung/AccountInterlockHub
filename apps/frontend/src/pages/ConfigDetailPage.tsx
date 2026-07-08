/*
 * SCR-004 연동 구성 상세 화면 — PROC-102(상세 조회) / PROC-105(활성 전환) / PROC-106(삭제) / SVC-002 / ADM-02.
 * 정본: docs/specs/screens/screen_SCR-004.md · design-system.md · process_PROC-102/105/106.md.
 *
 * 구성:
 *  - AdminShell + 1120px. 제목(구성명) + 활성 Badge + 액션(목록·활성 Toggle·편집·삭제).
 *  - Card 묶음: 기본 정보 → 서비스 A 진입 → 서비스 B 전달 → 전달 파라미터(테이블) → 동의 항목(테이블).
 *  - 전달 파라미터: isUserKey 행에 '사용자 키값' Badge(읽기 전용) + 상단 요약("사용자 키값 파라미터: <name>").
 *    지정은 필수(정확히 1개)라 정상 구성은 항상 파라미터명을 표기하고, 미지정은 방어 표시("지정 없음")로만 남긴다(BIZ-004-05).
 *  - 동의 항목: termsContent 가 있는 행은 [약관 보기]로 전체 약관 본문을 콘텐츠 Modal 에서 열람(읽기 전용).
 *  - 상태: Initial/Loading(Skeleton) · Loaded · Empty(대상 없음) · Error(Banner+재시도) · 세션 만료(중앙 리다이렉트).
 *
 * 활성 전환은 SCR-002 와 동일하게 "응답 확정 후 반영"(confirm-after-response) — 서버 확정 isActive 로 Badge·Toggle 갱신.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AdminShell,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Modal,
  Skeleton,
  Table,
  Toggle,
  useToast,
} from '../components';
import type { TableColumn } from '../components';
import { ApiError } from '../lib/apiClient';
import { deleteConfig, getConfigDetail, setConfigActive } from '../lib/configApi';
import type { ConfigDetail, ConsentItemResponse, ParameterResponse } from '../lib/configApi';
import { formatDateTime } from '../lib/format';
import styles from './ConfigDetailPage.module.css';

/** 상세 로드 상태. */
type LoadState = 'loading' | 'loaded' | 'notfound' | 'error';

const CONFIGS_LIST_PATH = '/admin/configs';

/** 약관 열람 대상(라벨·본문). */
interface TermsView {
  label: string;
  content: string;
}

export function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<ConfigDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [togglingActive, setTogglingActive] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [termsView, setTermsView] = useState<TermsView | null>(null);

  // ── 상세 조회(PROC-102 F3) ── deps 는 원시값(id·nonce)이라 안정적이다.
  useEffect(() => {
    if (!id) {
      setLoadState('error');
      setLoadError('대상 구성 식별자가 없습니다.');
      return;
    }
    let ignore = false;
    setLoadState('loading');
    setLoadError(null);
    getConfigDetail(id)
      .then((data) => {
        if (ignore) {
          return;
        }
        if (!data) {
          setLoadState('notfound'); // 대상 없음은 200 data:null
          return;
        }
        setDetail(data);
        setLoadState('loaded');
      })
      .catch((err: unknown) => {
        if (ignore) {
          return;
        }
        // 세션 만료(EX-AUTH-002)는 apiClient 중앙 훅이 로그인으로 리다이렉트한다(여기선 에러 표기만).
        setLoadError(err instanceof ApiError ? err.message : '상세 정보를 불러오지 못했습니다.');
        setLoadState('error');
      });
    return () => {
      ignore = true;
    };
  }, [id, reloadNonce]);

  // ── 활성 전환(PROC-105, 응답 확정 후 반영) ──
  function handleToggleActive() {
    if (!detail) {
      return;
    }
    setTogglingActive(true);
    setConfigActive(detail.id, !detail.isActive)
      .then((result) => {
        if (!result) {
          setLoadState('notfound'); // 대상 없음/이미 삭제
          return;
        }
        setDetail((prev) => (prev ? { ...prev, isActive: result.isActive } : prev));
        showToast(result.isActive ? '활성으로 변경했습니다.' : '비활성으로 변경했습니다.');
      })
      .catch(() => {
        showToast('상태 변경에 실패했습니다.', 'error');
      })
      .finally(() => setTogglingActive(false));
  }

  // ── 삭제(PROC-106, 확인 Modal 확정 → 목록 복귀) ──
  function confirmDelete() {
    if (!detail) {
      return;
    }
    setDeleting(true);
    deleteConfig(detail.id)
      .then(() => {
        // result null(이미 삭제됨)도 정상 처리로 간주해 목록으로 복귀한다.
        showToast('삭제했습니다.');
        navigate(CONFIGS_LIST_PATH);
      })
      .catch(() => {
        // 실패 시 Modal 을 유지해 재시도할 수 있게 한다.
        showToast('삭제에 실패했습니다.', 'error');
        setDeleting(false);
      });
  }

  const userKeyName = detail?.parameters.find((p) => p.isUserKey)?.name?.trim() ?? null;

  // ── 전달 파라미터 테이블 컬럼 ──
  const parameterColumns: Array<TableColumn<ParameterResponse>> = [
    { key: 'order', header: '순서', align: 'right', nowrap: true, render: (_p, i) => i + 1 },
    {
      key: 'name',
      header: '파라미터명',
      nowrap: true,
      render: (p) => <span className={styles.mono}>{p.name}</span>,
    },
    {
      key: 'sourceKeyA',
      header: '서비스 A 원천 키명',
      nowrap: true,
      render: (p) => <span className={styles.mono}>{p.sourceKeyA}</span>,
    },
    {
      key: 'deliverToB',
      header: '서비스 B 전달',
      render: (p) =>
        p.deliverToB ? (
          <Badge variant="info">전달</Badge>
        ) : (
          <Badge variant="neutral">미전달</Badge>
        ),
    },
    {
      key: 'required',
      header: '필수',
      render: (p) =>
        p.required ? (
          <Badge variant="danger">필수</Badge>
        ) : (
          <Badge variant="neutral">선택</Badge>
        ),
    },
    {
      key: 'isUserKey',
      header: '사용자 키값',
      render: (p) =>
        p.isUserKey ? (
          <Badge variant="userKey" icon="🔑">
            사용자 키값
          </Badge>
        ) : (
          <span className={styles.dash}>—</span>
        ),
    },
  ];

  // ── 동의 항목 테이블 컬럼 ──
  const consentColumns: Array<TableColumn<ConsentItemResponse>> = [
    { key: 'order', header: '순서', align: 'right', nowrap: true, render: (_c, i) => i + 1 },
    { key: 'label', header: '라벨', render: (c) => c.label },
    {
      key: 'description',
      header: '설명',
      render: (c) => c.description || <span className={styles.dash}>—</span>,
    },
    {
      key: 'required',
      header: '필수',
      render: (c) =>
        c.required ? (
          <Badge variant="danger">필수</Badge>
        ) : (
          <Badge variant="neutral">선택</Badge>
        ),
    },
    {
      key: 'terms',
      header: '약관 컨텐츠',
      render: (c) =>
        c.termsContent ? (
          <span className={styles.termsCell}>
            <Badge variant="info">설정됨</Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setTermsView({ label: c.label, content: c.termsContent ?? '' })
              }
            >
              약관 보기
            </Button>
          </span>
        ) : (
          <Badge variant="neutral">없음</Badge>
        ),
    },
  ];

  return (
    <AdminShell>
      <nav className={styles.crumb}>
        <a href={CONFIGS_LIST_PATH}>연동 구성 목록</a> / 상세
      </nav>

      <div className={styles.dethead}>
        <h1 className={styles.title}>{loadState === 'loaded' && detail ? detail.configName : '연동 구성 상세'}</h1>
        {loadState === 'loaded' && detail && (
          <Badge variant={detail.isActive ? 'active' : 'inactive'} dot>
            {detail.isActive ? '활성' : '비활성'}
          </Badge>
        )}
        <span className={styles.spacer} />
        {loadState === 'loaded' && detail && (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate(CONFIGS_LIST_PATH)}>
              목록
            </Button>
            <span className={styles.toggleWrap}>
              <Toggle
                checked={detail.isActive}
                onChange={handleToggleActive}
                disabled={togglingActive}
                ariaLabel="활성 여부 전환"
              />
            </span>
            <Button variant="primary" onClick={() => navigate(`/admin/configs/${detail.id}/edit`)}>
              편집
            </Button>
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              삭제
            </Button>
          </div>
        )}
      </div>

      {loadState === 'loading' && <DetailSkeleton />}

      {loadState === 'notfound' && (
        <EmptyState
          icon="🔍"
          title="대상 구성을 찾을 수 없습니다"
          description="이미 삭제되었거나 존재하지 않는 연동 구성입니다."
          action={
            <Button variant="primary" onClick={() => navigate(CONFIGS_LIST_PATH)}>
              목록으로
            </Button>
          }
        />
      )}

      {loadState === 'error' && (
        <Card>
          <Banner variant="error">{loadError ?? '상세 정보를 불러오지 못했습니다.'}</Banner>
          <div className={styles.loadErrorActions}>
            <Button variant="secondary" onClick={() => setReloadNonce((n) => n + 1)}>
              다시 시도
            </Button>
            <Button variant="ghost" onClick={() => navigate(CONFIGS_LIST_PATH)}>
              목록으로
            </Button>
          </div>
        </Card>
      )}

      {loadState === 'loaded' && detail && (
        <>
          {/* (1) 기본 정보 */}
          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>기본 정보</h2>
            <dl className={styles.dl}>
              <dt>구성 코드</dt>
              <dd className={styles.mono}>{detail.configCode}</dd>
              <dt>구성명</dt>
              <dd>{detail.configName}</dd>
              <dt>활성 여부</dt>
              <dd>
                <Badge variant={detail.isActive ? 'active' : 'inactive'} dot>
                  {detail.isActive ? '활성' : '비활성'}
                </Badge>
              </dd>
              <dt>생성 일시</dt>
              <dd>{formatDateTime(detail.createdAt)}</dd>
            </dl>
          </Card>

          {/* (2) 서비스 A 진입 */}
          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>서비스 A 진입</h2>
            <dl className={styles.dl}>
              <dt>호출 주소</dt>
              <dd>
                <ExternalLink url={detail.serviceAEntryUrl} />
              </dd>
            </dl>
          </Card>

          {/* (3) 서비스 B 전달 */}
          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>서비스 B 전달</h2>
            <dl className={styles.dl}>
              <dt>전달 주소</dt>
              <dd>
                <ExternalLink url={detail.serviceBDeliveryUrl} />
              </dd>
              <dt>전달 방식</dt>
              <dd>{detail.serviceBHttpMethod}</dd>
            </dl>
          </Card>

          {/* (4) 전달 파라미터 */}
          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>전달 파라미터 ({detail.parameters.length})</h2>
            <div className={[styles.ukeySummary, userKeyName ? '' : styles.ukeySummaryWarn].join(' ')}>
              <span>🔑 사용자 키값 파라미터:</span>
              {userKeyName ? (
                <>
                  <b>{userKeyName}</b>
                  <span className={styles.ukHint}>
                    — 지정 값이 연동이력·완료 확인(API-02)·완료 콜백(API-03)의 사용자 키값 근거입니다(BIZ-004). 지정은
                    필수(정확히 1개).
                  </span>
                </>
              ) : (
                <>
                  <b>지정 없음</b>
                  <span className={styles.ukHint}>
                    — (방어) 지정은 필수라 정상 구성엔 미발생. 미지정 구성은 연동이력·완료 확인/콜백 대상이 아닙니다(BIZ-004-05).
                  </span>
                </>
              )}
            </div>
            <Table
              columns={parameterColumns}
              rows={detail.parameters}
              getRowKey={(p) => p.id}
              ariaLabel="전달 파라미터 목록"
            />
          </Card>

          {/* (5) 동의 항목 */}
          <Card className={styles.card}>
            <h2 className={styles.cardTitle}>동의 항목 ({detail.consentItems.length})</h2>
            <Table
              columns={consentColumns}
              rows={detail.consentItems}
              getRowKey={(c) => c.id}
              ariaLabel="동의 항목 목록"
            />
          </Card>
        </>
      )}

      {/* 삭제 확인 Modal(PROC-106) */}
      <Modal
        open={deleteOpen}
        title="연동 구성 삭제"
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
          }
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              취소
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              삭제
            </Button>
          </>
        }
      >
        <strong>{detail?.configName}</strong> 구성을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며 감사
        로그에 기록됩니다(OPS-002).
      </Modal>

      {/* 약관 컨텐츠 열람 Modal(콘텐츠 변형 — 읽기 전용) */}
      <Modal
        open={termsView !== null}
        title={`${termsView?.label ?? ''} — 약관 컨텐츠`}
        size="md"
        scrollBody
        onClose={() => setTermsView(null)}
        footer={
          <Button variant="secondary" onClick={() => setTermsView(null)}>
            닫기
          </Button>
        }
      >
        {termsView?.content}
      </Modal>
    </AdminShell>
  );
}

/** 외부 주소 링크(설정 데이터 — 마스킹 없음, EXC-SEC-05). 새 탭·noopener. */
function ExternalLink({ url }: { url: string }) {
  return (
    <a className={styles.extLink} href={url} target="_blank" rel="noreferrer noopener">
      {url}
    </a>
  );
}

/** 초기 로딩 Skeleton — 상세 Card 골격. */
function DetailSkeleton() {
  return (
    <div aria-busy="true">
      <Card className={styles.card}>
        <Skeleton width="120px" height="16px" />
        <div className={styles.skGap} />
        <Skeleton width="80%" height="14px" />
        <div className={styles.skGap} />
        <Skeleton width="60%" height="14px" />
        <div className={styles.skGap} />
        <Skeleton width="70%" height="14px" />
      </Card>
      <Card className={styles.card}>
        <Skeleton width="120px" height="16px" />
        <div className={styles.skGap} />
        <Skeleton width="90%" height="14px" />
      </Card>
      <Card className={styles.card}>
        <Skeleton width="140px" height="16px" />
        <div className={styles.skGap} />
        <Skeleton width="85%" height="14px" />
        <div className={styles.skGap} />
        <Skeleton width="85%" height="14px" />
      </Card>
    </div>
  );
}

export default ConfigDetailPage;
