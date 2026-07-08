import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { ActorType, AuditEventType, AuditResult } from '../../common/audit/audit.constants';
import { AppException } from '../../common/envelope/app.exception';
import { verifyPassword } from './password.util';

/**
 * 관리자 로그인 인증·계정 잠금 서비스 — FN-002 / PROC-103 B2 / ENT-005(TBL_ADMIN_ACCOUNT).
 *
 * 계정 존재 여부를 응답으로 구분 노출하지 않는다(미존재·비활성·비밀번호 불일치 모두 401 EX-AUTH-001 동일 메시지).
 * 비밀번호는 단방향 해시로만 대조하고 평문·해시를 응답·로그에 남기지 않는다(AUTH-001-03).
 */

// 잠금 임계치·잠금 시간(AUTH-003, 기본안 수치 — Q1 확정 대기, EXC-AUTH-03).
const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

interface AdminAccountRow {
  id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
  failed_login_count: number;
  locked_until: Date | null;
}

// 인증 통과 계정(MDL-103, passwordHash 배제).
export interface AuthenticatedAdmin {
  username: string;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 자격 검증·잠금 처리(FN-002 처리 흐름). 성공 시 실패 카운트·잠금 리셋 + last_login_at 갱신.
   * @throws AppException EX-AUTH-001(미존재·비활성·불일치) · EX-AUTH-003(잠금 중)
   */
  async authenticate(
    username: string,
    password: string,
    now: Date,
  ): Promise<AuthenticatedAdmin> {
    const rows: AdminAccountRow[] = await this.dataSource.query(
      `SELECT id, username, password_hash, is_active, failed_login_count, locked_until
       FROM "TBL_ADMIN_ACCOUNT" WHERE username = $1`,
      [username],
    );
    const row = rows[0];

    // 1. 계정 조회(AUTH-001-01) — 미존재·비활성은 존재 비노출 위해 동일 처리.
    if (!row || row.is_active === false) {
      await this.audit(AuditEventType.LOGIN_FAIL, username, AuditResult.FAIL);
      throw new AppException('EX-AUTH-001');
    }

    // 2. 잠금 상태 확인(AUTH-003-01) — locked_until 미도래까지 시도 거부.
    if (row.locked_until && new Date(row.locked_until).getTime() > now.getTime()) {
      await this.audit(AuditEventType.LOGIN_LOCKED, username, AuditResult.BLOCKED);
      throw new AppException('EX-AUTH-003');
    }

    // 3. 비밀번호 대조(AUTH-001-03, 단방향 해시).
    const matched = await verifyPassword(password, row.password_hash);
    if (!matched) {
      const newCount = Number(row.failed_login_count) + 1;
      if (newCount >= LOCK_THRESHOLD) {
        const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
        await this.dataSource.query(
          `UPDATE "TBL_ADMIN_ACCOUNT" SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
          [newCount, lockedUntil, row.id],
        );
        await this.audit(AuditEventType.LOGIN_FAIL, username, AuditResult.FAIL);
        await this.audit(
          AuditEventType.ACCOUNT_LOCK,
          username,
          AuditResult.BLOCKED,
          `계정 잠금 ${LOCK_DURATION_MS / 60000}분(연속 실패 ${newCount}회)`,
        );
      } else {
        await this.dataSource.query(
          `UPDATE "TBL_ADMIN_ACCOUNT" SET failed_login_count = $1 WHERE id = $2`,
          [newCount, row.id],
        );
        await this.audit(AuditEventType.LOGIN_FAIL, username, AuditResult.FAIL);
      }
      throw new AppException('EX-AUTH-001');
    }

    // 4. 성공 처리(AUTH-003-02) — 카운트·잠금 리셋, last_login_at 갱신, 성공 감사.
    await this.dataSource.query(
      `UPDATE "TBL_ADMIN_ACCOUNT"
       SET failed_login_count = 0, locked_until = NULL, last_login_at = $1 WHERE id = $2`,
      [now, row.id],
    );
    await this.audit(AuditEventType.LOGIN_SUCCESS, username, AuditResult.SUCCESS);

    // 5. 반환(passwordHash 배제).
    return { username: row.username };
  }

  /** 로그아웃 감사(OPS-002 / AUTH-002-03). 세션 파기는 컨트롤러가 수행한다. */
  async recordLogout(username: string | null): Promise<void> {
    await this.audit(AuditEventType.LOGOUT, username, AuditResult.SUCCESS);
  }

  // 관리자 인증 감사 공통 — actorType ADMIN, actorId=username(책임성 위해 원문 유지, AuditService 정책).
  private async audit(
    eventType: string,
    username: string | null,
    result: AuditResult,
    detail?: string,
  ): Promise<void> {
    await this.auditService.write({
      eventType,
      actorType: ActorType.ADMIN,
      actorId: username,
      target: null,
      result,
      detail: detail ?? null,
    });
  }
}
