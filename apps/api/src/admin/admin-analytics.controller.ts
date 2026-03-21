import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin')
@UseGuards(SuperadminGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AdminAnalyticsService,
  ) {}

  // ─── Existing: GET /admin/analytics (byDate/bySeller/byProduct/byDomain) ──

  @Get('analytics')
  getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getAnalytics(from, to);
  }

  // ─── NEW: GET /admin/analytics/revenue ────────────────────────────────────

  @Get('analytics/revenue')
  getRevenue(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getRevenue(from, to);
  }

  // ─── NEW: GET /admin/analytics/overview ───────────────────────────────────

  @Get('analytics/overview')
  getOverview() {
    return this.analyticsService.getOverview();
  }

  // ─── NEW: GET /admin/products/:id/stats ───────────────────────────────────

  @Get('products/:id/stats')
  getProductStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getProductStats(id, from, to);
  }
}
