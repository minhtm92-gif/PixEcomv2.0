import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AnalyticsService } from './analytics.service';
import { OverviewQueryDto } from './dto/overview-query.dto';

/**
 * Analytics — seller KPI dashboard.
 *
 * Phase 2.3.4-C: Overview endpoint only.
 * All routes require JWT. sellerId sourced from JWT (never from body/params).
 */
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  /**
   * GET /api/analytics/overview
   *
   * Returns aggregated KPIs, per-source spend breakdown, and per-sellpage breakdown
   * for the authenticated seller within the given date range.
   *
   * Query params:
   *   dateFrom       — YYYY-MM-DD (default today UTC)
   *   dateTo         — YYYY-MM-DD (default today UTC)
   *   sellpageId     — optional UUID filter
   *   includeSources — comma-separated ad sources (default: META)
   *   timezone       — IANA tz string (accepted but not applied in Phase 1)
   */
  @Get('overview')
  getOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: OverviewQueryDto,
  ) {
    return this.service.getOverview(user.sellerId, query);
  }
}
