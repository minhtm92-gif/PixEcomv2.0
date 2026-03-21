import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('unsubscribe')
export class UnsubscribeController {
  private readonly logger = new Logger(UnsubscribeController.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.secret =
      this.config.get<string>('UNSUBSCRIBE_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'fallback-secret';
  }

  @Get(':token')
  async showUnsubscribePage(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      throw new NotFoundException('Invalid unsubscribe link');
    }

    const html = this.buildUnsubscribePageHtml(token, decoded.email);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Post(':token')
  async processUnsubscribe(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      throw new NotFoundException('Invalid unsubscribe link');
    }

    const { sellerId, email } = decoded;

    await this.prisma.emailSuppression.upsert({
      where: { sellerId_email: { sellerId, email } },
      update: {
        suppressMarketing: true,
        reason: 'unsubscribed',
      },
      create: {
        sellerId,
        email,
        reason: 'unsubscribed',
        suppressMarketing: true,
        suppressTransactional: false,
      },
    });

    await this.prisma.customerEmailPreference.upsert({
      where: { sellerId_email: { sellerId, email } },
      update: {
        marketingOptIn: false,
      },
      create: {
        sellerId,
        email,
        marketingOptIn: false,
        lifecycleOptIn: true,
      },
    });

    this.logger.log(`Unsubscribed: ${email} (seller ${sellerId})`);

    const html = this.buildConfirmationHtml(email);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  static generateToken(
    email: string,
    sellerId: string,
    secret: string,
  ): string {
    const payload = `${email}:${sellerId}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const data = Buffer.from(JSON.stringify({ email, sellerId })).toString(
      'base64url',
    );
    return `${data}.${signature}`;
  }

  private decodeToken(
    token: string,
  ): { email: string; sellerId: string } | null {
    try {
      const [dataB64, signature] = token.split('.');
      if (!dataB64 || !signature) return null;

      const data = JSON.parse(
        Buffer.from(dataB64, 'base64url').toString('utf8'),
      );
      const { email, sellerId } = data;

      if (!email || !sellerId) return null;

      const expectedSig = crypto
        .createHmac('sha256', this.secret)
        .update(`${email}:${sellerId}`)
        .digest('hex');

      if (signature !== expectedSig) return null;

      return { email, sellerId };
    } catch {
      return null;
    }
  }

  private buildUnsubscribePageHtml(token: string, email: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:80px auto;padding:20px">
    <div style="background:#fff;padding:40px 32px;border-radius:12px;text-align:center">
      <h1 style="margin:0 0 16px;font-size:22px;color:#111">Unsubscribe</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6">
        Are you sure you want to unsubscribe <strong>${this.esc(email)}</strong> from marketing emails?
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#888">
        You will still receive transactional emails (order confirmations, shipping updates).
      </p>
      <form method="POST" action="/api/unsubscribe/${token}">
        <button type="submit" style="background:#7c3aed;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
          Confirm Unsubscribe
        </button>
      </form>
    </div>
  </div>
</body>
</html>`;
  }

  private buildConfirmationHtml(email: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:80px auto;padding:20px">
    <div style="background:#fff;padding:40px 32px;border-radius:12px;text-align:center">
      <h1 style="margin:0 0 16px;font-size:22px;color:#111">Unsubscribed</h1>
      <p style="margin:0 0 8px;font-size:14px;color:#666;line-height:1.6">
        <strong>${this.esc(email)}</strong> has been unsubscribed from marketing emails.
      </p>
      <p style="margin:0;font-size:13px;color:#888">
        You will still receive transactional emails such as order confirmations and shipping updates.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
