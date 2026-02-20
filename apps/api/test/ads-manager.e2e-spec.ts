import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Ads Manager 3-Tier Read Layer E2E Tests — Milestone 2.3.4-B
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Coverage:
 *  1.  GET /ads-manager/campaigns  — 401 without JWT
 *  2.  GET /ads-manager/campaigns  — empty list for fresh seller
 *  3.  GET /ads-manager/campaigns  — returns campaign with all metrics columns
 *  4.  GET /ads-manager/campaigns  — storeMetricsPending=true when no stats rows
 *  5.  GET /ads-manager/adsets     — 401 without JWT
 *  6.  GET /ads-manager/adsets     — returns only adsets under campaignId + seller scope
 *  7.  GET /ads-manager/adsets     — tenant isolation (seller B's campaignId returns 0 adsets)
 *  8.  GET /ads-manager/adsets     — all metric columns present in response
 *  9.  GET /ads-manager/ads        — 401 without JWT
 *  10. GET /ads-manager/ads        — returns only ads under adsetId + seller scope
 *  11. GET /ads-manager/ads        — tenant isolation (seller B's adsetId returns 0 ads)
 *  12. GET /ads-manager/ads        — all metric columns present in response
 *  13. GET /ads-manager/filters    — returns campaigns, adsets, ads, statusEnums
 *  14. GET /ads-manager/campaigns  — status filter works
 *  15. Metrics derivation: CTR = clicks/impressions*100, CPC = spend/clicks, ROAS = store.revenue/spend, CR from store stats
 *  16. storeMetricsPending=false when ad_stats_daily rows exist with non-zero values
 */
describe('Ads Manager 3-Tier Read Layer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;

  // Seeded IDs (Seller A)
  let fbConnectionId: string;
  let sellpageId: string;
  let campaignAId: string;
  let campaignBId: string; // PAUSED
  let adsetA1Id: string;
  let adsetA2Id: string;
  let adA1Id: string;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uid = (prefix = 'adsm') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-5)}`;

  const uniqueEmail = () =>
    `adsm-${Date.now()}-${Math.random().toString(36).slice(-5)}@pixecom-e2e.io`;

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName: 'Ads Manager Tester' });

  const auth = (token: string) => `Bearer ${token}`;

  const get = (
    path: string,
    token: string,
    query?: Record<string, string>,
  ) =>
    request(app.getHttpServer())
      .get(path)
      .query(query ?? {})
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

    // ── Register Seller A ──
    const resA = await register(uniqueEmail());
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    // ── Register Seller B ──
    const resB = await register(uniqueEmail());
    sellerBToken = resB.body.accessToken;

    // ── Seed Seller A: FbConnection (AD_ACCOUNT) ──
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

    // ── Seed Seller A: Product + Sellpage ──
    const product = await prisma.product.create({
      data: {
        productCode: `ADSM-${Date.now()}`,
        name: 'Ads Manager Test Product',
        slug: `adsm-prod-${Date.now()}`,
        basePrice: 50,
        status: 'ACTIVE',
      },
    });

    const sellpage = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId: product.id,
        slug: uid('slug'),
        status: 'PUBLISHED',
      },
    });
    sellpageId = sellpage.id;

    // ── Seed Seller A: Campaign A (ACTIVE, DAILY budget) ──
    const campaignA = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Campaign Alpha',
        budget: 50,
        budgetType: 'DAILY',
        status: 'ACTIVE',
      },
    });
    campaignAId = campaignA.id;

    // ── Seed Seller A: Campaign B (PAUSED) ──
    const campaignB = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Campaign Beta',
        budget: 100,
        budgetType: 'DAILY',
        status: 'PAUSED',
      },
    });
    campaignBId = campaignB.id;

    // ── Seed Seller A: Adset 1 + Adset 2 under Campaign A ──
    const adset1 = await prisma.adset.create({
      data: {
        sellerId: sellerAId,
        campaignId: campaignAId,
        name: 'Adset One',
        status: 'ACTIVE',
        targeting: {},
      },
    });
    adsetA1Id = adset1.id;

    const adset2 = await prisma.adset.create({
      data: {
        sellerId: sellerAId,
        campaignId: campaignAId,
        name: 'Adset Two',
        status: 'PAUSED',
        targeting: {},
      },
    });
    adsetA2Id = adset2.id;

    // ── Seed Seller A: Ad under Adset 1 ──
    const ad1 = await prisma.ad.create({
      data: {
        sellerId: sellerAId,
        adsetId: adsetA1Id,
        name: 'Ad One',
        status: 'ACTIVE',
      },
    });
    adA1Id = ad1.id;

    // ── Seed ad_stats_daily for Campaign A (for metrics derivation test) ──
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'CAMPAIGN',
        entityId: campaignAId,
        statDate: today,
        spend: 100,
        impressions: 10000,
        linkClicks: 500,
        contentViews: 300,
        checkoutInitiated: 60,
        purchases: 30,
        purchaseValue: 1500,
      },
    });

    // ── Seed ad_stats_daily for Adset 1 ──
    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'ADSET',
        entityId: adsetA1Id,
        statDate: today,
        spend: 80,
        impressions: 8000,
        linkClicks: 400,
        contentViews: 240,
        checkoutInitiated: 48,
        purchases: 24,
        purchaseValue: 1200,
      },
    });

    // ── Seed ad_stats_daily for Ad 1 ──
    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'AD',
        entityId: adA1Id,
        statDate: today,
        spend: 80,
        impressions: 8000,
        linkClicks: 400,
        contentViews: 240,
        checkoutInitiated: 48,
        purchases: 24,
        purchaseValue: 1200,
      },
    });

    // ── Seed store_entity_stats_daily — store-side metrics for Campaign A / Adset 1 / Ad 1 ──
    // Required by 2.3.5 architecture: ROAS/CR/contentViews now sourced from store_entity_stats_daily
    // Campaign A: revenue=1500, purchases=30, contentViews=300, checkouts=60
    //   → ROAS = 1500/100 = 15, CR = 30/300*100 = 10, CR1 = 60/300*100 = 20, CR2 = 30/60*100 = 50
    await prisma.storeEntityStatsDaily.create({
      data: {
        sellerId: sellerAId,
        platform: 'META',
        level: 'CAMPAIGN',
        entityId: campaignAId,
        statDate: today,
        contentViews: 300,
        checkouts: 60,
        purchases: 30,
        revenue: 1500,
      },
    });

    // Adset 1: revenue=1200, purchases=24, contentViews=240, checkouts=48
    await prisma.storeEntityStatsDaily.create({
      data: {
        sellerId: sellerAId,
        platform: 'META',
        level: 'ADSET',
        entityId: adsetA1Id,
        statDate: today,
        contentViews: 240,
        checkouts: 48,
        purchases: 24,
        revenue: 1200,
      },
    });

    // Ad 1: revenue=1200, purchases=24, contentViews=240, checkouts=48
    await prisma.storeEntityStatsDaily.create({
      data: {
        sellerId: sellerAId,
        platform: 'META',
        level: 'AD',
        entityId: adA1Id,
        statDate: today,
        contentViews: 240,
        checkouts: 48,
        purchases: 24,
        revenue: 1200,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Campaign Tests ─────────────────────────────────────────────────────────

  it('1. GET /ads-manager/campaigns — 401 without JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/ads-manager/campaigns',
    );
    expect(res.status).toBe(401);
  });

  it('2. GET /ads-manager/campaigns — empty list for fresh seller', async () => {
    const fresh = await register(uniqueEmail());
    const res = await get(
      '/api/ads-manager/campaigns',
      fresh.body.accessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.campaigns).toEqual([]);
    expect(res.body.summary).toBeDefined();
  });

  it('3. GET /ads-manager/campaigns — returns campaigns with all metrics columns', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    expect(res.status).toBe(200);
    expect(res.body.campaigns.length).toBeGreaterThanOrEqual(2);

    const cam = res.body.campaigns.find((c: any) => c.id === campaignAId);
    expect(cam).toBeDefined();
    expect(cam.platform).toBe('META');
    expect(cam.status).toBe('ACTIVE');
    expect(cam.budgetPerDay).toBe(50);

    // All metrics columns must exist
    const metricsKeys = [
      'spend', 'impressions', 'clicks', 'ctr', 'cpc',
      'contentViews', 'costPerContentView',
      'checkout', 'costPerCheckout',
      'purchases', 'roas', 'cr', 'cr1', 'cr2',
      'storeMetricsPending',
    ];
    for (const key of metricsKeys) {
      expect(cam).toHaveProperty(key);
    }
  });

  it('4. GET /ads-manager/campaigns — storeMetricsPending=true when no stats rows', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    expect(res.status).toBe(200);
    // Campaign B has no stats rows
    const camB = res.body.campaigns.find((c: any) => c.id === campaignBId);
    expect(camB).toBeDefined();
    expect(camB.storeMetricsPending).toBe(true);
    expect(camB.spend).toBe(0);
  });

  it('15. Metrics derivation — CTR, CPC, ROAS, CR correctly derived', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    expect(res.status).toBe(200);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignAId);
    expect(cam).toBeDefined();
    // CTR = 500 / 10000 * 100 = 5.0
    expect(cam.clicks).toBe(500);
    expect(cam.impressions).toBe(10000);
    expect(cam.ctr).toBeCloseTo(5.0, 4);
    // CPC = 100 / 500 = 0.2
    expect(cam.cpc).toBeCloseTo(0.2, 4);
    // ROAS = 1500 / 100 = 15
    expect(cam.roas).toBeCloseTo(15, 4);
    // CR = 30 / 300 * 100 = 10
    expect(cam.cr).toBeCloseTo(10, 4);
    // CR1 = 60 / 300 * 100 = 20
    expect(cam.cr1).toBeCloseTo(20, 4);
    // CR2 = 30 / 60 * 100 = 50
    expect(cam.cr2).toBeCloseTo(50, 4);
    expect(cam.storeMetricsPending).toBe(false);
  });

  it('14. GET /ads-manager/campaigns — status filter returns only matching status', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      status: 'PAUSED',
    });
    expect(res.status).toBe(200);
    expect(res.body.campaigns.every((c: any) => c.status === 'PAUSED')).toBe(
      true,
    );
    expect(res.body.campaigns.find((c: any) => c.id === campaignBId)).toBeDefined();
    expect(res.body.campaigns.find((c: any) => c.id === campaignAId)).toBeUndefined();
  });

  // ─── Adset Tests ─────────────────────────────────────────────────────────────

  it('5. GET /ads-manager/adsets — 401 without JWT', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ads-manager/adsets')
      .query({ campaignId: campaignAId });
    expect(res.status).toBe(401);
  });

  it('6. GET /ads-manager/adsets — returns only adsets under campaignId + seller scope', async () => {
    const res = await get('/api/ads-manager/adsets', sellerAToken, {
      campaignId: campaignAId,
    });
    expect(res.status).toBe(200);
    const ids = res.body.adsets.map((a: any) => a.id);
    expect(ids).toContain(adsetA1Id);
    expect(ids).toContain(adsetA2Id);
    // All returned adsets reference the correct campaignId
    expect(
      res.body.adsets.every((a: any) => a.campaignId === campaignAId),
    ).toBe(true);
  });

  it('7. GET /ads-manager/adsets — tenant isolation (seller B cannot see seller A adsets)', async () => {
    // Seller B uses seller A's campaignId — must get 0 results (not 403, not data leak)
    const res = await get('/api/ads-manager/adsets', sellerBToken, {
      campaignId: campaignAId,
    });
    expect(res.status).toBe(200);
    expect(res.body.adsets).toEqual([]);
  });

  it('8. GET /ads-manager/adsets — all metric columns present', async () => {
    const res = await get('/api/ads-manager/adsets', sellerAToken, {
      campaignId: campaignAId,
    });
    expect(res.status).toBe(200);
    const adset = res.body.adsets.find((a: any) => a.id === adsetA1Id);
    expect(adset).toBeDefined();

    const metricsKeys = [
      'spend', 'impressions', 'clicks', 'ctr', 'cpc',
      'contentViews', 'costPerContentView',
      'checkout', 'costPerCheckout',
      'purchases', 'roas', 'cr', 'cr1', 'cr2',
      'storeMetricsPending',
    ];
    for (const key of metricsKeys) {
      expect(adset).toHaveProperty(key);
    }

    // Adset has no budget
    expect(adset.budgetPerDay).toBeNull();

    // Adset 1 has stats rows — storeMetricsPending=false
    expect(adset.storeMetricsPending).toBe(false);
    // Adset 2 has no stats — storeMetricsPending=true
    const adset2 = res.body.adsets.find((a: any) => a.id === adsetA2Id);
    expect(adset2.storeMetricsPending).toBe(true);
  });

  // ─── Ads Tests ──────────────────────────────────────────────────────────────

  it('9. GET /ads-manager/ads — 401 without JWT', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ads-manager/ads')
      .query({ adsetId: adsetA1Id });
    expect(res.status).toBe(401);
  });

  it('10. GET /ads-manager/ads — returns only ads under adsetId + seller scope', async () => {
    const res = await get('/api/ads-manager/ads', sellerAToken, {
      adsetId: adsetA1Id,
    });
    expect(res.status).toBe(200);
    const ids = res.body.ads.map((a: any) => a.id);
    expect(ids).toContain(adA1Id);
    expect(res.body.ads.every((a: any) => a.adsetId === adsetA1Id)).toBe(true);
  });

  it('11. GET /ads-manager/ads — tenant isolation (seller B cannot see seller A ads)', async () => {
    const res = await get('/api/ads-manager/ads', sellerBToken, {
      adsetId: adsetA1Id,
    });
    expect(res.status).toBe(200);
    expect(res.body.ads).toEqual([]);
  });

  it('12. GET /ads-manager/ads — all metric columns present', async () => {
    const res = await get('/api/ads-manager/ads', sellerAToken, {
      adsetId: adsetA1Id,
    });
    expect(res.status).toBe(200);
    const ad = res.body.ads.find((a: any) => a.id === adA1Id);
    expect(ad).toBeDefined();

    const metricsKeys = [
      'spend', 'impressions', 'clicks', 'ctr', 'cpc',
      'contentViews', 'costPerContentView',
      'checkout', 'costPerCheckout',
      'purchases', 'roas', 'cr', 'cr1', 'cr2',
      'storeMetricsPending',
    ];
    for (const key of metricsKeys) {
      expect(ad).toHaveProperty(key);
    }

    // Ad has no budget
    expect(ad.budgetPerDay).toBeNull();
    expect(ad.adsetId).toBe(adsetA1Id);
    expect(ad.campaignId).toBe(campaignAId);

    // Ad 1 has stats — metrics should be non-zero
    expect(ad.spend).toBeCloseTo(80, 2);
    expect(ad.storeMetricsPending).toBe(false);
  });

  // ─── Filters Tests ──────────────────────────────────────────────────────────

  it('13. GET /ads-manager/filters — returns campaigns, adsets (for campaignId), ads (for adsetId), statusEnums', async () => {
    const res = await get('/api/ads-manager/filters', sellerAToken, {
      campaignId: campaignAId,
      adsetId: adsetA1Id,
    });
    expect(res.status).toBe(200);

    // campaigns always returned
    const campIds = res.body.campaigns.map((c: any) => c.id);
    expect(campIds).toContain(campaignAId);
    expect(campIds).toContain(campaignBId);

    // adsets scoped to campaignId
    const adsetIds = res.body.adsets.map((a: any) => a.id);
    expect(adsetIds).toContain(adsetA1Id);
    expect(adsetIds).toContain(adsetA2Id);

    // ads scoped to adsetId
    const adIds = res.body.ads.map((a: any) => a.id);
    expect(adIds).toContain(adA1Id);

    // status enums present
    expect(res.body.statusEnums).toContain('ACTIVE');
    expect(res.body.statusEnums).toContain('PAUSED');
  });

  it('16. storeMetricsPending=false when stats rows exist with non-zero values', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken);
    const cam = res.body.campaigns.find((c: any) => c.id === campaignAId);
    expect(cam.storeMetricsPending).toBe(false);
    expect(cam.spend).toBeGreaterThan(0);
    expect(cam.impressions).toBeGreaterThan(0);
  });
});
