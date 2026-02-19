import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@pixecom/database';
import { QUEUE_NAME, StatsSyncJobData } from './queue';
import { processJob } from './processor';
import { startScheduler } from './scheduler';
import { startHealthServer } from './health';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKER_PORT = parseInt(process.env.WORKER_PORT ?? '3001', 10);
const CONCURRENCY = 5;

async function bootstrap() {
  // ── Prisma ─────────────────────────────────────────────────────────────────
  const prisma = new PrismaClient();
  await prisma.$connect();

  // ── BullMQ Worker ──────────────────────────────────────────────────────────
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<StatsSyncJobData>(
    QUEUE_NAME,
    (job) => processJob(job, prisma),
    {
      connection: connection as any,
      concurrency: CONCURRENCY,
    },
  );

  worker.on('completed', (job) => {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'job-completed',
        jobId: job.id,
        ts: new Date().toISOString(),
      }),
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'stats-sync-failed',
        jobId: job?.id,
        sellerId: job?.data?.sellerId,
        statLevel: job?.data?.level,
        attempt: job?.attemptsMade,
        error: err.message,
        ts: new Date().toISOString(),
      }),
    );
  });

  // ── Scheduler ──────────────────────────────────────────────────────────────
  startScheduler(prisma);

  // ── Health server ──────────────────────────────────────────────────────────
  startHealthServer(WORKER_PORT);

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'worker-started',
      queue: QUEUE_NAME,
      concurrency: CONCURRENCY,
      healthPort: WORKER_PORT,
      ts: new Date().toISOString(),
    }),
  );

  // Graceful shutdown
  const shutdown = async () => {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
