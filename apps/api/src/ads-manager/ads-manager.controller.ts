import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdsManagerReadService } from './ads-manager-read.service';
import { AdsManagerActionService } from './ads-manager-action.service';
import { CampaignsQueryDto } from './dto/campaigns-query.dto';
import { AdsetsQueryDto } from './dto/adsets-query.dto';
import { AdsQueryDto } from './dto/ads-query.dto';
import { FiltersQueryDto } from './dto/filters-query.dto';
import { BulkBudgetDto, BulkStatusDto } from './dto/bulk-action.dto';
import type { AuthUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('ads-manager')
export class AdsManagerController {
  constructor(
    private readonly service: AdsManagerReadService,
    private readonly actionService: AdsManagerActionService,
  ) {}

  /**
   * Resolve the effective sellerId.
   * - SUPERADMIN: use ?sellerId query param (required — returns 400 if missing)
   * - Regular SELLER: always use req.user.sellerId (query param ignored)
   */
  private resolveSellerId(user: AuthUser, querySellerId?: string): string {
    if (user.isSuperadmin) {
      if (!querySellerId) {
        throw new BadRequestException('Please select a seller first');
      }
      return querySellerId;
    }
    return user.sellerId;
  }

  // ─── READ ENDPOINTS ──────────────────────────────────────────────────────

  @Get('live-preview')
  getLivePreview(
    @Req() req: any,
    @Query('sellpageId') sellpageId?: string,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getLivePreview(sellerId, sellpageId);
  }

  @Get('daily-stats')
  getDailyStats(
    @Req() req: any,
    @Query('days') days?: string,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getDailyStats(sellerId, days ? parseInt(days, 10) : 7);
  }

  @Get('hourly-stats')
  getHourlyStats(
    @Req() req: any,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getHourlyStats(sellerId);
  }

  @Get('campaigns')
  getCampaigns(
    @Req() req: any,
    @Query() query: CampaignsQueryDto,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getCampaigns(sellerId, req.user.userId, query);
  }

  @Get('adsets')
  getAdsets(
    @Req() req: any,
    @Query() query: AdsetsQueryDto,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getAdsets(sellerId, query);
  }

  @Get('ads')
  getAds(
    @Req() req: any,
    @Query() query: AdsQueryDto,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getAds(sellerId, query);
  }

  @Get('filters')
  getFilters(
    @Req() req: any,
    @Query() query: FiltersQueryDto,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.service.getFilters(
      sellerId,
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
  bulkStatus(
    @Req() req: any,
    @Body() dto: BulkStatusDto,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.actionService.bulkStatus(sellerId, dto);
  }

  // ─── BULK BUDGET ──────────────────────────────────────────────────────────

  /**
   * PATCH /api/ads-manager/bulk-budget
   * Bulk update campaign budgets.
   * Body: { campaignIds[], budget, budgetType? }
   */
  @Patch('bulk-budget')
  @HttpCode(200)
  bulkBudget(
    @Req() req: any,
    @Body() dto: BulkBudgetDto,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.actionService.bulkBudget(sellerId, dto);
  }

  // ─── MANUAL SYNC ─────────────────────────────────────────────────────────

  /**
   * POST /api/ads-manager/sync
   * Pull latest status/budget from Meta for all connected ad accounts.
   * Rate limited: 1 call per seller per 60 seconds.
   */
  @Post('sync')
  @HttpCode(200)
  sync(
    @Req() req: any,
    @Body('adAccountId') adAccountId?: string,
    @Query('sellerId') querySellerId?: string,
  ) {
    const sellerId = this.resolveSellerId(req.user, querySellerId);
    return this.actionService.syncFromMeta(sellerId, adAccountId);
  }
}
