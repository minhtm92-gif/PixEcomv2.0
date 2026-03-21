import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  shippingAddress: {
    street: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    countryCode?: string;
  };
  storeName: string;
  storeSlug: string;
}

export interface ShippingEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: OrderItem[];
  storeName: string;
  storeSlug: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    this.fromEmail =
      this.config.get<string>('SENDGRID_FROM_EMAIL') ?? 'noreply@pixelxlab.com';

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.enabled = true;
      this.logger.log('SendGrid email service initialized');
    } else {
      this.enabled = false;
      this.logger.warn(
        'SENDGRID_API_KEY not set — email sending is disabled',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Send order confirmation email
  // ─────────────────────────────────────────────────────────────────────────

  async sendOrderConfirmation(data: OrderEmailData): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `[dry-run] Order confirmation would be sent to ${data.customerEmail} for ${data.orderNumber}`,
      );
      return;
    }

    try {
      await sgMail.send({
        to: data.customerEmail,
        from: { email: this.fromEmail, name: data.storeName },
        subject: `Order Confirmed - ${data.orderNumber}`,
        html: this.buildOrderConfirmationHtml(data),
      });
      this.logger.log(
        `Order confirmation sent to ${data.customerEmail} for ${data.orderNumber}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to send order confirmation to ${data.customerEmail}: ${err.message}`,
        err.stack,
      );
      // Don't throw — email failure should not break the order flow
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Send shipping notification email
  // ─────────────────────────────────────────────────────────────────────────

  async sendShippingNotification(data: ShippingEmailData): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `[dry-run] Shipping notification would be sent to ${data.customerEmail} for ${data.orderNumber}`,
      );
      return;
    }

    try {
      await sgMail.send({
        to: data.customerEmail,
        from: { email: this.fromEmail, name: data.storeName },
        subject: `Your Order Has Shipped - ${data.orderNumber}`,
        html: this.buildShippingNotificationHtml(data),
      });
      this.logger.log(
        `Shipping notification sent to ${data.customerEmail} for ${data.orderNumber}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to send shipping notification to ${data.customerEmail}: ${err.message}`,
        err.stack,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Send raw email (used by email-marketing module)
  // ─────────────────────────────────────────────────────────────────────────

  async sendRawEmail(params: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    fromName?: string;
  }): Promise<{ messageId?: string }> {
    if (!this.enabled) {
      this.logger.debug(
        `[dry-run] Raw email would be sent to ${params.to}: ${params.subject}`,
      );
      return {};
    }

    try {
      const [response] = await sgMail.send({
        to: params.toName
          ? { email: params.to, name: params.toName }
          : params.to,
        from: {
          email: this.fromEmail,
          name: params.fromName ?? 'Store',
        },
        subject: params.subject,
        html: params.html,
      });
      this.logger.log(`Raw email sent to ${params.to}: ${params.subject}`);
      const messageId = response?.headers?.['x-message-id'] as
        | string
        | undefined;
      return { messageId };
    } catch (err: any) {
      this.logger.error(
        `Failed to send raw email to ${params.to}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: HTML Templates
  // ─────────────────────────────────────────────────────────────────────────

  private buildOrderConfirmationHtml(data: OrderEmailData): string {
    const itemRows = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">
            ${this.esc(item.productName)}${item.variantName ? ` <span style="color:#888">- ${this.esc(item.variantName)}</span>` : ''}
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center">${item.quantity}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right">$${item.lineTotal.toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    const addr = data.shippingAddress;
    const trackingUrl = `${this.getBaseUrl()}/${data.storeSlug}/trackings/search`;

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">${this.esc(data.storeName)}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Order Confirmation</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px">
      <p style="margin:0 0 4px;font-size:16px;color:#333">Hi ${this.esc(data.customerName)},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6">
        Thank you for your order! We've received your payment and your order is being processed.
      </p>

      <!-- Order Number Badge -->
      <div style="background:#f5f3ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:600">Order Number</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#5b21b6">${this.esc(data.orderNumber)}</p>
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#fafafa">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Item</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="border-top:2px solid #f0f0f0;padding-top:16px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#666">Subtotal</td>
            <td style="padding:4px 0;font-size:14px;color:#333;text-align:right">$${data.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#666">Shipping</td>
            <td style="padding:4px 0;font-size:14px;color:#333;text-align:right">${data.shippingCost > 0 ? `$${data.shippingCost.toFixed(2)}` : 'Free'}</td>
          </tr>
          ${data.discountAmount > 0 ? `
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#16a34a">Discount</td>
            <td style="padding:4px 0;font-size:14px;color:#16a34a;text-align:right">-$${data.discountAmount.toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:8px 0 0;font-size:18px;font-weight:700;color:#111">Total</td>
            <td style="padding:8px 0 0;font-size:18px;font-weight:700;color:#111;text-align:right">$${data.total.toFixed(2)} ${data.currency}</td>
          </tr>
        </table>
      </div>

      <!-- Shipping Address -->
      <div style="background:#fafafa;border-radius:8px;padding:16px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Shipping to</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.6">
          ${this.esc(data.customerName)}<br>
          ${this.esc(addr.street)}${addr.line2 ? `<br>${this.esc(addr.line2)}` : ''}<br>
          ${this.esc(addr.city)}, ${this.esc(addr.state)} ${this.esc(addr.zip)}<br>
          ${this.esc(addr.country)}
        </p>
      </div>

      <!-- Payment Method -->
      <p style="margin:0 0 24px;font-size:13px;color:#888">
        Paid via <strong>${this.esc(data.paymentMethod === 'stripe' ? 'Credit Card' : 'PayPal')}</strong>
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:8px">
        <a href="${trackingUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Track Your Order</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0">
      <p style="margin:0;font-size:12px;color:#999">
        This email was sent by ${this.esc(data.storeName)}. If you have questions, reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildShippingNotificationHtml(data: ShippingEmailData): string {
    const itemList = data.items
      .map(
        (item) =>
          `<li style="padding:8px 0;font-size:14px;color:#333;border-bottom:1px solid #f0f0f0">
            ${this.esc(item.productName)}${item.variantName ? ` <span style="color:#888">- ${this.esc(item.variantName)}</span>` : ''} x${item.quantity}
          </li>`,
      )
      .join('');

    const trackingUrl = `${this.getBaseUrl()}/${data.storeSlug}/trackings/search`;

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">${this.esc(data.storeName)}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Shipping Update</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:8px">📦</div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Your Order Has Shipped!</h2>
        <p style="margin:0;font-size:14px;color:#666">Order ${this.esc(data.orderNumber)} is on its way to you.</p>
      </div>

      ${data.trackingNumber ? `
      <!-- Tracking Info -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;font-weight:600">Tracking Number</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#15803d">${this.esc(data.trackingNumber)}</p>
        ${data.trackingUrl ? `<a href="${this.esc(data.trackingUrl)}" style="display:inline-block;margin-top:8px;font-size:13px;color:#7c3aed;text-decoration:underline">Track with carrier</a>` : ''}
      </div>` : ''}

      <!-- Items -->
      <div style="margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Items Shipped</p>
        <ul style="list-style:none;margin:0;padding:0">${itemList}</ul>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:8px">
        <a href="${trackingUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Track Your Order</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0">
      <p style="margin:0;font-size:12px;color:#999">
        This email was sent by ${this.esc(data.storeName)}. If you have questions, reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getBaseUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }
}
