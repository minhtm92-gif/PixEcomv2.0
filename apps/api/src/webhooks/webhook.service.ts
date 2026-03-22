import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailSendService } from '../email-marketing/email-send.service';
import { WebhookOutboundService } from '../webhook-outbound/webhook-outbound.service';
import { PixanaTrackingService } from '../pixana-tracking/pixana-tracking.service';

/**
 * Shared service for webhook handlers — order confirmation + stock decrement.
 * Used by both Stripe and PayPal webhook controllers.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly emailMarketingEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly emailSend: EmailSendService,
    private readonly webhookOutbound: WebhookOutboundService,
    private readonly pixanaTracking: PixanaTrackingService,
    private readonly config: ConfigService,
  ) {
    this.emailMarketingEnabled =
      this.config.get<string>('EMAIL_MARKETING_ENABLED') === 'true';
  }

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

    // F.3: Send order confirmation email + dispatch outbound webhook (fire-and-forget)
    if (confirmed) {
      if (this.emailMarketingEnabled) {
        this.queueOrderConfirmationEmail(order.id).catch((err) =>
          this.logger.error(`Webhook: Failed to queue confirmation email: ${err.message}`),
        );
      } else {
        this.sendOrderConfirmationEmail(order.id).catch((err) =>
          this.logger.error(`Webhook: Failed to send confirmation email: ${err.message}`),
        );
      }

      // Cancel any pending cart/checkout recovery emails for this customer
      this.cancelRecoveryEmails(order.id).catch((err) =>
        this.logger.error(`Webhook: Failed to cancel recovery emails: ${err.message}`),
      );

      this.webhookOutbound.dispatchOrderEvent(order.sellerId, 'order.confirmed', order.id).catch((err) =>
        this.logger.error(`Webhook outbound failed: ${err.message}`),
      );

      // BUG-001 FIX: Send order.paid to PixAna for revenue attribution (fire-and-forget)
      this.pixanaTracking.sendOrderEvent('order.paid', order.id).catch((err) =>
        this.logger.error(`PixAna order.paid tracking failed: ${err.message}`),
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

    // Send refund confirmation email (fire-and-forget)
    if (this.emailMarketingEnabled) {
      this.queueRefundConfirmationEmail(order.id).catch((err) =>
        this.logger.error(`Webhook: Failed to queue refund email: ${err.message}`),
      );
    }

    // Dispatch outbound webhook (fire-and-forget)
    this.webhookOutbound.dispatchOrderEvent(order.sellerId, 'order.refunded', order.id).catch((err) =>
      this.logger.error(`Webhook outbound failed: ${err.message}`),
    );

    // BUG-001 FIX: Send order.refunded to PixAna to reverse revenue attribution (fire-and-forget)
    this.pixanaTracking.sendOrderEvent('order.refunded', order.id).catch((err) =>
      this.logger.error(`PixAna order.refunded tracking failed: ${err.message}`),
    );

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
  // F.3: SEND ORDER CONFIRMATION EMAIL (fire-and-forget helper — legacy)
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

  // ─────────────────────────────────────────────────────────────────────────
  // EMAIL MARKETING: QUEUE ORDER CONFIRMATION (T1)
  // ─────────────────────────────────────────────────────────────────────────

  private async queueOrderConfirmationEmail(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        sellerId: true,
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        total: true,
        subtotal: true,
        shippingCost: true,
        currency: true,
        shippingAddress: true,
        seller: { select: { name: true, slug: true } },
        sellpage: {
          select: {
            slug: true,
            domain: { select: { hostname: true } },
          },
        },
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

    const firstName = (order.customerName ?? 'Customer').split(' ')[0];
    const addr = (order.shippingAddress ?? {}) as Record<string, string>;
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const trackingUrl = `${frontendUrl}/${order.seller.slug}/trackings/search`;

    const items = order.items.map((i) => ({
      productName: i.product?.name ?? 'Product',
      variantName: i.variant?.name ?? null,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    }));

    const shippingAddressStr = [
      addr.street,
      addr.line2,
      `${addr.city ?? ''}, ${addr.state ?? ''} ${addr.zip ?? ''}`,
      addr.country,
    ]
      .filter(Boolean)
      .join('<br>');

    const settings = await this.prisma.sellerSettings.findUnique({
      where: { sellerId: order.sellerId },
      select: { supportEmail: true },
    });

    await this.emailSend.queueEmail({
      sellerId: order.sellerId,
      toEmail: order.customerEmail,
      toName: order.customerName ?? undefined,
      flowId: 'order_confirmation',
      subject: `Order #${order.orderNumber} Confirmed — Thank You, ${firstName}!`,
      priority: 1,
      variables: {
        first_name: firstName,
        order_number: order.orderNumber,
        items_html: this.emailSend.buildItemsHtml(items),
        subtotal: `$${Number(order.subtotal).toFixed(2)}`,
        shipping_cost: Number(order.shippingCost) > 0 ? `$${Number(order.shippingCost).toFixed(2)}` : 'Free',
        total: `$${Number(order.total).toFixed(2)} ${order.currency}`,
        shipping_address: shippingAddressStr,
        tracking_url: trackingUrl,
        store_name: order.seller.name,
        support_phone: '',
        support_email: settings?.supportEmail ?? '',
        email: order.customerEmail,
        unsubscribe_url: this.emailSend.buildUnsubscribeUrl(order.customerEmail, order.sellerId),
      },
    });

    this.logger.log(
      `Queued order_confirmation email for ${order.customerEmail} (order ${order.orderNumber})`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMAIL MARKETING: QUEUE REFUND CONFIRMATION (T5)
  // ─────────────────────────────────────────────────────────────────────────

  private async queueRefundConfirmationEmail(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        sellerId: true,
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        total: true,
        currency: true,
        paymentMethod: true,
        seller: { select: { name: true } },
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

    const firstName = (order.customerName ?? 'Customer').split(' ')[0];

    const items = order.items.map((i) => ({
      productName: i.product?.name ?? 'Product',
      variantName: i.variant?.name ?? null,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    }));

    const settings = await this.prisma.sellerSettings.findUnique({
      where: { sellerId: order.sellerId },
      select: { supportEmail: true },
    });

    await this.emailSend.queueEmail({
      sellerId: order.sellerId,
      toEmail: order.customerEmail,
      toName: order.customerName ?? undefined,
      flowId: 'refund_confirmation',
      subject: `Refund Processed — Order #${order.orderNumber}`,
      priority: 1,
      variables: {
        first_name: firstName,
        order_number: order.orderNumber,
        refund_amount: `$${Number(order.total).toFixed(2)} ${order.currency}`,
        original_total: `$${Number(order.total).toFixed(2)} ${order.currency}`,
        payment_method: order.paymentMethod === 'stripe' ? 'Credit Card' : (order.paymentMethod ?? 'Original Payment Method'),
        items_html: this.emailSend.buildItemsHtml(items),
        store_name: order.seller.name,
        support_phone: '',
        support_email: settings?.supportEmail ?? '',
        email: order.customerEmail,
        unsubscribe_url: this.emailSend.buildUnsubscribeUrl(order.customerEmail, order.sellerId),
      },
    });

    this.logger.log(
      `Queued refund_confirmation email for ${order.customerEmail} (order ${order.orderNumber})`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CANCEL RECOVERY EMAILS ON PURCHASE
  // ─────────────────────────────────────────────────────────────────────────

  private async cancelRecoveryEmails(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true, customerEmail: true },
    });

    if (!order) return;

    const { cancelledCount } = await this.emailSend.cancelPendingEmails(
      order.sellerId,
      order.customerEmail,
    );

    if (cancelledCount > 0) {
      this.logger.log(
        `Cancelled ${cancelledCount} pending recovery email(s) for ${order.customerEmail} after order confirmation`,
      );
    }
  }
}
