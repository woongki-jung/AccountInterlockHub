import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorType } from './audit.constants';
import { AuditLogEntry } from './audit.types';
import { maskToken } from './masking.util';

/**
 * 감사 로그 기록 서비스(FN-013) — ENT-006(TBL_AUDIT_LOG)에 append-only 로 기록한다.
 * 전 도메인이 재사용하는 횡단 서비스(@Global AuditModule 로 주입).
 *
 * 마스킹 정책:
 *  - SERVICE 행위자 식별자는 자격 성격이라 앞2·뒤2 마스킹(SEC-005-01)한다.
 *  - ADMIN username 은 감사 책임성(OPS-002-02 "관리자 ID" 기록)을 위해 원문 유지한다.
 *  - target·detail 의 민감 토큰(회원 키·요청 키값 등)은 호출부가 maskToken 으로 마스킹해 전달하며,
 *    detail 에 회원 키·개인정보 원문을 넣지 않는다(DATA-001-03). ※ 상세 근거는 완료 보고 참조.
 *
 * best-effort: 기록 실패가 업무 처리를 차단하지 않는다 — 실패 시 애플리케이션 로그로 폴백한다.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async write(entry: AuditLogEntry): Promise<void> {
    try {
      const actorId =
        entry.actorType === ActorType.SERVICE ? maskToken(entry.actorId) : entry.actorId ?? null;

      await this.dataSource.query(
        `INSERT INTO "TBL_AUDIT_LOG" (event_type, actor_type, actor_id, target, result, detail, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [entry.eventType, entry.actorType, actorId, entry.target ?? null, entry.result, entry.detail ?? null],
      );
    } catch (err) {
      // 감사 실패는 업무 흐름을 차단하지 않는다(FN-013 best-effort). 자격·민감값은 로그에 남기지 않는다.
      this.logger.error(
        `감사 로그 기록 실패(best-effort 폴백) — eventType=${entry.eventType}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
