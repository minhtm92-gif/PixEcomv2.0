import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * Shared service for webhook handlers — order confirmation + stock decrement.
 * Used by both Stripe and PayPal webhook controllers.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRM ORDER (idempotent)
  // ─────────────────────────────────────────────────────────────────────────

  async confirmOrder(
    orderId: string,
    transactionId: string,
    paymentMethod: string,
  ): Promise<{ success: boolean; orderNumber: string | null }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        sellerId: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      this.logger.warn(`Webhook: Order ${orderId} not found`);
      return { success: false, orderNumber: null };
    }

    // Idempotent — skip if already confirmed
    if (order.status !== 'PENDING') {
      this.logger.log(
        `Webhook: Order ${order.orderNumber} already ${order.status}, skipping`,
      );
      return { success: true, orderNumber: order.orderNumber };
    }

    // ── Transaction: confirm + decrement stock ───────────────────────────
    // Atomic: updateMany with status=PENDING filter prevents double-decrement
    // if both client confirmPayment() and webhook fire simultaneously.
    let confirmed = false;

    await this.prisma.$transaction(async (tx) => {
      // 1. Atomic update — only succeeds if still PENDING
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          paidAt: new Date(),
          transactionId,
        },
      });

      if (count === 0) {
        // Client confirmPayment() already confirmed — skip
        this.logger.log(
          `Webhook: Order ${order.orderNumber} already confirmed by client, skipping`,
        );
        return;
      }

      confirmed = true;

      // 2. Create CONFIRMED event
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          sellerId: order.sellerId,
          eventType: 'CONFIRMED',
          description: `Payment confirmed via ${paymentMethod} webhook. Transaction: ${transactionId}`,
        },
      });

      // 3. Decrement stock for each variant in the order
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });
        }
      }
    });

    this.logger.log(
      `Webhook: Order ${order.orderNumber} confirmed + stock decremented. Tx: ${transactionId}`,
    );

    // F.3: Send order confirmation email (fire-and-forget)
    if (confirmed) {
      this.sendOrderConfirmationEmail(order.id).catch((err) =>
        this.logger.error(`Webhook: Failed to send confirmation email: ${err.message}`),
      );
    }

    return { success: true, orderNumber: order.orderNumber };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFUND ORDER (idempotent)
  // ─────────────────────────────────────────────────────────────────────────

  async refundOrder(
    orderId: string,
    refundId: string,
    paymentMethod: string,
  ): Promise<{ success: boolean; orderNumber: string | null }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        sellerId: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      this.logger.warn(`Webhook refund: Order ${orderId} not found`);
      return { success: false, orderNumber: null };
    }

    // Idempotent — skip if already refunded
    if (order.status === 'REFUNDED') {
      this.logger.log(
        `Webhook: Order ${order.orderNumber} already REFUNDED, skipping`,
      );
      return { success: true, orderNumber: order.orderNumber };
    }

    // Can only refund CONFIRMED/PROCESSING/SHIPPED/DELIVERED orders
    const refundable = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    if (!refundable.includes(order.status)) {
      this.logger.warn(
        `Webhook: Order ${order.orderNumber} status ${order.status} not refundable`,
      );
      return { success: false, orderNumber: order.orderNumber };
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Atomic update — only succeeds if status is still refundable
      const { count } = await tx.order.updateMany({
        where: {
          id: order.id,
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        },
        data: { status: 'REFUNDED' },
      });

      if (count === 0) {
        this.logger.log(
          `Webhook: Order ${order.orderNumber} status changed before refund, skipping`,
        );
        return;
      }

      // 2. Create REFUNDED event
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          sellerId: order.sellerId,
          eventType: 'REFUNDED',
          description: `Refund processed via ${paymentMethod} webhook. Refund ID: ${refundId}`,
        },
      });

      // 3. Restore stock for each variant
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stockQuantity: { increment: item.quantity },
            },
          });
        }
      }
    });

    this.logger.log(
      `Webhook: Order ${order.orderNumber} refunded + stock restored. Refund: ${refundId}`,
    );

    return { success: true, orderNumber: order.orderNumber };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ORDER BY PAYMENT ID
  // ─────────────────────────────────────────────────────────────────────────

  async findOrderByPaymentId(
    paymentId: string,
  ): Promise<{ orderId: string; sellerId: string } | null> {
    const order = await this.prisma.order.findFirst({
      where: { paymentId },
      select: { id: true, sellerId: true },
    });
    return order ? { orderId: order.id, sellerId: order.sellerId } : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // F.3: SEND ORDER CONFIRMATION EMAIL (fire-and-forget helper)
  // ─────────────────────────────────────────────────────────────────────────

  private async sendOrderConfirmationEmail(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        total: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        currency: true,
        paymentMethod: true,
        shippingAddress: true,
        seller: { select: { name: true, slug: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });

    if (!order) return;

    const addr = (order.shippingAddress ?? {}) as Record<string, string>;

    await this.email.sendOrderConfirmation({
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? 'Customer',
      customerEmail: order.customerEmail,
      items: order.items.map((i) => ({
        productName: i.product?.name ?? 'Product',
        variantName: i.variant?.name ?? null,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      currency: order.currency,
      paymentMethod: order.paymentMethod ?? 'stripe',
      shippingAddress: {
        street: addr.street ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
        zip: addr.zip ?? '',
        country: addr.country ?? '',
      },
      storeName: order.seller.name,
      storeSlug: order.seller.slug,
    });
  }
}
