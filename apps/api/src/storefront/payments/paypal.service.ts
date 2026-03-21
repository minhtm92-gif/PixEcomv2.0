import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PayPalGatewayConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
}

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

  /** Fallback credentials from .env (backward compat for legacy orders) */
  private readonly fallbackConfig: PayPalGatewayConfig;

  /** Per-gateway token cache keyed by clientId */
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    this.fallbackConfig = {
      clientId: this.config.get<string>('PAYPAL_CLIENT_ID', ''),
      clientSecret: this.config.get<string>('PAYPAL_CLIENT_SECRET', ''),
      mode: mode === 'live' ? 'live' : 'sandbox',
    };
  }

  private getBaseUrl(mode: 'sandbox' | 'live'): string {
    return mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  async createOrder(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
    gatewayConfig?: PayPalGatewayConfig,
  ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
    const cfg = gatewayConfig ?? this.fallbackConfig;
    const baseUrl = this.getBaseUrl(cfg.mode);
    const token = await this.getAccessToken(cfg);

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
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

    this.logger.log(`PayPal order created: ${data.id} (mode=${cfg.mode})`);

    return {
      paypalOrderId: data.id,
      approvalUrl: approvalLink?.href ?? '',
    };
  }

  async captureOrder(
    paypalOrderId: string,
    gatewayConfig?: PayPalGatewayConfig,
  ): Promise<{ status: string; transactionId: string }> {
    const cfg = gatewayConfig ?? this.fallbackConfig;
    const baseUrl = this.getBaseUrl(cfg.mode);
    const token = await this.getAccessToken(cfg);

    const res = await fetch(
      `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
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

    const data = (await res.json()) as Record<string, unknown>;
    const purchaseUnits = data.purchase_units as Array<Record<string, unknown>> | undefined;
    const payments = purchaseUnits?.[0]?.payments as Record<string, unknown> | undefined;
    const captures = payments?.captures as Array<Record<string, unknown>> | undefined;
    const capture = captures?.[0] ?? {};

    return {
      status: data.status as string,
      transactionId: (capture.id as string) ?? paypalOrderId,
    };
  }

  private async getAccessToken(gatewayConfig?: PayPalGatewayConfig): Promise<string> {
    const cfg = gatewayConfig ?? this.fallbackConfig;
    const cacheKey = cfg.clientId;

    const cached = this.tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    const baseUrl = this.getBaseUrl(cfg.mode);
    const credentials = Buffer.from(
      `${cfg.clientId}:${cfg.clientSecret}`,
    ).toString('base64');

    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
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
    const token = data.access_token;
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;

    this.tokenCache.set(cacheKey, { token, expiresAt });

    return token;
  }
}
