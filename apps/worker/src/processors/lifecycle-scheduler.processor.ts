/**
 * lifecycle-scheduler.processor.ts
 *
 * BullMQ job handler for the "pixecom-lifecycle-scheduler" queue.
 * Runs every 30 minutes (repeatable).
 *
 * Schedules lifecycle emails based on order milestones:
 *
 *   L1 — Welcome Email       (purchase + 24 hours)
 *   L2 — Check-in Email      (delivery + 3 days)
 *   L3 — Review Request      (delivery + 7 days)
 *   L4 — Cross-sell Email    (delivery + 14 days, no complaint/return)
 *
 * Uses time windows to accommodate the 30-minute cron interval
 * without missing or duplicating sends.
 *
 * Error handling is per-order: one failed order does not abort the run.
 */

import { PrismaClient } from '@pixecom/database';
import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getOptimalSendTime } from '../utils/send-time';

// ─── Time window constants ──────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ─── Processor ──────────────────────────────────────────────────────────────

export async function lifecycleSchedulerProcessor(
  job: Job,
  prisma: PrismaClient,
): Promise<void> {
  const logger = {
    log: (msg: string) =>
      console.log(`[LifecycleScheduler][Job ${job.id}] ${msg}`),
    error: (msg: string, err?: unknown) =>
      console.error(`[LifecycleScheduler][Job ${job.id}] ${msg}`, err ?? ''),
  };

  logger.log('Starting lifecycle email scheduling run');

  const now = new Date();
  let scheduled = 0;

  // Create a BullMQ queue connection for pushing email-send jobs
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const emailSendQueue = new Queue('pixecom-email-send', {
    connection: redisConnection as any,
  });

  try {
    // ── L1: Welcome Email (purchase + 24 hours) ──────────────────────────
    const l1Count = await scheduleWelcomeEmails(prisma, emailSendQueue, now, logger);
    scheduled += l1Count;

    // ── L2: Check-in Email (delivery + 3 days) ──────────────────────────
    const l2Count = await scheduleCheckinEmails(prisma, emailSendQueue, now, logger);
    scheduled += l2Count;

    // ── L3: Review Request (delivery + 7 days) ──────────────────────────
    const l3Count = await scheduleReviewRequestEmails(prisma, emailSendQueue, now, logger);
    scheduled += l3Count;

    // ── L4: Cross-sell (delivery + 14 days) ──────────────────────────────
    const l4Count = await scheduleCrossSellEmails(prisma, emailSendQueue, now, logger);
    scheduled += l4Count;

    logger.log(
      `Lifecycle scheduling complete. Total scheduled: ${scheduled} ` +
      `(L1=${l1Count}, L2=${l2Count}, L3=${l3Count}, L4=${l4Count})`,
    );
  } catch (err) {
    logger.error('Lifecycle scheduler failed', err);
    throw err; // Let BullMQ mark the job as failed
  } finally {
    await emailSendQueue.close();
    await redisConnection.quit();
  }
}

// ─── L1: Welcome Email ──────────────────────────────────────────────────────
// Find orders paid 23-25 hours ago, status CONFIRMED/PROCESSING/SHIPPED

async function scheduleWelcomeEmails(
  prisma: PrismaClient,
  emailSendQueue: Queue,
  now: Date,
  logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): Promise<number> {
  const windowStart = new Date(now.getTime() - 25 * HOUR_MS);
  const windowEnd = new Date(now.getTime() - 23 * HOUR_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] },
      paidAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      seller: {
        select: { id: true, name: true },
      },
      items: {
        take: 1,
        select: { productName: true },
      },
    },
  });

  logger.log(`[L1-Welcome] Found ${orders.length} eligible orders (paid 23-25h ago)`);

  let count = 0;
  for (const order of orders) {
    try {
      // Idempotency: check if EmailJob already exists for welcome + this customer+seller
      const existingJob = await prisma.emailJob.findFirst({
        where: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          flowId: 'welcome',
        },
      });
      if (existingJob) continue;

      // Check suppression
      if (await isSuppressed(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Check lifecycle opt-in
      if (await isLifecycleOptedOut(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Get optimal send time
      const preference = await prisma.customerEmailPreference.findUnique({
        where: { sellerId_email: { sellerId: order.sellerId, email: order.customerEmail } },
        select: { timezone: true },
      });
      const sendAt = getOptimalSendTime(preference?.timezone ?? null, now);

      const firstName = extractFirstName(order.customerName);
      const storeName = order.seller.name;

      const variables: Record<string, unknown> = {
        first_name: firstName,
        store_name: storeName,
        order_number: order.orderNumber,
        support_phone: '', // Resolved at send time from seller settings
        email: order.customerEmail,
        unsubscribe_url: '', // Resolved at send time
      };

      const emailJob = await prisma.emailJob.create({
        data: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          toName: order.customerName ?? undefined,
          flowId: 'welcome',
          subject: '', // Resolved from template
          variables: variables as any,
          scheduledAt: sendAt,
          priority: 3,
          status: 'QUEUED',
        },
      });

      await emailSendQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        { jobId: `email-${emailJob.id}`, priority: 3 },
      );

      logger.log(`[L1-Welcome] Scheduled welcome email for ${order.customerEmail} (order ${order.orderNumber})`);
      count++;
    } catch (err) {
      logger.error(`[L1-Welcome] Failed for order ${order.id}`, err);
    }
  }

  return count;
}

// ─── L2: Check-in Email ─────────────────────────────────────────────────────
// Find orders delivered 68-76 hours ago (3 days window)

async function scheduleCheckinEmails(
  prisma: PrismaClient,
  emailSendQueue: Queue,
  now: Date,
  logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): Promise<number> {
  const windowStart = new Date(now.getTime() - 76 * HOUR_MS);
  const windowEnd = new Date(now.getTime() - 68 * HOUR_MS);

  // Find OrderEvents of type DELIVERED within the time window
  const deliveryEvents = await prisma.orderEvent.findMany({
    where: {
      eventType: 'DELIVERED',
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      order: {
        include: {
          seller: { select: { id: true, name: true } },
          items: { take: 1, select: { productName: true } },
        },
      },
    },
  });

  logger.log(`[L2-Checkin] Found ${deliveryEvents.length} delivery events (68-76h ago)`);

  let count = 0;
  for (const event of deliveryEvents) {
    const order = event.order;
    try {
      // Only for DELIVERED orders
      if (order.status !== 'DELIVERED') continue;

      // Idempotency: check if EmailJob already exists for checkin + this order
      const existingJob = await prisma.emailJob.findFirst({
        where: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          flowId: 'checkin',
          variables: {
            path: ['order_number'],
            equals: order.orderNumber,
          },
        },
      });
      if (existingJob) continue;

      // Check suppression
      if (await isSuppressed(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Check lifecycle opt-in
      if (await isLifecycleOptedOut(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Get optimal send time
      const preference = await prisma.customerEmailPreference.findUnique({
        where: { sellerId_email: { sellerId: order.sellerId, email: order.customerEmail } },
        select: { timezone: true },
      });
      const sendAt = getOptimalSendTime(preference?.timezone ?? null, now);

      const firstName = extractFirstName(order.customerName);
      const storeName = order.seller.name;
      const productName = order.items[0]?.productName ?? 'your purchase';

      const variables: Record<string, unknown> = {
        first_name: firstName,
        product_name: productName,
        order_number: order.orderNumber,
        store_name: storeName,
        support_phone: '',
        email: order.customerEmail,
        unsubscribe_url: '',
      };

      const emailJob = await prisma.emailJob.create({
        data: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          toName: order.customerName ?? undefined,
          flowId: 'checkin',
          subject: '',
          variables: variables as any,
          scheduledAt: sendAt,
          priority: 3,
          status: 'QUEUED',
        },
      });

      await emailSendQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        { jobId: `email-${emailJob.id}`, priority: 3 },
      );

      logger.log(`[L2-Checkin] Scheduled check-in email for ${order.customerEmail} (order ${order.orderNumber})`);
      count++;
    } catch (err) {
      logger.error(`[L2-Checkin] Failed for order ${order.id}`, err);
    }
  }

  return count;
}

// ─── L3: Review Request ─────────────────────────────────────────────────────
// Find orders delivered 6-8 days ago, no existing review

async function scheduleReviewRequestEmails(
  prisma: PrismaClient,
  emailSendQueue: Queue,
  now: Date,
  logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): Promise<number> {
  const windowStart = new Date(now.getTime() - 8 * DAY_MS);
  const windowEnd = new Date(now.getTime() - 6 * DAY_MS);

  // Find OrderEvents of type DELIVERED within the time window
  const deliveryEvents = await prisma.orderEvent.findMany({
    where: {
      eventType: 'DELIVERED',
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      order: {
        include: {
          seller: { select: { id: true, name: true } },
          items: {
            take: 1,
            select: {
              productId: true,
              productName: true,
            },
          },
          reviews: { take: 1, select: { id: true } },
        },
      },
    },
  });

  logger.log(`[L3-Review] Found ${deliveryEvents.length} delivery events (6-8 days ago)`);

  let count = 0;
  for (const event of deliveryEvents) {
    const order = event.order;
    try {
      // Only for DELIVERED orders
      if (order.status !== 'DELIVERED') continue;

      // Skip if a review already exists for this order
      if (order.reviews.length > 0) continue;

      // Idempotency: check if EmailJob already exists for review_request + this order
      const existingJob = await prisma.emailJob.findFirst({
        where: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          flowId: 'review_request',
          variables: {
            path: ['order_number'],
            equals: order.orderNumber,
          },
        },
      });
      if (existingJob) continue;

      // Check suppression
      if (await isSuppressed(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Check lifecycle opt-in
      if (await isLifecycleOptedOut(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Get optimal send time
      const preference = await prisma.customerEmailPreference.findUnique({
        where: { sellerId_email: { sellerId: order.sellerId, email: order.customerEmail } },
        select: { timezone: true },
      });
      const sendAt = getOptimalSendTime(preference?.timezone ?? null, now);

      const firstName = extractFirstName(order.customerName);
      const storeName = order.seller.name;
      const productName = order.items[0]?.productName ?? 'your purchase';

      const variables: Record<string, unknown> = {
        first_name: firstName,
        product_name: productName,
        product_image: '', // Resolved at send time
        order_number: order.orderNumber,
        review_url: '', // Resolved at send time
        store_name: storeName,
        email: order.customerEmail,
        unsubscribe_url: '',
      };

      const emailJob = await prisma.emailJob.create({
        data: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          toName: order.customerName ?? undefined,
          flowId: 'review_request',
          subject: '',
          variables: variables as any,
          scheduledAt: sendAt,
          priority: 3,
          status: 'QUEUED',
        },
      });

      await emailSendQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        { jobId: `email-${emailJob.id}`, priority: 3 },
      );

      logger.log(`[L3-Review] Scheduled review request for ${order.customerEmail} (order ${order.orderNumber})`);
      count++;
    } catch (err) {
      logger.error(`[L3-Review] Failed for order ${order.id}`, err);
    }
  }

  return count;
}

// ─── L4: Cross-sell Email ───────────────────────────────────────────────────
// Find orders delivered 13-15 days ago, NOT refunded/cancelled

async function scheduleCrossSellEmails(
  prisma: PrismaClient,
  emailSendQueue: Queue,
  now: Date,
  logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): Promise<number> {
  const windowStart = new Date(now.getTime() - 15 * DAY_MS);
  const windowEnd = new Date(now.getTime() - 13 * DAY_MS);

  // Find OrderEvents of type DELIVERED within the time window
  const deliveryEvents = await prisma.orderEvent.findMany({
    where: {
      eventType: 'DELIVERED',
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      order: {
        include: {
          seller: { select: { id: true, name: true } },
          items: { take: 1, select: { productName: true } },
        },
      },
    },
  });

  logger.log(`[L4-CrossSell] Found ${deliveryEvents.length} delivery events (13-15 days ago)`);

  let count = 0;
  for (const event of deliveryEvents) {
    const order = event.order;
    try {
      // Must still be DELIVERED (not REFUNDED or CANCELLED)
      if (order.status !== 'DELIVERED') continue;

      // Idempotency: check if EmailJob already exists for cross_sell + this order
      const existingJob = await prisma.emailJob.findFirst({
        where: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          flowId: 'cross_sell',
          variables: {
            path: ['order_number'],
            equals: order.orderNumber,
          },
        },
      });
      if (existingJob) continue;

      // Check suppression (cross-sell is marketing-category)
      if (await isSuppressed(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Check lifecycle opt-in (cross-sell uses lifecycle preference)
      if (await isLifecycleOptedOut(prisma, order.sellerId, order.customerEmail, logger)) continue;

      // Get optimal send time
      const preference = await prisma.customerEmailPreference.findUnique({
        where: { sellerId_email: { sellerId: order.sellerId, email: order.customerEmail } },
        select: { timezone: true },
      });
      const sendAt = getOptimalSendTime(preference?.timezone ?? null, now);

      const firstName = extractFirstName(order.customerName);
      const storeName = order.seller.name;
      const productName = order.items[0]?.productName ?? 'your purchase';

      const variables: Record<string, unknown> = {
        first_name: firstName,
        product_name: productName,
        order_number: order.orderNumber,
        store_name: storeName,
        store_url: '', // Resolved at send time
        email: order.customerEmail,
        unsubscribe_url: '',
      };

      const emailJob = await prisma.emailJob.create({
        data: {
          sellerId: order.sellerId,
          toEmail: order.customerEmail,
          toName: order.customerName ?? undefined,
          flowId: 'cross_sell',
          subject: '',
          variables: variables as any,
          scheduledAt: sendAt,
          priority: 4, // Marketing priority
          status: 'QUEUED',
        },
      });

      await emailSendQueue.add(
        'send-email',
        { emailJobId: emailJob.id },
        { jobId: `email-${emailJob.id}`, priority: 4 },
      );

      logger.log(`[L4-CrossSell] Scheduled cross-sell email for ${order.customerEmail} (order ${order.orderNumber})`);
      count++;
    } catch (err) {
      logger.error(`[L4-CrossSell] Failed for order ${order.id}`, err);
    }
  }

  return count;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Check if the email is suppressed (marketing suppression).
 */
async function isSuppressed(
  prisma: PrismaClient,
  sellerId: string,
  email: string,
  logger: { log: (msg: string) => void },
): Promise<boolean> {
  const suppression = await prisma.emailSuppression.findUnique({
    where: {
      sellerId_email: { sellerId, email },
    },
  });

  if (suppression && suppression.suppressMarketing) {
    logger.log(`Skipping lifecycle email for ${email} — suppressed (${suppression.reason})`);
    return true;
  }

  return false;
}

/**
 * Check if the customer has opted out of lifecycle emails.
 */
async function isLifecycleOptedOut(
  prisma: PrismaClient,
  sellerId: string,
  email: string,
  logger: { log: (msg: string) => void },
): Promise<boolean> {
  const preference = await prisma.customerEmailPreference.findUnique({
    where: { sellerId_email: { sellerId, email } },
    select: { lifecycleOptIn: true },
  });

  if (preference && !preference.lifecycleOptIn) {
    logger.log(`Skipping lifecycle email for ${email} — lifecycle opted out`);
    return true;
  }

  return false;
}

/**
 * Extract first name from a full name string.
 * Falls back to "there" if the name is missing.
 */
function extractFirstName(fullName: string | null): string {
  if (!fullName || fullName.trim() === '') return 'there';
  return fullName.trim().split(/\s+/)[0];
}
