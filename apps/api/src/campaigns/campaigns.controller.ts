import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InlineBudgetDto } from '../ads-manager/dto/bulk-action.dto';

/**
 * Campaigns — seller-scoped CRUD + Meta lifecycle.
 *
 * All routes require JWT. sellerId is sourced from JWT (never from params/body).
 *
 * Route ordering: static segments (/launch, /pause, /resume are sub-routes)
 * come AFTER /:id — NestJS handles these as POST/PATCH on /:id/action
 * which is unambiguous because the action is a verb, not a UUID.
 */
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  // ─── POST /campaigns ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.service.createCampaign(user.sellerId, dto);
  }

  // ─── GET /campaigns ───────────────────────────────────────────────────────

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCampaignsDto) {
    return this.service.listCampaigns(user.sellerId, query);
  }

  // ─── GET /campaigns/:id ───────────────────────────────────────────────────

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getCampaign(user.sellerId, id);
  }

  // ─── PATCH /campaigns/:id ─────────────────────────────────────────────────

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.updateCampaign(user.sellerId, id, dto);
  }

  // ─── POST /campaigns/:id/launch ───────────────────────────────────────────

  @Post(':id/launch')
  @HttpCode(HttpStatus.OK)
  launch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.launchCampaign(user.sellerId, id);
  }

  // ─── PATCH /campaigns/:id/pause ───────────────────────────────────────────

  @Patch(':id/pause')
  pause(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.pauseCampaign(user.sellerId, id);
  }

  // ─── PATCH /campaigns/:id/resume ──────────────────────────────────────────

  @Patch(':id/resume')
  resume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.resumeCampaign(user.sellerId, id);
  }

  // ─── PATCH /campaigns/:id/budget ──────────────────────────────────────────

  @Patch(':id/budget')
  @HttpCode(HttpStatus.OK)
  updateBudget(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InlineBudgetDto,
  ) {
    return this.service.updateCampaignBudget(user.sellerId, id, dto);
  }
}
