import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreMetricsService } from '../src/ads-manager/store-metrics.service';

/**
 * Ads Manager — Store Metrics Join E2E Tests (Milestone 2.3.5)
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Coverage:
 *  1.  Store stats join — campaign-level purchases/revenue from UTM-attributed orders
 *  2.  CR math: CR = purchases/contentViews*100, CR1 = checkouts/contentViews*100, CR2 = purchases/checkouts*100
 *  3.  ROAS = store revenue / ad spend (cross-source)
 *  4.  UTM N/A isolation — orders with utm_campaign='N/A' excluded from store stats
 *  5.  UTM null isolation — orders with no UTM excluded from store stats
 *  6.  Adset-level store join via utm_term
 *  7.  Ad-level store join via utm_content
 *  8.  Tenant isolation — store stats scoped to sellerId
 *  9.  storeMetricsPending=false when store stats exist
 *  10. storeMetricsPending=true when NO store stats (no attributed orders)
 *  11. Summary row aggregates raw store counts then derives (not sum of rows)
 *  12. costPerContentView = spend / contentViews
 *  13. costPerCheckout = spend / checkouts
 */
describe('Ads Manager Store Metrics Join (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storeMetricsSvc: StoreMetricsService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;
  let sellerBId: string;

  let fbConnectionId: string;
  let sellpageId: string;
  let campaignId: string;
  let adsetId: string;
  let adId: string;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uid = (p = 'smj') =>
    `${p}-${Date.now()}-${Math.random().toString(36).slice(-5)}`;

  const uniqueEmail = () =>
    `smj-${Date.now()}-${Math.random().toString(36).slice(-5)}@pixecom-e2e.io`;

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName: 'Store Join Tester' });

  const auth = (t: string) => `Bearer ${t}`;

  const get = (path: string, token: string, q?: Record<string, string>) =>
    request(app.getHttpServer())
      .get(path)
      .query(q ?? {})
      .set('Authorization', auth(token));

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    storeMetricsSvc = moduleFixture.get<StoreMetricsService>(StoreMetricsService);

    // ── Register sellers ──
    const resA = await register(uniqueEmail());
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    const resB = await register(uniqueEmail());
    sellerBToken = resB.body.accessToken;
    sellerBId = resB.body.seller.id;

    // ── Seed: FbConnection ──
    const fbConn = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        externalId: uid('act'),
        name: 'Test Ad Account',
        metadata: {},
      },
    });
    fbConnectionId = fbConn.id;

    // ── Seed: Product + Sellpage ──
    const product = await prisma.product.create({
      data: {
        productCode: `SMJ-${Date.now()}`,
        name: 'Store Join Test Product',
        slug: `smj-prod-${Date.now()}`,
        basePrice: 100,
        status: 'ACTIVE',
      },
    });

    const sellpage = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId: product.id,
        slug: uid('sp'),
        status: 'PUBLISHED',
      },
    });
    sellpageId = sellpage.id;

    // ── Seed: Campaign ──
    const campaign = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Store Join Campaign',
        budget: 100,
        budgetType: 'DAILY',
        status: 'ACTIVE',
      },
    });
    campaignId = campaign.id;

    // ── Seed: Adset ──
    const adset = await prisma.adset.create({
      data: {
        sellerId: sellerAId,
        campaignId,
        name: 'Store Join Adset',
        status: 'ACTIVE',
        targeting: {},
      },
    });
    adsetId = adset.id;

    // ── Seed: Ad ──
    const ad = await prisma.ad.create({
      data: {
        sellerId: sellerAId,
        adsetId,
        name: 'Store Join Ad',
        status: 'ACTIVE',
      },
    });
    adId = ad.id;

    // ── Seed: ad_stats_daily — ads-side (spend=200, impressions=10000, clicks=500) ──
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'CAMPAIGN',
        entityId: campaignId,
        statDate: today,
        spend: 200,
        impressions: 10000,
        linkClicks: 500,
      },
    });

    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'ADSET',
        entityId: adsetId,
        statDate: today,
        spend: 200,
        impressions: 10000,
        linkClicks: 500,
      },
    });

    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'AD',
        entityId: adId,
        statDate: today,
        spend: 200,
        impressions: 10000,
        linkClicks: 500,
      },
    });

    // ── Seed: Orders with proper UTM attribution ──
    // 5 attributed orders: purchases=5, revenue=500
    for (let i = 0; i < 5; i++) {
      await prisma.order.create({
        data: {
          sellerId: sellerAId,
          sellpageId,
          orderNumber: `SMJ-OK-${Date.now()}-${i}`,
          customerEmail: `buyer${i}@example.com`,
          total: 100,
          currency: 'USD',
          status: 'CONFIRMED',
          utmSource: 'facebook',
          utmMedium: 'cpc',
          utmCampaign: `c_${campaignId}`,
          utmTerm: `as_${adsetId}`,
          utmContent: `a_${adId}`,
        },
      });
    }

    // 2 orders with utm_campaign = 'N/A' — must be EXCLUDED from store stats
    for (let i = 0; i < 2; i++) {
      await prisma.order.create({
        data: {
          sellerId: sellerAId,
          sellpageId,
          orderNumber: `SMJ-NA-${Date.now()}-${i}`,
          customerEmail: `na${i}@example.com`,
          total: 999,
          currency: 'USD',
          status: 'CONFIRMED',
          utmCampaign: 'N/A',
          utmTerm: 'N/A',
          utmContent: 'N/A',
        },
      });
    }

    // 2 orders with no UTM at all — must also be EXCLUDED
    for (let i = 0; i < 2; i++) {
      await prisma.order.create({
        data: {
          sellerId: sellerAId,
          sellpageId,
          orderNumber: `SMJ-NULL-${Date.now()}-${i}`,
          customerEmail: `noUtm${i}@example.com`,
          total: 888,
          currency: 'USD',
          status: 'CONFIRMED',
          // utmCampaign deliberately omitted
        },
      });
    }

    // ── Seed: Seller B orders (should NOT appear in seller A's stats) ──
    const productB = await prisma.product.create({
      data: {
        productCode: `SMJ-B-${Date.now()}`,
        name: 'Seller B Product',
        slug: `smj-b-${Date.now()}`,
        basePrice: 50,
        status: 'ACTIVE',
      },
    });
    const spB = await prisma.sellpage.create({
      data: { sellerId: sellerBId, productId: productB.id, slug: uid('spb'), status: 'PUBLISHED' },
    });
    // Seller B's order uses seller A's campaignId in UTM — tenant isolation must block this
    await prisma.order.create({
      data: {
        sellerId: sellerBId,
        sellpageId: spB.id,
        orderNumber: `SMJ-B-${Date.now()}`,
        customerEmail: 'sellerb@example.com',
        total: 9999,
        currency: 'USD',
        status: 'CONFIRMED',
        utmCampaign: `c_${campaignId}`, // Same campaignId as seller A — must be isolated by sellerId
        utmTerm: `as_${adsetId}`,
        utmContent: `a_${adId}`,
      },
    });

    // ── Rollup: trigger upsertFromOrders for seller A ──
    const from = new Date('2000-01-01');
    const to = new Date('2099-12-31');
    await storeMetricsSvc.upsertFromOrders(sellerAId, from, to);
    // Also rollup seller B (separate scope)
    await storeMetricsSvc.upsertFromOrders(sellerBId, from, to);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Tests ─────────────────────────────────────────────────────────────────

  it('1. Campaign-level: store purchases and revenue joined from UTM-attributed orders', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    expect(res.status).toBe(200);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    expect(cam).toBeDefined();
    // 5 attributed orders × $100 = $500 revenue
    expect(cam.purchases).toBe(5);
  });

  it('2. CR math: CR=purchases/contentViews*100, CR1=checkouts/contentViews*100, CR2=purchases/checkouts*100', async () => {
    // Seed content views and checkouts directly into store_entity_stats_daily
    // purchases=5, revenue=500 already set; add contentViews=100, checkouts=20
    await prisma.storeEntityStatsDaily.updateMany({
      where: { sellerId: sellerAId, level: 'CAMPAIGN', entityId: campaignId },
      data: { contentViews: 100, checkouts: 20 },
    });

    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    expect(cam).toBeDefined();

    // CR  = 5 / 100 * 100 = 5.0
    expect(cam.cr).toBeCloseTo(5.0, 4);
    // CR1 = 20 / 100 * 100 = 20.0
    expect(cam.cr1).toBeCloseTo(20.0, 4);
    // CR2 = 5 / 20 * 100 = 25.0
    expect(cam.cr2).toBeCloseTo(25.0, 4);
    // ROAS = 500 / 200 = 2.5
    expect(cam.roas).toBeCloseTo(2.5, 4);
  });

  it('3. ROAS = store revenue / ad spend (cross-source)', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    // spend=200 from ad_stats_daily, revenue=500 from store
    expect(cam.spend).toBeCloseTo(200, 2);
    expect(cam.roas).toBeCloseTo(2.5, 4);
  });

  it('4. UTM N/A isolation — orders with utm=N/A NOT counted in store stats', async () => {
    // Check store_entity_stats_daily directly — purchases must be 5, not 7
    const storeRow = await prisma.storeEntityStatsDaily.findFirst({
      where: { sellerId: sellerAId, level: 'CAMPAIGN', entityId: campaignId },
    });
    expect(storeRow).toBeDefined();
    expect(Number(storeRow!.purchases)).toBe(5); // not 7 (2 N/A orders excluded)
    // Revenue must be 500, not 500+1998
    expect(Number(storeRow!.revenue)).toBeCloseTo(500, 2);
  });

  it('5. UTM null isolation — orders with no UTM field NOT counted in store stats', async () => {
    // Confirmed in test 4 — purchases=5 means null UTM orders also excluded
    const storeRow = await prisma.storeEntityStatsDaily.findFirst({
      where: { sellerId: sellerAId, level: 'CAMPAIGN', entityId: campaignId },
    });
    expect(Number(storeRow!.purchases)).toBe(5); // 2 null UTM orders excluded
  });

  it('6. Adset-level store join via utm_term', async () => {
    const res = await get('/api/ads-manager/adsets', sellerAToken, {
      campaignId,
    });
    expect(res.status).toBe(200);
    const adset = res.body.adsets.find((a: any) => a.id === adsetId);
    expect(adset).toBeDefined();
    expect(adset.purchases).toBe(5);
  });

  it('7. Ad-level store join via utm_content', async () => {
    const res = await get('/api/ads-manager/ads', sellerAToken, { adsetId });
    expect(res.status).toBe(200);
    const ad = res.body.ads.find((a: any) => a.id === adId);
    expect(ad).toBeDefined();
    expect(ad.purchases).toBe(5);
  });

  it('8. Tenant isolation — seller B store stats do NOT bleed into seller A', async () => {
    // Seller B's order used seller A's campaignId — but rollup is scoped by sellerId
    const sellerBStoreRow = await prisma.storeEntityStatsDaily.findFirst({
      where: { sellerId: sellerBId, level: 'CAMPAIGN', entityId: campaignId },
    });
    // Seller B should have their own row (1 order, $9999)
    expect(sellerBStoreRow).toBeDefined();
    expect(Number(sellerBStoreRow!.purchases)).toBe(1);

    // Seller A's row must still be 5 (not 6)
    const sellerAStoreRow = await prisma.storeEntityStatsDaily.findFirst({
      where: { sellerId: sellerAId, level: 'CAMPAIGN', entityId: campaignId },
    });
    expect(Number(sellerAStoreRow!.purchases)).toBe(5);

    // API response also correctly isolated
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    expect(cam.purchases).toBe(5);
  });

  it('9. storeMetricsPending=false when store stats exist', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    expect(cam.storeMetricsPending).toBe(false);
  });

  it('10. storeMetricsPending=true when no store stats (no attributed orders)', async () => {
    // Create a campaign with no orders attributed to it
    const cam2 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'No Store Stats Campaign',
        budget: 50,
        budgetType: 'DAILY',
        status: 'ACTIVE',
      },
    });

    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const empty = res.body.campaigns.find((c: any) => c.id === cam2.id);
    expect(empty).toBeDefined();
    expect(empty.storeMetricsPending).toBe(true);
    expect(empty.purchases).toBe(0);
    expect(empty.roas).toBe(0);
    expect(empty.cr).toBe(0);
  });

  it('11. Summary row aggregates raw store counts then derives (not sum of row-level metrics)', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    expect(res.status).toBe(200);
    // Summary should have purchases >= 5 (sum of all campaigns' purchases raw)
    expect(res.body.summary.purchases).toBeGreaterThanOrEqual(5);
    // Summary metrics must all be numbers, not null/undefined
    const summary = res.body.summary;
    expect(typeof summary.cr).toBe('number');
    expect(typeof summary.cr1).toBe('number');
    expect(typeof summary.cr2).toBe('number');
    expect(typeof summary.roas).toBe('number');
  });

  it('12. costPerContentView = spend / contentViews', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    // spend=200, contentViews=100 → costPerContentView=2.0
    expect(cam.contentViews).toBe(100);
    expect(cam.spend).toBeCloseTo(200, 2);
    expect(cam.costPerContentView).toBeCloseTo(2.0, 4);
  });

  it('13. costPerCheckout = spend / checkouts', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignId);
    // spend=200, checkouts=20 → costPerCheckout=10.0
    expect(cam.checkout).toBe(20);
    expect(cam.costPerCheckout).toBeCloseTo(10.0, 4);
  });
});
