import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function bootstrap() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker(
    'stats-sync',
    async (job) => {
      console.log(`Processing job ${job.id}:`, job.data);
      // Stats sync processor will be implemented in feature phase
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('PixEcom Worker started. Listening on queue: stats-sync');
}

bootstrap().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
