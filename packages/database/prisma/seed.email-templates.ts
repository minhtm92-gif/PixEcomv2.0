/**
 * Seed: Default Email Templates for PixEcom Email Marketing
 *
 * Inserts 12 default EmailTemplate records (sellerId = null, isDefault = true).
 * Designed for senior demographics (45-75+): large fonts, high contrast,
 * single-column layout, trust elements in every email.
 *
 * Run standalone:  tsx prisma/seed.email-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Shared HTML fragments ─────────────────────────────────────────────────────

const HEADER = (subtitle: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{store_name}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Georgia,'Times New Roman',serif;color:#333333;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px 12px 0 0;padding:36px 30px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.5px;">{{store_name}}</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">${subtitle}</p>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:36px 30px;border-radius:0 0 12px 12px;">`;

const FOOTER = `
      <!-- Trust Bar -->
      <div style="margin-top:32px;padding-top:24px;border-top:2px solid #f0f0f0;text-align:center;">
        <p style="margin:0 0 6px;font-size:14px;color:#7c3aed;font-weight:600;">100% Money-Back Guarantee</p>
        <p style="margin:0;font-size:16px;color:#555;">Questions? Call us: <strong>{{support_phone}}</strong></p>
        <p style="margin:6px 0 0;font-size:16px;color:#555;">Or email: <a href="mailto:{{support_email}}" style="color:#7c3aed;text-decoration:underline;">{{support_email}}</a></p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:28px 20px;">
      <p style="margin:0 0 8px;font-size:14px;color:#888888;">{{store_name}}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#888888;">{{store_address}}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#888888;">This email was sent to {{email}}</p>
      <p style="margin:0;font-size:14px;">
        <a href="{{unsubscribe_url}}" style="color:#7c3aed;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

const CTA_BUTTON = (url: string, label: string) =>
  `<div style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:18px;font-weight:700;font-family:Georgia,'Times New Roman',serif;min-width:200px;min-height:48px;line-height:1.4;">${label}</a>
      </div>`;

const CTA_BUTTON_GREEN = (url: string, label: string) =>
  `<div style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:18px;font-weight:700;font-family:Georgia,'Times New Roman',serif;min-width:200px;min-height:48px;line-height:1.4;">${label}</a>
      </div>`;

// ─── Template definitions ───────────────────────────────────────────────────────

interface TemplateDef {
  flowId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

const templates: TemplateDef[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. ORDER CONFIRMATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'order_confirmation',
    name: 'Order Confirmation',
    subject: 'Order #{{order_number}} Confirmed — Thank You, {{first_name}}!',
    htmlBody: `${HEADER('Order Confirmation')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 24px;font-size:18px;color:#555555;">
        Thank you for your order! We have received your payment and your order is now being prepared.
      </p>

      <!-- Order Number Badge -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Order Number</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#5b21b6;">{{order_number}}</p>
      </div>

      <!-- Items -->
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Items Ordered</p>
        {{items_html}}
      </div>

      <!-- Totals -->
      <div style="background:#fafafa;border-radius:8px;padding:20px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:18px;color:#555555;">Subtotal</td>
            <td style="padding:6px 0;font-size:18px;color:#333333;text-align:right;">{{subtotal}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:18px;color:#555555;">Shipping</td>
            <td style="padding:6px 0;font-size:18px;color:#333333;text-align:right;">{{shipping_cost}}</td>
          </tr>
          <tr>
            <td style="padding:10px 0 0;font-size:22px;font-weight:700;color:#111111;border-top:2px solid #e0e0e0;">Total</td>
            <td style="padding:10px 0 0;font-size:22px;font-weight:700;color:#111111;text-align:right;border-top:2px solid #e0e0e0;">{{total}}</td>
          </tr>
        </table>
      </div>

      <!-- Shipping Address -->
      <div style="background:#fafafa;border-radius:8px;padding:20px;margin-bottom:28px;">
        <p style="margin:0 0 10px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Shipping To</p>
        <p style="margin:0;font-size:18px;color:#333333;line-height:1.6;">{{shipping_address}}</p>
      </div>

      ${CTA_BUTTON('{{tracking_url}}', 'Track Your Order')}

      <p style="margin:0;font-size:16px;color:#555555;text-align:center;">
        We will send you another email when your order ships.
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

Thank you for your order! We have received your payment and your order is now being prepared.

ORDER NUMBER: {{order_number}}

Items Ordered:
{{items_text}}

Subtotal: {{subtotal}}
Shipping: {{shipping_cost}}
Total: {{total}}

Shipping To:
{{shipping_address}}

Track Your Order: {{tracking_url}}

We will send you another email when your order ships.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. SHIPPING CONFIRMATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'shipping_confirmation',
    name: 'Shipping Confirmation',
    subject: 'Great News! Your Order #{{order_number}} Has Shipped',
    htmlBody: `${HEADER('Shipping Update')}
      <div style="text-align:center;margin-bottom:28px;">
        <p style="font-size:48px;margin:0 0 12px;">&#128230;</p>
        <h2 style="margin:0 0 8px;font-size:26px;color:#111111;">Your Order Has Shipped!</h2>
        <p style="margin:0;font-size:18px;color:#555555;">Order #{{order_number}} is on its way to you.</p>
      </div>

      <!-- Tracking Info -->
      <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:14px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Tracking Number</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#15803d;">{{tracking_number}}</p>
      </div>

      <!-- Estimated Delivery -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Estimated Delivery</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#5b21b6;">{{estimated_delivery}}</p>
      </div>

      <!-- Items -->
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Items in This Shipment</p>
        {{items_html}}
      </div>

      ${CTA_BUTTON('{{tracking_url}}', 'Track Your Package')}

      <p style="margin:0;font-size:16px;color:#555555;text-align:center;">
        You can also track your order by visiting our website and entering your tracking number.
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

Great news! Your order #{{order_number}} has shipped!

TRACKING NUMBER: {{tracking_number}}
ESTIMATED DELIVERY: {{estimated_delivery}}

Track Your Package: {{tracking_url}}

Items in This Shipment:
{{items_text}}

You can also track your order by visiting our website.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. DELIVERY CONFIRMATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'delivery_confirmation',
    name: 'Delivery Confirmation',
    subject: 'Your Order #{{order_number}} Has Been Delivered!',
    htmlBody: `${HEADER('Delivery Confirmation')}
      <div style="text-align:center;margin-bottom:28px;">
        <p style="font-size:48px;margin:0 0 12px;">&#127881;</p>
        <h2 style="margin:0 0 8px;font-size:26px;color:#111111;">Your Order Has Been Delivered!</h2>
        <p style="margin:0;font-size:18px;color:#555555;">Order #{{order_number}} has arrived at your doorstep.</p>
      </div>

      <!-- Items Delivered -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Items Delivered</p>
        {{items_html}}
      </div>

      <!-- How's Your Product -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px;">
        <h3 style="margin:0 0 10px;font-size:22px;color:#5b21b6;">How's Your Product?</h3>
        <p style="margin:0;font-size:18px;color:#555555;line-height:1.6;">
          We hope you love your purchase! Your feedback helps us improve and helps other customers make informed decisions.
        </p>
      </div>

      ${CTA_BUTTON('{{review_url}}', 'Share Your Experience')}

      <p style="margin:0;font-size:16px;color:#555555;text-align:center;line-height:1.6;">
        If your package did not arrive or something is not right, please do not hesitate to contact us.
        We are here to help and will make it right.
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

Your order #{{order_number}} has been delivered!

Items Delivered:
{{items_text}}

HOW'S YOUR PRODUCT?
We hope you love your purchase! Your feedback helps us improve and helps other customers make informed decisions.

Share Your Experience: {{review_url}}

If your package did not arrive or something is not right, please contact us. We are here to help and will make it right.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. REFUND CONFIRMATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'refund_confirmation',
    name: 'Refund Confirmation',
    subject: 'Refund Processed — Order #{{order_number}}',
    htmlBody: `${HEADER('Refund Confirmation')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 24px;font-size:18px;color:#555555;line-height:1.6;">
        We have processed your refund. Here are the details:
      </p>

      <!-- Refund Amount Badge -->
      <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:14px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Refund Amount</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#15803d;">{{refund_amount}}</p>
      </div>

      <!-- Order Info -->
      <div style="background:#fafafa;border-radius:8px;padding:20px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:18px;color:#555555;">Order Number</td>
            <td style="padding:8px 0;font-size:18px;color:#333333;text-align:right;font-weight:600;">{{order_number}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:18px;color:#555555;">Original Total</td>
            <td style="padding:8px 0;font-size:18px;color:#333333;text-align:right;font-weight:600;">{{original_total}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:18px;color:#555555;">Refund Method</td>
            <td style="padding:8px 0;font-size:18px;color:#333333;text-align:right;font-weight:600;">{{payment_method}}</td>
          </tr>
        </table>
      </div>

      <!-- Processing Time -->
      <div style="background:#fffbeb;border:2px solid #fde68a;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:16px;color:#92400e;font-weight:700;">Processing Time</p>
        <p style="margin:0;font-size:18px;color:#78350f;line-height:1.6;">
          Please allow <strong>5-10 business days</strong> for the refund to appear on your statement, depending on your bank or payment provider.
        </p>
      </div>

      <p style="margin:0;font-size:18px;color:#555555;text-align:center;line-height:1.6;">
        We are sorry to see this order returned. If there is anything we can do to improve your experience, please let us know.
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We have processed your refund. Here are the details:

REFUND AMOUNT: {{refund_amount}}
ORDER NUMBER: {{order_number}}
ORIGINAL TOTAL: {{original_total}}
REFUND METHOD: {{payment_method}}

PROCESSING TIME:
Please allow 5-10 business days for the refund to appear on your statement, depending on your bank or payment provider.

We are sorry to see this order returned. If there is anything we can do to improve your experience, please let us know.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. ORDER DELAY NOTIFICATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'order_delay',
    name: 'Order Delay Notification',
    subject: 'Update on Your Order #{{order_number}}',
    htmlBody: `${HEADER('Order Update')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 24px;font-size:18px;color:#555555;line-height:1.6;">
        We wanted to let you know about an update regarding your order.
      </p>

      <!-- Order Number Badge -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Order Number</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#5b21b6;">{{order_number}}</p>
      </div>

      <!-- Delay Notice -->
      <div style="background:#fffbeb;border:2px solid #fde68a;border-radius:8px;padding:24px;margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:16px;color:#92400e;font-weight:700;">What's Happening</p>
        <p style="margin:0;font-size:18px;color:#78350f;line-height:1.6;">
          {{delay_reason}}
        </p>
      </div>

      <!-- Reassurance -->
      <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:18px;color:#15803d;font-weight:700;">Your Order is Safe</p>
        <p style="margin:0;font-size:18px;color:#166534;line-height:1.6;">
          Rest assured, your order is being processed and we will notify you as soon as it ships. We appreciate your patience.
        </p>
      </div>

      <p style="margin:0;font-size:18px;color:#555555;text-align:center;line-height:1.6;">
        If you have any questions, please do not hesitate to contact our support team. We are here to help.
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We wanted to let you know about an update regarding your order.

ORDER NUMBER: {{order_number}}

WHAT'S HAPPENING:
{{delay_reason}}

YOUR ORDER IS SAFE:
Rest assured, your order is being processed and we will notify you as soon as it ships. We appreciate your patience.

If you have any questions, please contact our support team.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. CART RECOVERY 1 — No discount
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'cart_recovery_1',
    name: 'Cart Recovery — Reminder',
    subject: 'You left something behind, {{first_name}}',
    htmlBody: `${HEADER('Your Cart is Waiting')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        We noticed you left an item in your shopping cart. It is still saved and waiting for you.
      </p>

      <!-- Product Card -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:250px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:20px;text-align:center;">
          <h3 style="margin:0 0 8px;font-size:22px;color:#111111;">{{product_name}}</h3>
          <p style="margin:0;font-size:20px;font-weight:700;color:#7c3aed;">{{product_price}}</p>
        </div>
      </div>

      ${CTA_BUTTON('{{cart_url}}', 'Complete Your Order')}

      <!-- Trust Badges -->
      <div style="text-align:center;margin-top:24px;padding:20px;background:#fafafa;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px;text-align:center;font-size:16px;color:#555555;">
              <strong style="color:#333333;">&#128274; Secure Checkout</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:8px;text-align:center;font-size:16px;color:#555555;">
              <strong style="color:#333333;">&#128176; Money-Back Guarantee</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:8px;text-align:center;font-size:16px;color:#555555;">
              <strong style="color:#333333;">&#128666; Fast, Reliable Shipping</strong>
            </td>
          </tr>
        </table>
      </div>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We noticed you left an item in your shopping cart. It is still saved and waiting for you.

PRODUCT: {{product_name}}
PRICE: {{product_price}}

Complete Your Order: {{cart_url}}

-- Why shop with us --
* Secure Checkout
* Money-Back Guarantee
* Fast, Reliable Shipping

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. CART RECOVERY 2 — Social proof, no discount
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'cart_recovery_2',
    name: 'Cart Recovery — Social Proof',
    subject: 'Your {{product_name}} is still waiting',
    htmlBody: `${HEADER('Still Interested?')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        The {{product_name}} you were looking at is still available. Here is why our customers love it:
      </p>

      <!-- Product Card -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:250px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:20px;text-align:center;">
          <h3 style="margin:0 0 8px;font-size:22px;color:#111111;">{{product_name}}</h3>
          <p style="margin:0;font-size:20px;font-weight:700;color:#7c3aed;">{{product_price}}</p>
        </div>
      </div>

      <!-- Social Proof / Reviews -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:24px;margin-bottom:28px;">
        <div style="text-align:center;margin-bottom:16px;">
          <span style="font-size:24px;color:#f59e0b;">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          <p style="margin:8px 0 0;font-size:16px;color:#7c3aed;font-weight:600;">Loved by Our Customers</p>
        </div>
        <p style="margin:0;font-size:18px;color:#555555;text-align:center;font-style:italic;line-height:1.6;">
          "{{review_quote}}"
        </p>
        <p style="margin:8px 0 0;font-size:16px;color:#888888;text-align:center;">
          — {{reviewer_name}}
        </p>
      </div>

      <!-- Value Proposition -->
      <div style="margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;font-size:18px;color:#333333;border-bottom:1px solid #f0f0f0;">
              &#10003;&nbsp;&nbsp;Premium quality materials
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:18px;color:#333333;border-bottom:1px solid #f0f0f0;">
              &#10003;&nbsp;&nbsp;Thousands of satisfied customers
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:18px;color:#333333;">
              &#10003;&nbsp;&nbsp;100% money-back guarantee
            </td>
          </tr>
        </table>
      </div>

      ${CTA_BUTTON('{{cart_url}}', 'Complete Your Order')}
${FOOTER}`,
    textBody: `Dear {{first_name}},

The {{product_name}} you were looking at is still available. Here is why our customers love it:

PRODUCT: {{product_name}}
PRICE: {{product_price}}

CUSTOMER REVIEW:
"{{review_quote}}"
— {{reviewer_name}}

WHY CHOOSE US:
* Premium quality materials
* Thousands of satisfied customers
* 100% money-back guarantee

Complete Your Order: {{cart_url}}

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. CART RECOVERY 3 — With discount
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'cart_recovery_3',
    name: 'Cart Recovery — Discount Offer',
    subject: 'A special offer — {{discount_percentage}}% off your {{product_name}}',
    htmlBody: `${HEADER('A Special Offer Just for You')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        We would love to help you complete your purchase. As a special thank-you, we are offering you an exclusive discount.
      </p>

      <!-- Discount Badge -->
      <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:16px;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:1px;">Your Exclusive Discount</p>
        <p style="margin:0 0 10px;font-size:42px;font-weight:700;color:#ffffff;">{{discount_percentage}}% OFF</p>
        <p style="margin:0 0 12px;font-size:18px;color:rgba(255,255,255,0.9);">Use code: <strong style="font-size:22px;letter-spacing:2px;">{{discount_code}}</strong></p>
        <p style="margin:0;font-size:16px;color:#fde68a;font-weight:600;">&#9200; Expires in 48 hours</p>
      </div>

      <!-- Product Card -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:250px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:20px;text-align:center;">
          <h3 style="margin:0 0 8px;font-size:22px;color:#111111;">{{product_name}}</h3>
          <p style="margin:0;font-size:20px;font-weight:700;color:#7c3aed;">{{product_price}}</p>
        </div>
      </div>

      ${CTA_BUTTON_GREEN('{{cart_url}}', 'Claim Your Discount')}

      <p style="margin:0;font-size:16px;color:#888888;text-align:center;">
        Your discount is automatically applied when you click the button above.
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We would love to help you complete your purchase. As a special thank-you, here is an exclusive discount:

YOUR EXCLUSIVE DISCOUNT: {{discount_percentage}}% OFF
USE CODE: {{discount_code}}
EXPIRES: In 48 hours

PRODUCT: {{product_name}}
PRICE: {{product_price}}

Claim Your Discount: {{cart_url}}

Your discount is automatically applied when you click the link above.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. CHECKOUT RECOVERY 1 — Help message
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'checkout_recovery_1',
    name: 'Checkout Recovery — Need Help?',
    subject: 'Did something go wrong with your order?',
    htmlBody: `${HEADER('We Are Here to Help')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        We noticed you started to check out but did not complete your order. Sometimes things come up, and that is perfectly okay. If you ran into any trouble, we would love to help.
      </p>

      <!-- Phone Help — Prominently Displayed -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <p style="font-size:36px;margin:0 0 12px;">&#128222;</p>
        <h3 style="margin:0 0 10px;font-size:22px;color:#5b21b6;">Need Help? Give Us a Call</h3>
        <p style="margin:0 0 8px;font-size:26px;font-weight:700;color:#7c3aed;">{{support_phone}}</p>
        <p style="margin:0;font-size:16px;color:#555555;">Our friendly team is ready to assist you.</p>
      </div>

      <!-- Product Reminder -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:200px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:16px;text-align:center;">
          <h3 style="margin:0 0 6px;font-size:20px;color:#111111;">{{product_name}}</h3>
          <p style="margin:0;font-size:18px;font-weight:700;color:#7c3aed;">{{product_price}}</p>
        </div>
      </div>

      ${CTA_BUTTON('{{cart_url}}', 'Complete Your Order')}

      <!-- Trust Badges -->
      <div style="text-align:center;margin-top:24px;padding:20px;background:#fafafa;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px;text-align:center;font-size:16px;color:#555555;">
              <strong style="color:#333333;">&#128274; Secure Checkout</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:8px;text-align:center;font-size:16px;color:#555555;">
              <strong style="color:#333333;">&#128176; Money-Back Guarantee</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:8px;text-align:center;font-size:16px;color:#555555;">
              <strong style="color:#333333;">&#128666; Fast, Reliable Shipping</strong>
            </td>
          </tr>
        </table>
      </div>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We noticed you started to check out but did not complete your order. If you ran into any trouble, we would love to help.

NEED HELP? GIVE US A CALL:
{{support_phone}}
Our friendly team is ready to assist you.

PRODUCT: {{product_name}}
PRICE: {{product_price}}

Complete Your Order: {{cart_url}}

-- Why shop with us --
* Secure Checkout
* Money-Back Guarantee
* Fast, Reliable Shipping

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. CHECKOUT RECOVERY 2 — Trust signals
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'checkout_recovery_2',
    name: 'Checkout Recovery — Trust Signals',
    subject: 'Your order is not yet complete — we are here to help',
    htmlBody: `${HEADER('Your Order Awaits')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        Your order for {{product_name}} is saved and ready to be completed. We understand that shopping online requires trust, so here is what you can count on:
      </p>

      <!-- Trust Signal 1: Money-Back Guarantee -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px;display:flex;">
        <div style="text-align:center;margin-bottom:0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:60px;vertical-align:top;padding-right:16px;font-size:36px;text-align:center;">&#128176;</td>
              <td style="vertical-align:top;">
                <h4 style="margin:0 0 6px;font-size:20px;color:#111111;">Money-Back Guarantee</h4>
                <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">If you are not completely satisfied, we will refund your purchase. No questions asked.</p>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Trust Signal 2: Secure Payment -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:60px;vertical-align:top;padding-right:16px;font-size:36px;text-align:center;">&#128274;</td>
            <td style="vertical-align:top;">
              <h4 style="margin:0 0 6px;font-size:20px;color:#111111;">Secure Payment</h4>
              <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">Your payment information is encrypted and protected with bank-level security.</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Trust Signal 3: Fast Shipping -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:60px;vertical-align:top;padding-right:16px;font-size:36px;text-align:center;">&#128666;</td>
            <td style="vertical-align:top;">
              <h4 style="margin:0 0 6px;font-size:20px;color:#111111;">Fast Shipping</h4>
              <p style="margin:0;font-size:16px;color:#555555;line-height:1.6;">Your order will be shipped promptly with full tracking so you always know where it is.</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Product Reminder -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:200px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:16px;text-align:center;">
          <h3 style="margin:0 0 6px;font-size:20px;color:#111111;">{{product_name}}</h3>
          <p style="margin:0;font-size:18px;font-weight:700;color:#7c3aed;">{{product_price}}</p>
        </div>
      </div>

      ${CTA_BUTTON('{{cart_url}}', 'Complete Your Order')}
${FOOTER}`,
    textBody: `Dear {{first_name}},

Your order for {{product_name}} is saved and ready to be completed. Here is what you can count on:

MONEY-BACK GUARANTEE
If you are not completely satisfied, we will refund your purchase. No questions asked.

SECURE PAYMENT
Your payment information is encrypted and protected with bank-level security.

FAST SHIPPING
Your order will be shipped promptly with full tracking so you always know where it is.

PRODUCT: {{product_name}}
PRICE: {{product_price}}

Complete Your Order: {{cart_url}}

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. CHECKOUT RECOVERY 3 — Discount + urgency
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'checkout_recovery_3',
    name: 'Checkout Recovery — Last Chance Discount',
    subject: 'Last chance: {{discount_percentage}}% off your {{product_name}}',
    htmlBody: `${HEADER('Your Last Chance')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        This is your last reminder about the {{product_name}} in your cart. We have reserved a special discount just for you, but it will not last long.
      </p>

      <!-- Discount Badge -->
      <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:16px;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:1px;">Last Chance Discount</p>
        <p style="margin:0 0 10px;font-size:42px;font-weight:700;color:#ffffff;">{{discount_percentage}}% OFF</p>
        <p style="margin:0 0 12px;font-size:18px;color:rgba(255,255,255,0.9);">Use code: <strong style="font-size:22px;letter-spacing:2px;">{{discount_code}}</strong></p>
        <p style="margin:0;font-size:16px;color:#fde68a;font-weight:600;">&#9200; Expires in 48 hours</p>
      </div>

      <!-- Product Card -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:250px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:20px;text-align:center;">
          <h3 style="margin:0 0 8px;font-size:22px;color:#111111;">{{product_name}}</h3>
          <p style="margin:0;font-size:20px;font-weight:700;color:#7c3aed;">{{product_price}}</p>
        </div>
      </div>

      ${CTA_BUTTON_GREEN('{{cart_url}}', 'Claim Your Discount')}

      <p style="margin:0 0 20px;font-size:16px;color:#888888;text-align:center;">
        Your discount is automatically applied when you click the button above.
      </p>

      <!-- Phone Help -->
      <div style="background:#fafafa;border-radius:8px;padding:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:16px;color:#555555;">Need help placing your order?</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#7c3aed;">&#128222; {{support_phone}}</p>
        <p style="margin:8px 0 0;font-size:16px;color:#555555;">We are happy to walk you through the process.</p>
      </div>
${FOOTER}`,
    textBody: `Dear {{first_name}},

This is your last reminder about the {{product_name}} in your cart. We have reserved a special discount just for you, but it will not last long.

LAST CHANCE DISCOUNT: {{discount_percentage}}% OFF
USE CODE: {{discount_code}}
EXPIRES: In 48 hours

PRODUCT: {{product_name}}
PRICE: {{product_price}}

Claim Your Discount: {{cart_url}}

Your discount is automatically applied when you click the link above.

Need help placing your order?
Call us: {{support_phone}}
We are happy to walk you through the process.

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11. WELCOME
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to {{store_name}} — Your Order is on Its Way!',
    htmlBody: `${HEADER('Welcome!')}
      <div style="text-align:center;margin-bottom:28px;">
        <p style="font-size:48px;margin:0 0 12px;">&#128075;</p>
        <h2 style="margin:0 0 10px;font-size:26px;color:#111111;">Welcome to {{store_name}}, {{first_name}}!</h2>
        <p style="margin:0;font-size:18px;color:#555555;line-height:1.6;">
          We are delighted you chose to shop with us. Thank you for your trust.
        </p>
      </div>

      <!-- What to Expect -->
      <div style="margin-bottom:28px;">
        <h3 style="margin:0 0 16px;font-size:22px;color:#5b21b6;">What Happens Next</h3>

        <div style="border:2px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50px;vertical-align:top;padding-right:12px;">
                <div style="width:36px;height:36px;background:#7c3aed;color:#ffffff;border-radius:50%;text-align:center;line-height:36px;font-size:18px;font-weight:700;">1</div>
              </td>
              <td style="vertical-align:top;">
                <h4 style="margin:0 0 4px;font-size:18px;color:#111111;">Order Processing</h4>
                <p style="margin:0;font-size:16px;color:#555555;">We are preparing your order right now.</p>
              </td>
            </tr>
          </table>
        </div>

        <div style="border:2px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50px;vertical-align:top;padding-right:12px;">
                <div style="width:36px;height:36px;background:#7c3aed;color:#ffffff;border-radius:50%;text-align:center;line-height:36px;font-size:18px;font-weight:700;">2</div>
              </td>
              <td style="vertical-align:top;">
                <h4 style="margin:0 0 4px;font-size:18px;color:#111111;">Shipping Notification</h4>
                <p style="margin:0;font-size:16px;color:#555555;">You will receive a tracking number once shipped.</p>
              </td>
            </tr>
          </table>
        </div>

        <div style="border:2px solid #e5e7eb;border-radius:8px;padding:16px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50px;vertical-align:top;padding-right:12px;">
                <div style="width:36px;height:36px;background:#7c3aed;color:#ffffff;border-radius:50%;text-align:center;line-height:36px;font-size:18px;font-weight:700;">3</div>
              </td>
              <td style="vertical-align:top;">
                <h4 style="margin:0 0 4px;font-size:18px;color:#111111;">Delivery</h4>
                <p style="margin:0;font-size:16px;color:#555555;">Your package will arrive at your door.</p>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Support Info -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px;">
        <h3 style="margin:0 0 10px;font-size:20px;color:#5b21b6;">We Are Always Here for You</h3>
        <p style="margin:0 0 8px;font-size:18px;color:#555555;line-height:1.6;">
          If you ever have a question or need assistance, do not hesitate to reach out.
        </p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#7c3aed;">&#128222; {{support_phone}}</p>
      </div>

      ${CTA_BUTTON('{{tracking_url}}', 'Track Your Order')}

      <p style="margin:0;font-size:18px;color:#555555;text-align:center;line-height:1.6;">
        Thank you for being part of the {{store_name}} family. We look forward to serving you!
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

Welcome to {{store_name}}! We are delighted you chose to shop with us.

WHAT HAPPENS NEXT:

1. ORDER PROCESSING
   We are preparing your order right now.

2. SHIPPING NOTIFICATION
   You will receive a tracking number once shipped.

3. DELIVERY
   Your package will arrive at your door.

Track Your Order: {{tracking_url}}

WE ARE ALWAYS HERE FOR YOU
If you ever have a question or need assistance, do not hesitate to reach out.
Call us: {{support_phone}}
Email: {{support_email}}

Thank you for being part of the {{store_name}} family!

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 12. REVIEW REQUEST
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'review_request',
    name: 'Review Request',
    subject: "How's your {{product_name}}, {{first_name}}?",
    htmlBody: `${HEADER('We Would Love Your Feedback')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 28px;font-size:18px;color:#555555;line-height:1.6;">
        We hope you are enjoying your {{product_name}}! Your opinion matters to us, and it helps other customers make confident decisions.
      </p>

      <!-- Product Card -->
      <div style="border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <div style="text-align:center;padding:20px;background:#fafafa;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width:250px;width:100%;height:auto;border-radius:6px;" />
        </div>
        <div style="padding:20px;text-align:center;">
          <h3 style="margin:0 0 12px;font-size:22px;color:#111111;">{{product_name}}</h3>
        </div>
      </div>

      <!-- Star Rating Prompt -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <h3 style="margin:0 0 12px;font-size:22px;color:#5b21b6;">How Would You Rate Your Experience?</h3>
        <p style="margin:0 0 16px;font-size:42px;letter-spacing:8px;color:#f59e0b;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
        <p style="margin:0;font-size:16px;color:#555555;">Click below to share your thoughts.</p>
      </div>

      ${CTA_BUTTON('{{review_url}}', 'Leave a Review')}

      <p style="margin:0;font-size:16px;color:#555555;text-align:center;line-height:1.6;">
        It only takes a minute, and your feedback truly makes a difference. Thank you!
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We hope you are enjoying your {{product_name}}! Your opinion matters to us, and it helps other customers make confident decisions.

PRODUCT: {{product_name}}

HOW WOULD YOU RATE YOUR EXPERIENCE?
Click here to share your thoughts: {{review_url}}

It only takes a minute, and your feedback truly makes a difference. Thank you!

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 13. CHECK-IN (Lifecycle L2 — delivery +3 days)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'checkin',
    name: 'Check-in After Delivery',
    subject: "How's your {{product_name}}, {{first_name}}?",
    htmlBody: `${HEADER('Just Checking In')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 24px;font-size:18px;color:#555555;line-height:1.6;">
        We hope your {{product_name}} arrived safely and that you are enjoying it! We wanted to reach out personally to make sure everything is just right.
      </p>

      <!-- Order Reference -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:14px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Your Order</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#5b21b6;">#{{order_number}}</p>
      </div>

      <p style="margin:0 0 24px;font-size:18px;color:#555555;line-height:1.6;">
        If anything is not quite right, or if you have any questions at all, please do not hesitate to contact us. We are here to help!
      </p>

      <!-- Help Block -->
      <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <h3 style="margin:0 0 12px;font-size:22px;color:#15803d;">Need Help?</h3>
        <p style="margin:0 0 8px;font-size:20px;color:#333333;">
          Call us anytime: <strong>{{support_phone}}</strong>
        </p>
        <p style="margin:0;font-size:16px;color:#555555;">
          Our friendly team is ready to assist you.
        </p>
      </div>

      <p style="margin:0;font-size:16px;color:#555555;text-align:center;line-height:1.6;">
        Thank you for choosing {{store_name}}. We truly appreciate your business!
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

We hope your {{product_name}} arrived safely and that you are enjoying it! We wanted to reach out personally to make sure everything is just right.

YOUR ORDER: #{{order_number}}

If anything is not quite right, or if you have any questions at all, please do not hesitate to contact us. We are here to help!

NEED HELP?
Call us anytime: {{support_phone}}
Our friendly team is ready to assist you.

Thank you for choosing {{store_name}}. We truly appreciate your business!

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 14. CROSS-SELL (Lifecycle L4 — delivery +14 days)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    flowId: 'cross_sell',
    name: 'Cross-sell Suggestion',
    subject: 'We thought you might like these, {{first_name}}',
    htmlBody: `${HEADER('A Little Something for You')}
      <p style="margin:0 0 8px;font-size:18px;color:#333333;">Dear {{first_name}},</p>
      <p style="margin:0 0 24px;font-size:18px;color:#555555;line-height:1.6;">
        Thank you so much for your recent purchase of {{product_name}}! We hope you are loving it.
      </p>

      <p style="margin:0 0 24px;font-size:18px;color:#555555;line-height:1.6;">
        We wanted to let you know that we have some other items in our store that our customers love just as much. No pressure at all — just thought you might enjoy browsing when you have a moment.
      </p>

      <!-- Soft CTA -->
      <div style="background:#f5f3ff;border:2px solid #e9d5ff;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <h3 style="margin:0 0 12px;font-size:22px;color:#5b21b6;">Discover More from {{store_name}}</h3>
        <p style="margin:0 0 16px;font-size:16px;color:#555555;">
          Hand-picked products our customers are loving right now.
        </p>
      </div>

      ${CTA_BUTTON('{{store_url}}', 'Visit Our Store')}

      <p style="margin:0;font-size:16px;color:#555555;text-align:center;line-height:1.6;">
        As always, every purchase comes with our 100% satisfaction guarantee. Thank you for being part of the {{store_name}} family!
      </p>
${FOOTER}`,
    textBody: `Dear {{first_name}},

Thank you so much for your recent purchase of {{product_name}}! We hope you are loving it.

We wanted to let you know that we have some other items in our store that our customers love just as much. No pressure at all — just thought you might enjoy browsing when you have a moment.

DISCOVER MORE FROM {{store_name}}
Visit Our Store: {{store_url}}

As always, every purchase comes with our 100% satisfaction guarantee. Thank you for being part of the {{store_name}} family!

---
Questions? Call us: {{support_phone}}
Or email: {{support_email}}
100% Money-Back Guarantee

{{store_name}}
{{store_address}}
This email was sent to {{email}}
Unsubscribe: {{unsubscribe_url}}`,
  },
];

// ─── Seed function ──────────────────────────────────────────────────────────────

export async function seedEmailTemplates() {
  console.log('Seeding default email templates...');

  let created = 0;
  let updated = 0;

  for (const tpl of templates) {
    // Prisma cannot use null in composite unique where clause,
    // so we use findFirst + create/update instead of upsert.
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        sellerId: null,
        flowId: tpl.flowId,
      },
    });

    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          name: tpl.name,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          textBody: tpl.textBody,
          isActive: true,
          isDefault: true,
        },
      });
      updated++;
      console.log(`  [updated] ${tpl.flowId} — "${tpl.name}"`);
    } else {
      await prisma.emailTemplate.create({
        data: {
          sellerId: null,
          flowId: tpl.flowId,
          name: tpl.name,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          textBody: tpl.textBody,
          isActive: true,
          isDefault: true,
        },
      });
      created++;
      console.log(`  [created] ${tpl.flowId} — "${tpl.name}"`);
    }
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}, Total: ${templates.length}`);
}

// ─── Standalone execution ───────────────────────────────────────────────────────

async function main() {
  try {
    await seedEmailTemplates();
  } catch (error) {
    console.error('Failed to seed email templates:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
