import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const QUEUE_NAME = 'stats-sync';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared Redis connection for the queue producer (used by both scheduler and API).
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Shared BullMQ Queue instance.
export const statsQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export interface StatsSyncJobData {
  sellerId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  level: 'CAMPAIGN' | 'ADSET' | 'AD';
}

/**
 * Enqueue one CAMPAIGN + ADSET + AD job for a seller on a given date.
 * Uses deterministic jobId so duplicates are silently skipped.
 */
export async function enqueueSellerSync(
  sellerId: string,
  date: string,
): Promise<string[]> {
  const levels: Array<'CAMPAIGN' | 'ADSET' | 'AD'> = ['CAMPAIGN', 'ADSET', 'AD'];
  const jobIds: string[] = [];

  for (const level of levels) {
    const jobId = makeJobId(sellerId, date, level);
    await statsQueue.add(
      'stats-sync',
      { sellerId, dateFrom: date, dateTo: date, level } satisfies StatsSyncJobData,
      { jobId },
    );
    jobIds.push(jobId);
  }

  return jobIds;
}

/**
 * Build a BullMQ-safe jobId (no colons allowed in BullMQ v5+).
 * Format: sync__<sellerId>__<dateFrom>__<dateTo>__<level>
 */
export function makeJobId(
  sellerId: string,
  date: string,
  level: 'CAMPAIGN' | 'ADSET' | 'AD',
): string {
  return `sync__${sellerId}__${date}__${date}__${level}`;
}
