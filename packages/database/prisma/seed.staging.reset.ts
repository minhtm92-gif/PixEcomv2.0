/**
 * Alpha Staging Seed Reset — PixEcom v2 (Milestone 2.4.0)
 *
 * Deletes ONLY records seeded by seed.staging.ts (identified by fixed UUID prefix).
 * All other data (platform products, other sellers, etc.) is preserved.
 *
 * Deletion order respects FK constraints (children before parents):
 *   AdStatsDaily → SellpageStatsDaily → Ads → Adsets → Campaigns → FbConnections
 *   → OrderEvents → OrderItems → Orders → Sellpages → SellerSettings → SellerUsers
 *   → Seller → User
 *
 * Guard: refuses to run unless NODE_ENV=staging or APP_ENV=staging.
 *
 * Run:
 *   pnpm --filter @pixecom/database seed:staging:reset
 *   # or from root:
 *   pnpm seed:staging:reset
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ────────────────────────────────────────────────────────────
const env = process.env.NODE_ENV;
const appEnv = process.env.APP_ENV;

if (env !== 'staging' && appEnv !== 'staging') {
  console.error(
    `❌ STAGING GUARD: This reset only runs in staging environment.\n` +
    `   Current: NODE_ENV="${env ?? 'undefined'}", APP_ENV="${appEnv ?? 'undefined'}"\n` +
    `   Set NODE_ENV=staging or APP_ENV=staging before running.`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Fixed IDs (must match seed.staging.ts exactly) ──────────────────────────

const SEED_USER_ID   = '00000000-5eed-0001-0001-000000000001';
const SEED_SELLER_ID = '00000000-5eed-0001-0002-000000000001';

// Generate all seeded UUIDs deterministically (must match seed.staging.ts)
const seedSP  = (i: number) => `00000000-5eed-0002-0001-${String(i).padStart(12, '0')}`;
const seedORD = (i: number) => `00000000-5eed-0003-0001-${String(i).padStart(12, '0')}`;
const seedOI  = (i: number) => `00000000-5eed-0003-0002-${String(i).padStart(12, '0')}`;
const seedOE  = (i: number) => `00000000-5eed-0003-0003-${String(i).padStart(12, '0')}`;
const seedFB  = (i: number) => `00000000-5eed-0004-0001-${String(i).padStart(12, '0')}`;
const seedCMP = (i: number) => `00000000-5eed-0004-0002-${String(i).padStart(12, '0')}`;
const seedADS = (i: number) => `00000000-5eed-0004-0003-${String(i).padStart(12, '0')}`;
const seedAD  = (i: number) => `00000000-5eed-0004-0004-${String(i).padStart(12, '0')}`;

// Build arrays
const sellpageIds = Array.from({ length: 3 },  (_, i) => seedSP(i + 1));
const orderIds    = Array.from({ length: 100 }, (_, i) => seedORD(i + 1));
// OI and OE: over-provision (100 orders × max 2 items + 4 events each = 800 max)
const orderItemIds  = Array.from({ length: 250 }, (_, i) => seedOI(i + 1));
const orderEventIds = Array.from({ length: 500 }, (_, i) => seedOE(i + 1));
const fbIds         = Array.from({ length: 1 },   (_, i) => seedFB(i + 1));
const campaignIds   = Array.from({ length: 10 },  (_, i) => seedCMP(i + 1));
const adsetIds      = Array.from({ length: 30 },  (_, i) => seedADS(i + 1));
const adIds         = Array.from({ length: 60 },  (_, i) => seedAD(i + 1));

async function main() {
  console.log('🗑️  Starting Alpha Staging Seed Reset...\n');
  console.log(`   Seller: ${SEED_SELLER_ID}`);
  console.log(`   This will delete ONLY seeded records. Platform data is preserved.\n`);

  // Step 1: Ad stats (no FK from other tables pointing here)
  console.log('Step 1/12 — Deleting AdStatsDaily for seeded seller...');
  const adStatsDeleted = await prisma.adStatsDaily.deleteMany({
    where: { sellerId: SEED_SELLER_ID },
  });
  console.log(`   ✅ ${adStatsDeleted.count} ad stats daily rows deleted`);

  // Step 2: Sellpage stats
  console.log('Step 2/12 — Deleting SellpageStatsDaily...');
  const spStatsDeleted = await prisma.sellpageStatsDaily.deleteMany({
    where: { sellerId: SEED_SELLER_ID },
  });
  console.log(`   ✅ ${spStatsDeleted.count} sellpage stats daily rows deleted`);

  // Step 3: Ad stats raw
  console.log('Step 3/12 — Deleting AdStatsRaw...');
  const adRawDeleted = await prisma.adStatsRaw.deleteMany({
    where: { sellerId: SEED_SELLER_ID },
  });
  console.log(`   ✅ ${adRawDeleted.count} ad stats raw rows deleted`);

  // Step 4: Ads
  console.log('Step 4/12 — Deleting Ads...');
  const adsDeleted = await prisma.ad.deleteMany({
    where: { id: { in: adIds } },
  });
  console.log(`   ✅ ${adsDeleted.count} ads deleted`);

  // Step 5: Adsets
  console.log('Step 5/12 — Deleting Adsets...');
  const adsetDeleted = await prisma.adset.deleteMany({
    where: { id: { in: adsetIds } },
  });
  console.log(`   ✅ ${adsetDeleted.count} adsets deleted`);

  // Step 6: Campaigns
  console.log('Step 6/12 — Deleting Campaigns...');
  const cmpDeleted = await prisma.campaign.deleteMany({
    where: { id: { in: campaignIds } },
  });
  console.log(`   ✅ ${cmpDeleted.count} campaigns deleted`);

  // Step 7: FbConnections
  console.log('Step 7/12 — Deleting FbConnections...');
  const fbDeleted = await prisma.fbConnection.deleteMany({
    where: { id: { in: fbIds } },
  });
  console.log(`   ✅ ${fbDeleted.count} FB connections deleted`);

  // Step 8: OrderEvents
  console.log('Step 8/12 — Deleting OrderEvents...');
  const oeDeleted = await prisma.orderEvent.deleteMany({
    where: { id: { in: orderEventIds } },
  });
  console.log(`   ✅ ${oeDeleted.count} order events deleted`);

  // Step 9: OrderItems
  console.log('Step 9/12 — Deleting OrderItems...');
  const oiDeleted = await prisma.orderItem.deleteMany({
    where: { id: { in: orderItemIds } },
  });
  console.log(`   ✅ ${oiDeleted.count} order items deleted`);

  // Step 10: Orders
  console.log('Step 10/12 — Deleting Orders...');
  const ordDeleted = await prisma.order.deleteMany({
    where: { id: { in: orderIds } },
  });
  console.log(`   ✅ ${ordDeleted.count} orders deleted`);

  // Step 11: Sellpages
  console.log('Step 11/12 — Deleting Sellpages...');
  const spDeleted = await prisma.sellpage.deleteMany({
    where: { id: { in: sellpageIds } },
  });
  console.log(`   ✅ ${spDeleted.count} sellpages deleted`);

  // Step 12: Seller + SellerSettings + SellerUsers + User
  // (SellerSettings, SellerUsers cascade from Seller; User has no cascade to Seller)
  console.log('Step 12/12 — Deleting Seller, Settings, SellerUsers, and User...');

  // SellerSettings + SellerUsers cascade from Seller
  const sellerDeleted = await prisma.seller.deleteMany({
    where: { id: SEED_SELLER_ID },
  });
  console.log(`   ✅ ${sellerDeleted.count} seller deleted (settings + seller_users cascade)`);

  const userDeleted = await prisma.user.deleteMany({
    where: { id: SEED_USER_ID },
  });
  console.log(`   ✅ ${userDeleted.count} user deleted`);

  console.log(`
╔════════════════════════════════════════════════╗
║     Alpha Staging Seed Reset Complete          ║
╠════════════════════════════════════════════════╣
║  All seeded records deleted.                   ║
║  Platform products / other sellers preserved.  ║
║  Re-run: pnpm seed:staging                     ║
╚════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
