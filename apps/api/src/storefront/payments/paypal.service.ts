import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PayPalAccessToken {
  access_token: string;
  expires_in: number;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

@Injectable()
export class PayPalPaymentService {
  private readonly logger = new Logger(PayPalPaymentService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET', '');
  }

  async createOrder(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            custom_id: metadata.orderId ?? '',
            description: metadata.orderNumber ?? 'PixEcom Order',
          },
        ],
        application_context: {
          brand_name: 'PixEcom',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`PayPal createOrder failed: ${res.status} ${body}`);
      throw new Error(`PayPal API error: ${res.status}`);
    }

    const data = (await res.json()) as PayPalOrderResponse;
    const approvalLink = data.links.find((l) => l.rel === 'approve');

    this.logger.log(`PayPal order created: ${data.id}`);

    return {
      paypalOrderId: data.id,
      approvalUrl: approvalLink?.href ?? '',
    };
  }

  async captureOrder(
    paypalOrderId: string,
  ): Promise<{ status: string; transactionId: string }> {
    const token = await this.getAccessToken();

    const res = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`PayPal captureOrder failed: ${res.status} ${body}`);
      throw new Error(`PayPal capture error: ${res.status}`);
    }

    const data = (await res.json()) as any;
    const capture =
      data.purchase_units?.[0]?.payments?.captures?.[0] ?? {};

    return {
      status: data.status as string,
      transactionId: (capture.id as string) ?? paypalOrderId,
    };
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

    const data = (await res.json()) as PayPalAccessToken;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.cachedToken;
  }
}
