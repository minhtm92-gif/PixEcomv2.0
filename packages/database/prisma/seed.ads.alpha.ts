/**
 * Alpha Ads Seed v1 — PixEcom v2 (Milestone 2.4.2)
 * seed_tag: alpha_ads_seed_v1
 *
 * Populates the Ads Manager 3-tier hierarchy for both alpha sellers:
 *
 *   alpha1@pixecom.io  →  Seller 00000000-A100-0001-0002-000000000001
 *   alpha2@pixecom.io  →  Seller 00000000-A200-0001-0002-000000000001
 *
 * Per seller:
 *   - 1 FbConnection (AD_ACCOUNT)
 *   - 6 Campaigns (ACTIVE × 3, PAUSED × 2, ARCHIVED × 1)
 *   - 3 Adsets per campaign   → 18 adsets
 *   - 4 Ads per adset         → 72 ads
 *
 * Naming conventions:
 *   Campaign: "Alpha Mouse Cold - C1", "UltraClean Retarget - C2" …
 *   Adset:    "Broad US 25-54", "LAL Purchasers 1%" …
 *   Ad:       "Hook 1 - Thumb A", "Hook 2 - Thumb B" …
 *
 * UTM / creativeId: stored in Adset.targeting JSON and Ad name (no schema
 *   column exists for utm_* on Campaign/Adset/Ad).
 *
 * Does NOT write ad_stats_daily — stats worker handles that.
 *
 * Idempotent: all rows use fixed UUIDs — safe to re-run.
 * Reset: run seed.ads.alpha.reset.ts to delete only these records.
 * Guard: refuses to run unless APP_ENV=staging or NODE_ENV=staging.
 *
 * Run:
 *   APP_ENV=staging pnpm --filter @pixecom/database seed:alpha:ads
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ─────────────────────────────────────────────────────────────
if (process.env.APP_ENV !== 'staging' && process.env.NODE_ENV !== 'staging') {
  console.error(
    '❌ STAGING GUARD: seed.ads.alpha only runs with APP_ENV=staging or NODE_ENV=staging.\n' +
    `   Got APP_ENV="${process.env.APP_ENV}" NODE_ENV="${process.env.NODE_ENV}"`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Fixed IDs ─────────────────────────────────────────────────────────────────
// Pattern: 00000000-AD<seller>-<layer>-<type>-<index 12 digits>
//   layer: 01=FbConn, 02=Campaign, 03=Adset, 04=Ad
//
// IDs are deterministic so reset can delete exactly these rows without a DB scan.

const AD = {
  // Seller 1 — prefix AD1
  S1_FB:   '00000000-AD10-0001-0001-000000000001',
  S1_CMP:  (i: number) => `00000000-AD10-0002-0001-${String(i).padStart(12, '0')}`,
  S1_ADS:  (i: number) => `00000000-AD10-0003-0001-${String(i).padStart(12, '0')}`,
  S1_AD:   (i: number) => `00000000-AD10-0004-0001-${String(i).padStart(12, '0')}`,

  // Seller 2 — prefix AD2
  S2_FB:   '00000000-AD20-0001-0001-000000000001',
  S2_CMP:  (i: number) => `00000000-AD20-0002-0001-${String(i).padStart(12, '0')}`,
  S2_ADS:  (i: number) => `00000000-AD20-0003-0001-${String(i).padStart(12, '0')}`,
  S2_AD:   (i: number) => `00000000-AD20-0004-0001-${String(i).padStart(12, '0')}`,
} as const;

// Seller IDs seeded by seed.alpha.ts — must exist before this script runs
const SELLERS = [
  {
    sellerId:     '00000000-A100-0001-0002-000000000001',
    sellerLabel:  'Alpha Store One (alpha1@pixecom.io)',
    // Published sellpage IDs from seed.alpha.ts — campaigns need a sellpageId
    sellpageIds:  [
      '00000000-A100-0003-0001-000000000001', // PUBLISHED — mouse deal
      '00000000-A100-0003-0001-000000000002', // PUBLISHED — stand offer
    ],
    fbId:    AD.S1_FB,
    cmpFn:   AD.S1_CMP,
    adsFn:   AD.S1_ADS,
    adFn:    AD.S1_AD,
    fbExtId: 'act_alpha1_ads_001',
    prefix:  'A1',
  },
  {
    sellerId:     '00000000-A200-0001-0002-000000000001',
    sellerLabel:  'Alpha Store Two (alpha2@pixecom.io)',
    sellpageIds:  [
      '00000000-A200-0003-0001-000000000001', // PUBLISHED — mouse deal
      '00000000-A200-0003-0001-000000000002', // PUBLISHED — stand offer
    ],
    fbId:    AD.S2_FB,
    cmpFn:   AD.S2_CMP,
    adsFn:   AD.S2_ADS,
    adFn:    AD.S2_AD,
    fbExtId: 'act_alpha2_ads_001',
    prefix:  'A2',
  },
] as const;

// ─── Campaign definitions (6 per seller) ───────────────────────────────────────
// Status split: ACTIVE × 3, PAUSED × 2, ARCHIVED × 1
// "LEARNING" is not a valid enum — use deliveryStatus string field for that.

type CmpStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

interface CampaignDef {
  index: number;           // 1–6 (used in name + ID)
  name: string;            // realistic campaign name
  status: CmpStatus;
  deliveryStatus: string;  // free-text delivery state (learning, active, paused, etc.)
  budget: number;          // $20–$100
  budgetType: 'DAILY' | 'LIFETIME';
  spIndex: 0 | 1;         // which published sellpage to link (0 or 1)
  startDaysAgo: number;
  objective: string;       // stored in externalCampaignId prefix for BI context
}

const CAMPAIGN_DEFS: CampaignDef[] = [
  { index: 1, name: 'Alpha Mouse Cold - C1',        status: 'ACTIVE',   deliveryStatus: 'learning',  budget: 50,  budgetType: 'DAILY',    spIndex: 0, startDaysAgo: 30, objective: 'CONVERSIONS' },
  { index: 2, name: 'UltraClean Retarget - C2',     status: 'ACTIVE',   deliveryStatus: 'active',    budget: 30,  budgetType: 'DAILY',    spIndex: 0, startDaysAgo: 21, objective: 'CONVERSIONS' },
  { index: 3, name: 'ProStand Awareness - C3',      status: 'ACTIVE',   deliveryStatus: 'active',    budget: 75,  budgetType: 'DAILY',    spIndex: 1, startDaysAgo: 14, objective: 'REACH' },
  { index: 4, name: 'Mouse LAL Cold - C4',          status: 'PAUSED',   deliveryStatus: 'paused',    budget: 40,  budgetType: 'DAILY',    spIndex: 0, startDaysAgo: 25, objective: 'CONVERSIONS' },
  { index: 5, name: 'Stand Retarget Lifetime - C5', status: 'PAUSED',   deliveryStatus: 'paused',    budget: 200, budgetType: 'LIFETIME', spIndex: 1, startDaysAgo: 18, objective: 'CONVERSIONS' },
  { index: 6, name: 'Deskpad Brand Video - C6',     status: 'ARCHIVED', deliveryStatus: 'archived',  budget: 25,  budgetType: 'DAILY',    spIndex: 0, startDaysAgo: 60, objective: 'VIDEO_VIEWS' },
];

// ─── Adset definitions (3 per campaign, reused pattern) ────────────────────────
// targeting JSON covers realistic Facebook audience structures.

interface AdsetDef {
  adsetIndex: 1 | 2 | 3;  // position within campaign
  nameTpl: string;         // e.g. "Broad US 25-54" — same across all campaigns
  optimizationGoal: string;
  targeting: Record<string, unknown>;
  utm: string;             // utm_content value stored in targeting.utm_content
}

const ADSET_DEFS: AdsetDef[] = [
  {
    adsetIndex: 1,
    nameTpl: 'Broad US 25-54',
    optimizationGoal: 'CONVERSIONS',
    targeting: {
      geo_locations: { countries: ['US'] },
      age_min: 25,
      age_max: 54,
      genders: [0],
      utm_campaign: 'alpha_broad',
      utm_content: 'broad_us_25_54',
    },
  },
  {
    adsetIndex: 2,
    nameTpl: 'LAL Purchasers 1%',
    optimizationGoal: 'CONVERSIONS',
    targeting: {
      geo_locations: { countries: ['US', 'CA', 'AU'] },
      age_min: 22,
      age_max: 55,
      lookalike_audience: { type: 'PURCHASERS', percent: 1 },
      utm_campaign: 'alpha_lal',
      utm_content: 'lal_purchasers_1pct',
    },
  },
  {
    adsetIndex: 3,
    nameTpl: 'Interest — Tech & Office',
    optimizationGoal: 'LINK_CLICKS',
    targeting: {
      geo_locations: { countries: ['US'] },
      age_min: 28,
      age_max: 50,
      interests: [
        { id: '6003107902433', name: 'Technology' },
        { id: '6003317093529', name: 'Home Office' },
      ],
      utm_campaign: 'alpha_interest',
      utm_content: 'interest_tech_office',
    },
  },
];

// ─── Ad definitions (4 per adset, reused pattern) ──────────────────────────────
// Creative IDs go in the Ad name (no schema column) per spec note.

interface AdDef {
  adIndex: 1 | 2 | 3 | 4;
  nameTpl: string;
  deliveryStatus: string;
  creativeRef: string;    // stored in externalAdId prefix for BI context
}

const AD_DEFS: AdDef[] = [
  { adIndex: 1, nameTpl: 'Hook 1 - Thumb A', deliveryStatus: 'active',  creativeRef: 'cre_hook1_thumbA' },
  { adIndex: 2, nameTpl: 'Hook 2 - Thumb B', deliveryStatus: 'active',  creativeRef: 'cre_hook2_thumbB' },
  { adIndex: 3, nameTpl: 'Hook 3 - Thumb C', deliveryStatus: 'paused',  creativeRef: 'cre_hook3_thumbC' },
  { adIndex: 4, nameTpl: 'UGC Cut 1',        deliveryStatus: 'active',  creativeRef: 'cre_ugc_cut1'     },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ─── Seed one seller ────────────────────────────────────────────────────────────

async function seedSellerAds(def: typeof SELLERS[number]): Promise<void> {
  const { sellerId, sellerLabel, sellpageIds, fbId, cmpFn, adsFn, adFn, fbExtId, prefix } = def;

  console.log(`\n━━━ ${sellerLabel} ━━━`);

  // Verify seller + sellpages exist (seed.alpha.ts prerequisite)
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) {
    console.error(`❌ Seller ${sellerId} not found. Run seed.alpha.ts first.`);
    process.exit(1);
  }

  const publishedSPs = await prisma.sellpage.findMany({
    where: { id: { in: [...sellpageIds] }, status: 'PUBLISHED' },
    select: { id: true, slug: true },
  });
  if (publishedSPs.length < 2) {
    console.error(
      `❌ Expected 2 PUBLISHED sellpages for ${sellerLabel}, found ${publishedSPs.length}.\n` +
      '   Run seed.alpha.ts first.',
    );
    process.exit(1);
  }

  // ── 1. FbConnection (AD_ACCOUNT) ─────────────────────────────────────────
  await prisma.fbConnection.upsert({
    where: { id: fbId },
    update: {},
    create: {
      id: fbId,
      sellerId,
      connectionType: 'AD_ACCOUNT',
      externalId: fbExtId,
      name: `${seller.name} — Ad Account`,
      accessTokenEnc: null,
      isPrimary: true,
      isActive: true,
      metadata: {
        seed_tag: 'alpha_ads_seed_v1',
        currency: 'USD',
        timezone: 'America/New_York',
      },
    },
  });

  console.log(`  ✅ FbConnection: ${fbExtId}`);

  // ── 2. Campaigns → Adsets → Ads ──────────────────────────────────────────
  let totalAdsets = 0;
  let totalAds = 0;

  for (const cdef of CAMPAIGN_DEFS) {
    const campaignId = cmpFn(cdef.index);
    const spId = sellpageIds[cdef.spIndex];
    const startDate = daysAgo(cdef.startDaysAgo);

    await prisma.campaign.upsert({
      where: { id: campaignId },
      update: { status: cdef.status, deliveryStatus: cdef.deliveryStatus },
      create: {
        id: campaignId,
        sellerId,
        sellpageId: spId,
        adAccountId: fbId,
        name: `${prefix} ${cdef.name}`,
        budget: cdef.budget,
        budgetType: cdef.budgetType,
        status: cdef.status,
        deliveryStatus: cdef.deliveryStatus,
        externalCampaignId: `ext_${prefix.toLowerCase()}_${cdef.objective.toLowerCase()}_c${cdef.index}`,
        startDate,
        createdAt: startDate,
      },
    });

    // 3 adsets per campaign
    for (const adef of ADSET_DEFS) {
      const globalAdsetIdx = (cdef.index - 1) * 3 + adef.adsetIndex;
      const adsetId = adsFn(globalAdsetIdx);

      // Adset inherits campaign status for ARCHIVED/PAUSED campaigns
      const adsetStatus = cdef.status === 'ARCHIVED' ? 'ARCHIVED'
        : cdef.status === 'PAUSED' ? 'PAUSED'
        : 'ACTIVE';
      const adsetDelivery = cdef.status === 'ARCHIVED' ? 'archived'
        : cdef.status === 'PAUSED' ? 'paused'
        : cdef.deliveryStatus === 'learning' && adef.adsetIndex === 1 ? 'learning'
        : 'active';

      await prisma.adset.upsert({
        where: { id: adsetId },
        update: { status: adsetStatus, deliveryStatus: adsetDelivery },
        create: {
          id: adsetId,
          campaignId,
          sellerId,
          name: `${prefix} ${adef.nameTpl}`,
          status: adsetStatus,
          deliveryStatus: adsetDelivery,
          optimizationGoal: adef.optimizationGoal,
          targeting: {
            ...adef.targeting,
            // Embed utm metadata in targeting JSON (no dedicated schema column)
            utm_campaign: (adef.targeting.utm_campaign as string | undefined) ?? 'alpha_seed',
            utm_content:  (adef.targeting.utm_content  as string | undefined) ?? 'seed',
            seed_tag: 'alpha_ads_seed_v1',
          },
          externalAdsetId: `ext_${prefix.toLowerCase()}_adset_${globalAdsetIdx}`,
          createdAt: startDate,
        },
      });

      totalAdsets++;

      // 4 ads per adset
      for (const adDef of AD_DEFS) {
        const globalAdIdx = (globalAdsetIdx - 1) * 4 + adDef.adIndex;
        const adId = adFn(globalAdIdx);

        // Ad status: propagate from adset; ad 3 is always PAUSED (mimic real mix)
        const adStatus = adsetStatus === 'ARCHIVED' ? 'ARCHIVED'
          : adsetStatus === 'PAUSED' ? 'PAUSED'
          : adDef.adIndex === 3 ? 'PAUSED'
          : 'ACTIVE';

        await prisma.ad.upsert({
          where: { id: adId },
          update: { status: adStatus, deliveryStatus: adDef.deliveryStatus },
          create: {
            id: adId,
            adsetId,
            sellerId,
            // Name encodes creative reference (no creativeId column in schema)
            name: `${prefix} ${adef.nameTpl} | ${adDef.nameTpl}`,
            status: adStatus,
            deliveryStatus: adDef.deliveryStatus,
            externalAdId: `ext_${prefix.toLowerCase()}_${adDef.creativeRef}_${globalAdIdx}`,
            createdAt: startDate,
          },
        });

        totalAds++;
      }
    }
  }

  console.log(`  ✅ 6 campaigns | ${totalAdsets} adsets | ${totalAds} ads`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Alpha Ads Seed v1 — seed_tag: alpha_ads_seed_v1\n');
  console.log('   Structure: 6 campaigns × 3 adsets × 4 ads = 72 ads per seller\n');

  for (const def of SELLERS) {
    await seedSellerAds(def);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  Alpha Ads Seed v1 Complete');
  console.log('═'.repeat(60));

  for (const def of SELLERS) {
    const [cmps, adsets, ads] = await Promise.all([
      prisma.campaign.count({ where: { sellerId: def.sellerId } }),
      prisma.adset.count({ where: { sellerId: def.sellerId } }),
      prisma.ad.count({ where: { sellerId: def.sellerId } }),
    ]);

    const byStatus = await prisma.campaign.groupBy({
      by: ['status'],
      where: { sellerId: def.sellerId },
      _count: { _all: true },
    });

    const statusLine = byStatus
      .map((r) => `${r.status}×${r._count._all}`)
      .join(', ');

    console.log(`\n  ${def.sellerLabel}`);
    console.log(`    FbConnection: ${def.fbExtId}`);
    console.log(`    Campaigns:    ${cmps} (${statusLine})`);
    console.log(`    Adsets:       ${adsets}`);
    console.log(`    Ads:          ${ads}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('  Test endpoints (replace TOKEN and IDs):');
  console.log('  GET /api/ads-manager/filters');
  console.log('  GET /api/ads-manager/campaigns?dateFrom=2026-01-01&dateTo=2026-12-31');
  console.log('  GET /api/ads-manager/adsets?campaignId=00000000-AD10-0002-0001-000000000001');
  console.log('  GET /api/ads-manager/ads?adsetId=00000000-AD10-0003-0001-000000000001');
  console.log('═'.repeat(60) + '\n');
}

main()
  .catch((e) => { console.error('❌ Ads seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
