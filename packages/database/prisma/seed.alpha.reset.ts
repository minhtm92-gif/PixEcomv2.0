/**
 * Alpha Seed v2 Reset — PixEcom v2 (Milestone 2.4.1)
 *
 * Deletes ONLY records created by seed.alpha.ts (seed_tag: alpha_seed_v2).
 * Records are identified by their fixed UUID prefix (A100 = seller 1, A200 = seller 2).
 *
 * Deletion order respects all FK constraints (children before parents):
 *   OrderEvents → OrderItems → Orders
 *   → SellpageStatsDaily → AdStatsDaily → AdStatsRaw
 *   → Ads → Adsets → Campaigns → FbConnections
 *   → Sellpages → SellerDomains
 *   → SellerSettings → SellerUsers
 *   → Sellers → Users
 *
 * Guard: refuses to run unless APP_ENV=staging or NODE_ENV=staging.
 *
 * Run:
 *   APP_ENV=staging pnpm --filter @pixecom/database seed:alpha:reset
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ────────────────────────────────────────────────────────────
if (process.env.APP_ENV !== 'staging' && process.env.NODE_ENV !== 'staging') {
  console.error(
    '❌ STAGING GUARD: seed.alpha.reset only runs with APP_ENV=staging or NODE_ENV=staging.\n' +
    `   Got APP_ENV="${process.env.APP_ENV}" NODE_ENV="${process.env.NODE_ENV}"`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Fixed IDs (must match seed.alpha.ts exactly) ─────────────────────────────
const SELLER_IDS = [
  '00000000-A100-0001-0002-000000000001',  // Alpha Store One
  '00000000-A200-0001-0002-000000000001',  // Alpha Store Two
];

const USER_IDS = [
  '00000000-A100-0001-0001-000000000001',
  '00000000-A200-0001-0001-000000000001',
];

// Generate all order/item/event IDs (over-provisioned — deleteMany ignores missing)
// 120 orders × max 4 items = 480 items; 120 orders × max 6 events = 720 events
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function buildIds(prefix: string, layer: string, type: string, count: number): string[] {
  return range(count).map(
    (i) => `00000000-${prefix}-${layer}-${type}-${String(i).padStart(12, '0')}`,
  );
}

const S1_ORDER_IDS  = buildIds('A100', '0004', '0001', 120);
const S1_OI_IDS     = buildIds('A100', '0005', '0001', 600);  // 120 × 5 max
const S1_OE_IDS     = buildIds('A100', '0006', '0001', 900);  // 120 × 7 max
const S1_SP_IDS     = buildIds('A100', '0003', '0001', 4);
const S1_DOMAIN_IDS = ['00000000-A100-0002-0001-000000000001'];

const S2_ORDER_IDS  = buildIds('A200', '0004', '0001', 120);
const S2_OI_IDS     = buildIds('A200', '0005', '0001', 600);
const S2_OE_IDS     = buildIds('A200', '0006', '0001', 900);
const S2_SP_IDS     = buildIds('A200', '0003', '0001', 4);
const S2_DOMAIN_IDS = ['00000000-A200-0002-0001-000000000001'];

async function main() {
  console.log('🗑️  Alpha Seed v2 Reset — deleting alpha_seed_v2 records...\n');
  console.log('  Sellers:', SELLER_IDS);

  // Step 1: Order Events
  console.log('\nStep 1/10 — OrderEvents...');
  const oe1 = await prisma.orderEvent.deleteMany({ where: { id: { in: [...S1_OE_IDS, ...S2_OE_IDS] } } });
  console.log(`  ✅ ${oe1.count} order events deleted`);

  // Step 2: Order Items
  console.log('Step 2/10 — OrderItems...');
  const oi = await prisma.orderItem.deleteMany({ where: { id: { in: [...S1_OI_IDS, ...S2_OI_IDS] } } });
  console.log(`  ✅ ${oi.count} order items deleted`);

  // Step 3: Orders
  console.log('Step 3/10 — Orders...');
  const ord = await prisma.order.deleteMany({ where: { id: { in: [...S1_ORDER_IDS, ...S2_ORDER_IDS] } } });
  console.log(`  ✅ ${ord.count} orders deleted`);

  // Step 4: Stats (by sellerId — no fixed UUIDs for stats rows)
  console.log('Step 4/10 — AdStatsDaily / AdStatsRaw / SellpageStatsDaily...');
  const [s1, s2, s3] = await Promise.all([
    prisma.adStatsDaily.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
    prisma.adStatsRaw.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
    prisma.sellpageStatsDaily.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
  ]);
  console.log(`  ✅ ${s1.count + s2.count + s3.count} stats rows deleted`);

  // Step 5: Ads → Adsets → Campaigns → FbConnections (cascade: seller)
  console.log('Step 5/10 — Ads / Adsets / Campaigns / FbConnections...');
  const [ads, adsets, cmps, fbs] = await Promise.all([
    prisma.ad.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
    prisma.adset.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
    prisma.campaign.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
    prisma.fbConnection.deleteMany({ where: { sellerId: { in: SELLER_IDS } } }),
  ]);
  console.log(`  ✅ ${ads.count} ads, ${adsets.count} adsets, ${cmps.count} campaigns, ${fbs.count} FB connections`);

  // Step 6: Creatives + CreativeAssets (cascade via sellerId)
  console.log('Step 6/10 — Creatives...');
  const cr = await prisma.creative.deleteMany({ where: { sellerId: { in: SELLER_IDS } } });
  console.log(`  ✅ ${cr.count} creatives deleted`);

  // Step 7: Assets (seller-owned)
  console.log('Step 7/10 — Seller-owned Assets...');
  const assets = await prisma.asset.deleteMany({ where: { ownerSellerId: { in: SELLER_IDS } } });
  console.log(`  ✅ ${assets.count} assets deleted`);

  // Step 8: Sellpages
  console.log('Step 8/10 — Sellpages...');
  const sp = await prisma.sellpage.deleteMany({ where: { id: { in: [...S1_SP_IDS, ...S2_SP_IDS] } } });
  console.log(`  ✅ ${sp.count} sellpages deleted`);

  // Step 9: Domains
  console.log('Step 9/10 — SellerDomains...');
  const dom = await prisma.sellerDomain.deleteMany({ where: { id: { in: [...S1_DOMAIN_IDS, ...S2_DOMAIN_IDS] } } });
  console.log(`  ✅ ${dom.count} domains deleted`);

  // Step 10: Seller (cascades SellerSettings + SellerUsers) + User
  console.log('Step 10/10 — Sellers + Users...');
  const sellers = await prisma.seller.deleteMany({ where: { id: { in: SELLER_IDS } } });
  const users   = await prisma.user.deleteMany({   where: { id: { in: USER_IDS } } });
  console.log(`  ✅ ${sellers.count} sellers (+ settings + seller_users cascade), ${users.count} users`);

  console.log(`
╔══════════════════════════════════════════════════╗
║       Alpha Seed v2 Reset Complete               ║
╠══════════════════════════════════════════════════╣
║  All alpha_seed_v2 records deleted.              ║
║  Platform products / other sellers untouched.    ║
║  Re-seed: APP_ENV=staging pnpm seed:alpha        ║
╚══════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => { console.error('❌ Reset failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
