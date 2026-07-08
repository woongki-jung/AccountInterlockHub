import { Body, Controller, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { ConfigService, ConfigResponse } from './config.service';
import { SaveConfigDto } from './dto/save-config.dto';

/**
 * 연동 구성 등록·편집 컨트롤러 — PROC-101 / SVC-001 / ADM-01.
 *
 * 진입 가드(IP → 세션 순):
 *  - IP 게이트(PROC-104, AdminIpMiddleware)는 app.module 이 api/admin 경로에 선적용한다.
 *  - SessionGuard(FN-003)로 유효 세션을 요구한다(미인증 401 EX-AUTH-001 / 유휴 만료 401 EX-AUTH-002).
 * 세션 사용자(req.session.admin.username)를 created_by/updated_by·감사 actorId 로 쓴다.
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다.
 */
@Controller('api/admin/configs')
@UseGuards(SessionGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /** 신규 등록(POST /api/admin/configs). 성공 → MDL-101(자식 포함) / 실패 → 422·409·400. */
  @Post()
  @HttpCode(200)
  async create(@Body() dto: SaveConfigDto, @Req() req: Request): Promise<ConfigResponse> {
    return this.configService.createConfig(dto, actorOf(req));
  }

  /** 편집(PUT /api/admin/configs/:id). config_code 불변, 고유성 자기 제외(EXC-BIZ-02). */
  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() dto: SaveConfigDto,
    @Req() req: Request,
  ): Promise<ConfigResponse> {
    return this.configService.updateConfig(id, dto, actorOf(req));
  }
}

// 세션에서 감사·생성자 식별자로 쓸 관리자 계정명을 얻는다(SessionGuard 통과 후라 항상 존재).
function actorOf(req: Request): string {
  return req.session.admin?.username ?? 'unknown';
}
