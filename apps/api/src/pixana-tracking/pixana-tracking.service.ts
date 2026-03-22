import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PixAna Tracking Service
 *
 * Sends order events (order.created, order.paid, order.shipped, etc.)
 * to PixAna's webhook endpoint for revenue attribution and ROAS calculation.
 *
 * This is the missing link that connects PixEcom purchases to PixAna analytics.
 * Without this, ROAS shows 0 purchases because PixAna never receives order data.
 *
 * Authentication: HMAC-SHA256 signature matching PixAna's expected format.
 * Delivery: Fire-and-forget with retry (never blocks the caller).
 */
@Injectable()
export class PixanaTrackingService {
  private readonly logger = new Logger(PixanaTrackingService.name);
  private readonly pixanaWebhookUrl: string | null;
  private readonly pixanaWebhookSecret: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.pixanaWebhookUrl =
      this.config.get<string>('PIXANA_WEBHOOK_URL') ?? null;
    this.pixanaWebhookSecret =
      this.config.get<string>('PIXANA_WEBHOOK_SECRET') ?? null;

    if (!this.pixanaWebhookUrl || !this.pixanaWebhookSecret) {
      this.logger.warn(
        'PIXANA_WEBHOOK_URL or PIXANA_WEBHOOK_SECRET not configured — purchase tracking to PixAna is DISABLED',
      );
    } else {
      this.logger.log(
        `PixAna tracking enabled → ${this.pixanaWebhookUrl}`,
      );
    }
  }

  /**
   * Send an order event to PixAna. Fire-and-forget — never throws.
   *
   * @param event — one of: order.created, order.paid, order.shipped, order.completed, order.refunded
   * @param orderId — the PixEcom order UUID
   */
  async sendOrderEvent(
    event: string,
    orderId: string,
  ): Promise<void> {
    if (!this.pixanaWebhookUrl || !this.pixanaWebhookSecret) {
      return; // silently skip if not configured
    }

    try {
      // 1. Fetch full order data with product costs for ROAS/CBH attribution
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          sellerId: true,
          orderNumber: true,
          status: true,
          sellpageId: true,
          customerEmail: true,
          subtotal: true,
          shippingCost: true,
          taxAmount: true,
          discountAmount: true,
          total: true,
          currency: true,
          source: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmTerm: true,
          utmContent: true,
          paymentMethod: true,
          paidAt: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              productName: true,
              variantName: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              product: {
                select: {
                  id: true,
                  costPrice: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  costPrice: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`PixAna tracking: Order ${orderId} not found`);
        return;
      }

      // 2. Compute product cost from items (variant costPrice > product costPrice > 0)
      const productCost = order.items.reduce((sum, item) => {
        const cost =
          Number(item.variant?.costPrice ?? item.product?.costPrice ?? 0);
        return sum + cost * item.quantity;
      }, 0);

      // 3. Build PixAna-compatible payload (matches PixecomOrderPayload interface)
      const payload = {
        event,
        data: {
          id: order.id,
          sellerId: order.sellerId,
          orderNumber: order.orderNumber,
          status: this.mapStatus(event, order.status),
          sellpageId: order.sellpageId ?? undefined,
          productId: order.items[0]?.productId ?? undefined,
          customerEmail: order.customerEmail,
          subtotal: Number(order.subtotal),
          shippingCost: Number(order.shippingCost),
          taxAmount: Number(order.taxAmount),
          discountAmount: Number(order.discountAmount),
          total: Number(order.total),
          productCost,
          source: order.source ?? undefined,
          utmSource: order.utmSource ?? undefined,
          utmMedium: order.utmMedium ?? undefined,
          utmCampaign: order.utmCampaign ?? undefined,
          utmTerm: order.utmTerm ?? undefined,
          utmContent: order.utmContent ?? undefined,
          paymentMethod: order.paymentMethod ?? undefined,
          paidAt: order.paidAt?.toISOString() ?? undefined,
          items: order.items.map((item) => ({
            id: item.id,
            productId: item.productId ?? undefined,
            variantId: item.variantId ?? undefined,
            productName: item.productName,
            variantName: item.variantName ?? undefined,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.lineTotal),
            unitCost: Number(
              item.variant?.costPrice ?? item.product?.costPrice ?? 0,
            ),
          })),
        },
        timestamp: new Date().toISOString(),
      };

      // 4. Send to PixAna with HMAC-SHA256 signature
      await this.deliverWithRetry(payload);

      this.logger.log(
        `PixAna tracking: ${event} sent for order ${order.orderNumber}`,
      );
    } catch (err) {
      // NEVER let tracking crash the caller
      this.logger.error(
        `PixAna tracking failed for ${event} (order ${orderId}): ${err}`,
      );
    }
  }

  // ─── Internal delivery with retry ──────────────────────────────────────────

  private async deliverWithRetry(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(body, timestamp);

    const maxAttempts = 3;
    const delays = [0, 2000, 5000]; // immediate, 2s, 5s

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await this.sleep(delays[attempt - 1]);
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(this.pixanaWebhookUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
            'x-webhook-timestamp': timestamp,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          return; // Success
        }

        this.logger.warn(
          `PixAna webhook HTTP ${response.status} (attempt ${attempt}/${maxAttempts})`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `PixAna webhook error: ${msg} (attempt ${attempt}/${maxAttempts})`,
        );
      }
    }

    this.logger.error(
      `PixAna webhook delivery failed after ${maxAttempts} attempts`,
    );
  }

  /**
   * Map event type to the status string PixAna expects in fact_order.
   * PixAna's upsertOrder uses the `status` field directly.
   */
  private mapStatus(event: string, currentStatus: string): string {
    switch (event) {
      case 'order.created':
        return 'PENDING';
      case 'order.paid':
        return 'PAID';
      case 'order.confirmed':
        return 'CONFIRMED';
      case 'order.shipped':
        return 'SHIPPED';
      case 'order.completed':
      case 'order.delivered':
        return 'DELIVERED';
      case 'order.refunded':
        return 'REFUNDED';
      case 'order.cancelled':
        return 'CANCELLED';
      default:
        return currentStatus;
    }
  }

  private sign(body: string, timestamp: string): string {
    return crypto
      .createHmac('sha256', this.pixanaWebhookSecret!)
      .update(`${timestamp}.${body}`)
      .digest('hex');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
