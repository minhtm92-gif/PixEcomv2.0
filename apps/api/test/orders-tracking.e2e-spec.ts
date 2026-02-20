import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SevenTrackProvider } from '../src/orders/tracking/seventeen-track.provider';

/**
 * Orders Tracking E2E Tests — Milestone 2.3.6
 *
 * Requires live PostgreSQL on port 5434.
 * SevenTrackProvider is mocked via jest.spyOn to avoid real HTTP calls.
 *
 * Coverage:
 *  1.  GET /orders — transactionId present in list item
 *  2.  GET /orders — trackingNumber + trackingStatus in list item
 *  3.  GET /orders/:id — transactionId = paymentId value
 *  4.  GET /orders/:id — tracking section present (number, status, url, provider)
 *  5.  POST /orders/:id/refresh-tracking — 401 without JWT
 *  6.  POST /orders/:id/refresh-tracking — 200 + snapshot shape
 *  7.  POST /orders/:id/refresh-tracking — trackingStatus updated in DB
 *  8.  POST /orders/:id/refresh-tracking — OrderEvent logged (TRACKING_REFRESHED)
 *  9.  POST /orders/:id/refresh-tracking — 400 when order has no tracking number
 *  10. POST /orders/:id/refresh-tracking — 404 when seller B uses seller A orderId
 *  11. POST /orders/:id/refresh-tracking — 429 after 5 requests in 60s window
 *  12. GET /sellers/me/settings — autoTrackingRefresh field present (default false)
 *  13. PATCH /sellers/me/settings — set autoTrackingRefresh=true persisted
 *  14. POST /orders/:id/refresh-tracking — 404 for unknown orderId
 */
describe('Orders Tracking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sevenTrackProvider: SevenTrackProvider;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;

  let orderWithTrackingId: string;
  let orderNoTrackingId: string;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const uid = (prefix = 'trk') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-5)}`;

  const uniqueEmail = () =>
    `trk-${Date.now()}-${Math.random().toString(36).slice(-5)}@pixecom-e2e.io`;

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName: 'Tracking Tester' });

  const auth = (token: string) => `Bearer ${token}`;

  const get = (path: string, token: string, query?: Record<string, string>) =>
    request(app.getHttpServer())
      .get(path)
      .query(query ?? {})
      .set('Authorization', auth(token));

  const post = (path: string, token: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', auth(token));

  const patch = (path: string, token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', auth(token))
      .send(body);

  // ─── Setup ───────────────────────────────────────────────────────────────

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
    sevenTrackProvider = moduleFixture.get<SevenTrackProvider>(SevenTrackProvider);

    // ── Mock the 17track provider — no real HTTP calls in E2E ──
    jest.spyOn(sevenTrackProvider, 'refreshTracking').mockResolvedValue({
      status: 'IN_TRANSIT',
      lastEvent: 'Package in transit',
      updatedAt: new Date(),
    });

    // ── Register Seller A + B ──
    const resA = await register(uniqueEmail());
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    const resB = await register(uniqueEmail());
    sellerBToken = resB.body.accessToken;

    // ── Seed: Product + Sellpage ──
    const product = await prisma.product.create({
      data: {
        productCode: `TRK-${Date.now()}`,
        name: 'Tracking Test Product',
        slug: uid('slug'),
        basePrice: 30,
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

    // ── Seed: Order WITH tracking number + paymentId ──
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const orderWithTracking = await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpage.id,
        orderNumber: uid('ORD'),
        customerEmail: 'customer@example.com',
        customerName: 'Test Customer',
        total: 99.99,
        currency: 'USD',
        status: 'SHIPPED',
        paymentId: 'PAY-XYZ-123',
        trackingNumber: 'TRK123456789',
        trackingUrl: 'https://t.17track.net/en#nums=TRK123456789',
        trackingProvider: '17TRACK',
        createdAt: today,
      },
    });
    orderWithTrackingId = orderWithTracking.id;

    // ── Seed: Order WITHOUT tracking number ──
    const orderNoTracking = await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpage.id,
        orderNumber: uid('ORD'),
        customerEmail: 'customer2@example.com',
        total: 49.99,
        currency: 'USD',
        status: 'PENDING',
        createdAt: today,
      },
    });
    orderNoTrackingId = orderNoTracking.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── GET /orders — new fields in list ────────────────────────────────────

  it('1. GET /orders — transactionId present in list item', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await get('/api/orders', sellerAToken, { dateFrom: today, dateTo: today });
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.id === orderWithTrackingId);
    expect(item).toBeDefined();
    expect(item).toHaveProperty('transactionId');
  });

  it('2. GET /orders — trackingNumber + trackingStatus in list item', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await get('/api/orders', sellerAToken, { dateFrom: today, dateTo: today });
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.id === orderWithTrackingId);
    expect(item).toBeDefined();
    expect(item).toHaveProperty('trackingNumber');
    expect(item).toHaveProperty('trackingStatus');
    expect(item.trackingNumber).toBe('TRK123456789');
  });

  // ─── GET /orders/:id — new fields in detail ───────────────────────────────

  it('3. GET /orders/:id — transactionId = paymentId value', async () => {
    const res = await get(`/api/orders/${orderWithTrackingId}`, sellerAToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactionId');
    expect(res.body.transactionId).toBe('PAY-XYZ-123');
  });

  it('4. GET /orders/:id — tracking section shape (number, status, url, provider)', async () => {
    const res = await get(`/api/orders/${orderWithTrackingId}`, sellerAToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tracking');
    expect(res.body.tracking).toMatchObject({
      number: 'TRK123456789',
      url: expect.any(String),
      provider: '17TRACK',
    });
    // status is null initially (not yet refreshed)
    expect(res.body.tracking).toHaveProperty('status');
  });

  // ─── POST /orders/:id/refresh-tracking ────────────────────────────────────

  it('5. POST /orders/:id/refresh-tracking — 401 without JWT', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${orderWithTrackingId}/refresh-tracking`);
    expect(res.status).toBe(401);
  });

  it('6. POST /orders/:id/refresh-tracking — 200 + snapshot shape', async () => {
    const res = await post(
      `/api/orders/${orderWithTrackingId}/refresh-tracking`,
      sellerAToken,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      trackingNumber: 'TRK123456789',
      trackingStatus: 'IN_TRANSIT',
      lastEvent: 'Package in transit',
    });
    expect(res.body).toHaveProperty('refreshedAt');
  });

  it('7. POST /orders/:id/refresh-tracking — trackingStatus updated in DB', async () => {
    await post(`/api/orders/${orderWithTrackingId}/refresh-tracking`, sellerAToken);
    const order = await prisma.order.findUnique({
      where: { id: orderWithTrackingId },
      select: { trackingStatus: true },
    });
    expect(order?.trackingStatus).toBe('IN_TRANSIT');
  });

  it('8. POST /orders/:id/refresh-tracking — OrderEvent logged (TRACKING_REFRESHED)', async () => {
    await post(`/api/orders/${orderWithTrackingId}/refresh-tracking`, sellerAToken);
    const event = await prisma.orderEvent.findFirst({
      where: { orderId: orderWithTrackingId, eventType: 'TRACKING_REFRESHED' },
    });
    expect(event).toBeDefined();
    expect(event?.eventType).toBe('TRACKING_REFRESHED');
  });

  it('9. POST /orders/:id/refresh-tracking — 400 when order has no tracking number', async () => {
    const res = await post(
      `/api/orders/${orderNoTrackingId}/refresh-tracking`,
      sellerAToken,
    );
    expect(res.status).toBe(400);
  });

  it('10. POST /orders/:id/refresh-tracking — 404 when seller B uses seller A orderId', async () => {
    const res = await post(
      `/api/orders/${orderWithTrackingId}/refresh-tracking`,
      sellerBToken,
    );
    expect(res.status).toBe(404);
  });

  it('11. POST /orders/:id/refresh-tracking — 429 after 5 requests in same 60s window', async () => {
    // Register a fresh seller so rate limit window is clean
    const fresh = await register(uniqueEmail());
    const freshToken = fresh.body.accessToken;
    const freshSellerId = fresh.body.seller.id;

    // Seed a product + sellpage + order with tracking for fresh seller
    const product = await prisma.product.create({
      data: {
        productCode: `TRK-RL-${Date.now()}`,
        name: 'Rate Limit Product',
        slug: uid('rl-slug'),
        basePrice: 20,
        status: 'ACTIVE',
      },
    });
    const sellpage = await prisma.sellpage.create({
      data: {
        sellerId: freshSellerId,
        productId: product.id,
        slug: uid('rl-sp'),
        status: 'PUBLISHED',
      },
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const order = await prisma.order.create({
      data: {
        sellerId: freshSellerId,
        sellpageId: sellpage.id,
        orderNumber: uid('RL'),
        customerEmail: 'rl@example.com',
        total: 10,
        currency: 'USD',
        status: 'SHIPPED',
        trackingNumber: 'RLTRK999',
        createdAt: today,
      },
    });

    const url = `/api/orders/${order.id}/refresh-tracking`;

    // First 5 requests should succeed (200)
    for (let i = 0; i < 5; i++) {
      const res = await post(url, freshToken);
      expect(res.status).toBe(200);
    }

    // 6th request in same window → 429
    const res = await post(url, freshToken);
    expect(res.status).toBe(429);
  });

  it('14. POST /orders/:id/refresh-tracking — 404 for unknown orderId', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await post(`/api/orders/${fakeId}/refresh-tracking`, sellerAToken);
    expect(res.status).toBe(404);
  });

  // ─── SellerSettings — autoTrackingRefresh ─────────────────────────────────

  it('12. GET /sellers/me/settings — autoTrackingRefresh field present (default false)', async () => {
    const res = await get('/api/sellers/me/settings', sellerAToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('autoTrackingRefresh');
    expect(res.body.autoTrackingRefresh).toBe(false);
  });

  it('13. PATCH /sellers/me/settings — set autoTrackingRefresh=true persisted', async () => {
    const patchRes = await patch(
      '/api/sellers/me/settings',
      sellerAToken,
      { autoTrackingRefresh: true },
    );
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.autoTrackingRefresh).toBe(true);

    // Verify persisted via GET
    const getRes = await get('/api/sellers/me/settings', sellerAToken);
    expect(getRes.body.autoTrackingRefresh).toBe(true);
  });
});
