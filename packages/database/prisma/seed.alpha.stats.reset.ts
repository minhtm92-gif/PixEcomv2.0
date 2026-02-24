/**
 * Alpha Stats Seed — Reset Script
 * seed_tag: alpha_stats_seed_v1
 *
 * Deletes ONLY the ad_stats_daily rows for entities created by seed.ads.alpha.ts
 * within the seeded date range (last 30 days).
 *
 * Does NOT delete campaigns, adsets, ads, or any other data
 * (those are handled by seed.ads.alpha.reset.ts).
 *
 * Guard: refuses to run unless APP_ENV=staging or NODE_ENV=staging.
 *
 * Run:
 *   APP_ENV=staging pnpm seed:alpha:stats:reset
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ─────────────────────────────────────────────────────────────
if (process.env.APP_ENV !== 'staging' && process.env.NODE_ENV !== 'staging') {
  console.error(
    '❌ STAGING GUARD: seed.alpha.stats.reset only runs with APP_ENV=staging or NODE_ENV=staging.\n' +
    `   Got APP_ENV="${process.env.APP_ENV}" NODE_ENV="${process.env.NODE_ENV}"`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Seeded entity IDs (must match seed.ads.alpha.ts) ──────────────────────────

const SELLER_IDS = [
  '00000000-A100-0001-0002-000000000001',
  '00000000-A200-0001-0002-000000000001',
] as const;

function allEntityIds(prefix: 'AD10' | 'AD20'): string[] {
  const ids: string[] = [];

  // 6 campaigns
  for (let i = 1; i <= 6; i++) {
    ids.push(`00000000-${prefix}-0002-0001-${String(i).padStart(12, '0')}`);
  }

  // 18 adsets
  for (let i = 1; i <= 18; i++) {
    ids.push(`00000000-${prefix}-0003-0001-${String(i).padStart(12, '0')}`);
  }

  // 72 ads
  for (let i = 1; i <= 72; i++) {
    ids.push(`00000000-${prefix}-0004-0001-${String(i).padStart(12, '0')}`);
  }

  return ids;
}

// Date range: last 30 days (matches seed script)
function dateOnly(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑️  Alpha Stats Seed — RESET\n');
  console.log('   This deletes ONLY ad_stats_daily rows for alpha ads seed entities.');
  console.log('   Campaigns, adsets, ads are NOT touched.\n');

  const dateFrom = dateOnly(30);
  const dateTo = dateOnly(0);

  const prefixes: Array<{ sellerId: string; prefix: 'AD10' | 'AD20'; label: string }> = [
    { sellerId: SELLER_IDS[0], prefix: 'AD10', label: 'alpha1@pixecom.io' },
    { sellerId: SELLER_IDS[1], prefix: 'AD20', label: 'alpha2@pixecom.io' },
  ];

  let grandTotal = 0;

  for (const { sellerId, prefix, label } of prefixes) {
    const entityIds = allEntityIds(prefix);

    const deleted = await prisma.adStatsDaily.deleteMany({
      where: {
        sellerId,
        entityId: { in: entityIds },
        statDate: { gte: dateFrom, lte: dateTo },
      },
    });

    console.log(`  ✅ ${label}: ${deleted.count} stats rows deleted`);
    grandTotal += deleted.count;
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  Alpha Stats Reset Complete');
  console.log('═'.repeat(60));

  for (const sellerId of SELLER_IDS) {
    const label = sellerId.includes('A100') ? 'alpha1@pixecom.io' : 'alpha2@pixecom.io';
    const remaining = await prisma.adStatsDaily.count({ where: { sellerId } });
    console.log(`  ${label}: ${remaining} stats rows remaining`);
  }

  console.log(`\n  Total deleted: ${grandTotal}`);
  console.log('  ✅ Re-run seed.alpha.stats.ts to re-seed.\n');
}

main()
  .catch((e) => { console.error('❌ Stats reset failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
