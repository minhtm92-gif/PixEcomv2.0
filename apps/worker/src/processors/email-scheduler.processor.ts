/**
 * email-scheduler.processor.ts
 *
 * BullMQ job handler for the "pixecom-email-scheduler" queue.
 * Runs every 5 minutes (repeatable).
 *
 * Schedules recovery emails for abandoned carts and checkouts:
 *
 * Cart recovery (stage='cart'):
 *   R1-A: abandonedAt + 1 hour   (cart_recovery_1)
 *   R1-B: abandonedAt + 24 hours (cart_recovery_2)
 *   R1-C: abandonedAt + 48 hours (cart_recovery_3)
 *
 * Checkout recovery (stage='checkout'):
 *   R2-A: abandonedAt + 30 minutes (checkout_recovery_1)
 *   R2-B: abandonedAt + 6 hours    (checkout_recovery_2)
 *   R2-C: abandonedAt + 24 hours   (checkout_recovery_3)
 *
 * Error handling is per-cart: one failed cart does not abort the run.
 */

import { PrismaClient } from '@pixecom/database';
import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// ─── Recovery timing definitions ──────────────────────────────────────────────

interface RecoveryStep {
  emailNumber: number;
  flowId: string;
  delayMs: number;
}

const CART_RECOVERY_STEPS: RecoveryStep[] = [
  { emailNumber: 1, flowId: 'cart_recovery_1', delayMs: 1 * 60 * 60 * 1000 },          // +1 hour
  { emailNumber: 2, flowId: 'cart_recovery_2', delayMs: 24 * 60 * 60 * 1000 },         // +24 hours
  { emailNumber: 3, flowId: 'cart_recovery_3', delayMs: 48 * 60 * 60 * 1000 },         // +48 hours
];

const CHECKOUT_RECOVERY_STEPS: RecoveryStep[] = [
  { emailNumber: 1, flowId: 'checkout_recovery_1', delayMs: 30 * 60 * 1000 },          // +30 minutes
  { emailNumber: 2, flowId: 'checkout_recovery_2', delayMs: 6 * 60 * 60 * 1000 },      // +6 hours
  { emailNumber: 3, flowId: 'checkout_recovery_3', delayMs: 24 * 60 * 60 * 1000 },     // +24 hours
];

// ─── Processor ────────────────────────────────────────────────────────────────

export async function emailSchedulerProcessor(
  job: Job,
  prisma: PrismaClient,
): Promise<void> {
  const logger = {
    log: (msg: string) => console.log(`[EmailSchedulerProcessor][Job ${job.id}] ${msg}`),
    error: (msg: string, err?: unknown) =>
      console.error(`[EmailSchedulerProcessor][Job ${job.id}] ${msg}`, err ?? ''),
  };

  logger.log('Starting email scheduling run');

  const now = new Date();
  let scheduled = 0;

  // Create a BullMQ queue connection for pushing email-send jobs
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const emailSendQueue = new Queue('pixecom-email-send', {
    connection: redisConnection as any,
  });

  try {
    // ── 1. Schedule cart recovery emails ───────────────────────────────────

    const abandonedCarts = await prisma.abandonedCart.findMany({
      where: {
        stage: 'cart',
        email: { not: null },
        recoveredAt: null,
        expiresAt: { gt: now },
        recoveryEmailsSent: { lt: 3 },
      },
    });

    logger.log(`Found ${abandonedCarts.length} eligible abandoned carts`);

    for (const cart of abandonedCarts) {
      try {
        const emailsScheduled = await scheduleRecoveryEmails({
          cart,
          steps: CART_RECOVERY_STEPS,
          now,
          prisma,
          emailSendQueue,
          logger,
        });
        scheduled += emailsScheduled;
      } catch (err) {
        logger.error(`Failed to schedule cart recovery for cart ${cart.id}`, err);
      }
    }

    // ── 2. Schedule checkout recovery emails ──────────────────────────────

    const abandonedCheckouts = await prisma.abandonedCart.findMany({
      where: {
        stage: 'checkout',
        email: { not: null },
        recoveredAt: null,
        expiresAt: { gt: now },
        recoveryEmailsSent: { lt: 3 },
      },
    });

    logger.log(`Found ${abandonedCheckouts.length} eligible abandoned checkouts`);

    for (const cart of abandonedCheckouts) {
      try {
        const emailsScheduled = await scheduleRecoveryEmails({
          cart,
          steps: CHECKOUT_RECOVERY_STEPS,
          now,
          prisma,
          emailSendQueue,
          logger,
        });
        scheduled += emailsScheduled;
      } catch (err) {
        logger.error(`Failed to schedule checkout recovery for cart ${cart.id}`, err);
      }
    }

    // ── 3. Pick up QUEUED EmailJobs created by the API (transactional, etc.) ─
    // The API creates EmailJob records with status=QUEUED but does not push
    // to BullMQ. This step bridges the gap by pushing them to the send queue.

    const pendingApiJobs = await prisma.emailJob.findMany({
      where: {
        status: 'QUEUED',
        scheduledAt: { lte: now },
      },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
      take: 100,
    });

    let dispatched = 0;
    for (const ej of pendingApiJobs) {
      try {
        // Check if already in BullMQ (idempotency)
        const existing = await emailSendQueue.getJob(`email-${ej.id}`);
        if (existing) continue;

        await emailSendQueue.add(
          'send-email',
          { emailJobId: ej.id },
          { jobId: `email-${ej.id}`, priority: ej.priority },
        );
        dispatched++;
      } catch (err) {
        logger.error(`Failed to dispatch email job ${ej.id} to BullMQ`, err);
      }
    }

    if (dispatched > 0) {
      logger.log(`Dispatched ${dispatched} pending API email jobs to BullMQ`);
    }

    logger.log(`Email scheduling complete. Scheduled ${scheduled} recovery + dispatched ${dispatched} API jobs`);
  } catch (err) {
    logger.error('Email scheduler failed', err);
    throw err; // Let BullMQ mark the job as failed
  } finally {
    await emailSendQueue.close();
    await redisConnection.quit();
  }
}

// ─── Recovery email scheduling helper ─────────────────────────────────────────

async function scheduleRecoveryEmails(params: {
  cart: {
    id: string;
    sellerId: string;
    sessionId: string;
    email: string | null;
    items: any;
    totalValue: any;
    abandonedAt: Date;
    recoveryEmailsSent: number;
  };
  steps: RecoveryStep[];
  now: Date;
  prisma: PrismaClient;
  emailSendQueue: Queue;
  logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void };
}): Promise<number> {
  const { cart, steps, now, prisma, emailSendQueue, logger } = params;
  let emailsScheduled = 0;

  if (!cart.email) return 0;

  // Determine which email to send next based on recoveryEmailsSent
  const nextEmailNumber = cart.recoveryEmailsSent + 1;
  const step = steps.find((s) => s.emailNumber === nextEmailNumber);

  if (!step) return 0; // All emails already sent

  // Check timing: is it time to send this email?
  const sendAt = new Date(cart.abandonedAt.getTime() + step.delayMs);
  if (now < sendAt) return 0; // Not yet time

  // Check suppression list
  const suppression = await prisma.emailSuppression.findUnique({
    where: {
      sellerId_email: {
        sellerId: cart.sellerId,
        email: cart.email,
      },
    },
  });

  if (suppression && suppression.suppressMarketing) {
    logger.log(
      `Skipping recovery email for ${cart.email} — suppressed (${suppression.reason})`,
    );
    return 0;
  }

  // Check if we already created an EmailJob for this flow+session (idempotency)
  const existingJob = await prisma.emailJob.findFirst({
    where: {
      sellerId: cart.sellerId,
      toEmail: cart.email,
      flowId: step.flowId,
      variables: {
        path: ['session_id'],
        equals: cart.sessionId,
      },
    },
  });

  if (existingJob) {
    // Already scheduled, skip
    return 0;
  }

  // Build variables for template
  const items = Array.isArray(cart.items) ? cart.items : [];
  const firstItem = items[0] as Record<string, unknown> | undefined;

  const variables: Record<string, unknown> = {
    session_id: cart.sessionId,
    cart_id: cart.id,
    product_name: firstItem?.productName ?? firstItem?.productId ?? 'your item',
    product_image: firstItem?.productImage ?? '',
    cart_url: '', // Will be resolved by template or frontend
    total_value: Number(cart.totalValue) || 0,
    items_count: items.length,
  };

  // Email 3 (R1-C or R2-C) gets a real discount code
  if (step.emailNumber === 3) {
    try {
      const discountCode = await createRecoveryDiscountCode(prisma, cart.sellerId, 10, 48);
      variables.discount_code = discountCode.code;
      variables.discount_percentage = 10;

      // Build cart_url with discount code auto-applied
      // Resolve seller slug for the storefront URL
      const seller = await prisma.seller.findUnique({
        where: { id: cart.sellerId },
        select: { slug: true },
      });
      if (seller) {
        const storefrontBase = process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_STOREFRONT_URL || '';
        if (storefrontBase) {
          variables.cart_url = `${storefrontBase}/${seller.slug}?discount=${discountCode.code}`;
        }
      }
    } catch (err) {
      logger.error(`Failed to generate discount code for cart ${cart.id}`, err);
      // Fallback to no discount code — email 3 will still send without discount
      variables.discount_code = '';
      variables.discount_percentage = 10;
    }
  }

  // Link discount code to email job (will update after job creation)
  const discountCodeForJob = variables.discount_code as string | undefined;

  // Create EmailJob
  const emailJob = await prisma.emailJob.create({
    data: {
      sellerId: cart.sellerId,
      toEmail: cart.email,
      flowId: step.flowId,
      subject: '', // Will be resolved from template
      variables: variables as any,
      scheduledAt: sendAt,
      priority: 2, // Recovery priority
      status: 'QUEUED',
    },
  });

  // Link discount code to email job ID
  if (discountCodeForJob) {
    await prisma.discountCode.updateMany({
      where: {
        sellerId: cart.sellerId,
        code: discountCodeForJob,
        emailJobId: null,
      },
      data: { emailJobId: emailJob.id },
    });
  }

  // Push to BullMQ email-send queue
  await emailSendQueue.add(
    'send-email',
    { emailJobId: emailJob.id },
    {
      jobId: `email-${emailJob.id}`,
      priority: 2,
    },
  );

  // Increment recoveryEmailsSent on AbandonedCart
  await prisma.abandonedCart.update({
    where: { id: cart.id },
    data: {
      recoveryEmailsSent: { increment: 1 },
    },
  });

  logger.log(
    `Scheduled ${step.flowId} for ${cart.email} (cart ${cart.id}, session ${cart.sessionId})`,
  );

  emailsScheduled++;
  return emailsScheduled;
}

// ─── Discount code generator (inline, no NestJS DI in worker) ─────────────────

async function createRecoveryDiscountCode(
  prisma: PrismaClient,
  sellerId: string,
  percentage: number,
  expiryHours: number,
): Promise<{ code: string; id: string }> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const generateSuffix = (len: number) => {
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let code: string;
  let attempts = 0;

  while (true) {
    const suffix = generateSuffix(attempts < 10 ? 4 : 8);
    code = `SAVE${percentage}-${suffix}`;

    const existing = await prisma.discountCode.findUnique({
      where: { sellerId_code: { sellerId, code } },
    });
    if (!existing) break;

    attempts++;
    if (attempts >= 15) {
      throw new Error('Unable to generate unique discount code');
    }
  }

  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  const record = await prisma.discountCode.create({
    data: {
      sellerId,
      code,
      type: 'PERCENTAGE',
      value: percentage,
      maxUses: 1,
      usedCount: 0,
      expiresAt,
      isActive: true,
    },
  });

  return { code: record.code, id: record.id };
}
