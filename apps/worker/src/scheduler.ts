import cron from 'node-cron';
import { PrismaClient } from '@pixecom/database';
import { fetchEligibleSellerIds } from './pipeline/fetch-entities';
import { enqueueSellerSync } from './queue';

const CRON_EXPRESSION = '*/5 * * * *'; // every 5 minutes

/**
 * Start the cron scheduler.
 *
 * Every 5 minutes:
 *   1. Query DB for eligible sellers (active AD_ACCOUNT + active/paused campaign)
 *   2. Enqueue CAMPAIGN + ADSET + AD jobs for each seller for today (UTC)
 *
 * Duplicate jobs for the same seller/date/level are silently skipped by BullMQ
 * (jobId dedup).
 */
export function startScheduler(prisma: PrismaClient): void {
  cron.schedule(CRON_EXPRESSION, async () => {
    const date = todayUTC();
    let enqueuedCount = 0;

    try {
      const sellerIds = await fetchEligibleSellerIds(prisma);

      for (const sellerId of sellerIds) {
        await enqueueSellerSync(sellerId, date);
        enqueuedCount += 3; // 3 jobs per seller (CAMPAIGN/ADSET/AD)
      }

      console.log(
        JSON.stringify({
          level: 'info',
          event: 'scheduler-tick',
          date,
          eligibleSellers: sellerIds.length,
          jobsEnqueued: enqueuedCount,
          ts: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'scheduler-tick-failed',
          date,
          error: (err as Error).message,
          ts: new Date().toISOString(),
        }),
      );
    }
  });

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'scheduler-started',
      cron: CRON_EXPRESSION,
      ts: new Date().toISOString(),
    }),
  );
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
