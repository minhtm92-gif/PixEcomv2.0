/**
 * stats-sync.processor.ts
 *
 * BullMQ job handler for the "stats-sync" queue.
 *
 * Run order per job:
 *  1. Load all active AD_ACCOUNT FbConnections (all sellers)
 *  2. For each account: decrypt token → fetch Meta insights (3 levels)
 *  3. Bulk insert AdStatsRaw rows
 *  4. Upsert AdStatsDaily (aggregate raw → daily per entity)
 *  5. Upsert SellpageStatsDaily (aggregate campaign stats → sellpage)
 *
 * Errors are caught per-account — one bad account does not abort the run.
 */

import { PrismaClient } from '@pixecom/database';
import type { Job } from 'bullmq';
import { createDecipheriv } from 'crypto';
import { IStatsProvider } from '../providers/types';
import { aggregateStats, MappedStats } from '../utils/field-mapper';

// ─── Token decryption (inline — mirrors MetaTokenService without NestJS DI) ──

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_HEX_LEN = 64;

function resolveKey(): Buffer {
  const keyHex = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== KEY_HEX_LEN) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('META_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
    }
    // DEV: generate warning only — ephemeral key means no real token can be decrypted
    console.warn('[StatsSyncProcessor] META_TOKEN_ENCRYPTION_KEY not set — using null key (DEV)');
    return Buffer.alloc(32, 0);
  }
  return Buffer.from(keyHex, 'hex');
}

function decryptToken(encToken: string, key: Buffer): string {
  const payload = Buffer.from(encToken, 'base64').toString('utf8');
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, ciphertextHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('Invalid token component lengths');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Return YYYY-MM-DD for today minus N days */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Level → StatsEntityType mapping ─────────────────────────────────────────

const LEVEL_TO_ENTITY_TYPE: Record<string, 'CAMPAIGN' | 'ADSET' | 'AD'> = {
  campaign: 'CAMPAIGN',
  adset: 'ADSET',
  ad: 'AD',
};

// ─── Entity ID resolution (external → internal UUID) ─────────────────────────

type EntityLookup = {
  externalToInternal: Map<string, string>;
};

async function buildEntityLookup(
  prisma: PrismaClient,
  sellerId: string,
): Promise<{ campaigns: EntityLookup; adsets: EntityLookup; ads: EntityLookup }> {
  const [campaigns, adsets, ads] = await Promise.all([
    prisma.campaign.findMany({
      where: { sellerId, externalCampaignId: { not: null } },
      select: { id: true, externalCampaignId: true },
    }),
    prisma.adset.findMany({
      where: { sellerId, externalAdsetId: { not: null } },
      select: { id: true, externalAdsetId: true },
    }),
    prisma.ad.findMany({
      where: { sellerId, externalAdId: { not: null } },
      select: { id: true, externalAdId: true },
    }),
  ]);

  return {
    campaigns: {
      externalToInternal: new Map(
        campaigns.map((c) => [c.externalCampaignId!, c.id]),
      ),
    },
    adsets: {
      externalToInternal: new Map(
        adsets.map((a) => [a.externalAdsetId!, a.id]),
      ),
    },
    ads: {
      externalToInternal: new Map(
        ads.map((a) => [a.externalAdId!, a.id]),
      ),
    },
  };
}

function resolveInternalId(
  lookup: EntityLookup,
  externalId: string,
): string | null {
  return lookup.externalToInternal.get(externalId) ?? null;
}

// ─── Processor ────────────────────────────────────────────────────────────────

export async function statsSyncProcessor(
  job: Job,
  prisma: PrismaClient,
  statsProvider: IStatsProvider,
): Promise<void> {
  const logger = {
    log: (msg: string) => console.log(`[StatsSyncProcessor][Job ${job.id}] ${msg}`),
    error: (msg: string, err?: unknown) =>
      console.error(`[StatsSyncProcessor][Job ${job.id}] ${msg}`, err ?? ''),
  };

  logger.log('Starting stats sync run');

  // Date range: last 3 days (catch late conversions from Meta's attribution window)
  const dateFrom = daysAgo(3);
  const dateTo = daysAgo(0); // today
  logger.log(`Date range: ${dateFrom} → ${dateTo}`);

  // 1. Load all active AD_ACCOUNT connections
  const adAccounts = await prisma.fbConnection.findMany({
    where: { connectionType: 'AD_ACCOUNT', isActive: true },
    select: {
      id: true,
      sellerId: true,
      externalId: true,
      accessTokenEnc: true,
    },
  });

  logger.log(`Found ${adAccounts.length} active AD_ACCOUNT connections`);

  const encKey = resolveKey();
  let processed = 0;
  let skipped = 0;

  for (const account of adAccounts) {
    try {
      if (!account.accessTokenEnc) {
        logger.log(`Skipping account ${account.externalId} — no access token stored`);
        skipped++;
        continue;
      }

      // 2a. Decrypt token
      const accessToken = decryptToken(account.accessTokenEnc, encKey);

      // 2b. Fetch Meta insights
      const fetchResult = await statsProvider.fetchForAccount(
        account.id,
        account.externalId,
        accessToken,
        dateFrom,
        dateTo,
      );

      if (fetchResult.entities.length === 0) {
        logger.log(`No stats returned for account ${account.externalId}`);
        processed++;
        continue;
      }

      // 2c. Resolve internal UUIDs for entities
      const lookup = await buildEntityLookup(prisma, account.sellerId);

      // 2d. Insert AdStatsRaw + upsert AdStatsDaily
      for (const entity of fetchResult.entities) {
        const entityType = LEVEL_TO_ENTITY_TYPE[entity.level];
        if (!entityType) continue;

        // Resolve internal UUID from external ID
        let internalId: string | null = null;
        if (entity.level === 'campaign') {
          internalId = resolveInternalId(lookup.campaigns, entity.externalEntityId);
        } else if (entity.level === 'adset') {
          internalId = resolveInternalId(lookup.adsets, entity.externalEntityId);
        } else if (entity.level === 'ad') {
          internalId = resolveInternalId(lookup.ads, entity.externalEntityId);
        }

        if (!internalId) {
          // Entity exists in Meta but not yet in our DB — skip
          continue;
        }

        const s = entity.stats;
        const statDate = new Date(`${s.dateStart}T00:00:00.000Z`);

        // Insert AdStatsRaw
        await prisma.adStatsRaw.create({
          data: {
            sellerId: account.sellerId,
            entityType,
            entityId: internalId,
            externalEntityId: entity.externalEntityId,
            fetchedAt: new Date(),
            dateStart: new Date(`${s.dateStart}T00:00:00.000Z`),
            dateStop: new Date(`${s.dateStop}T00:00:00.000Z`),
            spend: s.spend,
            impressions: s.impressions,
            cpm: s.cpm,
            ctr: s.ctr,
            cpc: s.cpc,
            linkClicks: s.linkClicks,
            contentViews: s.contentViews,
            addToCart: 0, // not fetched from Meta currently
            checkoutInitiated: s.checkoutInitiated,
            purchases: s.purchases,
            purchaseValue: s.purchaseValue,
            costPerPurchase: s.costPerPurchase,
            roas: s.roas,
          },
        });

        // Upsert AdStatsDaily
        await prisma.adStatsDaily.upsert({
          where: {
            uq_ad_stats_daily: {
              sellerId: account.sellerId,
              entityType,
              entityId: internalId,
              statDate,
            },
          },
          update: {
            spend: s.spend,
            impressions: s.impressions,
            cpm: s.cpm,
            ctr: s.ctr,
            cpc: s.cpc,
            linkClicks: s.linkClicks,
            contentViews: s.contentViews,
            addToCart: 0,
            checkoutInitiated: s.checkoutInitiated,
            purchases: s.purchases,
            purchaseValue: s.purchaseValue,
            costPerPurchase: s.costPerPurchase,
            roas: s.roas,
          },
          create: {
            sellerId: account.sellerId,
            entityType,
            entityId: internalId,
            statDate,
            spend: s.spend,
            impressions: s.impressions,
            cpm: s.cpm,
            ctr: s.ctr,
            cpc: s.cpc,
            linkClicks: s.linkClicks,
            contentViews: s.contentViews,
            addToCart: 0,
            checkoutInitiated: s.checkoutInitiated,
            purchases: s.purchases,
            purchaseValue: s.purchaseValue,
            costPerPurchase: s.costPerPurchase,
            roas: s.roas,
          },
        });
      }

      // 3. SellpageStatsDaily aggregation
      await aggregateSellpageStats(prisma, account.sellerId, dateFrom, dateTo, logger);

      processed++;
      logger.log(`Processed account ${account.externalId}: ${fetchResult.entities.length} entity-day rows`);
    } catch (err) {
      // Log and continue — one bad account must not abort the run
      logger.error(
        `Error processing account ${account.externalId} (seller ${account.sellerId})`,
        err,
      );
      skipped++;
    }
  }

  logger.log(`Stats sync complete. Processed: ${processed}, Skipped: ${skipped}`);
}

// ─── SellpageStatsDaily aggregation ──────────────────────────────────────────

/**
 * After campaign-level AdStatsDaily are upserted, aggregate per sellpage.
 *
 * Strategy:
 *  1. Load all sellpages for this seller
 *  2. For each sellpage, find all campaigns (via sellpageId)
 *  3. Sum AdStatsDaily CAMPAIGN rows for those campaigns per statDate
 *  4. Upsert SellpageStatsDaily
 */
async function aggregateSellpageStats(
  prisma: PrismaClient,
  sellerId: string,
  dateFrom: string,
  dateTo: string,
  logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): Promise<void> {
  try {
    // Load all sellpages for this seller
    const sellpages = await prisma.sellpage.findMany({
      where: { sellerId },
      select: { id: true },
    });

    for (const sellpage of sellpages) {
      // All campaigns for this sellpage
      const campaigns = await prisma.campaign.findMany({
        where: { sellerId, sellpageId: sellpage.id, externalCampaignId: { not: null } },
        select: { id: true },
      });

      if (campaigns.length === 0) continue;
      const campaignIds = campaigns.map((c) => c.id);

      // Get AdStatsDaily CAMPAIGN rows for the date range
      const dailyRows = await prisma.adStatsDaily.findMany({
        where: {
          sellerId,
          entityType: 'CAMPAIGN',
          entityId: { in: campaignIds },
          statDate: {
            gte: new Date(`${dateFrom}T00:00:00.000Z`),
            lte: new Date(`${dateTo}T23:59:59.000Z`),
          },
        },
        select: {
          statDate: true,
          spend: true,
          impressions: true,
          cpm: true,
          ctr: true,
          cpc: true,
          linkClicks: true,
          contentViews: true,
          checkoutInitiated: true,
          purchases: true,
          purchaseValue: true,
          costPerPurchase: true,
          roas: true,
        },
      });

      if (dailyRows.length === 0) continue;

      // Group by statDate
      const byDate = new Map<string, typeof dailyRows>();
      for (const row of dailyRows) {
        const key = row.statDate.toISOString().slice(0, 10);
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key)!.push(row);
      }

      // Aggregate + upsert per date
      for (const [dateKey, rows] of byDate.entries()) {
        // Build MappedStats-compatible objects from DB rows
        const mappedRows: MappedStats[] = rows.map((r) => ({
          dateStart: dateKey,
          dateStop: dateKey,
          spend: Number(r.spend),
          impressions: Number(r.impressions),
          cpm: Number(r.cpm),
          ctr: Number(r.ctr),
          cpc: Number(r.cpc),
          linkClicks: Number(r.linkClicks),
          contentViews: Number(r.contentViews),
          checkoutInitiated: Number(r.checkoutInitiated),
          purchases: Number(r.purchases),
          purchaseValue: Number(r.purchaseValue),
          costPerPurchase: Number(r.costPerPurchase),
          roas: Number(r.roas),
          addToCart: 0,
        } as MappedStats));

        const agg = aggregateStats(mappedRows);
        const statDate = new Date(`${dateKey}T00:00:00.000Z`);

        await prisma.sellpageStatsDaily.upsert({
          where: {
            uq_sellpage_stats_daily: {
              sellerId,
              sellpageId: sellpage.id,
              statDate,
              adSource: 'facebook',
            },
          },
          update: {
            revenue: agg.purchaseValue,
            ordersCount: agg.purchases,
            adSpend: agg.spend,
            roas: agg.roas,
            cpm: agg.cpm,
            ctr: agg.ctr,
            linkClicks: agg.linkClicks,
            contentViews: agg.contentViews,
            checkoutInitiated: agg.checkoutInitiated,
            purchases: agg.purchases,
            costPerPurchase: agg.costPerPurchase,
            // cr1/cr2/cr3: funnel conversion rates (derived)
            cr1: safeDivideLocal(agg.contentViews, agg.impressions) * 100,
            cr2: safeDivideLocal(agg.checkoutInitiated, agg.contentViews) * 100,
            cr3: safeDivideLocal(agg.purchases, agg.checkoutInitiated) * 100,
          },
          create: {
            sellerId,
            sellpageId: sellpage.id,
            statDate,
            adSource: 'facebook',
            revenue: agg.purchaseValue,
            ordersCount: agg.purchases,
            adSpend: agg.spend,
            roas: agg.roas,
            cpm: agg.cpm,
            ctr: agg.ctr,
            linkClicks: agg.linkClicks,
            contentViews: agg.contentViews,
            addToCart: 0,
            checkoutInitiated: agg.checkoutInitiated,
            purchases: agg.purchases,
            costPerPurchase: agg.costPerPurchase,
            cr1: safeDivideLocal(agg.contentViews, agg.impressions) * 100,
            cr2: safeDivideLocal(agg.checkoutInitiated, agg.contentViews) * 100,
            cr3: safeDivideLocal(agg.purchases, agg.checkoutInitiated) * 100,
          },
        });
      }
    }
  } catch (err) {
    logger.error(`SellpageStatsDaily aggregation failed for seller ${sellerId}`, err);
  }
}

function safeDivideLocal(a: number, b: number): number {
  if (!b || !isFinite(b)) return 0;
  return a / b;
}
