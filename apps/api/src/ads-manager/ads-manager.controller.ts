import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AdsManagerService } from './ads-manager.service';
import { ListCampaignsQueryDto } from './dto/list-campaigns.dto';
import { SyncRequestDto } from './dto/sync-request.dto';

/**
 * Ads Manager — read-layer campaign analytics + manual stats sync trigger.
 *
 * Phase 2.3.4-A: Campaign listing with aggregated stats only.
 * All routes require JWT. sellerId sourced from JWT (never from body/params).
 */
@Controller('ads-manager')
@UseGuards(JwtAuthGuard)
export class AdsManagerController {
  constructor(private readonly service: AdsManagerService) {}

  /**
   * GET /api/ads-manager/campaigns
   * List campaigns for the authenticated seller with aggregated stats.
   *
   * Query params:
   *   dateFrom, dateTo   — stats date range (YYYY-MM-DD, defaults to today UTC)
   *   status             — filter by campaign status (ACTIVE | PAUSED | ARCHIVED)
   *   sellpageId         — filter to a specific sellpage UUID
   *   sortBy             — sort stats by: spend | roas | purchases  (default: spend)
   *   sortDir            — asc | desc  (default: desc)
   *   limit              — max rows (1–200, default 50)
   *   cursor             — opaque pagination cursor (last row campaign.id)
   *   includeArchived    — include ARCHIVED campaigns (default false)
   */
  @Get('campaigns')
  getCampaigns(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCampaignsQueryDto,
  ) {
    return this.service.getCampaigns(user.sellerId, query);
  }

  /**
   * POST /api/ads-manager/sync
   * Manually enqueue CAMPAIGN + ADSET + AD stats-sync jobs for today
   * (or a specific date via body.date).
   *
   * Returns the three BullMQ job IDs that were enqueued.
   * Idempotent — duplicate jobs for the same seller/date are de-duped by BullMQ jobId.
   */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  enqueueSync(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncRequestDto,
  ) {
    const date = dto.date ?? this.service.todayUTC();
    return this.service.enqueueSync(user.sellerId, date).then((jobIds) => ({
      queued: true,
      date,
      jobIds,
    }));
  }
}
