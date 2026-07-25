import { computeConsentVersion } from './consent-version';
import { ConsentConfig, ConsentItemConfig, InterlockConfig, LoadInterlockConfigResult, MissingConstantKey } from './interlock-config.types';
import {
  isNonEmptyString,
  isPathFormat,
  isUrlFormat,
  isValidConsentNotice,
  parseConsentItems,
  parsePositiveInteger,
  sortConsentItemsByCode,
} from './interlock-config.validators';

/**
 * PROC-901 B2~B4 — 기동 시 상수 로드·형식 검증·버전 식별자 산출을 한 번에 수행하는 순수 함수다.
 * 데이터베이스·구성 API 를 참조하지 않는다(DATA-001-05) — 전달된 env 값만 읽는다.
 * 모든 미충족 항목을 모아 한 번에 반환한다(OPS-001-02 구현 가이드 — 하나씩 실패시키지 않는다).
 * NestJS 부트스트랩 이전에 호출되므로(main.ts), 검증 실패가 프레임워크 내부로 숨지 않는다.
 */
export function loadInterlockConfig(env: NodeJS.ProcessEnv): LoadInterlockConfigResult {
  const missing: MissingConstantKey[] = [];

  const interlockEntryPath = env.INTERLOCK_ENTRY_PATH;
  if (!isNonEmptyString(interlockEntryPath) || !isPathFormat(interlockEntryPath)) {
    missing.push('INTERLOCK_ENTRY_PATH');
  }

  const selfcheckPath = env.SELFCHECK_PATH;
  if (!isNonEmptyString(selfcheckPath) || !isPathFormat(selfcheckPath)) {
    missing.push('SELFCHECK_PATH');
  }

  const receiverDeliveryUrl = env.RECEIVER_DELIVERY_URL;
  if (!isNonEmptyString(receiverDeliveryUrl) || !isUrlFormat(receiverDeliveryUrl)) {
    missing.push('RECEIVER_DELIVERY_URL');
  }

  const rawConsentItems = env.CONSENT_ITEMS;
  const parsedConsentItems: ConsentItemConfig[] | null = isNonEmptyString(rawConsentItems)
    ? parseConsentItems(rawConsentItems)
    : null;
  if (!parsedConsentItems) {
    missing.push('CONSENT_ITEMS');
  }

  // <CONSENT_NOTICE> 는 선택 상수다(기본값 빈 문자열) — 값이 있을 때만 허용 형태를 검사한다.
  const consentNotice = env.CONSENT_NOTICE ?? '';
  if (consentNotice.length > 0 && !isValidConsentNotice(consentNotice)) {
    missing.push('CONSENT_NOTICE');
  }

  const retentionMonths = parsePositiveInteger(env.RETENTION_MONTHS);
  if (retentionMonths === null) missing.push('RETENTION_MONTHS');

  const retentionMaxMonths = parsePositiveInteger(env.RETENTION_MAX_MONTHS);
  if (retentionMaxMonths === null) missing.push('RETENTION_MAX_MONTHS');

  const consentProofRetentionMonths = parsePositiveInteger(env.CONSENT_PROOF_RETENTION_MONTHS);
  if (consentProofRetentionMonths === null) missing.push('CONSENT_PROOF_RETENTION_MONTHS');

  const completionRedirectUrl = env.COMPLETION_REDIRECT_URL;
  if (!isNonEmptyString(completionRedirectUrl) || !isUrlFormat(completionRedirectUrl)) {
    missing.push('COMPLETION_REDIRECT_URL');
  }

  if (missing.length > 0) {
    return { missing };
  }

  // 이 지점부터는 위 아홉 상수가 전부 존재·형식을 충족한 상태다 — 아래 비-null 단언(!)은 그 사실에 근거한다.
  let version: string;
  try {
    version = computeConsentVersion(parsedConsentItems!, consentNotice);
  } catch {
    // B4 버전 식별자 산출 실패 → 기동 중단(OPS-001-02 → EX-OPS-001). 원인 상수를 지목한다.
    return { missing: ['CONSENT_ITEMS'] };
  }

  const config: InterlockConfig = {
    interlockEntryPath: interlockEntryPath!,
    selfcheckPath: selfcheckPath!,
    receiverDeliveryUrl: receiverDeliveryUrl!,
    consentNotice,
    retentionMonths: retentionMonths!,
    retentionMaxMonths: retentionMaxMonths!,
    consentProofRetentionMonths: consentProofRetentionMonths!,
    completionRedirectUrl: completionRedirectUrl!,
  };

  const consent: ConsentConfig = {
    version,
    notice: consentNotice,
    items: sortConsentItemsByCode(parsedConsentItems!),
  };

  return { missing: [], config, consent };
}
