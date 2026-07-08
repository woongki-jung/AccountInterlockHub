/*
 * SCR-002 연동 구성 목록 화면 — PROC-102(조회·목록) / PROC-105(활성 전환) / PROC-106(삭제) / SVC-002 / ADM-02.
 * 정본: docs/specs/screens/screen_SCR-002.md · design-system.md · process_PROC-102/105/106.md.
 *
 * 구성:
 *  - AdminShell(헤더·로그아웃) + 1120px 컨테이너. 제목 + "연동 구성 등록" + 활성 필터·검색 + 목록 Table.
 *  - 상태: Initial/Loading(Skeleton 3행) · Loaded(Table) · Empty(EmptyState) · Error(Banner+재시도) · 세션 만료(중앙 리다이렉트).
 *  - 행 액션: 활성 Toggle(PATCH)·삭제(확인 Modal→DELETE)·구성명 클릭(상세 이동)·등록 버튼(신규 폼 이동).
 *
 * 구현 결정(SCR-002 §구현 가이드 — 택1):
 *  - 활성 전환은 "응답 확정 후 반영"(confirm-after-response)을 채택한다. 낙관적 업데이트·롤백 대신
 *    전환 중 해당 행 Toggle 을 비활성(disabled)하고, 서버가 확정한 isActive 로 행을 갱신한다(대상 없음이면 행 제거).
 *    사유: 롤백 상태 관리 없이 서버 확정값을 단일 진실로 두어 리뷰·회귀 안전성을 높인다.
 *  - 검색어는 300ms 디바운스 후 재조회한다(활성 필터는 즉시). 길이 100 초과는 재조회 없이 인라인 에러만 표기.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdminShell,
  Badge,
  Banner,
  Button,
  EmptyState,
  Modal,
  Select,
  Skeleton,
  Table,
  TextField,
  Toggle,
  useToast,
} from '../components';
import type { TableColumn } from '../components';
import { ApiError } from '../lib/apiClient';
import { deleteConfig, listConfigs, setConfigActive } from '../lib/configApi';
import type { ActiveFilter, ConfigListItem } from '../lib/configApi';
import { formatDateTime } from '../lib/format';
import styles from './ConfigsPage.module.css';

/** 목록 로드 상태. */
type LoadStatus = 'loading' | 'ready' | 'error';

const CONFIG_NEW_PATH = '/admin/configs/new';
const KEYWORD_MAX = 100;
const SEARCH_DEBOUNCE_MS = 300;

/** 활성 필터 select 옵션(SCR-002 §입력 폼 정의: ALL·ACTIVE·INACTIVE). */
const ACTIVE_FILTER_OPTIONS: Array<{ value: ActiveFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '활성만' },
  { value: 'INACTIVE', label: '비활성만' },
];

/** 삭제 확인 대상(행 식별·표시명). */
interface DeleteTarget {
  id: string;
  configName: string;
}

export function ConfigsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // 조회 조건(검색어는 디바운스 후 appliedKeyword 로 반영).
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('ALL');

  // 목록·로드 상태.
  const [rows, setRows] = useState<ConfigListItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // 액션 상태.
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const keywordError = keyword.length > KEYWORD_MAX ? '검색어가 너무 깁니다.' : null;

  // ── 검색어 디바운스(유효 길이일 때만 반영) ──
  useEffect(() => {
    if (keyword.length > KEYWORD_MAX) {
      return; // 초과 검색어는 재조회에 반영하지 않는다(인라인 에러만 노출).
    }
    const timer = window.setTimeout(() => setAppliedKeyword(keyword.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // ── 목록 조회(PROC-102 F1·F2) ── deps 는 모두 원시값이라 안정적이다(무한 재요청 없음).
  useEffect(() => {
    let ignore = false;
    setStatus('loading');
    setErrorMessage(null);
    listConfigs({ keyword: appliedKeyword, active: activeFilter })
      .then((list) => {
        if (ignore) {
          return;
        }
        setRows(list);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (ignore) {
          return;
        }
        // 세션 만료(EX-AUTH-002)는 apiClient 중앙 훅이 로그인으로 리다이렉트한다(여기선 에러 표기만).
        setErrorMessage(err instanceof ApiError ? err.message : '목록을 불러오지 못했습니다.');
        setStatus('error');
      });
    return () => {
      ignore = true;
    };
  }, [appliedKeyword, activeFilter, reloadNonce]);

  // ── 활성 전환(PROC-105, 응답 확정 후 반영) ──
  function handleToggleActive(row: ConfigListItem) {
    setTogglingId(row.id);
    setConfigActive(row.id, !row.isActive)
      .then((result) => {
        if (!result) {
          // 대상 없음/이미 삭제 — 목록에서 제거하고 안내(오류 아님).
          setRows((prev) => prev.filter((r) => r.id !== row.id));
          showToast('대상 구성을 찾을 수 없어 목록에서 제거했습니다.', 'info');
          return;
        }
        setRows((prev) =>
          prev.map((r) => (r.id === result.id ? { ...r, isActive: result.isActive } : r)),
        );
        showToast(result.isActive ? '활성으로 변경했습니다.' : '비활성으로 변경했습니다.');
      })
      .catch(() => {
        // 세션 만료는 중앙 훅 처리. 그 외 실패는 상태 미변경 + 실패 Toast.
        showToast('상태 변경에 실패했습니다.', 'error');
      })
      .finally(() => setTogglingId(null));
  }

  // ── 삭제(PROC-106, 확인 Modal 확정) ──
  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    const targetId = deleteTarget.id;
    setDeleting(true);
    deleteConfig(targetId)
      .then(() => {
        // result null(이미 삭제됨)도 목록에서 제거해 정합을 맞춘다.
        setRows((prev) => prev.filter((r) => r.id !== targetId));
        setDeleteTarget(null);
        showToast('삭제했습니다.');
      })
      .catch(() => {
        // 실패 시 Modal 을 유지해 재시도할 수 있게 한다.
        showToast('삭제에 실패했습니다.', 'error');
      })
      .finally(() => setDeleting(false));
  }

  // ── 목록 Table 컬럼 정의 ──
  const columns: Array<TableColumn<ConfigListItem>> = [
    {
      key: 'configCode',
      header: '구성 코드',
      hideOnMobile: true,
      nowrap: true,
      render: (row) => <span className={styles.mono}>{row.configCode}</span>,
    },
    {
      key: 'configName',
      header: '구성명',
      render: (row) => (
        <button
          type="button"
          className={styles.nameLink}
          onClick={() => navigate(`/admin/configs/${row.id}`)}
        >
          {row.configName}
        </button>
      ),
    },
    {
      key: 'isActive',
      header: '활성 여부',
      render: (row) => (
        <span className={styles.activityCell}>
          <Badge variant={row.isActive ? 'active' : 'inactive'} dot>
            {row.isActive ? '활성' : '비활성'}
          </Badge>
          <Toggle
            checked={row.isActive}
            onChange={() => handleToggleActive(row)}
            disabled={togglingId === row.id}
            ariaLabel={`${row.configName} 활성 여부 전환`}
            onLabel=""
            offLabel=""
          />
        </span>
      ),
    },
    {
      key: 'consentItemCount',
      header: '동의 항목 수',
      align: 'right',
      hideOnMobile: true,
      render: (row) => row.consentItemCount,
    },
    {
      key: 'createdAt',
      header: '생성 일시',
      hideOnMobile: true,
      nowrap: true,
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      header: '액션',
      render: (row) => (
        <span className={styles.rowActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget({ id: row.id, configName: row.configName })}
          >
            삭제
          </Button>
        </span>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className={styles.pagehead}>
        <h1 className={styles.title}>연동 구성 목록</h1>
        <span className={styles.spacer} />
        <Button variant="primary" onClick={() => navigate(CONFIG_NEW_PATH)}>
          + 연동 구성 등록
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchCol}>
          <TextField
            label="검색어"
            value={keyword}
            placeholder="구성명 · 구성 코드 검색"
            error={keywordError}
            hint="구성명 또는 구성 코드로 검색합니다."
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div className={styles.filterCol}>
          <Select
            label="활성 필터"
            options={ACTIVE_FILTER_OPTIONS}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          />
        </div>
      </div>

      {status === 'loading' && <ListSkeleton />}

      {status === 'error' && (
        <div className={styles.errorBar}>
          <Banner variant="error">{errorMessage ?? '목록을 불러오지 못했습니다.'}</Banner>
          <div className={styles.errorActions}>
            <Button variant="secondary" onClick={() => setReloadNonce((n) => n + 1)}>
              재시도
            </Button>
          </div>
        </div>
      )}

      {status === 'ready' && rows.length === 0 && (
        <EmptyState
          icon="📭"
          title="등록된 연동 구성이 없습니다"
          description="첫 연동 구성을 등록해 서비스 A ↔ 서비스 B 연동을 시작하세요."
          action={
            <Button variant="primary" onClick={() => navigate(CONFIG_NEW_PATH)}>
              + 연동 구성 등록
            </Button>
          }
        />
      )}

      {status === 'ready' && rows.length > 0 && (
        <>
          <Table
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            ariaLabel="연동 구성 목록"
          />
          <p className={styles.listNote}>
            기본 정렬: 생성일 내림차순. 페이지네이션 규약은 build 확정(FN-015).
          </p>
        </>
      )}

      {/* 삭제 확인 Modal(PROC-106 — 되돌릴 수 없어 확인 강제) */}
      <Modal
        open={deleteTarget !== null}
        title="연동 구성 삭제"
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              삭제
            </Button>
          </>
        }
      >
        <strong>{deleteTarget?.configName}</strong> 구성을 삭제하시겠습니까? 이 작업은 되돌릴 수
        없으며 감사 로그에 기록됩니다(OPS-002).
      </Modal>
    </AdminShell>
  );
}

/** 초기 로딩 Skeleton — 목록 Table 골격(행 3개). Table 크롬을 재사용한다. */
function ListSkeleton() {
  const skeletonRows = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  const skeletonColumns: Array<TableColumn<{ id: string }>> = [
    { key: 'configCode', header: '구성 코드', hideOnMobile: true, render: () => <Skeleton width="110px" height="14px" /> },
    { key: 'configName', header: '구성명', render: () => <Skeleton width="160px" height="14px" /> },
    { key: 'isActive', header: '활성 여부', render: () => <Skeleton width="90px" height="14px" /> },
    { key: 'consentItemCount', header: '동의 항목 수', align: 'right', hideOnMobile: true, render: () => <Skeleton width="24px" height="14px" /> },
    { key: 'createdAt', header: '생성 일시', hideOnMobile: true, render: () => <Skeleton width="120px" height="14px" /> },
    { key: 'actions', header: '액션', render: () => <Skeleton width="48px" height="14px" /> },
  ];
  return (
    <div aria-busy="true">
      <Table columns={skeletonColumns} rows={skeletonRows} getRowKey={(row) => row.id} ariaLabel="목록 로딩 중" />
    </div>
  );
}

export default ConfigsPage;
