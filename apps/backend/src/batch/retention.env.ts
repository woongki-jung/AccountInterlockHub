import { Logger } from '@nestjs/common';

/**
 * 보관정책 배치(PROC-402 / FN-011)의 운영 구성 훅. 기본값은 사양 확정 값(90/180일 fallback·5,000행 청크·
 * 일 1회 03:00)이며 환경변수로만 재정의한다. 청크 크기·기준 시각·보관 기간 재정의는 청크 경계·중단 재실행·
 * 경계 검증(TC BAT-02) 목적의 정상 구성 훅으로, 운영 기본은 불변이다.
 *
 * `#214`(P10) — 단일 보관 기간(RETENTION_DAYS)을 fallback two-pass 의 두 기준으로 분리했다:
 * RETENTION_CONFIRMED_DAYS(결과 확인/콜백 수신 후 보관, 기본 90) · RETENTION_ABSOLUTE_DAYS(생성 후
 * 절대 상한, 기본 180). 두 값 중 먼저 도래하는 시점에 삭제한다(process_PROC-402.md B2·B3).
 */

// 청크 DELETE 1회 상한 행수(ENT-004·ENT-007 §구현 가이드 확정). 운영 기본 불변.
export const DEFAULT_CHUNK_SIZE = 5000;
// 결과 확인/콜백 수신 후 보관 기간(일). 처리상태·연동이력 공통(FN-011 confirmedRetentionDays 기본안 90).
export const DEFAULT_CONFIRMED_DAYS = 90;
// 생성 일시(created_at) 기산 절대 상한(일). 미확인·미수신 건 정리 + 확인/수신 갈래의 fallback 상한
// (FN-011 absoluteRetentionDays 기본안 180).
export const DEFAULT_ABSOLUTE_DAYS = 180;
// 스케줄 cron 표현식(일 1회 03:00). build 확정 값(PROC-402 §구현 가이드).
export const DEFAULT_CRON = '0 3 * * *';

const logger = new Logger('RetentionEnv');

/** 양의 정수 환경변수를 파싱한다. 미설정·부적합이면 기본값으로 폴백하고 경고를 남긴다. */
function parsePositiveInt(raw: string | undefined, fallback: number, key: string): number {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    logger.warn(`${key} 값이 유효한 양의 정수가 아니어서 기본값(${fallback})으로 대체합니다 — 입력=${raw}`);
    return fallback;
  }
  return parsed;
}

/** 청크 크기(RETENTION_CHUNK_SIZE, 기본 5,000). 청크 경계·중단 재실행 검증 시 작은 값 주입 목적. */
export function resolveChunkSize(): number {
  return parsePositiveInt(process.env.RETENTION_CHUNK_SIZE, DEFAULT_CHUNK_SIZE, 'RETENTION_CHUNK_SIZE');
}

/** 결과 확인/콜백 수신 후 보관 기간(RETENTION_CONFIRMED_DAYS, 기본 90일). */
export function resolveConfirmedDays(): number {
  return parsePositiveInt(
    process.env.RETENTION_CONFIRMED_DAYS,
    DEFAULT_CONFIRMED_DAYS,
    'RETENTION_CONFIRMED_DAYS',
  );
}

/** 생성 일시 기산 절대 상한(RETENTION_ABSOLUTE_DAYS, 기본 180일). */
export function resolveAbsoluteDays(): number {
  return parsePositiveInt(
    process.env.RETENTION_ABSOLUTE_DAYS,
    DEFAULT_ABSOLUTE_DAYS,
    'RETENTION_ABSOLUTE_DAYS',
  );
}

/** 스케줄 cron 표현식(RETENTION_CRON, 기본 '0 3 * * *'). @Cron 데코레이터 적용 시점에 평가된다. */
export function resolveCron(): string {
  const raw = process.env.RETENTION_CRON;
  return raw == null || raw.trim() === '' ? DEFAULT_CRON : raw;
}

/**
 * 배치 실행 기준 시각(now). 기본은 현재 시각이며, RETENTION_NOW(ISO8601)로 재정의할 수 있다
 * (경계·중단 재실행 검증용, 선택). 파싱 불가 시 예외를 던진다.
 */
export function resolveNow(): Date {
  const raw = process.env.RETENTION_NOW;
  if (raw == null || raw.trim() === '') {
    return new Date();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`RETENTION_NOW 파싱 실패(ISO8601 필요) — 입력=${raw}`);
  }
  return parsed;
}
