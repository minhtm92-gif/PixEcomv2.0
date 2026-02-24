/**
 * Alpha Stats Seed — Verify Script
 * seed_tag: alpha_stats_seed_v1
 *
 * Read-only verification of the alpha stats seed data.
 * Checks row counts, entity type distributions, date coverage,
 * and that metrics are non-zero (storeMetricsPending = false).
 *
 * No staging guard — safe to run in any environment (read-only).
 *
 * Run:
 *   pnpm seed:alpha:stats:verify
 */

import { PrismaClient, StatsEntityType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Expected values ────────────────────────────────────────────────────────────

const SELLER_DEFS = [
  {
    sellerId: '00000000-A100-0001-0002-000000000001',
    label:    'alpha1@pixecom.io',
    prefix:   'AD10' as const,
  },
  {
    sellerId: '00000000-A200-0001-0002-000000000001',
    label:    'alpha2@pixecom.io',
    prefix:   'AD20' as const,
  },
];

// Campaigns by status and their expected date coverage
// ACTIVE campaigns: full 30 days (or startDaysAgo if < 30)
// PAUSED: startDaysAgo days but last 5 have ~5% values
// ARCHIVED: startDaysAgo days but last 14 are zero (no rows)
const CAMPAIGN_EXPECTED = [
  { index: 1, status: 'ACTIVE',   startDaysAgo: 30, minStatsRows: 28 },
  { index: 2, status: 'ACTIVE',   startDaysAgo: 21, minStatsRows: 19 },
  { index: 3, status: 'ACTIVE',   startDaysAgo: 14, minStatsRows: 12 },
  { index: 4, status: 'PAUSED',   startDaysAgo: 25, minStatsRows: 23 },
  { index: 5, status: 'PAUSED',   startDaysAgo: 18, minStatsRows: 16 },
  { index: 6, status: 'ARCHIVED', startDaysAgo: 60, minStatsRows: 14 }, // 30 days - 14 zero = 16
];

// ─── Check helper ──────────────────────────────────────────────────────────────

let allPassed = true;

function check(label: string, actual: number | boolean, expected: number | boolean): void {
  const pass = actual === expected;
  if (!pass) allPassed = false;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: ${actual} (expected ${expected})`);
}

function checkGte(label: string, actual: number, minimum: number): void {
  const pass = actual >= minimum;
  if (!pass) allPassed = false;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: ${actual} (expected >= ${minimum})`);
}

function checkGt(label: string, actual: number, minimum: number): void {
  const pass = actual > minimum;
  if (!pass) allPassed = false;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: ${actual} (expected > ${minimum})`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Alpha Stats Seed — Verify\n');

  for (const s of SELLER_DEFS) {
    console.log(`\n━━━ ${s.label} (${s.sellerId}) ━━━`);

    // ── 1. Total stats rows exist ─────────────────────────────────────────
    const totalStats = await prisma.adStatsDaily.count({
      where: { sellerId: s.sellerId },
    });
    // 96 entities × ~25 avg days = ~2400+, but exact depends on status
    checkGte('Total stats rows', totalStats, 1500);

    // ── 2. Entity type distribution ───────────────────────────────────────
    const byType = await prisma.adStatsDaily.groupBy({
      by: ['entityType'],
      where: { sellerId: s.sellerId },
      _count: { _all: true },
    });
    const typeMap: Record<string, number> = {};
    for (const r of byType) {
      typeMap[r.entityType] = r._count._all;
    }

    checkGte('CAMPAIGN stats rows', typeMap['CAMPAIGN'] ?? 0, 100);
    checkGte('ADSET stats rows', typeMap['ADSET'] ?? 0, 300);
    checkGte('AD stats rows', typeMap['AD'] ?? 0, 1000);

    // ── 3. All 3 entity types present ─────────────────────────────────────
    check('Has CAMPAIGN type', !!typeMap['CAMPAIGN'], true);
    check('Has ADSET type', !!typeMap['ADSET'], true);
    check('Has AD type', !!typeMap['AD'], true);

    // ── 4. Date range coverage ────────────────────────────────────────────
    const dateRange = await prisma.adStatsDaily.aggregate({
      where: { sellerId: s.sellerId },
      _min: { statDate: true },
      _max: { statDate: true },
    });

    if (dateRange._min.statDate && dateRange._max.statDate) {
      const minDate = dateRange._min.statDate;
      const maxDate = dateRange._max.statDate;
      const daySpan = Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      checkGte('Date span (days)', daySpan, 14);
      console.log(`     Date range: ${minDate.toISOString().slice(0, 10)} → ${maxDate.toISOString().slice(0, 10)}`);
    } else {
      allPassed = false;
      console.log('  ❌ No date range found');
    }

    // ── 5. ACTIVE campaign has non-zero recent stats ──────────────────────
    // Campaign 1 (ACTIVE) should have stats for today/yesterday
    const activeCmpId = `00000000-${s.prefix}-0002-0001-000000000001`;
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 1);
    recentDate.setHours(0, 0, 0, 0);

    const recentStats = await prisma.adStatsDaily.findFirst({
      where: {
        sellerId: s.sellerId,
        entityType: 'CAMPAIGN',
        entityId: activeCmpId,
        statDate: { gte: recentDate },
      },
    });

    check('ACTIVE campaign has recent stats', !!recentStats, true);
    if (recentStats) {
      checkGt('Recent spend > 0', Number(recentStats.spend), 0);
      checkGt('Recent impressions > 0', recentStats.impressions, 0);
      checkGt('Recent linkClicks > 0', recentStats.linkClicks, 0);
    }

    // ── 6. ARCHIVED campaign has NO recent stats (last 14 days) ───────────
    const archivedCmpId = `00000000-${s.prefix}-0002-0001-000000000006`;
    const recentWindow = new Date();
    recentWindow.setDate(recentWindow.getDate() - 13);
    recentWindow.setHours(0, 0, 0, 0);

    const archivedRecent = await prisma.adStatsDaily.count({
      where: {
        sellerId: s.sellerId,
        entityType: 'CAMPAIGN',
        entityId: archivedCmpId,
        statDate: { gte: recentWindow },
      },
    });
    check('ARCHIVED campaign has 0 recent stats', archivedRecent, 0);

    // ── 7. Aggregate metrics are non-zero (storeMetricsPending = false) ───
    const agg = await prisma.adStatsDaily.aggregate({
      where: { sellerId: s.sellerId, entityType: 'CAMPAIGN' },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
        contentViews: true,
        purchases: true,
        purchaseValue: true,
      },
    });

    checkGt('Agg spend > 0', Number(agg._sum.spend ?? 0), 0);
    checkGt('Agg impressions > 0', Number(agg._sum.impressions ?? 0), 0);
    checkGt('Agg linkClicks > 0', Number(agg._sum.linkClicks ?? 0), 0);
    checkGt('Agg contentViews > 0', Number(agg._sum.contentViews ?? 0), 0);
    checkGt('Agg purchases > 0', Number(agg._sum.purchases ?? 0), 0);
    checkGt('Agg purchaseValue > 0', Number(agg._sum.purchaseValue ?? 0), 0);

    // ── 8. Isolation check — no cross-seller contamination ────────────────
    const otherSellerId = s.sellerId.includes('A100')
      ? '00000000-A200-0001-0002-000000000001'
      : '00000000-A100-0001-0002-000000000001';
    const otherPrefix = s.sellerId.includes('A100') ? 'AD20' : 'AD10';

    // Ensure this seller's stats don't contain entities from the other seller
    const otherEntitySample = `00000000-${otherPrefix}-0002-0001-000000000001`;
    const crossCheck = await prisma.adStatsDaily.count({
      where: {
        sellerId: s.sellerId,
        entityId: otherEntitySample,
      },
    });
    check('No cross-seller contamination', crossCheck, 0);
  }

  // ─── Final result ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));

  if (allPassed) {
    console.log('  ✅ All checks passed — Alpha Stats Seed data is valid.');
    console.log('\n  Verify in API:');
    console.log('  GET /api/ads-manager/campaigns?dateFrom=2026-01-22&dateTo=2026-02-21');
    console.log('  → spend, impressions, clicks should all be > 0');
    console.log('  → storeMetricsPending should be false for ACTIVE campaigns');
    console.log('═'.repeat(60) + '\n');
  } else {
    console.log('  ❌ Some checks FAILED — stats data is incomplete or mismatched.');
    console.log('  Re-run: APP_ENV=staging pnpm seed:alpha:stats');
    console.log('═'.repeat(60) + '\n');
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error('❌ Verify failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
