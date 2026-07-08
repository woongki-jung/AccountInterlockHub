/*
 * SCR-003 연동 구성 등록·편집 폼 화면 — PROC-101(제출) / PROC-102(편집 프리필) / SVC-001 / ADM-01.
 * 정본: docs/specs/screens/screen_SCR-003.md · design-system.md · docs/specs/processes/process_PROC-101.md.
 *
 * 구성:
 *  - 섹션 순서(기본 정보 → 서비스 A 진입 → 전달 파라미터 → 동의 항목 → 서비스 B 전달) + 하단 저장/취소.
 *  - 전달 파라미터·동의 항목은 RepeatableRows 로 동적 입력. order 는 화면 순서(배열 인덱스)로 직렬화.
 *  - 사용자 키값 지정(BR-107): 파라미터 행 전체 단일 라디오 그룹, 정확히 1개 필수. 미선택 시 저장 비활성 + 경고.
 *  - 상태: 등록 Initial(빈 폼·각 1행) / 편집 Loading(Skeleton)·Loaded·Error / Submitting / Success(Toast+상세 이동)
 *          / Error(422 필드 매핑·409 코드 중복·400·413 Banner).
 *
 * ⚠️ 편집 프리필의 GET 상세(PROC-102)는 ADM-P6 착수 후 실동작한다 — 그 전에는 Error 상태로 안내한다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AdminShell,
  Banner,
  Button,
  Card,
  Checkbox,
  RepeatableRows,
  Select,
  Skeleton,
  TextField,
  Toggle,
  useToast,
} from '../components';
import { ApiError } from '../lib/apiClient';
import { createConfig, getConfigDetail, updateConfig } from '../lib/configApi';
import type { HttpMethod } from '../lib/configApi';
import { detectPiiParamNames } from '../lib/pii';
import {
  HTTP_METHOD_OPTIONS,
  LIMITS,
  buildPayload,
  createInitialFormState,
  formStateFromDetail,
  hasAnyError,
  newConsentRow,
  newParameterRow,
  validateForm,
} from '../lib/configForm';
import type { ConfigFormState, FormErrors } from '../lib/configForm';
import styles from './ConfigFormPage.module.css';

/** 편집 상세 로드 상태. */
type LoadState = 'loading' | 'loaded' | 'error' | 'notfound';

const CONFIGS_LIST_PATH = '/admin/configs';

export interface ConfigFormPageProps {
  mode: 'create' | 'edit';
}

export function ConfigFormPage({ mode }: ConfigFormPageProps) {
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string }>();
  const configId = routeParams.id;
  const { showToast } = useToast();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState<ConfigFormState>(() => createInitialFormState());
  const [loadState, setLoadState] = useState<LoadState>(isEdit ? 'loading' : 'loaded');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // 서버 응답(422/409) 매핑 오류(스칼라·목록 수준). 입력 변경 시 정리한다.
  const [serverErrors, setServerErrors] = useState<FormErrors | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // ── 편집 진입 프리필(PROC-102) ──
  useEffect(() => {
    if (!isEdit) {
      return;
    }
    if (!configId) {
      setLoadState('error');
      setLoadError('대상 구성 식별자가 없습니다.');
      return;
    }
    let ignore = false;
    setLoadState('loading');
    setLoadError(null);
    getConfigDetail(configId)
      .then((detail) => {
        if (ignore) {
          return;
        }
        if (!detail) {
          setLoadState('notfound'); // PROC-102: 대상 없음은 200 data:null
          return;
        }
        setForm(formStateFromDetail(detail));
        setLoadState('loaded');
      })
      .catch((err: unknown) => {
        if (ignore) {
          return;
        }
        // 세션 만료(EX-AUTH-002)는 apiClient 중앙 훅이 로그인으로 리다이렉트한다(여기선 에러 표기만).
        setLoadError(err instanceof ApiError ? err.message : '구성 정보를 불러오지 못했습니다.');
        setLoadState('error');
      });
    return () => {
      ignore = true;
    };
  }, [isEdit, configId, reloadNonce]);

  // ── 파생 값 ──
  const feErrors = useMemo(() => validateForm(form), [form]);
  const userKeyMissing = !form.parameters.some((p) => p.isUserKey);
  const piiHits = useMemo(() => detectPiiParamNames(form.parameters), [form.parameters]);
  const canSubmit = !submitting && !userKeyMissing;

  // ── 오류 정리·변경 핸들러 ──
  function clearServerFeedback() {
    if (serverErrors) setServerErrors(null);
    if (bannerError) setBannerError(null);
  }
  function patchForm(patch: Partial<ConfigFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    clearServerFeedback();
  }
  function markTouched(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function updateConsent(index: number, patch: Partial<ConfigFormState['consentItems'][number]>) {
    setForm((prev) => ({
      ...prev,
      consentItems: prev.consentItems.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
    clearServerFeedback();
  }
  function addConsent() {
    setForm((prev) => ({ ...prev, consentItems: [...prev.consentItems, newConsentRow()] }));
  }
  function removeConsent(index: number) {
    setForm((prev) => ({
      ...prev,
      consentItems: prev.consentItems.filter((_, i) => i !== index),
    }));
    clearServerFeedback();
  }

  function updateParam(index: number, patch: Partial<ConfigFormState['parameters'][number]>) {
    setForm((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
    clearServerFeedback();
  }
  function addParam() {
    setForm((prev) => ({ ...prev, parameters: [...prev.parameters, newParameterRow()] }));
  }
  function removeParam(index: number) {
    setForm((prev) => ({ ...prev, parameters: prev.parameters.filter((_, i) => i !== index) }));
    clearServerFeedback();
  }
  /** 사용자 키값 지정 — 선택 행만 isUserKey=true, 나머지 false(라디오 단일 선택, BR-107). */
  function selectUserKey(index: number) {
    setForm((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p, i) => ({ ...p, isUserKey: i === index })),
    }));
    clearServerFeedback();
  }

  // ── 제출(PROC-101 F1·F2) ──
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    clearServerFeedback();

    const errors = validateForm(form);
    if (hasAnyError(errors)) {
      return; // 인라인 에러로 안내(제출 차단)
    }

    setSubmitting(true);
    const payload = buildPayload(form);
    const request =
      isEdit && configId ? updateConfig(configId, payload) : createConfig(payload);
    request
      .then((saved) => {
        // 성공: Toast(앱 전역 — 상세 이동 후에도 유지) + SCR-004 상세 이동.
        showToast('저장되었습니다.');
        navigate(`/admin/configs/${saved.id}`);
      })
      .catch((err: unknown) => {
        handleSaveError(err);
        setSubmitting(false);
      });
  }

  function handleSaveError(err: unknown) {
    if (!(err instanceof ApiError)) {
      setBannerError('잠시 후 다시 시도해주세요.');
      return;
    }
    switch (err.code) {
      case 'EX-BIZ-001': {
        // 필드별 details → 인라인/목록 매핑. 인식 못한 필드는 Banner 로.
        const fieldMap = err.fieldErrors();
        const next: FormErrors = {};
        const leftover: string[] = [];
        for (const [field, message] of Object.entries(fieldMap)) {
          switch (field) {
            case 'configCode':
            case 'configName':
            case 'serviceAEntryUrl':
            case 'serviceBDeliveryUrl':
            case 'serviceBHttpMethod':
            case 'consentItems':
            case 'parameters':
              next[field] = message;
              break;
            default:
              leftover.push(message);
          }
        }
        setServerErrors(next);
        setSubmitAttempted(true);
        if (Object.keys(fieldMap).length === 0) {
          setBannerError(err.message);
        } else if (leftover.length > 0 && Object.keys(next).length === 0) {
          setBannerError(err.message);
        }
        break;
      }
      case 'EX-BIZ-002':
        setServerErrors({ configCode: '이미 존재하는 구성입니다.' });
        break;
      case 'EX-SEC-004':
        setBannerError('입력 형식이 올바르지 않습니다.');
        break;
      case 'EX-SEC-005':
        setBannerError('요청이 너무 큽니다.');
        break;
      // EX-AUTH-002 는 apiClient 중앙 훅이 로그인으로 리다이렉트한다(여기서 별도 처리 없음).
      default:
        setBannerError(err.message || '잠시 후 다시 시도해주세요.');
    }
  }

  function handleCancel() {
    if (window.confirm('입력 중인 내용이 사라질 수 있습니다. 목록으로 이동할까요?')) {
      navigate(CONFIGS_LIST_PATH);
    }
  }

  // ── 표시용 에러 선택기(서버 우선, 그 외 touched/제출 후 노출) ──
  function scalarError(field: keyof FormErrors): string | null {
    const server = serverErrors?.[field];
    if (typeof server === 'string') {
      return server;
    }
    const show = submitAttempted || touched[field as string];
    return show ? ((feErrors[field] as string | undefined) ?? null) : null;
  }
  const consentRowError = (i: number) =>
    submitAttempted ? feErrors.consentRows?.[i] : undefined;
  const paramRowError = (i: number) => (submitAttempted ? feErrors.paramRows?.[i] : undefined);
  const paramsCountError =
    (typeof serverErrors?.parameters === 'string' ? serverErrors.parameters : null) ??
    (submitAttempted ? (feErrors.parameters ?? null) : null);
  const userKeyMessage = userKeyMissing ? '사용자 키값 파라미터를 1개 지정해주세요.' : null;

  const title = isEdit ? '연동 구성 편집' : '연동 구성 등록';

  // ── 편집 로드 상태 분기 ──
  if (isEdit && loadState !== 'loaded') {
    return (
      <AdminShell>
        <nav className={styles.crumb}>
          <a href={CONFIGS_LIST_PATH}>연동 구성 목록</a> / {title}
        </nav>
        <h1 className={styles.title}>{title}</h1>
        {loadState === 'loading' && <ConfigFormSkeleton />}
        {loadState === 'notfound' && (
          <Card>
            <Banner variant="error">대상 구성을 찾을 수 없습니다.</Banner>
            <div className={styles.loadErrorActions}>
              <Button variant="secondary" onClick={() => navigate(CONFIGS_LIST_PATH)}>
                목록으로
              </Button>
            </div>
          </Card>
        )}
        {loadState === 'error' && (
          <Card>
            <Banner variant="error">{loadError ?? '구성 정보를 불러오지 못했습니다.'}</Banner>
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
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <nav className={styles.crumb}>
        <a href={CONFIGS_LIST_PATH}>연동 구성 목록</a> / {isEdit ? '편집' : '신규 등록'}
      </nav>
      <h1 className={styles.title}>{title}</h1>

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
        <fieldset className={styles.fieldset} disabled={submitting}>
          {bannerError && (
            <div className={styles.bannerSlot}>
              <Banner variant="error">{bannerError}</Banner>
            </div>
          )}

          {/* (1) 기본 정보 */}
          <Card>
            <SectionHeader title="기본 정보" desc="연동 구성을 식별하는 코드와 이름, 활성 여부를 설정합니다." />
            <div className={styles.grid2}>
              <TextField
                label="구성 코드"
                required
                value={form.configCode}
                readOnly={isEdit}
                maxLength={LIMITS.configCode}
                placeholder="예: CFG-PAYLINK-01"
                hint={isEdit ? '편집 시 고유성·참조 안정성을 위해 변경할 수 없습니다.' : '영문·숫자·하이픈. 최대 64자.'}
                error={scalarError('configCode')}
                onChange={(e) => patchForm({ configCode: e.target.value })}
                onBlur={() => markTouched('configCode')}
              />
              <div className={styles.field}>
                <span className={styles.staticLabel}>활성 여부</span>
                <Toggle
                  ariaLabel="활성 여부"
                  checked={form.isActive}
                  onChange={(next) => patchForm({ isActive: next })}
                />
              </div>
              <div className={styles.fieldFull}>
                <TextField
                  label="구성명"
                  required
                  value={form.configName}
                  maxLength={LIMITS.configName}
                  placeholder="예: 결제 연동 - 페이링크"
                  error={scalarError('configName')}
                  onChange={(e) => patchForm({ configName: e.target.value })}
                  onBlur={() => markTouched('configName')}
                />
              </div>
            </div>
          </Card>

          {/* (2) 서비스 A 진입 */}
          <Card>
            <SectionHeader title="서비스 A 진입" desc="사용자가 진입하는 서비스 A 호출(진입) 주소입니다." />
            <TextField
              label="서비스 A 호출 주소"
              type="url"
              required
              value={form.serviceAEntryUrl}
              maxLength={LIMITS.url}
              placeholder="https://service-a.example.com/interlock/entry"
              error={scalarError('serviceAEntryUrl')}
              onChange={(e) => patchForm({ serviceAEntryUrl: e.target.value })}
              onBlur={() => markTouched('serviceAEntryUrl')}
            />
          </Card>

          {/* (3) 전달 파라미터 정의 */}
          <Card>
            <SectionHeader
              title="전달 파라미터 정의"
              desc="서비스 A 원천 키에서 값을 취해 서비스 B로 전달할 파라미터를 정의합니다. 최소 1개."
            />
            {piiHits.length > 0 && (
              <div className={styles.bannerSlot}>
                <Banner variant="warning">
                  일부 파라미터명({piiHits.join(', ')})이 개인정보성 명칭 패턴에 해당할 수 있습니다. 안내이며
                  저장을 차단하지 않습니다(BIZ-001-05).
                </Banner>
              </div>
            )}
            {/* 사용자 키값 지정 요약 바(필수 · 정확히 1개) */}
            <div className={[styles.ukBar, userKeyMissing ? styles.ukBarError : ''].join(' ')}>
              <div className={styles.ukInfo}>
                <span>
                  사용자 키값 파라미터 <span className={styles.reqMark}>*</span>:{' '}
                  <b>{form.parameters.find((p) => p.isUserKey)?.name?.trim() || '미지정'}</b>
                </span>
                <span className={styles.ukNote}>
                  (필수 · 구성당 정확히 1개 · 지정 값이 연동이력·완료 확인/콜백의 사용자 키값 근거, BIZ-001-07)
                </span>
              </div>
              {userKeyMessage && (
                <span className={styles.ukReqError} role="alert">
                  ⚠ {userKeyMessage}
                </span>
              )}
            </div>
            <RepeatableRows
              items={form.parameters}
              getKey={(p) => p.key}
              addLabel="+ 파라미터 행 추가"
              removeAriaLabel="파라미터 행 삭제"
              disabled={submitting}
              removeDisabled={() => form.parameters.length <= 1}
              rowHighlighted={(p) => p.isUserKey}
              onAdd={addParam}
              onRemove={removeParam}
              renderHeader={(p, i) => (
                <label className={styles.ukLine}>
                  <input
                    type="radio"
                    name="userKey"
                    checked={p.isUserKey}
                    onChange={() => selectUserKey(i)}
                    aria-label={`사용자 키값 파라미터로 지정: ${p.name.trim() || `파라미터 ${i + 1}`}`}
                  />
                  <span>사용자 키값</span>
                  {p.isUserKey && <span className={styles.ukBadge}>지정됨</span>}
                </label>
              )}
              renderRow={(p, i) => (
                <div className={styles.paramGrid}>
                  <TextField
                    label="파라미터명"
                    required
                    value={p.name}
                    maxLength={LIMITS.paramName}
                    placeholder="예: orderId"
                    error={paramRowError(i)?.name ?? null}
                    onChange={(e) => updateParam(i, { name: e.target.value })}
                  />
                  <TextField
                    label="서비스 A 원천 키명"
                    required
                    value={p.sourceKeyA}
                    maxLength={LIMITS.sourceKeyA}
                    placeholder="예: a_order_id"
                    error={paramRowError(i)?.sourceKeyA ?? null}
                    onChange={(e) => updateParam(i, { sourceKeyA: e.target.value })}
                  />
                  <div className={styles.checkCell}>
                    <Checkbox
                      label="서비스 B 전달"
                      checked={p.deliverToB}
                      onChange={(e) => updateParam(i, { deliverToB: e.target.checked })}
                    />
                  </div>
                </div>
              )}
            />
            {paramsCountError && (
              <span className={styles.listError} role="alert">
                {paramsCountError}
              </span>
            )}
          </Card>

          {/* (4) 사용자 동의 항목 */}
          <Card>
            <SectionHeader
              title="사용자 동의 항목"
              desc="사용자 동의 화면(SCR-005)에 노출할 동의 항목입니다. 최소 1개."
            />
            <RepeatableRows
              items={form.consentItems}
              getKey={(c) => c.key}
              addLabel="+ 동의 항목 행 추가"
              removeAriaLabel="동의 항목 행 삭제"
              disabled={submitting}
              removeDisabled={() => form.consentItems.length <= 1}
              onAdd={addConsent}
              onRemove={removeConsent}
              renderHeader={(_c, i) => <span>동의 항목 {i + 1}</span>}
              renderRow={(c, i) => (
                <div>
                  <div className={styles.consentGrid}>
                    <TextField
                      label="동의 항목 라벨"
                      required
                      value={c.label}
                      maxLength={LIMITS.consentLabel}
                      placeholder="예: 결제 정보 제공 동의"
                      error={consentRowError(i)?.label ?? null}
                      onChange={(e) => updateConsent(i, { label: e.target.value })}
                    />
                    <TextField
                      label="설명"
                      value={c.description}
                      maxLength={LIMITS.consentDescription}
                      placeholder="보조 설명(선택)"
                      error={consentRowError(i)?.description ?? null}
                      onChange={(e) => updateConsent(i, { description: e.target.value })}
                    />
                    <div className={styles.checkCell}>
                      <Checkbox
                        label="필수"
                        checked={c.required}
                        onChange={(e) => updateConsent(i, { required: e.target.checked })}
                      />
                    </div>
                  </div>
                  <div className={styles.termsField}>
                    <label className={styles.termsLabel} htmlFor={`terms-${c.key}`}>
                      약관 컨텐츠{' '}
                      <span className={styles.optMark}>
                        (선택 · 전체 약관 본문 — 입력 시 동의 화면에 [상세] 노출)
                      </span>
                    </label>
                    <textarea
                      id={`terms-${c.key}`}
                      className={styles.textarea}
                      value={c.termsContent}
                      placeholder="전체 약관 본문을 입력하세요(선택)."
                      onChange={(e) => updateConsent(i, { termsContent: e.target.value })}
                    />
                  </div>
                </div>
              )}
            />
            {(submitAttempted || typeof serverErrors?.consentItems === 'string') &&
              (serverErrors?.consentItems || feErrors.consentItems) && (
                <span className={styles.listError} role="alert">
                  {serverErrors?.consentItems ?? feErrors.consentItems}
                </span>
              )}
          </Card>

          {/* (5) 서비스 B 전달 */}
          <Card>
            <SectionHeader
              title="서비스 B 전달"
              desc="동의 완료 시 요청을 전달할 서비스 B 주소와 전달 방식입니다."
            />
            <div className={styles.grid2}>
              <div className={styles.fieldFull}>
                <TextField
                  label="서비스 B 전달 주소"
                  type="url"
                  required
                  value={form.serviceBDeliveryUrl}
                  maxLength={LIMITS.url}
                  placeholder="https://service-b.example.com/receive"
                  error={scalarError('serviceBDeliveryUrl')}
                  onChange={(e) => patchForm({ serviceBDeliveryUrl: e.target.value })}
                  onBlur={() => markTouched('serviceBDeliveryUrl')}
                />
              </div>
              <Select
                label="전달 방식"
                required
                options={HTTP_METHOD_OPTIONS}
                value={form.serviceBHttpMethod}
                error={scalarError('serviceBHttpMethod')}
                onChange={(e) =>
                  patchForm({ serviceBHttpMethod: e.target.value as HttpMethod })
                }
              />
            </div>
          </Card>

          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              취소
            </Button>
            <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
              저장
            </Button>
          </div>
        </fieldset>
      </form>
    </AdminShell>
  );
}

/** 섹션 헤더(제목 + 설명). */
function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDesc}>{desc}</p>
    </div>
  );
}

/** 편집 로드 중 Skeleton(폼 골격). */
function ConfigFormSkeleton() {
  return (
    <div aria-busy="true">
      <Card>
        <Skeleton width="120px" height="14px" />
        <div className={styles.skGap} />
        <Skeleton height="40px" />
        <div className={styles.skGap} />
        <Skeleton width="120px" height="14px" />
        <div className={styles.skGap} />
        <Skeleton height="40px" />
      </Card>
      <Card>
        <Skeleton width="160px" height="14px" />
        <div className={styles.skGap} />
        <Skeleton height="40px" />
      </Card>
    </div>
  );
}

export default ConfigFormPage;
