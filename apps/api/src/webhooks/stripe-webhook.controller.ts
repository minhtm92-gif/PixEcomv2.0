import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { WebhookService } from './webhook.service';

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - payment_intent.succeeded → confirm order + decrement stock
 * - charge.refunded          → refund order + restore stock
 *
 * Uses raw body for signature verification (must be configured in main.ts).
 */
@Controller('webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly webhookService: WebhookService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY', ''),
    );
    this.webhookSecret = this.config.get<string>(
      'STRIPE_WEBHOOK_SECRET',
      '',
    );
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    // ── 1. Verify signature ──────────────────────────────────────────────
    if (!this.webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not configured — rejecting');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;
    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        this.logger.error('No raw body available — check rawBody config');
        return res.status(400).json({ error: 'Missing raw body' });
      }
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: any) {
      this.logger.error(`Stripe signature verification failed: ${err.message}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    this.logger.log(`Stripe webhook received: ${event.type} [${event.id}]`);

    // ── 2. Route by event type ───────────────────────────────────────────
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      this.logger.error(
        `Error processing ${event.type}: ${err.message}`,
        err.stack,
      );
      // Return 200 anyway to prevent Stripe retries on app errors
      // (Stripe would keep retrying on 5xx, causing duplicate processing)
    }

    return res.status(200).json({ received: true });
  }

  // ─── Event handlers ──────────────────────────────────────────────────────

  private async handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
    const orderId = pi.metadata?.orderId;
    if (!orderId) {
      // Fallback: find order by paymentId
      const found = await this.webhookService.findOrderByPaymentId(pi.id);
      if (!found) {
        this.logger.warn(`PI ${pi.id}: no orderId in metadata and no matching order`);
        return;
      }
      const result = await this.webhookService.confirmOrder(
        found.orderId,
        pi.id,
        'stripe',
      );
      this.logger.log(`PI ${pi.id} → Order ${result.orderNumber} confirmed (fallback)`);
      return;
    }

    const result = await this.webhookService.confirmOrder(
      orderId,
      pi.id,
      'stripe',
    );
    this.logger.log(`PI ${pi.id} → Order ${result.orderNumber} confirmed`);
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    const piId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!piId) {
      this.logger.warn(`Charge ${charge.id}: no payment_intent reference`);
      return;
    }

    // Find order by PI's paymentId (stored in order.paymentId)
    const found = await this.webhookService.findOrderByPaymentId(piId);
    if (!found) {
      this.logger.warn(`Charge ${charge.id}: no order found for PI ${piId}`);
      return;
    }

    const refundId = charge.refunds?.data?.[0]?.id ?? charge.id;
    const result = await this.webhookService.refundOrder(
      found.orderId,
      refundId,
      'stripe',
    );
    this.logger.log(
      `Charge ${charge.id} refund → Order ${result.orderNumber} refunded`,
    );
  }
}
