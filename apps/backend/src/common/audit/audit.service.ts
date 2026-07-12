import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorType } from './audit.constants';
import { AuditLogEntry } from './audit.types';
import { maskToken } from './masking.util';

// ENT-006(TBL_AUDIT_LOG) 컬럼폭(docs/specs/datas/data_ENT-006.md §속성 정의) — INSERT 전 방어 절단 기준.
// event_type(50)·actor_type(20)·result(20) 은 항상 애플리케이션 상수(audit.constants.ts)의 짧은 고정값만
// 들어오므로(최대 실사용 23자) 절단 대상에서 제외한다.
const ACTOR_ID_MAX = 64; // actor_id varchar(64)
const TARGET_MAX = 200; // target varchar(200)
const DETAIL_MAX = 1000; // detail varchar(1000)

/**
 * ENT-006 컬럼폭 방어 절단 — trackingKey(≤255, DATA-002-07)를 maskToken 으로 마스킹해도
 * 길이가 보존되어(SEC-005-01, 앞2·뒤2만 대체) target(200)·actor_id(64) 같은 좁은 컬럼을
 * 초과할 수 있다. 초과 시 INSERT 전체가 실패해 감사 이벤트가 무음 유실되므로(P9 회귀,
 * accountinterlockhub#233) INSERT 전에 컬럼폭만큼 절단한다 — 이미 마스킹된 관측용 값이라
 * 절단해도 감사 목적(이상 징후 관측)에는 지장이 없다.
 */
function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) {
    return null;
  }
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

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
 * 컬럼폭 초과로 인한 실패는 위 truncate() 로 사전 방지하며, best-effort try/catch 는 그 외
 * 예외(DB 접속 장애 등) 대비 백스톱으로 유지한다.
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
        [
          entry.eventType,
          entry.actorType,
          truncate(actorId, ACTOR_ID_MAX),
          truncate(entry.target, TARGET_MAX),
          entry.result,
          truncate(entry.detail, DETAIL_MAX),
        ],
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
