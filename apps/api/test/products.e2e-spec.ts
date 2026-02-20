import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Product Catalog + Asset E2E Tests — Milestone 2.2.1
 * Updated Milestone 2.3.7: self-contained seed — no external db:seed required.
 *
 * Run: pnpm --filter @pixecom/api test:e2e
 *
 * Seeded products (all ACTIVE):
 *   MOUSE-001  SlimPro Wireless Mouse   — % pricing (49.99 * 40% = 20.00)
 *   STAND-001  ProStand Laptop Stand    — fixed pricing (15.00)
 *   DESKPAD-001 UltraClean Desk Pad    — % pricing (39.99 * 35% = 14.00)
 *
 * Labels: bestseller, new-arrival, trending, limited-edition
 * Assets (on MOUSE-001 only): 2 media, 2 thumbnails, 2 adtexts
 */
describe('Product Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  // IDs resolved after listing — we look them up by productCode in beforeAll
  let mouseProductId: string;
  let standProductId: string;
  let deskpadProductId: string;

  // ─── Helper ──────────────────────────────────────────────────────────────

  const uniqueEmail = () =>
    `prod-e2e-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const registerAndGetToken = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: uniqueEmail(),
        password: 'Password123!',
        displayName: 'CatalogTester',
      })
      .expect(201);
    return res.body.accessToken as string;
  };

  // ─── Setup / Teardown ────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // ── Self-contained seed: labels ──────────────────────────────────────
    const labelBestseller = await prisma.productLabel.upsert({
      where: { slug: 'bestseller' },
      update: {},
      create: { name: 'Bestseller', slug: 'bestseller' },
    });
    const labelNewArrival = await prisma.productLabel.upsert({
      where: { slug: 'new-arrival' },
      update: {},
      create: { name: 'New Arrival', slug: 'new-arrival' },
    });
    const labelTrending = await prisma.productLabel.upsert({
      where: { slug: 'trending' },
      update: {},
      create: { name: 'Trending', slug: 'trending' },
    });
    const labelLimited = await prisma.productLabel.upsert({
      where: { slug: 'limited-edition' },
      update: {},
      create: { name: 'Limited Edition', slug: 'limited-edition' },
    });

    // ── Self-contained seed: products ───────────────────────────────────
    // Product 1: MOUSE-001 — percentage pricing (49.99 * 40% = 20.00)
    const product1 = await prisma.product.upsert({
      where: { productCode: 'MOUSE-001' },
      update: {},
      create: {
        productCode: 'MOUSE-001',
        name: 'SlimPro Wireless Mouse',
        slug: 'slimpro-wireless-mouse',
        basePrice: 29.99,
        compareAtPrice: 39.99,
        currency: 'USD',
        sku: 'MOUSE-001-SKU',
        description: 'Ergonomic wireless mouse with precision tracking and 6-month battery life.',
        descriptionBlocks: [
          { type: 'paragraph', content: 'Ultra-slim ergonomic design for all-day comfort.' },
          { type: 'bullet_list', items: ['2.4GHz wireless', '1600 DPI sensor', '6-month battery'] },
        ],
        shippingInfo: { weight_g: 95, dimensions_cm: { l: 11.5, w: 6.2, h: 3.8 } },
        tags: ['wireless', 'ergonomic', 'office', 'productivity'],
        status: 'ACTIVE',
      },
    });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000101' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000101', productId: product1.id, name: 'Black', sku: 'MOUSE-001-BLK', priceOverride: null, options: { color: 'Black' }, stockQuantity: 150, isActive: true, position: 0 } });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000102' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000102', productId: product1.id, name: 'White', sku: 'MOUSE-001-WHT', priceOverride: null, options: { color: 'White' }, stockQuantity: 80, isActive: true, position: 1 } });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000103' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000103', productId: product1.id, name: 'Rose Gold', sku: 'MOUSE-001-RGD', priceOverride: 32.99, options: { color: 'Rose Gold' }, stockQuantity: 40, isActive: true, position: 2 } });
    await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product1.id, labelId: labelBestseller.id } }, update: {}, create: { productId: product1.id, labelId: labelBestseller.id } });
    await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product1.id, labelId: labelTrending.id } }, update: {}, create: { productId: product1.id, labelId: labelTrending.id } });
    await prisma.pricingRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000201' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000201', productId: product1.id, suggestedRetail: 49.99, sellerTakePercent: 40.00, sellerTakeFixed: null, holdPercent: 10, holdDurationDays: 7, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true } });
    await prisma.assetMedia.upsert({ where: { id: '00000000-0000-0000-0000-000000000301' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000301', productId: product1.id, version: 'v1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/v1-main.mp4', mediaType: 'VIDEO', durationSec: 30, fileSize: 8500000, width: 1080, height: 1080, position: 0, isCurrent: true } });
    await prisma.assetThumbnail.upsert({ where: { id: '00000000-0000-0000-0000-000000000401' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000401', productId: product1.id, version: 'v1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/v1-thumb.jpg', width: 800, height: 800, position: 0, isCurrent: true } });
    await prisma.assetThumbnail.upsert({ where: { id: '00000000-0000-0000-0000-000000000402' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000402', productId: product1.id, version: 'b1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/b1-thumb.jpg', width: 800, height: 800, position: 1, isCurrent: false } });
    await prisma.assetAdtext.upsert({ where: { id: '00000000-0000-0000-0000-000000000501' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000501', productId: product1.id, version: 'v1', primaryText: 'Say goodbye to tangled cables.', headline: 'SlimPro Wireless Mouse — Work Smarter', description: 'Ergonomic. Precise. Silent. Free 2-day shipping.' } });

    // Product 2: STAND-001 — fixed pricing override (15.00)
    const product2 = await prisma.product.upsert({
      where: { productCode: 'STAND-001' },
      update: {},
      create: {
        productCode: 'STAND-001',
        name: 'ProStand Laptop Stand',
        slug: 'prostand-laptop-stand',
        basePrice: 34.99,
        compareAtPrice: 49.99,
        currency: 'USD',
        sku: 'STAND-001-SKU',
        description: 'Adjustable aluminum laptop stand with cable management.',
        descriptionBlocks: [
          { type: 'paragraph', content: 'Premium aluminum alloy construction.' },
          { type: 'bullet_list', items: ['Adjustable 0-60 degrees', 'Fits 10-17 inch laptops', 'Foldable for travel'] },
        ],
        shippingInfo: { weight_g: 420, dimensions_cm: { l: 26, w: 22, h: 3 } },
        tags: ['laptop', 'stand', 'ergonomic', 'aluminum', 'portable'],
        status: 'ACTIVE',
      },
    });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000111' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000111', productId: product2.id, name: 'Silver', sku: 'STAND-001-SLV', priceOverride: null, options: { color: 'Silver' }, stockQuantity: 200, isActive: true, position: 0 } });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000112' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000112', productId: product2.id, name: 'Space Gray', sku: 'STAND-001-SGR', priceOverride: 37.99, options: { color: 'Space Gray' }, stockQuantity: 120, isActive: true, position: 1 } });
    await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product2.id, labelId: labelBestseller.id } }, update: {}, create: { productId: product2.id, labelId: labelBestseller.id } });
    await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product2.id, labelId: labelNewArrival.id } }, update: {}, create: { productId: product2.id, labelId: labelNewArrival.id } });
    await prisma.pricingRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000202' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000202', productId: product2.id, suggestedRetail: 54.99, sellerTakePercent: 25.00, sellerTakeFixed: 15.00, holdPercent: 10, holdDurationDays: 7, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true } });

    // Product 3: DESKPAD-001 — percentage pricing (39.99 * 35% = 14.00)
    const product3 = await prisma.product.upsert({
      where: { productCode: 'DESKPAD-001' },
      update: {},
      create: {
        productCode: 'DESKPAD-001',
        name: 'UltraClean Desk Pad',
        slug: 'ultraclean-desk-pad',
        basePrice: 24.99,
        compareAtPrice: null,
        currency: 'USD',
        sku: 'DESKPAD-001-SKU',
        description: 'Large waterproof desk pad with stitched edges and non-slip rubber base.',
        descriptionBlocks: [
          { type: 'paragraph', content: 'Keep your desk clean and organised.' },
          { type: 'bullet_list', items: ['900x400mm XL size', 'Waterproof surface', 'Non-slip base'] },
        ],
        shippingInfo: { weight_g: 280, dimensions_cm: { l: 92, w: 42, h: 0.3 } },
        tags: ['desk', 'pad', 'waterproof', 'home-office'],
        status: 'ACTIVE',
      },
    });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000121' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000121', productId: product3.id, name: 'Black / XL', sku: 'DESKPAD-001-BLK-XL', priceOverride: null, options: { color: 'Black', size: 'XL' }, stockQuantity: 300, isActive: true, position: 0 } });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000122' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000122', productId: product3.id, name: 'Grey / XL', sku: 'DESKPAD-001-GRY-XL', priceOverride: null, options: { color: 'Grey', size: 'XL' }, stockQuantity: 250, isActive: true, position: 1 } });
    await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000123' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000123', productId: product3.id, name: 'Pink / XL', sku: 'DESKPAD-001-PNK-XL', priceOverride: 26.99, options: { color: 'Pink', size: 'XL' }, stockQuantity: 75, isActive: true, position: 2 } });
    await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product3.id, labelId: labelLimited.id } }, update: {}, create: { productId: product3.id, labelId: labelLimited.id } });
    await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product3.id, labelId: labelTrending.id } }, update: {}, create: { productId: product3.id, labelId: labelTrending.id } });
    await prisma.pricingRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000203' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000203', productId: product3.id, suggestedRetail: 39.99, sellerTakePercent: 35.00, sellerTakeFixed: null, holdPercent: 10, holdDurationDays: 7, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true } });

    // Register a seller to obtain an access token used in all tests
    accessToken = await registerAndGetToken();

    // Discover product IDs by fetching the full catalog
    const listRes = await request(app.getHttpServer())
      .get('/api/products?limit=100')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const products: Array<{ id: string; code: string }> = listRes.body.data;
    mouseProductId = products.find((p) => p.code === 'MOUSE-001')?.id ?? '';
    standProductId = products.find((p) => p.code === 'STAND-001')?.id ?? '';
    deskpadProductId = products.find((p) => p.code === 'DESKPAD-001')?.id ?? '';

    if (!mouseProductId || !standProductId || !deskpadProductId) {
      throw new Error('Self-contained seed failed — products not found after upsert');
    }
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1 — Auth guard: 401 without token
  // ─────────────────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('GET /api/products returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/products').expect(401);
    });

    it('GET /api/products/:id returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}`)
        .expect(401);
    });

    it('GET /api/products/:id/variants returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/variants`)
        .expect(401);
    });

    it('GET /api/products/:id/assets/media returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/media`)
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2 — Pagination
  // ─────────────────────────────────────────────────────────────────────────

  describe('Pagination', () => {
    it('returns page 1 with default limit when no params given', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(Array.isArray(res.body.data)).toBe(true);
      // At least 3 seeded products
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('respects page and limit params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('page 2 with limit=2 returns different products than page 1', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/api/products?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/api/products?page=2&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids1 = page1.body.data.map((p: { id: string }) => p.id);
      const ids2 = page2.body.data.map((p: { id: string }) => p.id);

      // If total > 2, page 2 must exist and have different IDs
      if (page1.body.total > 2) {
        const overlap = ids1.filter((id: string) => ids2.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it('returns 400 for invalid page param (0)', async () => {
      await request(app.getHttpServer())
        .get('/api/products?page=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3 — Label filter
  // ─────────────────────────────────────────────────────────────────────────

  describe('Label filter', () => {
    it('label=bestseller returns only bestseller products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?label=bestseller')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Seeded: MOUSE-001 and STAND-001 have bestseller label
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(mouseProductId);
      expect(ids).toContain(standProductId);
      // DESKPAD-001 does NOT have bestseller label
      expect(ids).not.toContain(deskpadProductId);
    });

    it('label=limited-edition returns only limited-edition products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?label=limited-edition')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids = res.body.data.map((p: { id: string }) => p.id);
      // DESKPAD-001 has limited-edition label
      expect(ids).toContain(deskpadProductId);
      // STAND-001 does NOT
      expect(ids).not.toContain(standProductId);
    });

    it('label=trending returns products with trending label', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?label=trending')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(mouseProductId);
      expect(ids).toContain(deskpadProductId);
      // STAND-001 does NOT have trending label
      expect(ids).not.toContain(standProductId);
    });

    it('label=nonexistent-label returns empty data array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?label=nonexistent-zzz')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4 — Search (q param)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Search (q param)', () => {
    it('q=wireless returns SlimPro mouse (name match)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?q=wireless')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(mouseProductId);
    });

    it('q=MOUSE-001 returns mouse product (code match)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?q=MOUSE-001')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(mouseProductId);
    });

    it('q=desk returns UltraClean desk pad', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?q=desk')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(deskpadProductId);
    });

    it('q=zzz-no-match returns empty results', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?q=zzz-no-match-at-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('q is case-insensitive (LAPTOP matches laptop stand)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?q=LAPTOP')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(standProductId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5 — Product card shape
  // ─────────────────────────────────────────────────────────────────────────

  describe('Product card shape', () => {
    it('catalog items have required card fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const card = res.body.data[0];
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('code');
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('slug');
      expect(card).toHaveProperty('heroImageUrl');
      expect(card).toHaveProperty('suggestedRetailPrice');
      expect(card).toHaveProperty('youTakeEstimate');
      expect(card).toHaveProperty('labels');
      expect(Array.isArray(card.labels)).toBe(true);
    });

    it('MOUSE-001 card heroImageUrl is the v1 thumbnail URL', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const mouse = res.body.data.find(
        (p: { code: string }) => p.code === 'MOUSE-001',
      );
      expect(mouse).toBeDefined();
      expect(mouse.heroImageUrl).toBe(
        'https://cdn.pixelxlab.com/assets/mouse-001/v1-thumb.jpg',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6 — Product detail returns variants
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/products/:id — product detail', () => {
    it('returns full product detail with variants', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(mouseProductId);
      expect(res.body.productCode).toBe('MOUSE-001');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('descriptionBlocks');
      expect(res.body).toHaveProperty('shippingInfo');
      expect(res.body).toHaveProperty('tags');
      expect(res.body).toHaveProperty('currency');
      expect(res.body.status).toBe('ACTIVE');
      expect(Array.isArray(res.body.variants)).toBe(true);
      expect(res.body.variants.length).toBeGreaterThanOrEqual(2);
    });

    it('variants have required fields including effectivePrice', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const variant = res.body.variants[0];
      expect(variant).toHaveProperty('id');
      expect(variant).toHaveProperty('name');
      expect(variant).toHaveProperty('effectivePrice');
      expect(variant).toHaveProperty('stockQuantity');
      expect(variant).toHaveProperty('isActive');
      expect(variant).toHaveProperty('position');
      expect(variant).toHaveProperty('options');
    });

    it('Rose Gold variant effectivePrice uses priceOverride (32.99)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const roseGold = res.body.variants.find(
        (v: { name: string }) => v.name === 'Rose Gold',
      );
      expect(roseGold).toBeDefined();
      expect(parseFloat(roseGold.effectivePrice)).toBeCloseTo(32.99, 2);
    });

    it('Black variant effectivePrice falls back to basePrice (29.99)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const black = res.body.variants.find(
        (v: { name: string }) => v.name === 'Black',
      );
      expect(black).toBeDefined();
      expect(parseFloat(black.effectivePrice)).toBeCloseTo(29.99, 2);
    });

    it('returns 404 for non-existent product ID', async () => {
      await request(app.getHttpServer())
        .get('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('returns 400 for non-UUID product ID', async () => {
      await request(app.getHttpServer())
        .get('/api/products/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7 — GET /api/products/:id/variants (separate endpoint)
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/products/:id/variants', () => {
    it('returns active variants array for mouse product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/variants`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res)).toBe(false); // response is the array directly
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3); // Black, White, Rose Gold
    });

    it('variants are ordered by position asc', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/variants`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const positions = res.body.map((v: { position: number }) => v.position);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8 — Assets endpoints return arrays
  // ─────────────────────────────────────────────────────────────────────────

  describe('Asset endpoints', () => {
    it('GET /assets/media returns array of media items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/media`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // v1 and b1
    });

    it('media items have required fields and stub stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/media`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const item = res.body[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('version');
      expect(item).toHaveProperty('url');
      expect(item).toHaveProperty('mediaType');
      expect(item).toHaveProperty('isCurrent');
      // Phase 1 stub stats
      expect(item.spend).toBe(0);
      expect(item.roas).toBeNull();
    });

    it('media items are ordered version asc then position asc', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/media`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // v1 comes before b1 alphabetically
      expect(res.body[0].version).toBe('b1');
      expect(res.body[1].version).toBe('v1');
    });

    it('GET /assets/thumbnails returns array of thumbnail items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/thumbnails`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // v1 and b1
    });

    it('thumbnails have stub stats: spend=0, roas=null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/thumbnails`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      for (const item of res.body) {
        expect(item.spend).toBe(0);
        expect(item.roas).toBeNull();
      }
    });

    it('GET /assets/adtexts returns array of adtext items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/adtexts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // v1 and b1
    });

    it('adtexts have primaryText, headline, and stub stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}/assets/adtexts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const item = res.body[0];
      expect(item).toHaveProperty('primaryText');
      expect(item).toHaveProperty('headline');
      expect(item.spend).toBe(0);
      expect(item.roas).toBeNull();
    });

    it('product with no assets returns empty arrays', async () => {
      // STAND-001 has no seeded assets
      const media = await request(app.getHttpServer())
        .get(`/api/products/${standProductId}/assets/media`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const thumbs = await request(app.getHttpServer())
        .get(`/api/products/${standProductId}/assets/thumbnails`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const adtexts = await request(app.getHttpServer())
        .get(`/api/products/${standProductId}/assets/adtexts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(media.body).toEqual([]);
      expect(thumbs.body).toEqual([]);
      expect(adtexts.body).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 9 — youTakeEstimate: percentage case
  // ─────────────────────────────────────────────────────────────────────────

  describe('youTakeEstimate — percentage case (MOUSE-001)', () => {
    /**
     * MOUSE-001 pricing rule:
     *   suggestedRetail    = 49.99
     *   sellerTakePercent  = 40.00
     *   sellerTakeFixed    = null
     *
     * Expected: youTakeEstimate = 49.99 * 0.40 = 19.996 → "20.00"
     */
    it('catalog card computes youTakeEstimate as pct of suggestedRetail', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const mouse = res.body.data.find(
        (p: { code: string }) => p.code === 'MOUSE-001',
      );
      expect(mouse).toBeDefined();
      expect(parseFloat(mouse.youTakeEstimate)).toBeCloseTo(20.0, 2);
      // suggestedRetailPrice from pricing rule (not basePrice)
      expect(parseFloat(mouse.suggestedRetailPrice)).toBeCloseTo(49.99, 2);
    });

    it('detail endpoint also returns correct youTakeEstimate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${mouseProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(parseFloat(res.body.youTakeEstimate)).toBeCloseTo(20.0, 2);
    });

    it('DESKPAD-001 youTakeEstimate = 39.99 * 35% = 14.00', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const pad = res.body.data.find(
        (p: { code: string }) => p.code === 'DESKPAD-001',
      );
      expect(pad).toBeDefined();
      expect(parseFloat(pad.youTakeEstimate)).toBeCloseTo(14.0, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 10 — youTakeEstimate: fixed override case
  // ─────────────────────────────────────────────────────────────────────────

  describe('youTakeEstimate — fixed override case (STAND-001)', () => {
    /**
     * STAND-001 pricing rule:
     *   suggestedRetail    = 54.99
     *   sellerTakePercent  = 25.00
     *   sellerTakeFixed    = 15.00  ← fixed takes precedence
     *
     * Expected: youTakeEstimate = 15.00 (NOT 54.99 * 0.25 = 13.75)
     */
    it('catalog card youTakeEstimate uses fixed amount, not percentage', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products?limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const stand = res.body.data.find(
        (p: { code: string }) => p.code === 'STAND-001',
      );
      expect(stand).toBeDefined();
      // Fixed override = 15.00 (not 54.99 * 25% = 13.75)
      expect(parseFloat(stand.youTakeEstimate)).toBeCloseTo(15.0, 2);
      // suggestedRetailPrice from pricing rule
      expect(parseFloat(stand.suggestedRetailPrice)).toBeCloseTo(54.99, 2);
    });

    it('detail endpoint also returns fixed youTakeEstimate = 15.00', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/${standProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(parseFloat(res.body.youTakeEstimate)).toBeCloseTo(15.0, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 11 — DRAFT / ARCHIVED products are not visible
  // ─────────────────────────────────────────────────────────────────────────

  describe('Only ACTIVE products appear in catalog', () => {
    it('catalog list contains only ACTIVE products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // All returned items should be active (status not exposed on card
      // but we verify through product detail)
      for (const card of res.body.data) {
        const detail = await request(app.getHttpServer())
          .get(`/api/products/${card.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        expect(detail.body.status).toBe('ACTIVE');
      }
    });
  });
});
