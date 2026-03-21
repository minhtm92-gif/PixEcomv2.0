import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
  Logger,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { WebhookService } from './webhook.service';

/**
 * POST /api/webhooks/paypal
 *
 * Handles PayPal webhook events:
 * - CHECKOUT.ORDER.APPROVED          → (info only — capture already happens client-side)
 * - PAYMENT.CAPTURE.COMPLETED        → confirm order + decrement stock
 * - PAYMENT.CAPTURE.REFUNDED         → refund order + restore stock
 * - PAYMENT.CAPTURE.REVERSED         → refund order + restore stock
 *
 * Uses PayPal's verification API to validate webhook signatures.
 */
@Controller('webhooks')
export class PayPalWebhookController {
  private readonly logger = new Logger(PayPalWebhookController.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly webhookService: WebhookService,
  ) {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET', '');
    this.webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID', '');
  }

  @Post('paypal')
  async handlePayPalWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    // ── 1. Verify webhook signature ──────────────────────────────────────
    if (!this.webhookId) {
      this.logger.warn('PAYPAL_WEBHOOK_ID not configured — rejecting');
      return res.status(500).json({ error: 'Webhook ID not configured' });
    }

    const verified = await this.verifyWebhookSignature(headers, body);
    if (!verified) {
      this.logger.error('PayPal webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const eventType = body.event_type as string;
    this.logger.log(`PayPal webhook received: ${eventType} [${body.id}]`);

    // ── 2. Route by event type ───────────────────────────────────────────
    try {
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handleCaptureCompleted(body.resource);
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
        case 'PAYMENT.CAPTURE.REVERSED':
          await this.handleCaptureRefunded(body.resource, eventType);
          break;

        case 'CHECKOUT.ORDER.APPROVED':
          this.logger.log(
            `PayPal order approved: ${body.resource?.id} (info only)`,
          );
          break;

        default:
          this.logger.log(`Unhandled PayPal event: ${eventType}`);
      }
    } catch (err: any) {
      this.logger.error(
        `Error processing ${eventType}: ${err.message}`,
        err.stack,
      );
    }

    return res.status(200).json({ received: true });
  }

  // ─── Event handlers ──────────────────────────────────────────────────────

  private async handleCaptureCompleted(resource: any) {
    // resource.custom_id = orderId (set in PayPalPaymentService.createOrder)
    const orderId = resource?.custom_id;
    const captureId = resource?.id;

    if (!orderId) {
      // Fallback: try supplementary_data or find by paymentId
      const ppOrderId = resource?.supplementary_data?.related_ids?.order_id;
      if (ppOrderId) {
        const found = await this.webhookService.findOrderByPaymentId(ppOrderId);
        if (found) {
          await this.webhookService.confirmOrder(found.orderId, captureId, 'paypal');
          this.logger.log(`PayPal capture ${captureId} → confirmed via ppOrderId`);
          return;
        }
      }
      this.logger.warn(`PayPal capture ${captureId}: no orderId found`);
      return;
    }

    const result = await this.webhookService.confirmOrder(
      orderId,
      captureId,
      'paypal',
    );
    this.logger.log(
      `PayPal capture ${captureId} → Order ${result.orderNumber} confirmed`,
    );
  }

  private async handleCaptureRefunded(resource: any, eventType: string) {
    // For refunds, resource is the refund object; the capture is in links
    const refundId = resource?.id;

    // Try to find the order via the original capture's custom_id
    // PayPal refund events have links to the original capture
    const captureLink = resource?.links?.find(
      (l: any) => l.rel === 'up' && l.href?.includes('/captures/'),
    );

    let orderId: string | null = null;

    if (captureLink?.href) {
      // Extract capture ID from the link
      const captureId = captureLink.href.split('/captures/')[1]?.split('?')[0];
      if (captureId) {
        // PayPal captures don't directly reference our order;
        // look up by the PayPal order ID stored in order.paymentId
        // We need to search more broadly
        this.logger.log(
          `PayPal refund ${refundId}: looking up capture ${captureId}`,
        );
      }
    }

    // Fallback: find order by custom_id on the resource
    if (!orderId && resource?.custom_id) {
      orderId = resource.custom_id;
    }

    // Second fallback: search by the PayPal invoice_id if present
    if (!orderId && resource?.invoice_id) {
      const found = await this.webhookService.findOrderByPaymentId(
        resource.invoice_id,
      );
      if (found) {
        orderId = found.orderId;
      }
    }

    if (!orderId) {
      this.logger.warn(
        `PayPal ${eventType} ${refundId}: cannot determine orderId`,
      );
      return;
    }

    const result = await this.webhookService.refundOrder(
      orderId,
      refundId,
      'paypal',
    );
    this.logger.log(
      `PayPal ${eventType} ${refundId} → Order ${result.orderNumber} refunded`,
    );
  }

  // ─── PayPal signature verification ────────────────────────────────────────

  private async verifyWebhookSignature(
    headers: Record<string, string>,
    body: any,
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      const verifyPayload = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: body,
      };

      const res = await fetch(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(verifyPayload),
        },
      );

      if (!res.ok) {
        const errBody = await res.text();
        this.logger.error(
          `PayPal verify-webhook-signature failed: ${res.status} ${errBody}`,
        );
        return false;
      }

      const data = (await res.json()) as {
        verification_status: string;
      };

      return data.verification_status === 'SUCCESS';
    } catch (err: any) {
      this.logger.error(
        `PayPal webhook verification error: ${err.message}`,
      );
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      throw new Error(`PayPal auth error: ${res.status}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.cachedToken;
  }
}
