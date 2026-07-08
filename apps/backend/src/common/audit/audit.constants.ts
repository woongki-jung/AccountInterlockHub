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
  LOGOUT: 'LOGOUT',
  ACCOUNT_LOCK: 'ACCOUNT_LOCK',
  CONFIG_CREATE: 'CONFIG_CREATE',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  CONFIG_DELETE: 'CONFIG_DELETE',
  CONFIG_ACTIVE_TOGGLE: 'CONFIG_ACTIVE_TOGGLE',
  IP_BLOCK: 'IP_BLOCK',
  API_AUTH_FAIL: 'API_AUTH_FAIL',
  DELIVERY_FAIL: 'DELIVERY_FAIL',
  CALLBACK_RECEIVE: 'CALLBACK_RECEIVE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BATCH_RUN: 'BATCH_RUN',
} as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];
