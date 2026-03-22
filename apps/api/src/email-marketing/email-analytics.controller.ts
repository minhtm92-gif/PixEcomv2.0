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
<<<<<<< HEAD
=======
   * Build a { from, to } date range from query params.
   * Defaults to the last 30 days if either param is missing.
   */
  private buildDateRange(query: EmailAnalyticsQueryDto): {
    from: Date;
    to: Date;
  } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  /**
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
   * GET /api/email-analytics/overview?from=2026-01-01&to=2026-03-21
   *
   * Aggregate email stats: sent, delivered, opened, clicked, bounced, complained + rates.
   */
  @Get('overview')
  getOverview(@Req() req: any, @Query() query: EmailAnalyticsQueryDto) {
    const sellerId = req.user.sellerId;
<<<<<<< HEAD
    return this.analyticsService.getOverview(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
=======
    return this.analyticsService.getOverview(sellerId, this.buildDateRange(query));
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  }

  /**
   * GET /api/email-analytics/flows?from=...&to=...
   *
   * Per-flow breakdown: sent, opened, clicked + rates for each flow.
   */
  @Get('flows')
  getFlowStats(@Req() req: any, @Query() query: EmailAnalyticsQueryDto) {
    const sellerId = req.user.sellerId;
<<<<<<< HEAD
    return this.analyticsService.getFlowStats(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
=======
    return this.analyticsService.getFlowStats(sellerId, this.buildDateRange(query));
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  }

  /**
   * GET /api/email-analytics/recovery?from=...&to=...
   *
   * Abandoned cart/checkout recovery metrics.
   */
  @Get('recovery')
  getRecoveryStats(@Req() req: any, @Query() query: EmailAnalyticsQueryDto) {
    const sellerId = req.user.sellerId;
<<<<<<< HEAD
    return this.analyticsService.getRecoveryStats(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
=======
    return this.analyticsService.getRecoveryStats(sellerId, this.buildDateRange(query));
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
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
<<<<<<< HEAD
    return this.analyticsService.getRevenueAttribution(sellerId, {
      from: new Date(query.from),
      to: new Date(query.to),
    });
=======
    return this.analyticsService.getRevenueAttribution(sellerId, this.buildDateRange(query));
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  }
}
