import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Analytics Overview E2E Tests — Milestone 2.3.4-C
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Money constants used (matching service defaults):
 *   SELLER_TAKE = 0.70
 *   HOLD        = 0.30 of YouTake
 *
 * Coverage:
 *  1.  401 without JWT
 *  2.  All zeros when seller has no orders or stats
 *  3.  Revenue + orders computed correctly from seeded orders
 *  4.  YouTake / hold / cashToBalance derived correctly
 *  5.  Cost (adSpend) computed from sellpage_stats_daily
 *  6.  ROAS = revenue / cost
 *  7.  purchases sourced from sellpage_stats_daily
 *  8.  sellpageId filter scopes both revenue and cost
 *  9.  bySellpage breakdown items sum up to kpis totals
 *  10. bySource breakdown present for META
 *  11. Tenant isolation — Seller B cannot see Seller A overview
 *  12. CANCELLED + REFUNDED orders excluded from revenue
 *  13. Stats outside date range excluded
 */
describe('Analytics Overview (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;
  let sellerBId: string;

  // Seeded IDs for Seller A
  let productId: string;
  let sellpageId1: string;
  let sellpageId2: string;

  // ─── Constants (must match service) ────────────────────────────────────────
  const SELLER_TAKE = 0.70;
  const HOLD_PCT = 0.30;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'anl234') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const getOverview = (token: string, query?: Record<string, string>) =>
    request(app.getHttpServer())
      .get('/api/analytics/overview')
      .query(query ?? {})
      .set('Authorization', `Bearer ${token}`);

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
    const resA = await register(uniqueEmail('anl-a'), 'Analytics Seller A');
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    const resB = await register(uniqueEmail('anl-b'), 'Analytics Seller B');
    sellerBToken = resB.body.accessToken;
    sellerBId = resB.body.seller.id;

    // ── Seed platform product ──
    const product = await prisma.product.create({
      data: {
        productCode: `ANL234-${Date.now()}`,
        name: 'Analytics Test Product',
        slug: `anl-test-prod-${Date.now()}`,
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
        slug: `anl-sp1-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    sellpageId1 = sp1.id;

    const sp2 = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: `anl-sp2-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    sellpageId2 = sp2.id;

    // ── Seed orders for Seller A ──
    // Sellpage 1: 2 CONFIRMED orders on 2026-02-10
    //   order1: total=200.00
    //   order2: total=300.00
    //   → sellpage1 revenue = 500.00
    await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ANL-001-${Date.now()}`,
        customerEmail: 'buyer1@test.io',
        total: 200.00,
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-10T10:00:00.000Z'),
      },
    });
    await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ANL-002-${Date.now()}`,
        customerEmail: 'buyer2@test.io',
        total: 300.00,
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-10T11:00:00.000Z'),
      },
    });

    // Sellpage 2: 1 CONFIRMED order on 2026-02-10
    //   order3: total=100.00
    //   → sellpage2 revenue = 100.00
    await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId2,
        orderNumber: `ANL-003-${Date.now()}`,
        customerEmail: 'buyer3@test.io',
        total: 100.00,
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-10T12:00:00.000Z'),
      },
    });

    // CANCELLED order — should be excluded
    await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ANL-004-${Date.now()}`,
        customerEmail: 'buyer4@test.io',
        total: 999.00,
        status: 'CANCELLED',
        createdAt: new Date('2026-02-10T13:00:00.000Z'),
      },
    });

    // REFUNDED order — should be excluded
    await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ANL-005-${Date.now()}`,
        customerEmail: 'buyer5@test.io',
        total: 888.00,
        status: 'REFUNDED',
        createdAt: new Date('2026-02-10T14:00:00.000Z'),
      },
    });

    // Order outside date range (2026-02-09) — excluded from 02-10 queries
    await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ANL-006-${Date.now()}`,
        customerEmail: 'buyer6@test.io',
        total: 777.00,
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-09T10:00:00.000Z'),
      },
    });

    // ── Seed sellpage_stats_daily for Seller A ──
    // Sellpage 1: META on 2026-02-10 → spend=50, purchases=5, linkClicks=200
    await prisma.sellpageStatsDaily.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        statDate: new Date('2026-02-10T00:00:00.000Z'),
        adSource: 'META',
        adSpend: 50.00,
        purchases: 5,
        linkClicks: 200,
      },
    });

    // Sellpage 2: META on 2026-02-10 → spend=20, purchases=2, linkClicks=80
    await prisma.sellpageStatsDaily.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId2,
        statDate: new Date('2026-02-10T00:00:00.000Z'),
        adSource: 'META',
        adSpend: 20.00,
        purchases: 2,
        linkClicks: 80,
      },
    });

    // Stat outside date range (2026-02-09) — excluded
    await prisma.sellpageStatsDaily.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        statDate: new Date('2026-02-09T00:00:00.000Z'),
        adSource: 'META',
        adSpend: 999.00,
        purchases: 99,
        linkClicks: 9999,
      },
    });

    // Seller B: seed an order and stats (must never appear in Seller A results)
    const spB = await prisma.sellpage.create({
      data: {
        sellerId: sellerBId,
        productId,
        slug: `anl-spB-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    await prisma.order.create({
      data: {
        sellerId: sellerBId,
        sellpageId: spB.id,
        orderNumber: `ANL-B-001-${Date.now()}`,
        customerEmail: 'buyerB@test.io',
        total: 9999.00,
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-10T10:00:00.000Z'),
      },
    });
    await prisma.sellpageStatsDaily.create({
      data: {
        sellerId: sellerBId,
        sellpageId: spB.id,
        statDate: new Date('2026-02-10T00:00:00.000Z'),
        adSource: 'META',
        adSpend: 9999.00,
        purchases: 999,
        linkClicks: 99999,
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
      .get('/api/analytics/overview')
      .expect(401);
  });

  it('2. all zeros when seller has no orders or stats (far future date)', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2099-01-01',
      dateTo: '2099-01-01',
    }).expect(200);

    expect(res.body.kpis.revenue).toBe(0);
    expect(res.body.kpis.cost).toBe(0);
    expect(res.body.kpis.youTake).toBe(0);
    expect(res.body.kpis.hold).toBe(0);
    expect(res.body.kpis.cashToBalance).toBe(0);
    expect(res.body.kpis.roas).toBe(0);
    expect(res.body.kpis.orders).toBe(0);
    expect(res.body.kpis.purchases).toBe(0);
    expect(res.body.bySource).toEqual([]);
    expect(res.body.bySellpage).toEqual([]);
  });

  it('3. revenue + orders computed correctly from confirmed orders', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // sp1(200+300) + sp2(100) = 600; 3 confirmed orders
    expect(res.body.kpis.revenue).toBeCloseTo(600, 2);
    expect(res.body.kpis.orders).toBe(3);
  });

  it('4. youTake / hold / cashToBalance derived correctly', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    const revenue = 600;
    const youTake = round2(revenue * SELLER_TAKE);       // 420.00
    const hold = round2(youTake * HOLD_PCT);             // 126.00
    const cashToBalance = round2(youTake - hold);        // 294.00

    expect(res.body.kpis.youTake).toBeCloseTo(youTake, 2);
    expect(res.body.kpis.hold).toBeCloseTo(hold, 2);
    expect(res.body.kpis.unhold).toBe(0);
    expect(res.body.kpis.cashToBalance).toBeCloseTo(cashToBalance, 2);
  });

  it('5. cost (adSpend) aggregated from sellpage_stats_daily', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // sp1=50 + sp2=20 = 70
    expect(res.body.kpis.cost).toBeCloseTo(70, 2);
  });

  it('6. ROAS = revenue / cost', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // revenue=600 / cost=70 ≈ 8.5714
    const expectedRoas = 600 / 70;
    expect(res.body.kpis.roas).toBeCloseTo(expectedRoas, 3);
  });

  it('7. purchases sourced from sellpage_stats_daily', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // sp1=5 + sp2=2 = 7
    expect(res.body.kpis.purchases).toBe(7);
  });

  it('8. sellpageId filter scopes both revenue and cost', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      sellpageId: sellpageId1,
    }).expect(200);

    // Only sp1: revenue=500, cost=50, orders=2
    expect(res.body.kpis.revenue).toBeCloseTo(500, 2);
    expect(res.body.kpis.cost).toBeCloseTo(50, 2);
    expect(res.body.kpis.orders).toBe(2);
    expect(res.body.kpis.purchases).toBe(5);
    // bySellpage should have only 1 entry (sp1)
    expect(res.body.bySellpage).toHaveLength(1);
    expect(res.body.bySellpage[0].sellpage.id).toBe(sellpageId1);
  });

  it('9. bySellpage breakdown items sum to kpis totals', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    const sumRevenue = res.body.bySellpage.reduce((acc: number, r: any) => acc + r.revenue, 0);
    const sumOrders = res.body.bySellpage.reduce((acc: number, r: any) => acc + r.orders, 0);
    const sumCost = res.body.bySellpage.reduce((acc: number, r: any) => acc + r.cost, 0);

    expect(sumRevenue).toBeCloseTo(res.body.kpis.revenue, 2);
    expect(sumOrders).toBe(res.body.kpis.orders);
    expect(sumCost).toBeCloseTo(res.body.kpis.cost, 2);
  });

  it('10. bySource breakdown present for META', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    const metaRow = res.body.bySource.find((r: any) => r.source === 'META');
    expect(metaRow).toBeDefined();
    expect(metaRow.spend).toBeCloseTo(70, 2);  // 50 + 20
    expect(metaRow.clicks).toBe(280);           // 200 + 80
    expect(metaRow.purchases).toBe(7);          // 5 + 2
  });

  it('11. tenant isolation — Seller B cannot see Seller A overview', async () => {
    const res = await getOverview(sellerBToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // Seller B has 1 order of 9999 and spend of 9999 — not mixed with A's 600/70
    expect(res.body.kpis.revenue).toBeCloseTo(9999, 2);
    expect(res.body.kpis.cost).toBeCloseTo(9999, 2);

    // Seller A's values must not appear
    expect(res.body.kpis.revenue).not.toBeCloseTo(600, 2);
    expect(res.body.kpis.cost).not.toBeCloseTo(70, 2);
  });

  it('12. CANCELLED and REFUNDED orders excluded from revenue', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // If cancelled (999) or refunded (888) were included: 600 + 999 + 888 = 2487
    // Correct: 600 only
    expect(res.body.kpis.revenue).toBeCloseTo(600, 2);
  });

  it('13. stats and orders outside date range excluded', async () => {
    const res = await getOverview(sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // Out-of-range order (777 on 2026-02-09) and stat (999 on 2026-02-09) excluded
    // Revenue should be 600 not 600+777=1377
    expect(res.body.kpis.revenue).toBeCloseTo(600, 2);
    // Cost should be 70 not 70+999=1069
    expect(res.body.kpis.cost).toBeCloseTo(70, 2);
  });
});
