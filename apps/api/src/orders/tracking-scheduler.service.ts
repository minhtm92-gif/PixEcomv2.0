import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersTrackingService } from './orders-tracking.service';

/**
 * TrackingSchedulerService
 *
 * Runs the auto-refresh job every 6 hours.
 * Only refreshes orders for sellers with autoTrackingRefresh = true.
 *
 * Uses NestJS ScheduleModule (@nestjs/schedule) — registered via ScheduleModule.forFeature()
 * in OrdersModule, and ScheduleModule.forRoot() globally in AppModule.
 */
@Injectable()
export class TrackingSchedulerService {
  constructor(private readonly trackingService: OrdersTrackingService) {}

  /**
   * Runs at 00:00, 06:00, 12:00, 18:00 UTC every day.
   * Catches all errors internally — the cron never crashes the process.
   */
  @Cron('0 */6 * * *')
  async handleAutoRefresh(): Promise<void> {
    try {
      await this.trackingService.autoRefreshAll();
    } catch {
      // Top-level safety net — errors per-order are already swallowed inside autoRefreshAll
    }
  }
}
