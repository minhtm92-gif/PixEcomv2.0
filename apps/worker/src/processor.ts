import { Job } from 'bullmq';
import { PrismaClient } from '@pixecom/database';
import { StatsSyncJobData } from './queue';
import { MockProvider } from './providers/mock.provider';
import { fetchSellerEntities } from './pipeline/fetch-entities';
import { writeRaw } from './pipeline/write-raw';
import { aggregateDaily } from './pipeline/aggregate-daily';
import { rollupSellpage } from './pipeline/rollup-sellpage';

const provider = new MockProvider();

/**
 * Main BullMQ job processor.
 *
 * Runs the 3-tier pipeline for one seller / level / date:
 *   1. Fetch entity list for seller
 *   2. Generate mock stats (MockProvider.fetchStats)
 *   3. Append to ad_stats_raw
 *   4. Aggregate raw → ad_stats_daily (upsert)
 *   5. If CAMPAIGN level: roll up → sellpage_stats_daily (upsert)
 *
 * Each seller job is fully isolated — errors do not affect other sellers.
 */
export async function processJob(
  job: Job<StatsSyncJobData>,
  prisma: PrismaClient,
): Promise<void> {
  const { sellerId, dateFrom, dateTo, level } = job.data;
  const startMs = Date.now();

  // ── 1. Fetch entities ───────────────────────────────────────────────────
  const entities = await fetchSellerEntities(prisma, sellerId);

  let entityList: Array<{ id: string; externalId: string | null; budget: number }>;
  let entityIds: string[];

  if (level === 'CAMPAIGN') {
    entityList = entities.campaigns;
    entityIds = entities.campaigns.map((c) => c.id);
  } else if (level === 'ADSET') {
    entityList = entities.adsets;
    entityIds = entities.adsets.map((a) => a.id);
  } else {
    entityList = entities.ads;
    entityIds = entities.ads.map((a) => a.id);
  }

  if (entityList.length === 0) {
    log('info', 'stats-sync-complete', {
      jobId: job.id,
      sellerId,
      statLevel: level,
      date: dateFrom,
      rawInserted: 0,
      dailyUpserted: 0,
      sellpageUpserted: 0,
      durationMs: Date.now() - startMs,
      note: 'no entities found',
    });
    return;
  }

  // ── 2. Generate mock stats ──────────────────────────────────────────────
  const rawRows = await provider.fetchStats(
    sellerId,
    level,
    entityList,
    dateFrom,
    dateTo,
  );

  // ── 3. Append raw ───────────────────────────────────────────────────────
  const rawInserted = await writeRaw(prisma, rawRows);

  // ── 4. Aggregate → daily ────────────────────────────────────────────────
  const dailyUpserted = await aggregateDaily(
    prisma,
    sellerId,
    level,
    entityIds,
    dateFrom,
  );

  // ── 5. Sellpage rollup (CAMPAIGN only) ──────────────────────────────────
  let sellpageUpserted = 0;
  if (level === 'CAMPAIGN') {
    sellpageUpserted = await rollupSellpage(
      prisma,
      sellerId,
      entityIds,
      dateFrom,
    );
  }

  log('info', 'stats-sync-complete', {
    jobId: job.id,
    sellerId,
    statLevel: level,
    date: dateFrom,
    rawInserted,
    dailyUpserted,
    sellpageUpserted,
    durationMs: Date.now() - startMs,
  });
}

function log(
  level: 'info' | 'error',
  event: string,
  data: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ level, event, ...data, ts: new Date().toISOString() }));
}
