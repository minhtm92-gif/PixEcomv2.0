/**
 * Alpha Stats Seed — PixEcom v2 (Milestone 2.4.2+)
 * seed_tag: alpha_stats_seed_v1
 *
 * Generates 30 days of synthetic ad_stats_daily rows for all entities
 * seeded by seed.ads.alpha.ts (alpha1 and alpha2 sellers).
 *
 * Per seller (6 campaigns × 3 adsets × 4 ads = 96 entities):
 *   - CAMPAIGN rows  → 6 × 30 days  = 180 rows
 *   - ADSET rows     → 18 × 30 days = 540 rows
 *   - AD rows        → 72 × 30 days = 2160 rows
 *   - Total per seller: 2880 rows
 *   - Grand total: 5760 rows
 *
 * Stats behavior by campaign status:
 *   ACTIVE   → full 30 days of data
 *   PAUSED   → data starts from campaign start, drops to near-zero for last 5 days
 *   ARCHIVED → data starts from campaign start, zero for last 14 days
 *
 * Idempotent: uses upsert on unique key (sellerId, entityType, entityId, statDate).
 * Safe to re-run — updates existing rows.
 *
 * Prerequisites: seed.alpha.ts + seed.ads.alpha.ts must have been run.
 * Guard: refuses to run unless APP_ENV=staging or NODE_ENV=staging.
 *
 * Run:
 *   APP_ENV=staging pnpm seed:alpha:stats
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ─────────────────────────────────────────────────────────────
if (process.env.APP_ENV !== 'staging' && process.env.NODE_ENV !== 'staging') {
  console.error(
    '❌ STAGING GUARD: seed.alpha.stats only runs with APP_ENV=staging or NODE_ENV=staging.\n' +
    `   Got APP_ENV="${process.env.APP_ENV}" NODE_ENV="${process.env.NODE_ENV}"`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAYS = 30;

const SELLER_IDS = [
  '00000000-A100-0001-0002-000000000001', // alpha1@pixecom.io
  '00000000-A200-0001-0002-000000000001', // alpha2@pixecom.io
] as const;

// ID generators — must match seed.ads.alpha.ts exactly
function cmpId(prefix: 'AD10' | 'AD20', i: number): string {
  return `00000000-${prefix}-0002-0001-${String(i).padStart(12, '0')}`;
}
function adsetId(prefix: 'AD10' | 'AD20', i: number): string {
  return `00000000-${prefix}-0003-0001-${String(i).padStart(12, '0')}`;
}
function adId(prefix: 'AD10' | 'AD20', i: number): string {
  return `00000000-${prefix}-0004-0001-${String(i).padStart(12, '0')}`;
}

// Campaign status/start data from seed.ads.alpha.ts (indices 1-6)
interface CampaignMeta {
  index: number;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  startDaysAgo: number;
  budget: number;
}

const CAMPAIGNS: CampaignMeta[] = [
  { index: 1, status: 'ACTIVE',   startDaysAgo: 30, budget: 50 },
  { index: 2, status: 'ACTIVE',   startDaysAgo: 21, budget: 30 },
  { index: 3, status: 'ACTIVE',   startDaysAgo: 14, budget: 75 },
  { index: 4, status: 'PAUSED',   startDaysAgo: 25, budget: 40 },
  { index: 5, status: 'PAUSED',   startDaysAgo: 18, budget: 200 },
  { index: 6, status: 'ARCHIVED', startDaysAgo: 60, budget: 25 },
];

// ─── Base metrics per tier ─────────────────────────────────────────────────────
// These are daily base values. Each entity gets a budget-proportional multiplier.
// Funnel: impressions → clicks → contentViews → addToCart → checkout → purchases

interface BaseMetrics {
  spendBase: number;
  impBase: number;
  clickBase: number;
  cvBase: number;
  atcBase: number;    // addToCart
  coBase: number;     // checkoutInitiated
  purchBase: number;
  pvBase: number;     // purchaseValue (in $)
}

// Campaign-level metrics (aggregate — higher numbers)
function campaignBaseMetrics(budget: number): BaseMetrics {
  // Scale metrics proportional to budget (normalized to $50)
  const scale = budget / 50;
  return {
    spendBase:  +(42 * scale).toFixed(2),
    impBase:    Math.round(5200 * scale),
    clickBase:  Math.round(210 * scale),
    cvBase:     Math.round(145 * scale),
    atcBase:    Math.round(55 * scale),
    coBase:     Math.round(22 * scale),
    purchBase:  Math.round(9 * scale),
    pvBase:     +(320 * scale).toFixed(2),
  };
}

// Adset-level: ~33% of campaign (3 adsets per campaign)
function adsetBaseMetrics(budget: number, adsetIndex: number): BaseMetrics {
  const scale = budget / 50;
  // Vary slightly by adset position: adset 1 gets most traffic
  const adsetWeights = [0.40, 0.35, 0.25];
  const w = adsetWeights[adsetIndex - 1] ?? 0.33;
  return {
    spendBase:  +(42 * scale * w).toFixed(2),
    impBase:    Math.round(5200 * scale * w),
    clickBase:  Math.round(210 * scale * w),
    cvBase:     Math.round(145 * scale * w),
    atcBase:    Math.round(55 * scale * w),
    coBase:     Math.round(22 * scale * w),
    purchBase:  Math.round(9 * scale * w),
    pvBase:     +(320 * scale * w).toFixed(2),
  };
}

// Ad-level: ~25% of adset (4 ads per adset)
function adBaseMetrics(budget: number, adsetIndex: number, adIndex: number): BaseMetrics {
  const adsetBase = adsetBaseMetrics(budget, adsetIndex);
  // Vary by ad position: ad 1-2 get more, ad 3 is paused (lower), ad 4 moderate
  const adWeights = [0.35, 0.30, 0.10, 0.25];
  const w = adWeights[adIndex - 1] ?? 0.25;
  return {
    spendBase:  +(adsetBase.spendBase * w).toFixed(2),
    impBase:    Math.round(adsetBase.impBase * w),
    clickBase:  Math.round(adsetBase.clickBase * w),
    cvBase:     Math.round(adsetBase.cvBase * w),
    atcBase:    Math.round(adsetBase.atcBase * w),
    coBase:     Math.round(adsetBase.coBase * w),
    purchBase:  Math.round(adsetBase.purchBase * w),
    pvBase:     +(adsetBase.pvBase * w).toFixed(2),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dateOnly(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ±20% daily variance */
const v = () => 0.8 + Math.random() * 0.4;

/**
 * Returns a multiplier for a given day based on campaign status.
 * - ACTIVE: full data for all days within startDaysAgo
 * - PAUSED: full data but drops to ~5% for the last 5 days (recently paused)
 * - ARCHIVED: full data but zero for the last 14 days (been off for a while)
 */
function dayMultiplier(
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  startDaysAgo: number,
  dayIdx: number, // 0 = today, 29 = 29 days ago
): number {
  // No stats before campaign started
  if (dayIdx > startDaysAgo) return 0;

  if (status === 'ACTIVE') return 1;

  if (status === 'PAUSED') {
    // Last 5 days: near-zero (campaign was recently paused)
    if (dayIdx < 5) return 0.05;
    return 1;
  }

  if (status === 'ARCHIVED') {
    // Last 14 days: zero (campaign has been off)
    if (dayIdx < 14) return 0;
    return 1;
  }

  return 1;
}

// ─── Entity types ──────────────────────────────────────────────────────────────

type EntityType = 'CAMPAIGN' | 'ADSET' | 'AD';

interface StatsEntity {
  entityType: EntityType;
  entityId: string;
  base: BaseMetrics;
  campaignStatus: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  campaignStartDaysAgo: number;
}

// ─── Build entity list for one seller ──────────────────────────────────────────

function buildEntities(prefix: 'AD10' | 'AD20'): StatsEntity[] {
  const entities: StatsEntity[] = [];

  for (const cmp of CAMPAIGNS) {
    const cmpBase = campaignBaseMetrics(cmp.budget);

    // Campaign entity
    entities.push({
      entityType: 'CAMPAIGN',
      entityId: cmpId(prefix, cmp.index),
      base: cmpBase,
      campaignStatus: cmp.status,
      campaignStartDaysAgo: cmp.startDaysAgo,
    });

    // 3 adsets per campaign
    for (let asi = 1; asi <= 3; asi++) {
      const globalAdsetIdx = (cmp.index - 1) * 3 + asi;
      const asBase = adsetBaseMetrics(cmp.budget, asi);

      entities.push({
        entityType: 'ADSET',
        entityId: adsetId(prefix, globalAdsetIdx),
        base: asBase,
        campaignStatus: cmp.status,
        campaignStartDaysAgo: cmp.startDaysAgo,
      });

      // 4 ads per adset
      for (let adi = 1; adi <= 4; adi++) {
        const globalAdIdx = (globalAdsetIdx - 1) * 4 + adi;
        const aBase = adBaseMetrics(cmp.budget, asi, adi);

        entities.push({
          entityType: 'AD',
          entityId: adId(prefix, globalAdIdx),
          base: aBase,
          campaignStatus: cmp.status,
          campaignStartDaysAgo: cmp.startDaysAgo,
        });
      }
    }
  }

  return entities;
}

// ─── Upsert stats for one entity×day ───────────────────────────────────────────

async function upsertStat(
  sellerId: string,
  entity: StatsEntity,
  dayIdx: number,
): Promise<boolean> {
  const mult = dayMultiplier(entity.campaignStatus, entity.campaignStartDaysAgo, dayIdx);
  if (mult === 0) return false; // skip zero days entirely

  const b = entity.base;
  const spend          = +(b.spendBase * v() * mult).toFixed(2);
  const impressions    = Math.max(0, Math.round(b.impBase * v() * mult));
  const linkClicks     = Math.max(0, Math.round(b.clickBase * v() * mult));
  const contentViews   = Math.max(0, Math.round(b.cvBase * v() * mult));
  const addToCart      = Math.max(0, Math.round(b.atcBase * v() * mult));
  const checkoutInitiated = Math.max(0, Math.round(b.coBase * v() * mult));
  const purchases      = Math.max(0, Math.round(b.purchBase * v() * mult));
  const purchaseValue  = +(b.pvBase * v() * mult).toFixed(2);

  // Derived metrics
  const ctr = impressions > 0 ? +((linkClicks / impressions) * 100).toFixed(4) : 0;
  const cpc = linkClicks > 0 ? +(spend / linkClicks).toFixed(4) : 0;
  const cpm = impressions > 0 ? +((spend / impressions) * 1000).toFixed(4) : 0;
  const costPerPurchase = purchases > 0 ? +(spend / purchases).toFixed(2) : 0;
  const roas = spend > 0 ? +(purchaseValue / spend).toFixed(4) : 0;

  const statDate = dateOnly(dayIdx);

  const data = {
    spend, impressions, linkClicks, contentViews, addToCart,
    checkoutInitiated, purchases, purchaseValue,
    ctr, cpc, cpm, costPerPurchase, roas,
  };

  await prisma.adStatsDaily.upsert({
    where: {
      uq_ad_stats_daily: {
        sellerId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        statDate,
      },
    },
    update: data,
    create: {
      sellerId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      statDate,
      ...data,
    },
  });

  return true;
}

// ─── Seed one seller ───────────────────────────────────────────────────────────

async function seedSellerStats(
  sellerId: string,
  prefix: 'AD10' | 'AD20',
  label: string,
): Promise<number> {
  console.log(`\n━━━ ${label} ━━━`);

  // Verify seller exists
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) {
    console.error(`❌ Seller ${sellerId} not found. Run seed.alpha.ts first.`);
    process.exit(1);
  }

  // Verify campaigns exist
  const cmpCount = await prisma.campaign.count({ where: { sellerId } });
  if (cmpCount === 0) {
    console.error(`❌ No campaigns found for ${label}. Run seed.ads.alpha.ts first.`);
    process.exit(1);
  }

  const entities = buildEntities(prefix);
  let totalRows = 0;
  let byCampaign = 0;
  let byAdset = 0;
  let byAd = 0;

  for (const entity of entities) {
    for (let day = 0; day < DAYS; day++) {
      const inserted = await upsertStat(sellerId, entity, day);
      if (inserted) {
        totalRows++;
        if (entity.entityType === 'CAMPAIGN') byCampaign++;
        else if (entity.entityType === 'ADSET') byAdset++;
        else byAd++;
      }
    }
  }

  console.log(`  ✅ ${totalRows} stats rows upserted`);
  console.log(`     CAMPAIGN: ${byCampaign} | ADSET: ${byAdset} | AD: ${byAd}`);

  return totalRows;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📊 Alpha Stats Seed — seed_tag: alpha_stats_seed_v1');
  console.log(`   ${DAYS} days × 96 entities per seller × 2 sellers\n`);

  const t0 = Date.now();
  let grandTotal = 0;

  grandTotal += await seedSellerStats(
    SELLER_IDS[0],
    'AD10',
    'Alpha Store One (alpha1@pixecom.io)',
  );

  grandTotal += await seedSellerStats(
    SELLER_IDS[1],
    'AD20',
    'Alpha Store Two (alpha2@pixecom.io)',
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  Alpha Stats Seed Complete');
  console.log('═'.repeat(60));

  for (const sellerId of SELLER_IDS) {
    const label = sellerId.includes('A100') ? 'alpha1@pixecom.io' : 'alpha2@pixecom.io';
    const stats = await prisma.adStatsDaily.count({ where: { sellerId } });
    const byCmp = await prisma.adStatsDaily.count({
      where: { sellerId, entityType: 'CAMPAIGN' },
    });
    const byAdset = await prisma.adStatsDaily.count({
      where: { sellerId, entityType: 'ADSET' },
    });
    const byAd = await prisma.adStatsDaily.count({
      where: { sellerId, entityType: 'AD' },
    });

    console.log(`\n  ${label}`);
    console.log(`    Total stats rows: ${stats}`);
    console.log(`    CAMPAIGN: ${byCmp} | ADSET: ${byAdset} | AD: ${byAd}`);
  }

  console.log(`\n  Grand total: ${grandTotal} rows upserted in ${elapsed}s`);

  console.log('\n' + '─'.repeat(60));
  console.log('  Verify endpoints (replace :TOKEN):');
  console.log('  GET /api/ads-manager/campaigns?dateFrom=2026-01-22&dateTo=2026-02-21');
  console.log('  GET /api/ads-manager/adsets?campaignId=00000000-AD10-0002-0001-000000000001');
  console.log('  GET /api/ads-manager/ads?adsetId=00000000-AD10-0003-0001-000000000001');
  console.log('═'.repeat(60) + '\n');
}

main()
  .catch((e) => { console.error('❌ Stats seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
