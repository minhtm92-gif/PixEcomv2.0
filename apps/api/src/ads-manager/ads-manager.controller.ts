import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdsManagerReadService } from './ads-manager-read.service';
import { AdsManagerActionService } from './ads-manager-action.service';
import { CampaignsQueryDto } from './dto/campaigns-query.dto';
import { AdsetsQueryDto } from './dto/adsets-query.dto';
import { AdsQueryDto } from './dto/ads-query.dto';
import { FiltersQueryDto } from './dto/filters-query.dto';
import { BulkBudgetDto, BulkStatusDto } from './dto/bulk-action.dto';

@UseGuards(JwtAuthGuard)
@Controller('ads-manager')
export class AdsManagerController {
  constructor(
    private readonly service: AdsManagerReadService,
    private readonly actionService: AdsManagerActionService,
  ) {}

  // ─── READ ENDPOINTS (unchanged) ──────────────────────────────────────────

  @Get('campaigns')
  getCampaigns(@Req() req: any, @Query() query: CampaignsQueryDto) {
    return this.service.getCampaigns(req.user.sellerId, query);
  }

  @Get('adsets')
  getAdsets(@Req() req: any, @Query() query: AdsetsQueryDto) {
    return this.service.getAdsets(req.user.sellerId, query);
  }

  @Get('ads')
  getAds(@Req() req: any, @Query() query: AdsQueryDto) {
    return this.service.getAds(req.user.sellerId, query);
  }

  @Get('filters')
  getFilters(@Req() req: any, @Query() query: FiltersQueryDto) {
    return this.service.getFilters(
      req.user.sellerId,
      query.campaignId,
      query.adsetId,
    );
  }

  // ─── BULK STATUS ──────────────────────────────────────────────────────────

  /**
   * PATCH /api/ads-manager/bulk-status
   * Bulk pause or resume campaigns, adsets, or ads.
   * Body: { entityType, entityIds[], action }
   */
  @Patch('bulk-status')
  @HttpCode(200)
  bulkStatus(@Req() req: any, @Body() dto: BulkStatusDto) {
    return this.actionService.bulkStatus(req.user.sellerId, dto);
  }

  // ─── BULK BUDGET ──────────────────────────────────────────────────────────

  /**
   * PATCH /api/ads-manager/bulk-budget
   * Bulk update campaign budgets.
   * Body: { campaignIds[], budget, budgetType? }
   */
  @Patch('bulk-budget')
  @HttpCode(200)
  bulkBudget(@Req() req: any, @Body() dto: BulkBudgetDto) {
    return this.actionService.bulkBudget(req.user.sellerId, dto);
  }

  // ─── MANUAL SYNC ─────────────────────────────────────────────────────────

  /**
   * POST /api/ads-manager/sync
   * Pull latest status/budget from Meta for all connected ad accounts.
   * Rate limited: 1 call per seller per 60 seconds.
   */
  @Post('sync')
  @HttpCode(200)
  sync(@Req() req: any) {
    return this.actionService.syncFromMeta(req.user.sellerId);
  }
}
