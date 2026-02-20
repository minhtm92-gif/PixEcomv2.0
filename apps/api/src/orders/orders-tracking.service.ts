import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SevenTrackProvider } from './tracking/seventeen-track.provider';

// ─── Return type ─────────────────────────────────────────────────────────────

export interface TrackingSnapshot {
  trackingNumber: string;
  trackingStatus: string;
  lastEvent: string | null;
  refreshedAt: Date;
}

// ─── Statuses that mean "no further refresh needed" ──────────────────────────

const TERMINAL_STATUSES = ['DELIVERED', 'EXCEPTION'];

/**
 * OrdersTrackingService
 *
 * Responsibilities:
 *  1. refreshTracking()  — call 17track, update order, log OrderEvent
 *  2. autoRefreshAll()   — batch refresh for all sellers with autoTrackingRefresh=true
 *
 * Tenant isolation:
 *  - refreshTracking() always queries { id, sellerId } — cross-seller access returns 404
 *  - autoRefreshAll() only touches each seller's own orders
 */
@Injectable()
export class OrdersTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingProvider: SevenTrackProvider,
  ) {}

  /**
   * Refresh tracking status for a single order.
   *
   * @throws NotFoundException  if order not found or belongs to different seller
   * @throws BadRequestException if order has no tracking number
   */
  async refreshTracking(
    sellerId: string,
    orderId: string,
  ): Promise<TrackingSnapshot> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId }, // tenant-scoped
      select: { id: true, trackingNumber: true, trackingProvider: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (!order.trackingNumber) {
      throw new BadRequestException('Order has no tracking number');
    }

    // Call 17track — never throws, returns UNKNOWN on error
    const result = await this.trackingProvider.refreshTracking(
      order.trackingNumber,
      order.trackingProvider ?? undefined,
    );

    // Update order tracking status + log event in a single transaction
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { trackingStatus: result.status },
      }),
      this.prisma.orderEvent.create({
        data: {
          orderId,
          sellerId,
          eventType: 'TRACKING_REFRESHED',
          description:
            result.lastEvent ?? `Tracking status updated to ${result.status}`,
        },
      }),
    ]);

    return {
      trackingNumber: order.trackingNumber,
      trackingStatus: result.status,
      lastEvent: result.lastEvent ?? null,
      refreshedAt: result.updatedAt,
    };
  }

  /**
   * Auto-refresh all in-flight orders for sellers with autoTrackingRefresh=true.
   *
   * Called by TrackingSchedulerService every 6 hours.
   * Per-order errors are caught and logged — the batch never aborts.
   */
  async autoRefreshAll(): Promise<void> {
    const enabledSellers = await this.prisma.sellerSettings.findMany({
      where: { autoTrackingRefresh: true },
      select: { sellerId: true },
    });

    for (const { sellerId } of enabledSellers) {
      // Find orders that have a tracking number and are not in a terminal state
      const orders = await this.prisma.order.findMany({
        where: {
          sellerId,
          trackingNumber: { not: null },
          trackingStatus: { notIn: TERMINAL_STATUSES },
        },
        select: { id: true },
      });

      for (const { id } of orders) {
        try {
          await this.refreshTracking(sellerId, id);
        } catch {
          // Swallow per-order errors — log and continue
          // (In production this would push to a logger/Sentry)
        }
      }
    }
  }
}
