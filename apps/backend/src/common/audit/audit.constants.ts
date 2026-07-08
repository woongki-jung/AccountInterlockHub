// 감사 로그(ENT-006·FN-013) 코드값 상수. event_type 은 DB CHECK 로 고정하지 않고 애플리케이션 상수로 관리한다.
// actor_type·result 는 DB CHECK 목록과 일치한다.

export const ActorType = {
  ADMIN: 'ADMIN',
  SERVICE: 'SERVICE',
  SYSTEM: 'SYSTEM',
  BATCH: 'BATCH',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const AuditResult = {
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  INFO: 'INFO',
} as const;
export type AuditResult = (typeof AuditResult)[keyof typeof AuditResult];

// OPS-002-01 감사 대상 이벤트(확장 가능). 값은 코드 상수로 통일한다.
export const AuditEventType = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAIL: 'LOGIN_FAIL',
  LOGIN_LOCKED: 'LOGIN_LOCKED', // 잠금 중 로그인 시도(AUTH-003-01, FN-002 step2)
  LOGOUT: 'LOGOUT',
  ACCOUNT_LOCK: 'ACCOUNT_LOCK', // 연속 실패 임계 도달로 잠금 설정(AUTH-003-02)
  CONFIG_CREATE: 'CONFIG_CREATE',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  CONFIG_DELETE: 'CONFIG_DELETE', // 소프트 삭제(PROC-106·BR-104)
  CONFIG_ACTIVATE: 'CONFIG_ACTIVATE', // 활성 전환(PROC-105·BR-103)
  CONFIG_DEACTIVATE: 'CONFIG_DEACTIVATE', // 비활성 전환(PROC-105·BR-103)
  CONFIG_PII_WARN: 'CONFIG_PII_WARN', // 개인정보 직접 수신 파라미터 경고(BIZ-001-05·BR-102, 비차단 INFO)
  IP_BLOCK: 'IP_BLOCK',
  API_AUTH_FAIL: 'API_AUTH_FAIL',
  DELIVERY_FAIL: 'DELIVERY_FAIL',
  CALLBACK_RECEIVE: 'CALLBACK_RECEIVE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BATCH_RUN: 'BATCH_RUN',
} as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];
