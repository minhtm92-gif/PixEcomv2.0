import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailJobStatus } from '@pixecom/database';

interface QueueEmailParams {
  sellerId: string;
  toEmail: string;
  toName?: string;
  flowId: string;
  subject: string;
  variables?: Record<string, string>;
  priority?: number;
  scheduledAt?: Date;
}

/** Flow IDs that are transactional — always deliver, bypass frequency caps */
const TRANSACTIONAL_FLOW_IDS = new Set([
  'order_confirmation',
  'shipping_confirmation',
  'delivery_confirmation',
  'refund_confirmation',
  'order_delay',
]);

@Injectable()
export class EmailSendService {
  private readonly logger = new Logger(EmailSendService.name);
  private readonly unsubscribeSecret: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly templateService: EmailTemplateService,
    private readonly config: ConfigService,
  ) {
    this.unsubscribeSecret =
      this.config.get<string>('UNSUBSCRIBE_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'fallback-secret';
    this.apiBaseUrl =
      this.config.get<string>('API_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      'http://localhost:4000';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC HELPERS: Build unsubscribe URL & items HTML for transactional emails
  // ─────────────────────────────────────────────────────────────────────────

  buildUnsubscribeUrl(email: string, sellerId: string): string {
    const payload = `${email}:${sellerId}`;
    const signature = crypto
      .createHmac('sha256', this.unsubscribeSecret)
      .update(payload)
      .digest('hex');
    const data = Buffer.from(JSON.stringify({ email, sellerId })).toString(
      'base64url',
    );
    return `${this.apiBaseUrl}/api/unsubscribe/${data}.${signature}`;
  }

  buildItemsHtml(
    items: Array<{
      productName: string;
      variantName?: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>,
  ): string {
    if (!items.length) return '<p>No items</p>';

    const rows = items
      .map(
        (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:16px;color:#333333;">
            ${this.esc(item.productName)}${item.variantName ? ` <span style="color:#888888;">- ${this.esc(item.variantName)}</span>` : ''}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:16px;color:#333333;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:16px;color:#333333;text-align:right;">$${item.lineTotal.toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return `<table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  async queueEmail(params: QueueEmailParams): Promise<{ jobId: string }> {
    const {
      sellerId,
      toEmail,
      toName,
      flowId,
      subject,
      variables = {},
      priority = 3,
      scheduledAt,
    } = params;

    // Priority 1 = transactional — always send, bypass suppression & frequency caps
    const isTransactional = priority === 1 || TRANSACTIONAL_FLOW_IDS.has(flowId);

    if (!isTransactional) {
      const canSend = await this.shouldSend(sellerId, toEmail, flowId);
      if (!canSend) {
        this.logger.log(
          `Email to ${toEmail} suppressed for flow ${flowId} (seller ${sellerId})`,
        );
        return { jobId: '' };
      }
    }

    const template = await this.templateService.getByFlow(sellerId, flowId);

    const job = await this.prisma.emailJob.create({
      data: {
        sellerId,
        toEmail,
        toName,
        flowId,
        templateId: template?.id,
        subject,
        variables: variables as any,
        priority,
        scheduledAt: scheduledAt ?? new Date(),
        status: EmailJobStatus.QUEUED,
      },
    });

    this.logger.log(
      `Email job ${job.id} queued for ${toEmail} (flow: ${flowId})`,
    );

    return { jobId: job.id };
  }

  async shouldSend(
    sellerId: string,
    email: string,
    flowCategory: string,
  ): Promise<boolean> {
    const isTransactional = flowCategory.startsWith('transactional_');

    const suppression = await this.prisma.emailSuppression.findUnique({
      where: { sellerId_email: { sellerId, email } },
    });

    if (suppression) {
      if (isTransactional && suppression.suppressTransactional) return false;
      if (!isTransactional && suppression.suppressMarketing) return false;
    }

    if (!isTransactional) {
      const preference = await this.prisma.customerEmailPreference.findUnique({
        where: { sellerId_email: { sellerId, email } },
      });

      if (preference) {
        if (
          flowCategory.startsWith('marketing_') &&
          !preference.marketingOptIn
        ) {
          return false;
        }
        if (
          flowCategory.startsWith('lifecycle_') &&
          !preference.lifecycleOptIn
        ) {
          return false;
        }

        const now = new Date();
        const weekStart = preference.weekResetAt
          ? new Date(preference.weekResetAt)
          : null;
        const needsReset =
          !weekStart || now.getTime() - weekStart.getTime() > 7 * 86400000;

        const currentWeekCount = needsReset ? 0 : preference.emailsThisWeek;
        if (currentWeekCount >= 3) {
          this.logger.debug(
            `Frequency cap: ${email} received ${currentWeekCount} emails this week`,
          );
          return false;
        }

        if (preference.lastEmailSentAt) {
          const hoursSinceLast =
            (now.getTime() - new Date(preference.lastEmailSentAt).getTime()) /
            3600000;
          if (hoursSinceLast < 6) {
            this.logger.debug(
              `Frequency cap: ${email} received email ${hoursSinceLast.toFixed(1)}h ago`,
            );
            return false;
          }
        }
      }
    }

    return true;
  }

  async processEmailJob(jobId: string): Promise<void> {
    const job = await this.prisma.emailJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== EmailJobStatus.QUEUED) {
      this.logger.warn(`Job ${jobId} not found or not in QUEUED status`);
      return;
    }

    await this.prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: EmailJobStatus.SENDING,
        attemptCount: { increment: 1 },
      },
    });

    try {
      const template = await this.templateService.getByFlow(
        job.sellerId,
        job.flowId,
      );

      const variables = (job.variables as Record<string, string>) ?? {};
      const htmlBody = template
        ? this.templateService.resolveVariables(template.htmlBody, variables)
        : this.buildFallbackHtml(job.subject, variables);

      const seller = await this.prisma.seller.findUnique({
        where: { id: job.sellerId },
        select: { name: true },
      });

      const storeName = seller?.name ?? 'Store';

      await this.emailService.sendRawEmail({
        to: job.toEmail,
        toName: job.toName ?? undefined,
        subject: this.templateService.resolveVariables(job.subject, variables),
        html: htmlBody,
        fromName: storeName,
      });

      await this.prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: EmailJobStatus.SENT,
          sentAt: new Date(),
        },
      });

      const now = new Date();
      await this.prisma.customerEmailPreference.upsert({
        where: {
          sellerId_email: { sellerId: job.sellerId, email: job.toEmail },
        },
        update: {
          lastEmailSentAt: now,
          emailsThisWeek: { increment: 1 },
        },
        create: {
          sellerId: job.sellerId,
          email: job.toEmail,
          lastEmailSentAt: now,
          emailsThisWeek: 1,
          weekResetAt: now,
        },
      });

      this.logger.log(`Email job ${jobId} sent to ${job.toEmail}`);
    } catch (err: any) {
      const shouldRetry = job.attemptCount + 1 < job.maxAttempts;

      await this.prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: shouldRetry ? EmailJobStatus.QUEUED : EmailJobStatus.FAILED,
          error: err.message,
        },
      });

      this.logger.error(
        `Email job ${jobId} failed: ${err.message}${shouldRetry ? ' (will retry)' : ' (max attempts reached)'}`,
      );
    }
  }

  async cancelPendingEmails(
    sellerId: string,
    email: string,
    flowId?: string,
  ): Promise<{ cancelledCount: number }> {
    const where: any = {
      sellerId,
      toEmail: email,
      status: EmailJobStatus.QUEUED,
    };

    if (flowId) {
      where.flowId = flowId;
    }

    const { count } = await this.prisma.emailJob.updateMany({
      where,
      data: { status: EmailJobStatus.CANCELLED },
    });

    if (count > 0) {
      this.logger.log(
        `Cancelled ${count} pending email(s) for ${email}${flowId ? ` (flow: ${flowId})` : ''}`,
      );
    }

    return { cancelledCount: count };
  }

  private buildFallbackHtml(
    subject: string,
    variables: Record<string, string>,
  ): string {
    const body = variables['body'] ?? '';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#fff;padding:32px 24px;border-radius:12px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#111">${this.esc(subject)}</h1>
      <div style="font-size:14px;color:#333;line-height:1.6">${body}</div>
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
