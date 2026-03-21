/**
 * email-send.processor.ts
 *
 * BullMQ job handler for the "pixecom-email-send" queue.
 *
 * Picks up individual EmailJob records and sends them via SendGrid.
 * NOT repeatable — each job is pushed by the API or email-scheduler.
 *
 * Error handling is per-job: one failed email does not crash the worker.
 */

import { PrismaClient } from '@pixecom/database';
import type { Job } from 'bullmq';
import sgMail from '@sendgrid/mail';

// ─── SendGrid initialisation ─────────────────────────────────────────────────

let sendgridInitialised = false;

function ensureSendgridInit(): boolean {
  if (sendgridInitialised) return true;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) {
    sgMail.setApiKey(apiKey);
    sendgridInitialised = true;
    return true;
  }
  return false;
}

// ─── Template variable resolution ─────────────────────────────────────────────

function resolveVariables(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    const val = variables[varName];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

// ─── Email tracking (link wrapping + open pixel) ─────────────────────────────

/** Patterns to skip when wrapping links */
const SKIP_LINK_PATTERNS = [
  /^mailto:/i,
  /^tel:/i,
  /^javascript:/i,
  /^#/,
  /^$/,
  /unsubscribe/i,
];

function shouldSkipLink(href: string): boolean {
  return SKIP_LINK_PATTERNS.some((p) => p.test(href));
}

/**
 * Wrap all <a href="..."> links with click-tracking redirects.
 * Also appends utm_source=email & utm_medium={flowId} for attribution.
 */
function wrapLinks(html: string, emailJobId: string, baseUrl: string): string {
  const trackingId = Buffer.from(emailJobId).toString('base64url');
  let linkIndex = 0;

  return html.replace(
    /<a\s([^>]*?)href\s*=\s*["']([^"']*)["']([^>]*?)>/gi,
    (fullMatch, before, href, after) => {
      const trimmed = (href ?? '').trim();
      if (shouldSkipLink(trimmed)) return fullMatch;
      if (trimmed.includes('/api/email-tracking/click/')) return fullMatch;

      const idx = linkIndex++;
      const encodedUrl = encodeURIComponent(trimmed);
      const trackingUrl =
        `${baseUrl}/api/email-tracking/click/${trackingId}/${idx}?url=${encodedUrl}`;

      return `<a ${before}href="${trackingUrl}"${after}>`;
    },
  );
}

/**
 * Insert a 1x1 transparent tracking pixel before </body>.
 */
function addTrackingPixel(html: string, emailJobId: string, baseUrl: string): string {
  const trackingId = Buffer.from(emailJobId).toString('base64url');
  const pixelUrl = `${baseUrl}/api/email-tracking/open/${trackingId}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

/** Check if email tracking is enabled (default: true) */
function isTrackingEnabled(): boolean {
  const val = process.env.EMAIL_TRACKING_ENABLED;
  // Default to 'true' if not set
  return val === undefined || val === '' || val === 'true' || val === '1';
}

/** Get the base URL for tracking endpoints */
function getTrackingBaseUrl(): string {
  return (
    process.env.API_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3001'
  );
}

// ─── Processor ────────────────────────────────────────────────────────────────

export async function emailSendProcessor(
  job: Job,
  prisma: PrismaClient,
): Promise<void> {
  const logger = {
    log: (msg: string) => console.log(`[EmailSendProcessor][Job ${job.id}] ${msg}`),
    error: (msg: string, err?: unknown) =>
      console.error(`[EmailSendProcessor][Job ${job.id}] ${msg}`, err ?? ''),
  };

  const { emailJobId } = job.data as { emailJobId: string };
  if (!emailJobId) {
    logger.error('Missing emailJobId in job data — skipping');
    return;
  }

  try {
    // 1. Load EmailJob (include template)
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: { template: true },
    });

    if (!emailJob) {
      logger.error(`EmailJob ${emailJobId} not found — skipping`);
      return;
    }

    // 2. If already processed, skip
    if (emailJob.status !== 'QUEUED') {
      logger.log(`EmailJob ${emailJobId} status is ${emailJob.status} — skipping`);
      return;
    }

    // 3. Update status to SENDING
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: 'SENDING' },
    });

    // 4. Resolve template — prefer explicit templateId, then flowId lookup
    let subject = emailJob.subject;
    let htmlBody = '';

    if (emailJob.template) {
      // Template is already included via relation
      subject = emailJob.template.subject;
      htmlBody = emailJob.template.htmlBody;
    } else if (emailJob.templateId) {
      // templateId set but relation didn't load (shouldn't happen, safety net)
      const tpl = await prisma.emailTemplate.findUnique({
        where: { id: emailJob.templateId },
      });
      if (tpl) {
        subject = tpl.subject;
        htmlBody = tpl.htmlBody;
      }
    } else {
      // Fallback: find template by flowId + sellerId, then default
      const sellerTemplate = await prisma.emailTemplate.findUnique({
        where: {
          sellerId_flowId: {
            sellerId: emailJob.sellerId,
            flowId: emailJob.flowId,
          },
        },
      });

      if (sellerTemplate && sellerTemplate.isActive) {
        subject = sellerTemplate.subject;
        htmlBody = sellerTemplate.htmlBody;
      } else {
        // Fallback to default template (sellerId=null)
        const defaultTemplate = await prisma.emailTemplate.findFirst({
          where: {
            flowId: emailJob.flowId,
            isDefault: true,
            sellerId: null,
          },
        });
        if (defaultTemplate) {
          subject = defaultTemplate.subject;
          htmlBody = defaultTemplate.htmlBody;
        }
      }
    }

    // 5. Resolve template variables
    const variables = (emailJob.variables as Record<string, unknown>) ?? {};
    subject = resolveVariables(subject, variables);
    htmlBody = resolveVariables(htmlBody, variables);

    // 5b. Wrap links + add tracking pixel (if enabled)
    if (isTrackingEnabled() && htmlBody) {
      const trackingBaseUrl = getTrackingBaseUrl();
      htmlBody = wrapLinks(htmlBody, emailJobId, trackingBaseUrl);
      htmlBody = addTrackingPixel(htmlBody, emailJobId, trackingBaseUrl);
      logger.log(`Tracking injected for email job ${emailJobId}`);
    }

    // 6. Send via SendGrid
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@pixelxlab.com';
    const isEnabled = ensureSendgridInit();

    if (!isEnabled) {
      // Dev mode: dry-run
      logger.log(
        `[dry-run] Would send email to ${emailJob.toEmail} (flow: ${emailJob.flowId}, subject: "${subject}")`,
      );
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });
    } else {
      // Real send
      const [response] = await sgMail.send({
        to: emailJob.toEmail,
        from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || 'PixelxLab' },
        subject,
        html: htmlBody || `<p>${subject}</p>`,
      });

      const providerMessageId = response?.headers?.['x-message-id'] ?? null;

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attemptCount: { increment: 1 },
          providerMessageId,
        },
      });

      logger.log(
        `Email sent to ${emailJob.toEmail} (flow: ${emailJob.flowId}, msgId: ${providerMessageId})`,
      );
    }

    // 7. Update CustomerEmailPreference
    try {
      await prisma.customerEmailPreference.upsert({
        where: {
          sellerId_email: {
            sellerId: emailJob.sellerId,
            email: emailJob.toEmail,
          },
        },
        update: {
          emailsThisWeek: { increment: 1 },
          lastEmailSentAt: new Date(),
        },
        create: {
          sellerId: emailJob.sellerId,
          email: emailJob.toEmail,
          emailsThisWeek: 1,
          lastEmailSentAt: new Date(),
        },
      });
    } catch (prefErr) {
      // Non-critical — log but don't fail the job
      logger.error('Failed to update CustomerEmailPreference', prefErr);
    }
  } catch (err: any) {
    // Send failure — increment attemptCount, possibly mark FAILED
    logger.error(`Failed to send EmailJob ${emailJobId}`, err);

    try {
      const current = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        select: { attemptCount: true, maxAttempts: true },
      });

      if (current) {
        const newAttemptCount = current.attemptCount + 1;
        const newStatus = newAttemptCount >= current.maxAttempts ? 'FAILED' : 'QUEUED';

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: newStatus,
            attemptCount: newAttemptCount,
            error: err.message ? String(err.message).slice(0, 1000) : 'Unknown error',
          },
        });

        if (newStatus === 'FAILED') {
          logger.error(
            `EmailJob ${emailJobId} permanently failed after ${newAttemptCount} attempts`,
          );
        } else {
          logger.log(
            `EmailJob ${emailJobId} will retry (attempt ${newAttemptCount}/${current.maxAttempts})`,
          );
        }
      }
    } catch (updateErr) {
      logger.error(`Failed to update EmailJob ${emailJobId} after send failure`, updateErr);
    }
  }
}
