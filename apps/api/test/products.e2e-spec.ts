import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Product Catalog + Asset E2E Tests — Milestone 2.2.1
 *
 * Requires a live PostgreSQL database (pixecom-postgres on port 5434)
 * with seed data already applied:
 *   pnpm --filter @pixecom/database db:seed
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

    // Register a seller to obtain an access token used in all tests
    accessToken = await registerAndGetToken();

    // Discover seeded product IDs by fetching the full catalog
    const listRes = await request(app.getHttpServer())
      .get('/api/products?limit=100')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const products: Array<{ id: string; code: string }> = listRes.body.data;
    mouseProductId = products.find((p) => p.code === 'MOUSE-001')?.id ?? '';
    standProductId = products.find((p) => p.code === 'STAND-001')?.id ?? '';
    deskpadProductId =
      products.find((p) => p.code === 'DESKPAD-001')?.id ?? '';

    // Guard: fail early with a clear message if seed wasn't run
    if (!mouseProductId || !standProductId || !deskpadProductId) {
      throw new Error(
        'Seed data missing! Run: pnpm --filter @pixecom/database db:seed',
      );
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
        .get('/api/products')
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
        .get('/api/products')
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
        .get('/api/products')
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
        .get('/api/products')
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
