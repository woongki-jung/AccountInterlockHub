import { ActorType, AuditResult } from './audit.constants';

// FN-013 감사 로그 기록 입력(MDL-401). occurred_at 은 기록 시점 now() 로 서버가 채운다.
export interface AuditLogEntry {
  eventType: string; // AuditEventType 상수 권장
  actorType: ActorType;
  actorId?: string | null; // 관리자 username 또는 서비스 식별
  target?: string | null; // 구성 코드·요청 키값 등(민감 토큰은 maskToken 으로 마스킹해 전달)
  result: AuditResult;
  detail?: string | null; // 부가 상세(회원 키·개인정보 원문 배제 — DATA-001-03)
}
