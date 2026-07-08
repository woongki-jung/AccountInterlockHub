import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import {
  ActiveResult,
  ConfigResponse,
  ConfigService,
  ConfigSummary,
  DeleteResult,
} from './config.service';
import { ListConfigQueryDto } from './dto/list-config.dto';
import { SaveConfigDto } from './dto/save-config.dto';
import { SetActiveDto } from './dto/set-active.dto';

/**
 * 연동 구성 관리 컨트롤러 — PROC-101/102/105/106 · SVC-001/002 · ADM-01/02.
 *
 * 진입 가드(IP → 세션 순):
 *  - IP 게이트(PROC-104, AdminIpMiddleware)는 app.module 이 api/admin 경로에 선적용한다.
 *  - SessionGuard(FN-003)로 유효 세션을 요구한다(미인증 401 EX-AUTH-001 / 유휴 만료 401 EX-AUTH-002).
 * 세션 사용자(req.session.admin.username)를 created_by/updated_by·감사 actorId 로 쓴다.
 * 응답 본문은 전역 SuccessInterceptor(FN-015)가 { success:true, data } 로 감싼다(null → data:null).
 */
@Controller('api/admin/configs')
@UseGuards(SessionGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /** 목록 조회(GET /api/admin/configs). 필터: active(선택)·keyword(선택·≤100). 응답 → MDL-102[]. */
  @Get()
  @HttpCode(200)
  async list(@Query() query: ListConfigQueryDto): Promise<ConfigSummary[]> {
    return this.configService.listConfigs({
      active: query.active ?? null,
      keyword: query.keyword && query.keyword.length > 0 ? query.keyword : null,
    });
  }

  /** 상세 조회(GET /api/admin/configs/:id). 성공 → MDL-101(자식 포함) / 대상 없음 → 200 data:null. */
  @Get(':id')
  @HttpCode(200)
  async detail(@Param('id') id: string): Promise<ConfigResponse | null> {
    return this.configService.getConfigDetail(id);
  }

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

  /** 활성 전환(PATCH /api/admin/configs/:id/active, BR-103). 성공 → { id, isActive } / 대상 없음 → data:null. */
  @Patch(':id/active')
  @HttpCode(200)
  async setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @Req() req: Request,
  ): Promise<ActiveResult | null> {
    return this.configService.setActive(id, dto.isActive, actorOf(req));
  }

  /** 소프트 삭제(DELETE /api/admin/configs/:id, BR-104). 성공 → { id, deleted:true } / 대상 없음 → data:null. */
  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string, @Req() req: Request): Promise<DeleteResult | null> {
    return this.configService.softDelete(id, actorOf(req));
  }
}

// 세션에서 감사·생성자 식별자로 쓸 관리자 계정명을 얻는다(SessionGuard 통과 후라 항상 존재).
function actorOf(req: Request): string {
  return req.session.admin?.username ?? 'unknown';
}
