import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalyticsQueryDto } from './dto/email-analytics-query.dto';

@Controller('email-analytics')
@UseGuards(JwtAuthGuard)
export class EmailAnalyticsController {
  constructor(private readonly analyticsService: EmailAnalyticsService) {}

  /**
   * GET /api/email-analytics/overview?from=2026-01-01&to=2026-03-21
   *
   * Aggregate email stats: sent, delivered, opened, clicked, bounced, complained + rates.
   */
  @Get('overview')
  getOverview(@Req() req: any, @Query() query: EmailAnalyticsQueryDto) {
    const sellerId = req.user.sellerId;
    return this.analyticsService.getOverview(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
  }

  /**
   * GET /api/email-analytics/flows?from=...&to=...
   *
   * Per-flow breakdown: sent, opened, clicked + rates for each flow.
   */
  @Get('flows')
  getFlowStats(@Req() req: any, @Query() query: EmailAnalyticsQueryDto) {
    const sellerId = req.user.sellerId;
    return this.analyticsService.getFlowStats(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
  }

  /**
   * GET /api/email-analytics/recovery?from=...&to=...
   *
   * Abandoned cart/checkout recovery metrics.
   */
  @Get('recovery')
  getRecoveryStats(@Req() req: any, @Query() query: EmailAnalyticsQueryDto) {
    const sellerId = req.user.sellerId;
    return this.analyticsService.getRecoveryStats(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
  }

  /**
   * GET /api/email-analytics/revenue?from=...&to=...
   *
   * Revenue attribution — orders driven by email clicks within 7-day window.
   */
  @Get('revenue')
  getRevenueAttribution(
    @Req() req: any,
    @Query() query: EmailAnalyticsQueryDto,
  ) {
    const sellerId = req.user.sellerId;
    return this.analyticsService.getRevenueAttribution(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
  }
}
