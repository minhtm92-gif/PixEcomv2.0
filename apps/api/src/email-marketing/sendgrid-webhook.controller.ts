import {
  Body,
  Controller,
  Post,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailJobStatus } from '@pixecom/database';

interface SendGridEvent {
  event: string;
  email: string;
  timestamp: number;
  sg_message_id?: string;
  reason?: string;
  type?: string;
  url?: string;
}

@Controller('webhooks')
export class SendGridWebhookController {
  private readonly logger = new Logger(SendGridWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('sendgrid')
  async handleSendGridWebhook(@Body() events: SendGridEvent[]) {
    if (!Array.isArray(events)) {
      this.logger.warn('Invalid SendGrid webhook payload — expected array');
      return { received: true };
    }

    this.logger.log(`SendGrid webhook: ${events.length} event(s) received`);

    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (err: any) {
        this.logger.error(
          `Failed to process SendGrid event ${event.event}: ${err.message}`,
        );
      }
    }

    return { received: true };
  }

  private async processEvent(event: SendGridEvent): Promise<void> {
    const messageId = this.extractMessageId(event.sg_message_id);
    if (!messageId) return;

    const job = await this.prisma.emailJob.findFirst({
      where: { providerMessageId: messageId },
    });

    if (!job) {
      this.logger.debug(
        `No email job found for message ID: ${messageId}`,
      );
      return;
    }

    switch (event.event) {
      case 'delivered':
        await this.prisma.emailJob.update({
          where: { id: job.id },
          data: { status: EmailJobStatus.DELIVERED },
        });
        break;

      case 'open':
        await this.prisma.emailJob.update({
          where: { id: job.id },
          data: {
            status: EmailJobStatus.OPENED,
            openedAt: new Date(event.timestamp * 1000),
          },
        });
        break;

      case 'click':
        await this.prisma.emailJob.update({
          where: { id: job.id },
          data: {
            status: EmailJobStatus.CLICKED,
            clickedAt: new Date(event.timestamp * 1000),
          },
        });
        break;

      case 'bounce':
        await this.handleBounce(job, event);
        break;

      case 'dropped':
        await this.prisma.emailJob.update({
          where: { id: job.id },
          data: {
            status: EmailJobStatus.FAILED,
            error: `Dropped: ${event.reason ?? 'unknown'}`,
          },
        });
        break;

      case 'spamreport':
        await this.handleSpamReport(job, event);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(job, event);
        break;

      default:
        this.logger.debug(`Unhandled SendGrid event: ${event.event}`);
    }
  }

  private async handleBounce(
    job: { id: string; sellerId: string; toEmail: string },
    event: SendGridEvent,
  ): Promise<void> {
    const isHardBounce = event.type === 'bounce';

    await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.BOUNCED,
        bouncedAt: new Date(event.timestamp * 1000),
        error: `Bounce (${event.type}): ${event.reason ?? 'unknown'}`,
      },
    });

    await this.prisma.emailSuppression.upsert({
      where: {
        sellerId_email: { sellerId: job.sellerId, email: job.toEmail },
      },
      update: {
        reason: 'bounced',
        suppressMarketing: true,
        suppressTransactional: isHardBounce,
      },
      create: {
        sellerId: job.sellerId,
        email: job.toEmail,
        reason: 'bounced',
        suppressMarketing: true,
        suppressTransactional: isHardBounce,
      },
    });

    this.logger.log(
      `Bounce (${event.type}) recorded for ${job.toEmail} — suppression added`,
    );
  }

  private async handleSpamReport(
    job: { id: string; sellerId: string; toEmail: string },
    event: SendGridEvent,
  ): Promise<void> {
    await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: EmailJobStatus.COMPLAINED,
        complainedAt: new Date(event.timestamp * 1000),
      },
    });

    await this.prisma.emailSuppression.upsert({
      where: {
        sellerId_email: { sellerId: job.sellerId, email: job.toEmail },
      },
      update: {
        reason: 'complained',
        suppressMarketing: true,
      },
      create: {
        sellerId: job.sellerId,
        email: job.toEmail,
        reason: 'complained',
        suppressMarketing: true,
        suppressTransactional: false,
      },
    });

    this.logger.log(
      `Spam report recorded for ${job.toEmail} — suppression added`,
    );
  }

  private async handleUnsubscribe(
    job: { id: string; sellerId: string; toEmail: string },
    event: SendGridEvent,
  ): Promise<void> {
    await this.prisma.emailJob.update({
      where: { id: job.id },
      data: {
        unsubscribedAt: new Date(event.timestamp * 1000),
      },
    });

    await this.prisma.emailSuppression.upsert({
      where: {
        sellerId_email: { sellerId: job.sellerId, email: job.toEmail },
      },
      update: {
        reason: 'unsubscribed',
        suppressMarketing: true,
      },
      create: {
        sellerId: job.sellerId,
        email: job.toEmail,
        reason: 'unsubscribed',
        suppressMarketing: true,
        suppressTransactional: false,
      },
    });

    await this.prisma.customerEmailPreference.upsert({
      where: {
        sellerId_email: { sellerId: job.sellerId, email: job.toEmail },
      },
      update: {
        marketingOptIn: false,
      },
      create: {
        sellerId: job.sellerId,
        email: job.toEmail,
        marketingOptIn: false,
        lifecycleOptIn: true,
      },
    });

    this.logger.log(
      `Unsubscribe recorded for ${job.toEmail} — suppression + preference updated`,
    );
  }

  private extractMessageId(sgMessageId?: string): string | null {
    if (!sgMessageId) return null;
    const dotIndex = sgMessageId.indexOf('.');
    return dotIndex > 0 ? sgMessageId.substring(0, dotIndex) : sgMessageId;
  }
}
