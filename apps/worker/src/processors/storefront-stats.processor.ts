/**
 * storefront-stats.processor.ts
 *
 * BullMQ job handler for "storefront-stats" queue.
 * Runs every 15 minutes.
 *
 * 1. Query StorefrontEvent rows from the last 24 hours
 * 2. Group by (sellerId, sellpageId, date, eventType) → COUNT
 * 3. Upsert SellpageStatsDaily with adSource='organic'
 *
 * Idempotent: uses upsert so safe to re-run.
 */

import { PrismaClient } from '@pixecom/database';
import type { Job } from 'bullmq';

// ─── Types for raw SQL result ────────────────────────────────────────────────

interface EventAggRow {
  seller_id: string;
  sellpage_id: string;
  stat_date: Date;
  event_type: string;
  event_count: bigint;
  total_value: string; // Decimal comes back as string from raw SQL
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || !isFinite(denominator) || !isFinite(numerator)) return 0;
  return numerator / denominator;
}

// ─── Processor ───────────────────────────────────────────────────────────────

export async function storefrontStatsProcessor(
  job: Job,
  prisma: PrismaClient,
): Promise<void> {
  const logger = {
    log: (msg: string) =>
      console.log(`[StorefrontStatsProcessor][Job ${job.id}] ${msg}`),
    error: (msg: string, err?: unknown) =>
      console.error(`[StorefrontStatsProcessor][Job ${job.id}] ${msg}`, err ?? ''),
  };

  logger.log('Starting storefront stats aggregation');

  // Aggregation window: last 24 hours (catch any missed events)
  const since = new Date();
  since.setHours(since.getHours() - 24);

  try {
    // 1. Query StorefrontEvent grouped by seller, sellpage, date, eventType
    const rows = await prisma.$queryRawUnsafe<EventAggRow[]>(
      `SELECT
        seller_id,
        sellpage_id,
        DATE(created_at) as stat_date,
        event_type,
        COUNT(*) as event_count,
        COALESCE(SUM(value), 0) as total_value
      FROM storefront_events
      WHERE created_at >= $1
        AND sellpage_id IS NOT NULL
      GROUP BY seller_id, sellpage_id, DATE(created_at), event_type`,
      since,
    );

    if (rows.length === 0) {
      logger.log('No storefront events found in the last 24 hours');
      return;
    }

    logger.log(`Found ${rows.length} aggregated event groups`);

    // 2. Group rows by (sellerId, sellpageId, statDate) composite key
    const groupMap = new Map<
      string,
      {
        sellerId: string;
        sellpageId: string;
        statDate: Date;
        events: Map<string, { count: number; value: number }>;
      }
    >();

    for (const row of rows) {
      const key = `${row.seller_id}:${row.sellpage_id}:${row.stat_date.toISOString().slice(0, 10)}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          sellerId: row.seller_id,
          sellpageId: row.sellpage_id,
          statDate: row.stat_date,
          events: new Map(),
        });
      }
      groupMap.get(key)!.events.set(row.event_type, {
        count: Number(row.event_count),
        value: parseFloat(row.total_value) || 0,
      });
    }

    // 3. Upsert SellpageStatsDaily for each group
    let upserted = 0;

    for (const group of groupMap.values()) {
      try {
        const contentViews = group.events.get('content_view')?.count ?? 0;
        const addToCart = group.events.get('add_to_cart')?.count ?? 0;
        const checkoutInitiated = group.events.get('checkout')?.count ?? 0;
        const purchases = group.events.get('purchase')?.count ?? 0;
        const revenue = group.events.get('purchase')?.value ?? 0;

        // Conversion rates
        const cr1 = safeDivide(checkoutInitiated, contentViews) * 100; // checkout/views
        const cr2 = safeDivide(purchases, checkoutInitiated) * 100;    // purchase/checkout
        const cr3 = safeDivide(purchases, contentViews) * 100;         // purchase/views

        // Normalize statDate to midnight UTC
        const statDate = new Date(group.statDate.toISOString().slice(0, 10) + 'T00:00:00.000Z');

        await prisma.sellpageStatsDaily.upsert({
          where: {
            uq_sellpage_stats_daily: {
              sellerId: group.sellerId,
              sellpageId: group.sellpageId,
              statDate,
              adSource: 'organic',
            },
          },
          update: {
            contentViews,
            addToCart,
            checkoutInitiated,
            purchases,
            revenue,
            ordersCount: purchases,
            cr1,
            cr2,
            cr3,
          },
          create: {
            sellerId: group.sellerId,
            sellpageId: group.sellpageId,
            statDate,
            adSource: 'organic',
            contentViews,
            addToCart,
            checkoutInitiated,
            purchases,
            revenue,
            ordersCount: purchases,
            adSpend: 0,
            roas: 0,
            cpm: 0,
            ctr: 0,
            linkClicks: 0,
            costPerPurchase: 0,
            cr1,
            cr2,
            cr3,
          },
        });

        upserted++;
      } catch (err) {
        logger.error(
          `Failed to upsert stats for seller=${group.sellerId} sellpage=${group.sellpageId}`,
          err,
        );
        // Continue — one failed sellpage should not abort the run
      }
    }

    logger.log(`Storefront stats aggregation complete. Upserted ${upserted} rows`);
  } catch (err) {
    logger.error('Storefront stats aggregation failed', err);
    throw err; // Let BullMQ mark the job as failed
  }
}
