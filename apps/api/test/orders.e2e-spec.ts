import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Orders Read Layer E2E Tests — Milestone 2.3.4-D + Task B2
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Coverage:
 *  1.  GET /orders — 401 without JWT
 *  2.  GET /orders — empty list for fresh seller
 *  3.  GET /orders — returns seeded orders with correct shape
 *  4.  GET /orders — sellpageId filter
 *  5.  GET /orders — status filter
 *  6.  GET /orders — search by order number prefix
 *  7.  GET /orders — search by customer email (contains)
 *  8.  GET /orders — cursor pagination (limit=1 → nextCursor → page 2)
 *  9.  GET /orders — tenant isolation (Seller B sees only own orders)
 *  10. GET /orders/:id — returns full order detail shape
 *  11. GET /orders/:id — 404 when order belongs to another seller
 *  12. GET /orders/:id — 404 for non-existent order id
 *  13. GET /orders/:id — 400 for non-UUID param
 *  14. Response never leaks raw DB fields (sellerId, shippingCost, discountAmount, etc.)
 *  15. GET /orders/:id — exposes tracking + payment fields
 *  16. GET /orders — list item includes trackingNumber
 *  17. GET /orders — search by customerName (contains)
 *  18. GET /orders — search by customerPhone (contains)
 *  19. GET /orders — search by trackingNumber (contains)
 */
describe('Orders Read Layer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;
  let sellerBId: string;

  // Seeded IDs
  let productId: string;
  let sellpageId1: string;
  let sellpageId2: string;
  let orderA1Id: string; // CONFIRMED, sellpage1, has tracking + payment
  let orderA2Id: string; // PENDING, sellpage1
  let orderA3Id: string; // CONFIRMED, sellpage2
  let orderBId: string;  // Seller B's order

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'ord234') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

  const get = (path: string, token: string, query?: Record<string, string | number>) =>
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

    // Register sellers
    const resA = await register(uniqueEmail('ord-a'), 'Orders Seller A');
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    const resB = await register(uniqueEmail('ord-b'), 'Orders Seller B');
    sellerBToken = resB.body.accessToken;
    sellerBId = resB.body.seller.id;

    // Platform product
    const product = await prisma.product.create({
      data: {
        productCode: `ORD234-${Date.now()}`,
        name: 'Orders Test Product',
        slug: `ord-test-prod-${Date.now()}`,
        basePrice: 49.99,
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    // Sellpages for Seller A
    const sp1 = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: `ord-sp1-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    sellpageId1 = sp1.id;

    const sp2 = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: `ord-sp2-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    sellpageId2 = sp2.id;

    // Orders for Seller A
    const now = Date.now();

    // Order A1 — has tracking + payment fields for Task B2 tests
    const o1 = await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ORD-A-001-${now}`,
        customerEmail: 'alice@test.io',
        customerName: 'Alice Buyer',
        customerPhone: '+84900000001',
        subtotal: 150.00,
        shippingCost: 5.00,
        taxAmount: 0,
        discountAmount: 0,
        total: 155.00,
        currency: 'USD',
        status: 'CONFIRMED',
        trackingNumber: 'TRK-TEST-001',
        trackingUrl: 'https://track.example.com/TRK-TEST-001',
        paymentMethod: 'COD',
        paymentId: 'PAY-ALICE-001',
        shippingAddress: { street: '123 Main St', city: 'HCM', country: 'VN' },
        createdAt: new Date('2026-02-10T10:00:00.000Z'),
      },
    });
    orderA1Id = o1.id;

    // Add items + event to order A1
    await prisma.orderItem.create({
      data: {
        orderId: o1.id,
        productName: 'Test Product',
        variantName: 'Size M',
        quantity: 2,
        unitPrice: 75.00,
        lineTotal: 150.00,
      },
    });
    await prisma.orderEvent.create({
      data: {
        orderId: o1.id,
        sellerId: sellerAId,
        eventType: 'CONFIRMED',
        description: 'Payment received',
      },
    });

    const o2 = await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId1,
        orderNumber: `ORD-A-002-${now}`,
        customerEmail: 'bob@test.io',
        customerName: 'Bob Buyer',
        subtotal: 49.99,
        total: 49.99,
        currency: 'USD',
        status: 'PENDING',
        createdAt: new Date('2026-02-10T11:00:00.000Z'),
      },
    });
    orderA2Id = o2.id;

    const o3 = await prisma.order.create({
      data: {
        sellerId: sellerAId,
        sellpageId: sellpageId2,
        orderNumber: `ORD-A-003-${now}`,
        customerEmail: 'carol@test.io',
        customerName: 'Carol Buyer',
        customerPhone: '+84900000003',
        subtotal: 200.00,
        total: 200.00,
        currency: 'USD',
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-10T12:00:00.000Z'),
      },
    });
    orderA3Id = o3.id;

    // Seller B's order (must never appear in Seller A results)
    const spB = await prisma.sellpage.create({
      data: {
        sellerId: sellerBId,
        productId,
        slug: `ord-spB-${Date.now()}`,
        status: 'PUBLISHED',
      },
    });
    const oB = await prisma.order.create({
      data: {
        sellerId: sellerBId,
        sellpageId: spB.id,
        orderNumber: `ORD-B-001-${now}`,
        customerEmail: 'sellerb@test.io',
        total: 9999.00,
        currency: 'USD',
        status: 'CONFIRMED',
        createdAt: new Date('2026-02-10T13:00:00.000Z'),
      },
    });
    orderBId = oB.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LIST ENDPOINT
  // ══════════════════════════════════════════════════════════════════════════

  it('1. GET /orders — 401 without JWT', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
  });

  it('2. GET /orders — empty list for fresh seller', async () => {
    const freshRes = await register(uniqueEmail('ord-fresh'), 'Fresh Seller');
    const freshToken = freshRes.body.accessToken;

    const res = await get('/api/orders', freshToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it('3. GET /orders — returns seeded orders with correct shape', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    expect(res.body.items.length).toBe(3);
    const item = res.body.items[0]; // most recent first
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('orderNumber');
    expect(item).toHaveProperty('createdAt');
    expect(item).toHaveProperty('customer.email');
    expect(item).toHaveProperty('customer.name');
    expect(item).toHaveProperty('total');
    expect(item).toHaveProperty('currency');
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('itemsCount');
    // sellpage present for orders with sellpageId
    expect(item).toHaveProperty('sellpage.id');
    expect(item).toHaveProperty('sellpage.url');
  });

  it('4. GET /orders — sellpageId filter returns only that sellpage orders', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      sellpageId: sellpageId1,
    }).expect(200);

    expect(res.body.items.length).toBe(2);
    for (const item of res.body.items) {
      expect(item.sellpage.id).toBe(sellpageId1);
    }
    // Seller A's sellpage2 order should not appear
    const ids = res.body.items.map((i: any) => i.id);
    expect(ids).not.toContain(orderA3Id);
  });

  it('5. GET /orders — status filter returns only matching status', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      status: 'PENDING',
    }).expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(orderA2Id);
    expect(res.body.items[0].status).toBe('PENDING');
  });

  it('6. GET /orders — search by order number prefix', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      search: 'ORD-A-001',
    }).expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(orderA1Id);
  });

  it('7. GET /orders — search by customer email (contains)', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      search: 'carol@test',
    }).expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(orderA3Id);
  });

  it('8. GET /orders — cursor pagination returns nextCursor and non-overlapping page 2', async () => {
    const page1 = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      limit: 2,
    }).expect(200);

    expect(page1.body.items.length).toBe(2);
    expect(page1.body.nextCursor).not.toBeNull();

    const cursor = page1.body.nextCursor;
    const page1Ids = page1.body.items.map((i: any) => i.id);

    const page2 = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      limit: 2,
      cursor,
    }).expect(200);

    expect(page2.body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of page2.body.items) {
      expect(page1Ids).not.toContain(item.id);
    }
  });

  it('9. GET /orders — tenant isolation: Seller B sees only own orders', async () => {
    const res = await get('/api/orders', sellerBToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    const ids = res.body.items.map((i: any) => i.id);
    expect(ids).toContain(orderBId);
    expect(ids).not.toContain(orderA1Id);
    expect(ids).not.toContain(orderA2Id);
    expect(ids).not.toContain(orderA3Id);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL ENDPOINT
  // ══════════════════════════════════════════════════════════════════════════

  it('10. GET /orders/:id — returns full order detail shape', async () => {
    const res = await get(`/api/orders/${orderA1Id}`, sellerAToken).expect(200);
    const o = res.body;

    // Top-level fields
    expect(o.id).toBe(orderA1Id);
    expect(o).toHaveProperty('orderNumber');
    expect(o).toHaveProperty('createdAt');

    // sellpage
    expect(o.sellpage).not.toBeNull();
    expect(o.sellpage).toHaveProperty('id', sellpageId1);
    expect(o.sellpage).toHaveProperty('url');

    // customer
    expect(o.customer).toMatchObject({
      email: 'alice@test.io',
      name: 'Alice Buyer',
      phone: '+84900000001',
    });

    // totals
    expect(o.totals).toMatchObject({
      subtotal: 150,
      shipping: 5,
      tax: 0,
      discount: 0,
      total: 155,
      currency: 'USD',
    });

    // status
    expect(o.status).toBe('CONFIRMED');

    // items
    expect(o.items).toHaveLength(1);
    expect(o.items[0]).toMatchObject({
      productTitle: 'Test Product',
      variantTitle: 'Size M',
      qty: 2,
      unitPrice: 75,
      lineTotal: 150,
    });

    // events
    expect(o.events).toHaveLength(1);
    expect(o.events[0].type).toBe('CONFIRMED');
    expect(o.events[0]).toHaveProperty('at');
    expect(o.events[0]).toHaveProperty('note');
  });

  it('11. GET /orders/:id — 404 when order belongs to another seller', async () => {
    // Seller A tries to access Seller B's order
    await get(`/api/orders/${orderBId}`, sellerAToken).expect(404);
  });

  it('12. GET /orders/:id — 404 for non-existent order id', async () => {
    await get('/api/orders/00000000-0000-0000-0000-000000000000', sellerAToken).expect(404);
  });

  it('13. GET /orders/:id — 400 for non-UUID param', async () => {
    await get('/api/orders/not-a-uuid', sellerAToken).expect(400);
  });

  it('14. Response never leaks raw DB fields (sellerId, shippingCost, discountAmount, updatedAt)', async () => {
    const listRes = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    const listItem = listRes.body.items[0];
    // Raw DB fields must not appear in list items
    expect(listItem).not.toHaveProperty('sellerId');
    expect(listItem).not.toHaveProperty('updatedAt');
    expect(listItem).not.toHaveProperty('shippingCost');  // exposed as totals.shipping in detail only
    expect(listItem).not.toHaveProperty('discountAmount'); // exposed as totals.discount in detail only

    const detailRes = await get(`/api/orders/${orderA1Id}`, sellerAToken).expect(200);
    const detail = detailRes.body;
    // Raw DB field names must not leak (values are mapped to semantic response keys)
    expect(detail).not.toHaveProperty('sellerId');
    expect(detail).not.toHaveProperty('discountAmount'); // in totals.discount
    expect(detail).not.toHaveProperty('shippingCost');   // in totals.shipping
    expect(detail).not.toHaveProperty('subtotal');        // in totals.subtotal
    expect(detail).not.toHaveProperty('taxAmount');       // in totals.tax
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TASK B2 — NEW TESTS
  // ══════════════════════════════════════════════════════════════════════════

  it('15. GET /orders/:id — exposes tracking + payment + shippingAddress fields', async () => {
    const res = await get(`/api/orders/${orderA1Id}`, sellerAToken).expect(200);
    const o = res.body;

    expect(o.trackingNumber).toBe('TRK-TEST-001');
    expect(o.trackingUrl).toBe('https://track.example.com/TRK-TEST-001');
    expect(o.paymentMethod).toBe('COD');
    expect(o.paymentId).toBe('PAY-ALICE-001');
    expect(o.shippingAddress).toMatchObject({ street: '123 Main St', city: 'HCM', country: 'VN' });
  });

  it('15b. GET /orders/:id — tracking/payment fields are null when not set', async () => {
    const res = await get(`/api/orders/${orderA2Id}`, sellerAToken).expect(200);
    const o = res.body;

    expect(o.trackingNumber).toBeNull();
    expect(o.trackingUrl).toBeNull();
    expect(o.paymentMethod).toBeNull();
    expect(o.paymentId).toBeNull();
    expect(o.shippingAddress).toEqual({});
  });

  it('16. GET /orders — list item includes trackingNumber field', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    }).expect(200);

    // All items must have the trackingNumber key (null for unset, string for set)
    for (const item of res.body.items) {
      expect(item).toHaveProperty('trackingNumber');
    }

    // Find order A1 in the list — should have its trackingNumber
    const a1 = res.body.items.find((i: any) => i.id === orderA1Id);
    expect(a1).toBeDefined();
    expect(a1.trackingNumber).toBe('TRK-TEST-001');

    // Order A2 has no trackingNumber — should be null
    const a2 = res.body.items.find((i: any) => i.id === orderA2Id);
    expect(a2).toBeDefined();
    expect(a2.trackingNumber).toBeNull();
  });

  it('17. GET /orders — search by customerName (contains, case-insensitive)', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      search: 'alice buyer',
    }).expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(orderA1Id);
  });

  it('18. GET /orders — search by customerPhone (contains)', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      search: '+84900000003',
    }).expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(orderA3Id);
  });

  it('19. GET /orders — search by trackingNumber (contains, case-insensitive)', async () => {
    const res = await get('/api/orders', sellerAToken, {
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
      search: 'TRK-TEST',
    }).expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(orderA1Id);
  });
});
