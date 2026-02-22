import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { canTransition } from './orders.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkStatusResult {
  updated: number;
  failed: Array<{ orderId: string; reason: string }>;
}

// ─── Map order status → event type ───────────────────────────────────────────
const STATUS_TO_EVENT: Record<string, string> = {
  CONFIRMED:  'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED:    'SHIPPED',
  DELIVERED:  'DELIVERED',
  CANCELLED:  'CANCELLED',
  REFUNDED:   'REFUNDED',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrdersBulkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bulk update order status.
   * C.2: Now validates status transitions before updating.
   * Orders with invalid transitions are skipped and added to failed[].
   */
  async bulkUpdateStatus(
    sellerId: string,
    dto: BulkStatusDto,
  ): Promise<BulkStatusResult> {
    const failed: Array<{ orderId: string; reason: string }> = [];
    let updated = 0;

    for (const orderId of dto.orderIds) {
      try {
        // Validate order exists and belongs to this seller
        const order = await this.prisma.order.findFirst({
          where: { id: orderId, sellerId },
          select: { id: true, status: true },
        });

        if (!order) {
          failed.push({
            orderId,
            reason: 'Order not found or does not belong to this seller',
          });
          continue;
        }

        // Skip if already at target status
        if (order.status === dto.status) {
          failed.push({ orderId, reason: `Order is already ${dto.status}` });
          continue;
        }

        // C.2: Validate transition
        const current = order.status.toString();
        if (!canTransition(current, dto.status)) {
          failed.push({
            orderId,
            reason: `Cannot transition from ${current} to ${dto.status}`,
          });
          continue;
        }

        const eventType = STATUS_TO_EVENT[dto.status] ?? 'CONFIRMED';

        // Update order + create event in a transaction
        await this.prisma.$transaction([
          this.prisma.order.update({
            where: { id: orderId },
            data: { status: dto.status as never },
          }),
          this.prisma.orderEvent.create({
            data: {
              orderId,
              sellerId,
              eventType: eventType as never,
              description: `Status updated to ${dto.status} via bulk update`,
            },
          }),
        ]);

        updated++;
      } catch {
        failed.push({ orderId, reason: 'Internal error processing order' });
      }
    }

    return { updated, failed };
  }
}
