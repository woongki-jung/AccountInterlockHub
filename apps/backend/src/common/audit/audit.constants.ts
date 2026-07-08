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
  CONSENT_REJECT: 'CONSENT_REJECT', // 사용자 거부 처리(PROC-202 B3a, FN-008 — 200 정상 종료·상태 실패 1건, INFO)
  DELIVERY_BLOCK: 'DELIVERY_BLOCK', // 미동의 전달 차단(PROC-203 B1, FN-012 — 내부 차단·EX 없음, BLOCKED)
  DELIVERY_FAIL: 'DELIVERY_FAIL', // 서비스 B 전달 실패 확정(PROC-203 B6, 재시도 후, FAIL → 502 EX-BIZ-004)
  CALLBACK_RECEIVE: 'CALLBACK_RECEIVE',
  COMPLETION_CHECK: 'COMPLETION_CHECK', // 연동 완료 확인 조회(PROC-302, FN-017 — userKey 마스킹·완료 여부 기록, 읽기 전용)
  HISTORY_CREATE: 'HISTORY_CREATE', // 연동이력 생성(PROC-201 진입 시, FN-016 — userKey 마스킹만 기록)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BATCH_RUN: 'BATCH_RUN',
} as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];
