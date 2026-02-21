/**
 * Alpha Ads Seed v1 — Reset Script (Milestone 2.4.2)
 * seed_tag: alpha_ads_seed_v1
 *
 * Deletes ONLY the rows created by seed.ads.alpha.ts.
 * Deletion order respects FK constraints:
 *   Ads → Adsets → Campaigns → FbConnections
 *
 * Does NOT delete sellers, users, orders, or the base alpha seed data
 * (those are handled by seed.alpha.reset.ts).
 *
 * Guard: refuses to run unless APP_ENV=staging or NODE_ENV=staging.
 *
 * Run:
 *   APP_ENV=staging pnpm --filter @pixecom/database seed:alpha:ads:reset
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ─────────────────────────────────────────────────────────────
if (process.env.APP_ENV !== 'staging' && process.env.NODE_ENV !== 'staging') {
  console.error(
    '❌ STAGING GUARD: seed.ads.alpha.reset only runs with APP_ENV=staging or NODE_ENV=staging.\n' +
    `   Got APP_ENV="${process.env.APP_ENV}" NODE_ENV="${process.env.NODE_ENV}"`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── All seeded IDs (matches seed.ads.alpha.ts exactly) ────────────────────────

// Seller IDs
const SELLER_IDS = [
  '00000000-A100-0001-0002-000000000001',
  '00000000-A200-0001-0002-000000000001',
] as const;

// FbConnection IDs (1 per seller)
const FB_IDS = [
  '00000000-AD10-0001-0001-000000000001',  // Seller 1
  '00000000-AD20-0001-0001-000000000001',  // Seller 2
] as const;

// Campaign ID generators — 6 per seller, indices 1–6
function cmpIds(prefix: 'AD10' | 'AD20'): string[] {
  return Array.from({ length: 6 }, (_, i) =>
    `00000000-${prefix}-0002-0001-${String(i + 1).padStart(12, '0')}`,
  );
}

// Adset ID generators — 18 per seller, indices 1–18
function adsetIds(prefix: 'AD10' | 'AD20'): string[] {
  return Array.from({ length: 18 }, (_, i) =>
    `00000000-${prefix}-0003-0001-${String(i + 1).padStart(12, '0')}`,
  );
}

// Ad ID generators — 72 per seller, indices 1–72
function adIds(prefix: 'AD10' | 'AD20'): string[] {
  return Array.from({ length: 72 }, (_, i) =>
    `00000000-${prefix}-0004-0001-${String(i + 1).padStart(12, '0')}`,
  );
}

const ALL_CAMPAIGN_IDS = [...cmpIds('AD10'), ...cmpIds('AD20')];
const ALL_ADSET_IDS    = [...adsetIds('AD10'), ...adsetIds('AD20')];
const ALL_AD_IDS       = [...adIds('AD10'), ...adIds('AD20')];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑️  Alpha Ads Seed v1 — RESET\n');
  console.log('   This deletes ONLY rows tagged alpha_ads_seed_v1.');
  console.log('   Base alpha seed data (sellers, orders) is NOT touched.\n');

  // ── Step 1: Ads ───────────────────────────────────────────────────────────
  const deletedAds = await prisma.ad.deleteMany({
    where: { id: { in: ALL_AD_IDS } },
  });
  console.log(`  ✅ Step 1 — Ads deleted:      ${deletedAds.count}`);

  // ── Step 2: Adsets ────────────────────────────────────────────────────────
  const deletedAdsets = await prisma.adset.deleteMany({
    where: { id: { in: ALL_ADSET_IDS } },
  });
  console.log(`  ✅ Step 2 — Adsets deleted:   ${deletedAdsets.count}`);

  // ── Step 3: Campaigns ─────────────────────────────────────────────────────
  const deletedCmps = await prisma.campaign.deleteMany({
    where: { id: { in: ALL_CAMPAIGN_IDS } },
  });
  console.log(`  ✅ Step 3 — Campaigns deleted: ${deletedCmps.count}`);

  // ── Step 4: FbConnections ─────────────────────────────────────────────────
  // Only delete the connections seeded by THIS script (tagged in metadata).
  // We use the fixed IDs to be safe — avoids deleting any user-created connections.
  const deletedFb = await prisma.fbConnection.deleteMany({
    where: { id: { in: [...FB_IDS] } },
  });
  console.log(`  ✅ Step 4 — FbConnections deleted: ${deletedFb.count}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  Alpha Ads Reset Complete');
  console.log('═'.repeat(60));

  // Confirm remaining counts for both sellers
  for (const sellerId of SELLER_IDS) {
    const [cmps, adsets, ads, fbs] = await Promise.all([
      prisma.campaign.count({ where: { sellerId } }),
      prisma.adset.count({ where: { sellerId } }),
      prisma.ad.count({ where: { sellerId } }),
      prisma.fbConnection.count({ where: { sellerId } }),
    ]);

    const label = sellerId.includes('A100') ? 'alpha1@pixecom.io' : 'alpha2@pixecom.io';
    console.log(`\n  ${label}`);
    console.log(`    FbConnections remaining: ${fbs}`);
    console.log(`    Campaigns remaining:     ${cmps}`);
    console.log(`    Adsets remaining:        ${adsets}`);
    console.log(`    Ads remaining:           ${ads}`);
  }

  console.log('\n  ✅ Re-run seed.ads.alpha.ts to re-seed.\n');
}

main()
  .catch((e) => { console.error('❌ Ads reset failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
