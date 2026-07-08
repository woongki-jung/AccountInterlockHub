/*
 * SCR-001 관리자 로그인 화면.
 * 정본: docs/specs/screens/screen_SCR-001.md · docs/specs/screens/design-system.md.
 * - FE 검증은 형식·비어있음만 확인하고 자격 판정은 서버(FN-002)에 위임한다(계정 존재 여부 비노출).
 * - 상태: Initial(빈 폼 + 조건부 만료 안내) / Loading(버튼 스피너·폼 disabled·aria-busy) /
 *   Error 인증실패(401 EX-AUTH-001 인라인) / Error 잠금(423 EX-AUTH-003 배너) / 성공(200 → SCR-002 이동).
 * - 비밀번호는 화면 표시 마스킹, 컴포넌트 상태 밖으로 저장·로그하지 않는다(AUTH-001-03).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Banner, Button, Card, TextField } from '../components';
import { ApiError } from '../lib/apiClient';
import { loginRequest } from '../lib/authApi';
import styles from './LoginPage.module.css';

/** 로그인 성공 후 이동할 화면(SCR-002 연동 구성 목록). */
const POST_LOGIN_PATH = '/admin/configs';

/** 세션 만료 리다이렉트(?expired=1) 진입 시 안내 문구. */
const SESSION_EXPIRED_MESSAGE = '세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.';

/** 401 EX-AUTH-001 인라인 에러 폴백(엔벨로프 메시지가 없을 때). */
const AUTH_FAIL_FALLBACK = '로그인이 필요합니다.';
/** 423 EX-AUTH-003 잠금 배너 폴백. */
const LOCKED_FALLBACK = '계정이 잠겼습니다. 잠시 후 다시 시도해 주세요.';
/** 기타 오류 배너 폴백. */
const GENERIC_ERROR_FALLBACK = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

/** 계정 ID 최대 길이(MDL-103.username · LoginDto MaxLength). */
const USERNAME_MAX_LENGTH = 64;

/** 제출 결과 오류의 표시 방식 구분(인증 실패=인라인 / 그 외=배너). */
type SubmitError =
  | { display: 'inline'; message: string }
  | { display: 'banner'; message: string };

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showExpiredNotice = searchParams.get('expired') === '1';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  // 서버 검증(400 EX-SEC-004) 필드 오류 — FE 선검증 후에도 방어적으로 매핑한다.
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  // FE 유효성(형식·비어있음만) — 계정 ID: 트림 후 비어있지 않고 64자 이하.
  const usernameValid = username.trim().length > 0 && username.length <= USERNAME_MAX_LENGTH;
  const passwordValid = password.length > 0;

  // 버튼 활성 조건(SCR-001 §조건부 표시): username.trim() !== '' && password !== ''.
  const canSubmit = username.trim() !== '' && password !== '' && !submitting;

  const usernameError =
    serverFieldErrors.username ??
    (usernameTouched && !usernameValid ? '계정 ID를 입력해주세요.' : null);
  const passwordError =
    serverFieldErrors.password ??
    (passwordTouched && !passwordValid ? '비밀번호를 입력해주세요.' : null);

  /** 입력 변경 시 이전 제출 오류를 정리해 낡은 안내가 남지 않게 한다. */
  function clearSubmitErrors() {
    if (submitError) setSubmitError(null);
    if (Object.keys(serverFieldErrors).length > 0) setServerFieldErrors({});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameTouched(true);
    setPasswordTouched(true);
    clearSubmitErrors();

    if (!usernameValid || !passwordValid) {
      return;
    }

    setSubmitting(true);
    // 자격 제출(PROC-103). 성공: SCR-002 이동 / 실패: 코드별 안내.
    loginRequest(username, password)
      .then(() => {
        navigate(POST_LOGIN_PATH, { replace: true });
      })
      .catch((error: unknown) => {
        handleLoginError(error);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  function handleLoginError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setSubmitError({ display: 'banner', message: GENERIC_ERROR_FALLBACK });
      return;
    }
    switch (error.code) {
      case 'EX-AUTH-001':
        // 인증 실패 — 계정 존재 여부를 구분 노출하지 않는다(동일 인라인 메시지).
        setSubmitError({ display: 'inline', message: error.message || AUTH_FAIL_FALLBACK });
        break;
      case 'EX-AUTH-003':
        // 계정 잠금 — 오류 배너.
        setSubmitError({ display: 'banner', message: error.message || LOCKED_FALLBACK });
        break;
      case 'EX-SEC-004': {
        // 서버 입력 검증 실패 — 필드 오류를 캡션에 매핑(없으면 배너).
        const fieldErrors = error.fieldErrors();
        if (Object.keys(fieldErrors).length > 0) {
          setServerFieldErrors(fieldErrors);
        } else {
          setSubmitError({ display: 'banner', message: error.message || GENERIC_ERROR_FALLBACK });
        }
        break;
      }
      default:
        // 403 EX-SEC-001(실배포는 서버 가드가 페이지 전에 차단) 및 5xx·기타 → 배너.
        setSubmitError({ display: 'banner', message: error.message || GENERIC_ERROR_FALLBACK });
    }
  }

  const bannerError = submitError?.display === 'banner' ? submitError : null;
  const inlineAuthError = submitError?.display === 'inline' ? submitError : null;

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.brand}>AccountInterlockHub</div>
        <h1 className={styles.title}>관리자 로그인</h1>

        {showExpiredNotice && (
          <div className={styles.banner}>
            <Banner variant="warning">{SESSION_EXPIRED_MESSAGE}</Banner>
          </div>
        )}

        {bannerError && (
          <div className={styles.banner}>
            <Banner variant="error">{bannerError.message}</Banner>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
          <fieldset className={styles.formGroup} disabled={submitting}>
            <div className={styles.field}>
              <TextField
                label="계정 ID"
                name="username"
                type="text"
                required
                autoComplete="username"
                maxLength={USERNAME_MAX_LENGTH}
                placeholder="계정 ID를 입력하세요"
                value={username}
                error={usernameError}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearSubmitErrors();
                }}
                onBlur={() => setUsernameTouched(true)}
              />
            </div>

            <div className={styles.field}>
              <TextField
                label="비밀번호"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                error={passwordError}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearSubmitErrors();
                }}
                onBlur={() => setPasswordTouched(true)}
              />
            </div>

            {inlineAuthError && (
              <span className={styles.authError} role="alert">
                {inlineAuthError.message}
              </span>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={submitting}
              disabled={!canSubmit}
              className={styles.submit}
            >
              로그인
            </Button>
          </fieldset>
        </form>

        <p className={styles.foot}>IP 허용 목록 통과 + 로그인 인증 이중 방어</p>
      </Card>
    </div>
  );
}

export default LoginPage;
