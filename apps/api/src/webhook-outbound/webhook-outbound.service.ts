import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhookOutboundService {
  private readonly logger = new Logger(WebhookOutboundService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Main dispatch method (fire-and-forget) ───────────────────────────────

  /**
   * Dispatch an order event to all active webhook endpoints for a seller.
   * This is FIRE-AND-FORGET — it never throws.
   * Call this with .catch() or wrap in try-catch at the call site.
   */
  async dispatchOrderEvent(
    sellerId: string,
    eventType: string,
    orderId: string,
  ): Promise<void> {
    try {
      // 1. Find active endpoints that subscribe to this event type
      const endpoints = await this.prisma.webhookEndpoint.findMany({
        where: {
          sellerId,
          isActive: true,
          events: { has: eventType },
        },
      });

      if (endpoints.length === 0) return;

      // 2. Fetch full order data for the payload
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerEmail: true,
          customerName: true,
          customerPhone: true,
          shippingAddress: true,
          subtotal: true,
          shippingCost: true,
          taxAmount: true,
          discountAmount: true,
          total: true,
          currency: true,
          paymentMethod: true,
          trackingNumber: true,
          trackingUrl: true,
          transactionId: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              variantName: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Webhook dispatch: Order ${orderId} not found`);
        return;
      }

      // 3. Build payload
      const payload = {
        sellerId,
        eventType,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customer: {
            name: order.customerName,
            email: order.customerEmail,
            phone: order.customerPhone,
          },
          shippingAddress: order.shippingAddress ?? {},
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
          })),
          subtotal: Number(order.subtotal),
          shippingCost: Number(order.shippingCost),
          taxAmount: Number(order.taxAmount),
          discountAmount: Number(order.discountAmount),
          total: Number(order.total),
          currency: order.currency,
          paymentMethod: order.paymentMethod,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
          transactionId: order.transactionId,
          source: order.source,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      // 4. Dispatch to each endpoint (in parallel)
      await Promise.allSettled(
        endpoints.map((ep) => this.deliverToEndpoint(ep, eventType, payload)),
      );
    } catch (err) {
      // NEVER let webhook dispatch crash the caller
      this.logger.error(`Webhook dispatch failed for order ${orderId}: ${err}`);
    }
  }

  // ─── Deliver to a single endpoint with retry ────────────────────────────

  private async deliverToEndpoint(
    endpoint: { id: string; url: string; secret: string },
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(body, timestamp, endpoint.secret);

    const maxAttempts = 3;
    const delays = [0, 2000, 10000]; // immediate, 2s, 10s

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await this.sleep(delays[attempt - 1]);
      }

      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
            'x-webhook-timestamp': timestamp,
            'x-webhook-event': eventType,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const duration = Date.now() - start;
        const responseBody = await response.text().catch(() => '');

        // Log delivery
        await this.logDelivery({
          endpointId: endpoint.id,
          eventType,
          payload: payload as any,
          statusCode: response.status,
          responseBody: responseBody.slice(0, 2000),
          success: response.ok,
          attempts: attempt,
          duration,
          error: response.ok ? null : `HTTP ${response.status}`,
        });

        if (response.ok) {
          this.logger.log(
            `Webhook delivered: ${eventType} → ${endpoint.url} (${duration}ms, attempt ${attempt})`,
          );
          return; // Success — stop retrying
        }

        this.logger.warn(
          `Webhook failed: ${eventType} → ${endpoint.url} HTTP ${response.status} (attempt ${attempt}/${maxAttempts})`,
        );
      } catch (err: unknown) {
        const duration = Date.now() - start;
        const errorMsg = err instanceof Error ? err.message : String(err);

        await this.logDelivery({
          endpointId: endpoint.id,
          eventType,
          payload: payload as any,
          statusCode: null,
          responseBody: null,
          success: false,
          attempts: attempt,
          duration,
          error: errorMsg.slice(0, 1000),
        });

        this.logger.warn(
          `Webhook error: ${eventType} → ${endpoint.url}: ${errorMsg} (attempt ${attempt}/${maxAttempts})`,
        );
      }
    }
  }

  // ─── HMAC-SHA256 Signing ───────────────────────────────────────────────

  private sign(body: string, timestamp: string, secret: string): string {
    const data = `${timestamp}.${body}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private async logDelivery(data: {
    endpointId: string;
    eventType: string;
    payload: any;
    statusCode: number | null;
    responseBody: string | null;
    success: boolean;
    attempts: number;
    duration: number;
    error: string | null;
  }): Promise<void> {
    try {
      await this.prisma.webhookDelivery.create({ data });
    } catch (err) {
      this.logger.error(`Failed to log webhook delivery: ${err}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Verify incoming webhook signature (used by inbound handlers) ─────

  static verifySignature(
    body: string,
    signature: string,
    timestamp: string,
    secret: string,
  ): boolean {
    // Reject if timestamp is more than 5 minutes old (replay protection)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    // timingSafeEqual throws RangeError if lengths differ
    if (sigBuf.length !== expBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expBuf);
  }
}
