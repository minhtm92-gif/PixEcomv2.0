/**
 * Alpha Ads Seed v1 — Verify Script (Milestone 2.4.2)
 * seed_tag: alpha_ads_seed_v1
 *
 * Read-only verification of the alpha ads seed data.
 * Checks counts, status distributions, and structural integrity.
 * Exits with code 1 if any check fails (CI-friendly).
 *
 * No staging guard — safe to run in any environment (read-only).
 *
 * Run:
 *   pnpm --filter @pixecom/database seed:alpha:ads:verify
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Expected values (derived from seed.ads.alpha.ts spec) ─────────────────────
const EXPECTED = {
  fbConnectionsPerSeller: 1,
  campaignsPerSeller:     6,
  adsetsPerSeller:        18,   // 6 campaigns × 3 adsets
  adsPerSeller:           72,   // 18 adsets × 4 ads

  // Campaign status distribution: ACTIVE×3, PAUSED×2, ARCHIVED×1
  campaignStatus: {
    ACTIVE:   3,
    PAUSED:   2,
    ARCHIVED: 1,
  },

  // All 6 campaign IDs per seller (index 1–6)
  campaignsByPrefix: {
    S1: (i: number) => `00000000-AD10-0002-0001-${String(i).padStart(12, '0')}`,
    S2: (i: number) => `00000000-AD20-0002-0001-${String(i).padStart(12, '0')}`,
  },

  sellers: [
    {
      sellerId:   '00000000-A100-0001-0002-000000000001',
      label:      'alpha1@pixecom.io',
      fbId:       '00000000-AD10-0001-0001-000000000001',
      fbExtId:    'act_alpha1_ads_001',
    },
    {
      sellerId:   '00000000-A200-0001-0002-000000000001',
      label:      'alpha2@pixecom.io',
      fbId:       '00000000-AD20-0001-0001-000000000001',
      fbExtId:    'act_alpha2_ads_001',
    },
  ],
} as const;

// ─── Check helper ──────────────────────────────────────────────────────────────

let allPassed = true;

function check(label: string, actual: number | boolean, expected: number | boolean): void {
  const pass = actual === expected;
  if (!pass) allPassed = false;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: ${actual} (expected ${expected})`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Alpha Ads Seed v1 — Verify\n');

  for (const s of EXPECTED.sellers) {
    console.log(`\n━━━ ${s.label} (${s.sellerId}) ━━━`);

    // ── 1. Seller exists ────────────────────────────────────────────────────
    const seller = await prisma.seller.findUnique({
      where: { id: s.sellerId },
      select: { id: true, name: true },
    });
    check('Seller exists', !!seller, true);
    if (!seller) {
      console.log('     (Skipping remaining checks — seller not found)');
      allPassed = false;
      continue;
    }

    // ── 2. FbConnection ─────────────────────────────────────────────────────
    const fb = await prisma.fbConnection.findUnique({
      where: { id: s.fbId },
      select: { id: true, externalId: true, connectionType: true, isActive: true },
    });
    check('FbConnection exists', !!fb, true);
    if (fb) {
      check('FbConnection type = AD_ACCOUNT', fb.connectionType === 'AD_ACCOUNT', true);
      check('FbConnection isActive = true',   fb.isActive, true);
      check(`FbConnection externalId = "${s.fbExtId}"`, fb.externalId === s.fbExtId, true);
    }

    // ── 3. Campaign counts ──────────────────────────────────────────────────
    const totalCampaigns = await prisma.campaign.count({ where: { sellerId: s.sellerId } });
    check(`Total campaigns`, totalCampaigns, EXPECTED.campaignsPerSeller);

    const byStatus = await prisma.campaign.groupBy({
      by: ['status'],
      where: { sellerId: s.sellerId },
      _count: { _all: true },
    });
    const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));

    check('ACTIVE campaigns',   statusMap['ACTIVE']   ?? 0, EXPECTED.campaignStatus.ACTIVE);
    check('PAUSED campaigns',   statusMap['PAUSED']   ?? 0, EXPECTED.campaignStatus.PAUSED);
    check('ARCHIVED campaigns', statusMap['ARCHIVED'] ?? 0, EXPECTED.campaignStatus.ARCHIVED);

    // ── 4. All campaign fixed IDs exist ─────────────────────────────────────
    const prefix = s.sellerId.includes('A100') ? 'S1' : 'S2';
    const expectedCmpIds = Array.from({ length: 6 }, (_, i) =>
      EXPECTED.campaignsByPrefix[prefix](i + 1),
    );
    const foundCmps = await prisma.campaign.findMany({
      where: { id: { in: expectedCmpIds } },
      select: { id: true },
    });
    check('All 6 campaign IDs found', foundCmps.length, 6);

    // ── 5. Adset counts ─────────────────────────────────────────────────────
    const totalAdsets = await prisma.adset.count({ where: { sellerId: s.sellerId } });
    check(`Total adsets`, totalAdsets, EXPECTED.adsetsPerSeller);

    // Spot-check: each campaign has exactly 3 adsets
    const adsetsByCmp = await prisma.adset.groupBy({
      by: ['campaignId'],
      where: { sellerId: s.sellerId },
      _count: { _all: true },
    });
    const adsetCountsCorrect = adsetsByCmp.every((r) => r._count._all === 3);
    check('Every campaign has exactly 3 adsets', adsetCountsCorrect, true);
    if (!adsetCountsCorrect) {
      console.log('     Breakdown:', adsetsByCmp.map((r) => `${r.campaignId.slice(-4)}→${r._count._all}`).join(', '));
    }

    // ── 6. Ad counts ────────────────────────────────────────────────────────
    const totalAds = await prisma.ad.count({ where: { sellerId: s.sellerId } });
    check(`Total ads`, totalAds, EXPECTED.adsPerSeller);

    // Spot-check: each adset has exactly 4 ads
    const adsByAdset = await prisma.ad.groupBy({
      by: ['adsetId'],
      where: { sellerId: s.sellerId },
      _count: { _all: true },
    });
    const adCountsCorrect = adsByAdset.every((r) => r._count._all === 4);
    check('Every adset has exactly 4 ads', adCountsCorrect, true);
    if (!adCountsCorrect) {
      console.log('     Breakdown:', adsByAdset.map((r) => `${r.adsetId.slice(-4)}→${r._count._all}`).join(', '));
    }

    // ── 7. UTM stored in adset targeting JSON ───────────────────────────────
    // Verify at least one adset has utm_campaign in targeting
    const sampleAdset = await prisma.adset.findFirst({
      where: { sellerId: s.sellerId },
      select: { targeting: true, name: true },
    });
    const targeting = sampleAdset?.targeting as Record<string, unknown> | null;
    const hasUtm = !!targeting?.utm_campaign;
    check('Adset targeting contains utm_campaign', hasUtm, true);

    // ── 8. seed_tag in FbConnection metadata ────────────────────────────────
    const fbFull = await prisma.fbConnection.findUnique({
      where: { id: s.fbId },
      select: { metadata: true },
    });
    const meta = fbFull?.metadata as Record<string, unknown> | null;
    const hasTag = meta?.seed_tag === 'alpha_ads_seed_v1';
    check('FbConnection metadata.seed_tag correct', hasTag, true);

    // ── 9. Status propagation spot-check ────────────────────────────────────
    // Campaign 6 is ARCHIVED → all its adsets should be ARCHIVED
    const archivedCmpId = EXPECTED.campaignsByPrefix[prefix](6);
    const archivedAdsets = await prisma.adset.findMany({
      where: { campaignId: archivedCmpId },
      select: { status: true },
    });
    const allArchived = archivedAdsets.length > 0 && archivedAdsets.every((a) => a.status === 'ARCHIVED');
    check('ARCHIVED campaign adsets all ARCHIVED', allArchived, true);

    // Campaign 1 (ACTIVE, delivery=learning) → adset 1 should have deliveryStatus=learning
    const activeCmpId = EXPECTED.campaignsByPrefix[prefix](1);
    const firstAdsetPrefix = s.sellerId.includes('A100') ? 'AD10' : 'AD20';
    const learningAdset = await prisma.adset.findFirst({
      where: {
        campaignId: activeCmpId,
        id: `00000000-${firstAdsetPrefix}-0003-0001-000000000001`,
      },
      select: { deliveryStatus: true },
    });
    check('C1 Adset1 deliveryStatus = learning', learningAdset?.deliveryStatus === 'learning', true);
  }

  // ─── Final result ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));

  if (allPassed) {
    console.log('  ✅ All checks passed — Alpha Ads Seed v1 data is valid.');
    console.log('\n  Test endpoints (replace :TOKEN and IDs):');
    console.log('  GET  /api/ads-manager/filters');
    console.log('  GET  /api/ads-manager/campaigns?dateFrom=2026-01-01&dateTo=2026-12-31');
    console.log('  GET  /api/ads-manager/adsets?campaignId=00000000-AD10-0002-0001-000000000001');
    console.log('  GET  /api/ads-manager/ads?adsetId=00000000-AD10-0003-0001-000000000001');
    console.log('\n  Seller 1 (alpha1): campaigns AD10-0002-0001-{1..6}');
    console.log('  Seller 2 (alpha2): campaigns AD20-0002-0001-{1..6}');
    console.log('═'.repeat(60) + '\n');
  } else {
    console.log('  ❌ Some checks FAILED — seed data is incomplete or mismatched.');
    console.log('  Re-run: APP_ENV=staging pnpm --filter @pixecom/database seed:alpha:ads');
    console.log('═'.repeat(60) + '\n');
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error('❌ Verify failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
