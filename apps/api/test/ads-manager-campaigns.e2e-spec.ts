import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Ads Manager — Campaign Read Layer E2E Tests — Milestone 2.3.4-A
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Strategy:
 *   - Register two sellers (A and B) via the auth API.
 *   - Seed Campaign + Sellpage + FbConnection + Product rows directly via
 *     PrismaService (no campaign-create endpoint exists yet in 2.3.4-A).
 *   - Seed AdStatsDaily rows for date-range aggregation tests.
 *
 * Coverage:
 *  1.  401 without JWT
 *  2.  Empty rows when seller has no campaigns
 *  3.  Returns campaign rows with zero stats (no stats seeded)
 *  4.  Date-range aggregation sums stats correctly (2 stat rows)
 *  5.  Stats outside date range are excluded
 *  6.  Filter by status=PAUSED
 *  7.  Filter by sellpageId
 *  8.  Seller B cannot see Seller A campaigns (isolation)
 *  9.  DELETED campaigns excluded by default
 *  10. sortBy=roas returns highest ROAS row first
 *  11. Cursor pagination returns nextCursor and second page
 *  12. POST /sync returns 202 with jobIds
 *  13. POST /sync without JWT returns 401
 */
describe('Ads Manager — Campaign Read Layer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;

  // Seeded IDs for Seller A
  let productId: string;
  let sellpageId: string;
  let sellpageId2: string;
  let fbConnectionId: string;
  let campaignId1: string; // ACTIVE, stats seeded
  let campaignId2: string; // ACTIVE, no stats
  let campaignId3: string; // PAUSED
  let campaignId4: string; // DELETED (excluded by default)
  let campaignId5: string; // ACTIVE, different sellpage

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'am234') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

  const get = (path: string, token: string, query?: Record<string, string | number | boolean>) =>
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

    // Register Seller A and B
    const resA = await register(uniqueEmail('am234-a'), 'AdsManager Seller A');
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    const resB = await register(uniqueEmail('am234-b'), 'AdsManager Seller B');
    sellerBToken = resB.body.accessToken;

    // ── Seed a shared Product (platform-level, no sellerId) ──
    const product = await prisma.product.create({
      data: {
        productCode: `AM234-${Date.now()}`,
        name: 'Test Product AM234',
        slug: `test-product-am234-${Date.now()}`,
        basePrice: 99.99,
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    // ── Seed Sellpages for Seller A ──
    const sp1 = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: `sp-am234-main-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    sellpageId = sp1.id;

    const sp2 = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: `sp-am234-alt-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    sellpageId2 = sp2.id;

    // ── Seed FbConnection for Seller A ──
    const fbConn = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        externalId: `act_am234_${Date.now()}`,
        name: 'AM234 Ad Account',
      },
    });
    fbConnectionId = fbConn.id;

    // ── Seed Campaigns for Seller A ──
    const now = new Date();

    const c1 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Campaign High Spend',
        budget: 50.00,
        budgetType: 'DAILY',
        status: 'ACTIVE',
        createdAt: new Date(now.getTime() - 4000),
      },
    });
    campaignId1 = c1.id;

    const c2 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Campaign No Stats',
        budget: 20.00,
        budgetType: 'DAILY',
        status: 'ACTIVE',
        createdAt: new Date(now.getTime() - 3000),
      },
    });
    campaignId2 = c2.id;

    const c3 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Campaign Paused',
        budget: 30.00,
        budgetType: 'DAILY',
        status: 'PAUSED',
        createdAt: new Date(now.getTime() - 2000),
      },
    });
    campaignId3 = c3.id;

    const c4 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbConnectionId,
        name: 'Campaign Deleted',
        budget: 10.00,
        budgetType: 'DAILY',
        status: 'DELETED',
        createdAt: new Date(now.getTime() - 1000),
      },
    });
    campaignId4 = c4.id;

    const c5 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId2,
        adAccountId: fbConnectionId,
        name: 'Campaign Alt Sellpage',
        budget: 15.00,
        budgetType: 'DAILY',
        status: 'ACTIVE',
        createdAt: new Date(now.getTime() - 500),
      },
    });
    campaignId5 = c5.id;

    // ── Seed AdStatsDaily for Campaign 1 ──
    // Day 1: spend=100, impressions=1000, linkClicks=50, purchases=5, purchaseValue=500
    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'CAMPAIGN',
        entityId: campaignId1,
        statDate: new Date('2026-02-10T00:00:00.000Z'),
        spend: 100.00,
        impressions: 1000,
        linkClicks: 50,
        purchases: 5,
        purchaseValue: 500.00,
      },
    });
    // Day 2: spend=200, impressions=2000, linkClicks=80, purchases=10, purchaseValue=1000
    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'CAMPAIGN',
        entityId: campaignId1,
        statDate: new Date('2026-02-11T00:00:00.000Z'),
        spend: 200.00,
        impressions: 2000,
        linkClicks: 80,
        purchases: 10,
        purchaseValue: 1000.00,
      },
    });
    // Day outside range (2026-02-09): should be excluded
    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'CAMPAIGN',
        entityId: campaignId1,
        statDate: new Date('2026-02-09T00:00:00.000Z'),
        spend: 999.00,
        impressions: 9999,
        linkClicks: 999,
        purchases: 99,
        purchaseValue: 9999.00,
      },
    });

    // Campaign 5: high ROAS (spend=10, purchaseValue=200 → ROAS=20)
    await prisma.adStatsDaily.create({
      data: {
        sellerId: sellerAId,
        entityType: 'CAMPAIGN',
        entityId: campaignId5,
        statDate: new Date('2026-02-10T00:00:00.000Z'),
        spend: 10.00,
        impressions: 100,
        linkClicks: 5,
        purchases: 2,
        purchaseValue: 200.00,
      },
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST CASES
  // ══════════════════════════════════════════════════════════════════════════

  it('1. returns 401 without JWT', async () => {
    await request(app.getHttpServer())
      .get('/api/ads-manager/campaigns')
      .expect(401);
  });

  it('2. returns empty rows when seller has no campaigns in date range', async () => {
    // Seller B has no campaigns
    const res = await get('/api/ads-manager/campaigns', sellerBToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
    }).expect(200);

    expect(res.body).toMatchObject({
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
      rows: [],
      nextCursor: null,
    });
  });

  it('3. returns campaign rows with zero stats when no stats exist', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      dateFrom: '2099-01-01',
      dateTo: '2099-01-01',
    }).expect(200);

    expect(res.body.rows.length).toBeGreaterThan(0);
    // All rows should have zero stats since no stats exist for 2099
    for (const row of res.body.rows) {
      expect(row.stats).toMatchObject({
        spend: 0,
        impressions: 0,
        clicks: 0,
        purchases: 0,
        revenue: 0,
        roas: 0,
      });
    }
    // Verify row shape
    const firstRow = res.body.rows[0];
    expect(firstRow).toHaveProperty('id');
    expect(firstRow).toHaveProperty('name');
    expect(firstRow).toHaveProperty('status');
    expect(firstRow).toHaveProperty('dailyBudget');
    expect(firstRow).toHaveProperty('budgetType');
    expect(firstRow).toHaveProperty('sellpage.id');
    expect(firstRow).toHaveProperty('sellpage.url');
    expect(firstRow).toHaveProperty('fbConnection.id');
    expect(firstRow).toHaveProperty('fbConnection.adAccountExternalId');
  });

  it('4. date-range sums stats correctly across two days', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
      sortBy: 'spend',
      sortDir: 'desc',
    }).expect(200);

    const c1Row = res.body.rows.find((r: any) => r.id === campaignId1);
    expect(c1Row).toBeDefined();

    // Day1 + Day2 sum: spend=300, impressions=3000, clicks=130, purchases=15, revenue=1500
    expect(c1Row.stats.spend).toBeCloseTo(300, 2);
    expect(c1Row.stats.impressions).toBe(3000);
    expect(c1Row.stats.clicks).toBe(130);
    expect(c1Row.stats.purchases).toBe(15);
    expect(c1Row.stats.revenue).toBeCloseTo(1500, 2);
    // ROAS = 1500/300 = 5.0
    expect(c1Row.stats.roas).toBeCloseTo(5.0, 3);
  });

  it('5. stats outside date range are excluded', async () => {
    // Only 2026-02-10 — Day2 (2026-02-11) + out-of-range (2026-02-09) excluded
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    const c1Row = res.body.rows.find((r: any) => r.id === campaignId1);
    expect(c1Row).toBeDefined();
    // Only day 1: spend=100
    expect(c1Row.stats.spend).toBeCloseTo(100, 2);
    expect(c1Row.stats.impressions).toBe(1000);
  });

  it('6. filters by status=PAUSED only returns paused campaigns', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      status: 'PAUSED',
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
    }).expect(200);

    expect(res.body.rows.length).toBeGreaterThan(0);
    for (const row of res.body.rows) {
      expect(row.status).toBe('PAUSED');
    }
    // Campaign 1 (ACTIVE) should not appear
    const c1Row = res.body.rows.find((r: any) => r.id === campaignId1);
    expect(c1Row).toBeUndefined();
  });

  it('7. filters by sellpageId returns only campaigns for that sellpage', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      sellpageId: sellpageId2,
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
    }).expect(200);

    expect(res.body.rows.length).toBe(1);
    expect(res.body.rows[0].id).toBe(campaignId5);
    expect(res.body.rows[0].sellpage.id).toBe(sellpageId2);
  });

  it('8. tenant isolation — Seller B cannot see Seller A campaigns', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerBToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
    }).expect(200);

    const ids = res.body.rows.map((r: any) => r.id);
    expect(ids).not.toContain(campaignId1);
    expect(ids).not.toContain(campaignId2);
    expect(ids).not.toContain(campaignId3);
    expect(ids).not.toContain(campaignId4);
    expect(ids).not.toContain(campaignId5);
  });

  it('9. DELETED campaigns are excluded by default', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
    }).expect(200);

    const ids = res.body.rows.map((r: any) => r.id);
    expect(ids).not.toContain(campaignId4);
  });

  it('10. sortBy=roas returns campaign with highest ROAS first', async () => {
    const res = await get('/api/ads-manager/campaigns', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
      sortBy: 'roas',
      sortDir: 'desc',
      status: 'ACTIVE',
    }).expect(200);

    // Campaign 5: ROAS=20  (spend=10, revenue=200)
    // Campaign 1: ROAS=5   (spend=300, revenue=1500) [two-day sum]
    // Campaign 2: ROAS=0   (no stats)
    const firstRow = res.body.rows[0];
    expect(firstRow.id).toBe(campaignId5);
    expect(firstRow.stats.roas).toBeCloseTo(20.0, 3);
  });

  it('11. cursor pagination returns nextCursor and second page', async () => {
    // First page: limit=2
    const page1 = await get('/api/ads-manager/campaigns', sellerAToken, {
      limit: 2,
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
      sortBy: 'spend',
      sortDir: 'desc',
    }).expect(200);

    expect(page1.body.rows.length).toBe(2);
    expect(page1.body.nextCursor).not.toBeNull();

    const cursor = page1.body.nextCursor;
    const page1Ids = page1.body.rows.map((r: any) => r.id);

    // Second page
    const page2 = await get('/api/ads-manager/campaigns', sellerAToken, {
      limit: 2,
      cursor,
      dateFrom: '2026-02-10',
      dateTo: '2026-02-11',
      sortBy: 'spend',
      sortDir: 'desc',
    }).expect(200);

    // Page 2 IDs should not overlap with page 1 IDs
    for (const row of page2.body.rows) {
      expect(page1Ids).not.toContain(row.id);
    }
  });

  it('12. POST /sync returns 202 with queued=true and jobIds array', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ads-manager/sync')
      .set('Authorization', auth(sellerAToken))
      .send({ date: '2026-02-11' })
      .expect(202);

    expect(res.body.queued).toBe(true);
    expect(res.body.date).toBe('2026-02-11');
    expect(Array.isArray(res.body.jobIds)).toBe(true);
    expect(res.body.jobIds.length).toBe(3); // CAMPAIGN + ADSET + AD
  });

  it('13. POST /sync without JWT returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/ads-manager/sync')
      .send({ date: '2026-02-11' })
      .expect(401);
  });
});
