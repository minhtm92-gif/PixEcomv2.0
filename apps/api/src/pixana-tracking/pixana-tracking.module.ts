import { Global, Module } from '@nestjs/common';
import { PixanaTrackingService } from './pixana-tracking.service';

/**
 * PixAna Tracking Module — sends order events to PixAna for revenue attribution.
 *
 * Marked @Global() so StorefrontService and OrdersService can inject
 * PixanaTrackingService without explicit module imports.
 *
 * BUG-001 FIX: This module was missing entirely, causing ROAS to show 0 purchases.
 */
@Global()
@Module({
  providers: [PixanaTrackingService],
  exports: [PixanaTrackingService],
})
export class PixanaTrackingModule {}
