import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './session.guard';
import { destroySession, regenerateSession, saveSession } from './session.support';

/**
 * 관리자 로그인·로그아웃 컨트롤러 — PROC-103 / SVC-003.
 * 진입 전 IP 게이트(PROC-104 미들웨어)가 선행한다. 로그인은 미인증 허용, 로그아웃은 유효 세션 전제.
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  /**
   * 로그인(POST /api/admin/auth/login) — body { username, password }.
   * 성공 → 세션 발급(Set-Cookie) + { username }. 실패 → 401 EX-AUTH-001 / 423 EX-AUTH-003.
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<{ username: string }> {
    const account = await this.authService.authenticate(dto.username, dto.password, new Date());

    // 세션 발급(FN-003) — 고정 공격 방지를 위해 재생성 후 관리자 상태를 싣는다.
    await regenerateSession(req);
    const now = Date.now();
    req.session.admin = { username: account.username, issuedAt: now, lastActivityAt: now };
    await saveSession(req);

    return { username: account.username };
  }

  /**
   * 로그아웃(POST /api/admin/auth/logout) — 유효 세션 필요(SessionGuard).
   * 서버 세션 즉시 파기 + LOGOUT 감사.
   */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request): Promise<{ success: boolean }> {
    const username = req.session.admin?.username ?? null;
    await this.authService.recordLogout(username);
    await destroySession(req.session);
    return { success: true };
  }
}
