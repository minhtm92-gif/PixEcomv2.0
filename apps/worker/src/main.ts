/**
<<<<<<< HEAD
 * PixEcom Worker — Milestone 2.3.7 (WS2)
 *
 * Structured JSON logging for all worker events.
 * Log shape: { ts, level, queue, jobId, sellerId?, durationMs?, msg }
 *
 * No secrets logged (no tokens, no URLs, no payloads).
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const QUEUE_NAME = "stats-sync";

// ── Structured logger ────────────────────────────────────────────────────────

function log(
  level: "info" | "warn" | "error",
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const record = {
    ts: new Date().toISOString(),
    level,
    queue: QUEUE_NAME,
    msg,
    ...(extra ?? {}),
  };
  // Always newline-delimited JSON — suitable for Railway / Datadog / Loki
  process.stdout.write(JSON.stringify(record) + "\n");
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
=======
 * PixEcom Worker
 *
 * BullMQ worker that processes six queues:
 *   1. "stats-sync"                    — Meta ad stats (every 15 min)
 *   2. "storefront-stats"              — Storefront event aggregation (every 15 min)
 *   3. "pixecom-email-send"            — Send individual email jobs (on-demand, concurrency 3)
 *   4. "pixecom-cart-tracker"          — Detect abandoned carts/checkouts (every 5 min)
 *   5. "pixecom-email-scheduler"       — Schedule recovery emails (every 5 min)
 *   6. "pixecom-lifecycle-scheduler"   — Schedule lifecycle emails (every 30 min)
 *
 * Architecture:
 *   Queue:  stats-sync (Redis-backed, BullMQ)
 *   Job:    { type: 'full-sync' } — triggered every 15 min
 *   Processor: statsSyncProcessor (processors/stats-sync.processor.ts)
 *   Stats provider: MetaStatsProvider (providers/meta-stats.provider.ts)
 *
 *   Queue:  storefront-stats (Redis-backed, BullMQ)
 *   Job:    { type: 'aggregate' } — triggered every 15 min
 *   Processor: storefrontStatsProcessor (processors/storefront-stats.processor.ts)
 *
 *   Queue:  pixecom-email-send (Redis-backed, BullMQ)
 *   Job:    { emailJobId: string } — pushed by API or email-scheduler
 *   Processor: emailSendProcessor (processors/email-send.processor.ts)
 *
 *   Queue:  pixecom-cart-tracker (Redis-backed, BullMQ)
 *   Job:    { type: 'detect' } — triggered every 5 min
 *   Processor: cartTrackerProcessor (processors/cart-tracker.processor.ts)
 *
 *   Queue:  pixecom-email-scheduler (Redis-backed, BullMQ)
 *   Job:    { type: 'schedule' } — triggered every 5 min
 *   Processor: emailSchedulerProcessor (processors/email-scheduler.processor.ts)
 *
 *   Queue:  pixecom-lifecycle-scheduler (Redis-backed, BullMQ)
 *   Job:    { type: 'lifecycle' } — triggered every 30 min
 *   Processor: lifecycleSchedulerProcessor (processors/lifecycle-scheduler.processor.ts)
 */

import { PrismaClient } from '@pixecom/database';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { MetaStatsProvider } from './providers/meta-stats.provider';
import { statsSyncProcessor } from './processors/stats-sync.processor';
import { storefrontStatsProcessor } from './processors/storefront-stats.processor';
import { emailSendProcessor } from './processors/email-send.processor';
import { cartTrackerProcessor } from './processors/cart-tracker.processor';
import { emailSchedulerProcessor } from './processors/email-scheduler.processor';
import { lifecycleSchedulerProcessor } from './processors/lifecycle-scheduler.processor';

// ─── Configuration ────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'stats-sync';
const STOREFRONT_QUEUE_NAME = 'storefront-stats';
const EMAIL_SEND_QUEUE_NAME = 'pixecom-email-send';
const CART_TRACKER_QUEUE_NAME = 'pixecom-cart-tracker';
const EMAIL_SCHEDULER_QUEUE_NAME = 'pixecom-email-scheduler';
const LIFECYCLE_SCHEDULER_QUEUE_NAME = 'pixecom-lifecycle-scheduler';
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LIFECYCLE_CRON_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const CONCURRENCY = 5;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
>>>>>>> feature/2.4.2-alpha-ads-seed-v1

async function bootstrap() {
  console.log('[Worker] Starting PixEcom Worker');

  // Redis connection (maxRetriesPerRequest=null required for BullMQ)
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  // Prisma client
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('[Worker] Database connected');

  // Stats provider (real Meta API)
  const statsProvider = new MetaStatsProvider({
    log: (msg: string) => console.log(`[MetaStatsProvider] ${msg}`),
    error: (msg: string, err?: unknown) => console.error(`[MetaStatsProvider] ${msg}`, err ?? ''),
  });

  // ── BullMQ Worker: stats-sync ───────────────────────────────────────────────

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
<<<<<<< HEAD
      const startedAt = Date.now();
      const jobId    = job.id ?? "unknown";
      // sellerId is expected in job.data — never log tokens or URLs
      const sellerId = (job.data as Record<string, unknown>)?.sellerId as string | undefined;

      log("info", "Job started", { jobId, sellerId });

      // Stats sync processor — to be implemented in feature phase
      // (Phase 1 stub: no-op)

      const durationMs = Date.now() - startedAt;
      log("info", "Job completed", { jobId, sellerId, durationMs });
=======
      await statsSyncProcessor(job, prisma, statsProvider);
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
    },
    {
      connection: connection as any,
      concurrency: CONCURRENCY,
    },
  );

<<<<<<< HEAD
  worker.on("completed", (job) => {
    log("info", "Job marked completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    log("error", "Job failed", {
      jobId: job?.id ?? "unknown",
      errorMsg: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "Worker error", { errorMsg: err.message });
  });

  log("info", "Worker started", { redisConnected: true });
=======
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  // ── BullMQ Worker: storefront-stats ─────────────────────────────────────────

  const storefrontWorker = new Worker(
    STOREFRONT_QUEUE_NAME,
    async (job) => {
      await storefrontStatsProcessor(job, prisma);
    },
    {
      connection: connection as any,
      concurrency: 1, // Single concurrency — lightweight aggregation
    },
  );

  storefrontWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  storefrontWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  storefrontWorker.on('error', (err) => {
    console.error('[Worker] Storefront worker error:', err.message);
  });

  // ── BullMQ Worker: email-send ───────────────────────────────────────────────

  const emailSendWorker = new Worker(
    EMAIL_SEND_QUEUE_NAME,
    async (job) => {
      await emailSendProcessor(job, prisma);
    },
    {
      connection: connection as any,
      concurrency: 3, // Parallel email sends
    },
  );

  emailSendWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  emailSendWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  emailSendWorker.on('error', (err) => {
    console.error('[Worker] Email send worker error:', err.message);
  });

  // ── BullMQ Worker: cart-tracker ─────────────────────────────────────────────

  const cartTrackerWorker = new Worker(
    CART_TRACKER_QUEUE_NAME,
    async (job) => {
      await cartTrackerProcessor(job, prisma);
    },
    {
      connection: connection as any,
      concurrency: 1, // Serial — runs every 5 min
    },
  );

  cartTrackerWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  cartTrackerWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  cartTrackerWorker.on('error', (err) => {
    console.error('[Worker] Cart tracker worker error:', err.message);
  });

  // ── BullMQ Worker: email-scheduler ──────────────────────────────────────────

  const emailSchedulerWorker = new Worker(
    EMAIL_SCHEDULER_QUEUE_NAME,
    async (job) => {
      await emailSchedulerProcessor(job, prisma);
    },
    {
      connection: connection as any,
      concurrency: 1, // Serial — runs every 5 min
    },
  );

  emailSchedulerWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  emailSchedulerWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  emailSchedulerWorker.on('error', (err) => {
    console.error('[Worker] Email scheduler worker error:', err.message);
  });

  // ── BullMQ Worker: lifecycle-scheduler ────────────────────────────────────

  const lifecycleSchedulerWorker = new Worker(
    LIFECYCLE_SCHEDULER_QUEUE_NAME,
    async (job) => {
      await lifecycleSchedulerProcessor(job, prisma);
    },
    {
      connection: connection as any,
      concurrency: 1, // Serial — runs every 30 min
    },
  );

  lifecycleSchedulerWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  lifecycleSchedulerWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  lifecycleSchedulerWorker.on('error', (err) => {
    console.error('[Worker] Lifecycle scheduler worker error:', err.message);
  });

  // ── Repeatable Job Scheduler ────────────────────────────────────────────────
  // Schedule repeatable jobs. BullMQ ensures only one instance is queued per repeat key.

  const queue = new Queue(QUEUE_NAME, { connection: connection as any });
  const storefrontQueue = new Queue(STOREFRONT_QUEUE_NAME, { connection: connection as any });
  const emailSendQueue = new Queue(EMAIL_SEND_QUEUE_NAME, { connection: connection as any });
  const cartTrackerQueue = new Queue(CART_TRACKER_QUEUE_NAME, { connection: connection as any });
  const emailSchedulerQueue = new Queue(EMAIL_SCHEDULER_QUEUE_NAME, { connection: connection as any });
  const lifecycleSchedulerQueue = new Queue(LIFECYCLE_SCHEDULER_QUEUE_NAME, { connection: connection as any });

  // Remove any stale repeatable jobs from previous deployments
  const allQueues = [queue, storefrontQueue, cartTrackerQueue, emailSchedulerQueue, lifecycleSchedulerQueue];
  for (const q of allQueues) {
    const existingRepeatables = await q.getRepeatableJobs();
    for (const rJob of existingRepeatables) {
      await q.removeRepeatableByKey(rJob.key);
      console.log(`[Worker] Removed stale repeatable job: ${rJob.key}`);
    }
  }

  // ── Stats sync: every 15 minutes ──

  await queue.add(
    'full-sync',
    { type: 'full-sync' },
    {
      repeat: { every: SYNC_INTERVAL_MS },
    },
  );

  console.log(
    `[Worker] Scheduled repeatable job "full-sync" every ${SYNC_INTERVAL_MS / 1000}s (${SYNC_INTERVAL_MS / 60000} min)`,
  );

  // ── Storefront stats: every 15 minutes ──

  await storefrontQueue.add(
    'aggregate',
    { type: 'aggregate' },
    {
      repeat: { every: SYNC_INTERVAL_MS },
    },
  );

  console.log(
    `[Worker] Scheduled repeatable job "storefront-stats:aggregate" every ${SYNC_INTERVAL_MS / 1000}s (${SYNC_INTERVAL_MS / 60000} min)`,
  );

  // ── Cart tracker: every 5 minutes ──

  await cartTrackerQueue.add(
    'detect',
    { type: 'detect' },
    {
      repeat: { every: EMAIL_CRON_INTERVAL_MS },
    },
  );

  console.log(
    `[Worker] Scheduled repeatable job "cart-tracker:detect" every ${EMAIL_CRON_INTERVAL_MS / 1000}s (${EMAIL_CRON_INTERVAL_MS / 60000} min)`,
  );

  // ── Email scheduler: every 5 minutes ──

  await emailSchedulerQueue.add(
    'schedule',
    { type: 'schedule' },
    {
      repeat: { every: EMAIL_CRON_INTERVAL_MS },
    },
  );

  console.log(
    `[Worker] Scheduled repeatable job "email-scheduler:schedule" every ${EMAIL_CRON_INTERVAL_MS / 1000}s (${EMAIL_CRON_INTERVAL_MS / 60000} min)`,
  );

  // ── Lifecycle scheduler: every 30 minutes ──

  await lifecycleSchedulerQueue.add(
    'lifecycle',
    { type: 'lifecycle' },
    {
      repeat: { every: LIFECYCLE_CRON_INTERVAL_MS },
    },
  );

  console.log(
    `[Worker] Scheduled repeatable job "lifecycle-scheduler:lifecycle" every ${LIFECYCLE_CRON_INTERVAL_MS / 1000}s (${LIFECYCLE_CRON_INTERVAL_MS / 60000} min)`,
  );

  // Trigger immediate first run for stats queues
  await queue.add('full-sync', { type: 'full-sync', immediate: true });
  console.log('[Worker] Triggered immediate first sync run');

  await storefrontQueue.add('aggregate', { type: 'aggregate', immediate: true });
  console.log('[Worker] Triggered immediate storefront stats aggregation');

  // Trigger immediate first run for email marketing queues
  await cartTrackerQueue.add('detect', { type: 'detect', immediate: true });
  console.log('[Worker] Triggered immediate cart tracker run');

  await emailSchedulerQueue.add('schedule', { type: 'schedule', immediate: true });
  console.log('[Worker] Triggered immediate email scheduler run');

  await lifecycleSchedulerQueue.add('lifecycle', { type: 'lifecycle', immediate: true });
  console.log('[Worker] Triggered immediate lifecycle scheduler run');

  // Note: email-send queue does NOT get a repeatable job — it processes on-demand items

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal} — shutting down gracefully`);
    await worker.close();
    await storefrontWorker.close();
    await emailSendWorker.close();
    await cartTrackerWorker.close();
    await emailSchedulerWorker.close();
    await lifecycleSchedulerWorker.close();
    await queue.close();
    await storefrontQueue.close();
    await emailSendQueue.close();
    await cartTrackerQueue.close();
    await emailSchedulerQueue.close();
    await lifecycleSchedulerQueue.close();
    await prisma.$disconnect();
    await connection.quit();
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log(
    `[Worker] Listening on queues: ` +
    `${QUEUE_NAME} (concurrency: ${CONCURRENCY}), ` +
    `${STOREFRONT_QUEUE_NAME} (concurrency: 1), ` +
    `${EMAIL_SEND_QUEUE_NAME} (concurrency: 3), ` +
    `${CART_TRACKER_QUEUE_NAME} (concurrency: 1), ` +
    `${EMAIL_SCHEDULER_QUEUE_NAME} (concurrency: 1), ` +
    `${LIFECYCLE_SCHEDULER_QUEUE_NAME} (concurrency: 1)`,
  );
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
}

// ─── Entry point ──────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
<<<<<<< HEAD
  process.stdout.write(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      queue: QUEUE_NAME,
      msg: "Worker failed to start",
      errorMsg: (err as Error).message,
    }) + "\n",
  );
=======
  console.error('[Worker] Failed to start:', err);
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  process.exit(1);
});
