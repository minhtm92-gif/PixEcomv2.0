/**
 * PixEcom Stats Sync Worker
 *
 * BullMQ worker that processes two queues:
 *   1. "stats-sync"       — Meta ad stats (every 15 min)
 *   2. "storefront-stats" — Storefront event aggregation (every 15 min)
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
 */

import { PrismaClient } from '@pixecom/database';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { MetaStatsProvider } from './providers/meta-stats.provider';
import { statsSyncProcessor } from './processors/stats-sync.processor';
import { storefrontStatsProcessor } from './processors/storefront-stats.processor';

// ─── Configuration ────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'stats-sync';
const STOREFRONT_QUEUE_NAME = 'storefront-stats';
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const CONCURRENCY = 5;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  console.log('[Worker] Starting PixEcom Stats Sync Worker');

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

  // ── BullMQ Worker ──────────────────────────────────────────────────────────

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await statsSyncProcessor(job, prisma, statsProvider);
    },
    {
      connection: connection as any,
      concurrency: CONCURRENCY,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  // ── BullMQ Worker: storefront-stats ───────────────────────────────────────

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

  // ── Repeatable Job Scheduler ───────────────────────────────────────────────
  // Schedule repeatable jobs every 15 minutes.
  // BullMQ ensures only one instance is queued per repeat key.

  const queue = new Queue(QUEUE_NAME, { connection: connection as any });
  const storefrontQueue = new Queue(STOREFRONT_QUEUE_NAME, { connection: connection as any });

  // Remove any stale repeatable jobs from previous deployments
  const existingRepeatables = await queue.getRepeatableJobs();
  for (const job of existingRepeatables) {
    await queue.removeRepeatableByKey(job.key);
    console.log(`[Worker] Removed stale repeatable job: ${job.key}`);
  }

  const existingStorefrontRepeatables = await storefrontQueue.getRepeatableJobs();
  for (const job of existingStorefrontRepeatables) {
    await storefrontQueue.removeRepeatableByKey(job.key);
    console.log(`[Worker] Removed stale repeatable job: ${job.key}`);
  }

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

  // Trigger immediate first run
  await queue.add('full-sync', { type: 'full-sync', immediate: true });
  console.log('[Worker] Triggered immediate first sync run');

  await storefrontQueue.add('aggregate', { type: 'aggregate', immediate: true });
  console.log('[Worker] Triggered immediate storefront stats aggregation');

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal} — shutting down gracefully`);
    await worker.close();
    await storefrontWorker.close();
    await queue.close();
    await storefrontQueue.close();
    await prisma.$disconnect();
    await connection.quit();
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log(`[Worker] Listening on queues: ${QUEUE_NAME} (concurrency: ${CONCURRENCY}), ${STOREFRONT_QUEUE_NAME} (concurrency: 1)`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});
