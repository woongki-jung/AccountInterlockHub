import { Logger } from '@nestjs/common';

/**
 * 보관정책 배치(PROC-402 / FN-011)의 운영 구성 훅. 기본값은 사양 확정 값(90일·5,000행 청크·일 1회 03:00)이며
 * 환경변수로만 재정의한다. 청크 크기·기준 시각 재정의는 청크 경계·중단 재실행·경계 검증(TC BAT-02) 목적의
 * 정상 구성 훅으로, 운영 기본은 불변이다.
 */

// 청크 DELETE 1회 상한 행수(ENT-004·ENT-007 §구현 가이드 확정). 운영 기본 불변.
export const DEFAULT_CHUNK_SIZE = 5000;
// 보관 기간(일). 처리상태·연동이력 공통(FN-011 기본안 90).
export const DEFAULT_RETENTION_DAYS = 90;
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

/** 보관 기간(RETENTION_DAYS, 기본 90일). */
export function resolveRetentionDays(): number {
  return parsePositiveInt(process.env.RETENTION_DAYS, DEFAULT_RETENTION_DAYS, 'RETENTION_DAYS');
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
