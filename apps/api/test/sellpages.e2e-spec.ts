import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Sellpage Module E2E Tests — Milestone 2.2.2
 *
 * Requires a live PostgreSQL database (pixecom-postgres on port 5434)
 * with seed data already applied:
 *   pnpm --filter @pixecom/database db:seed
 *
 * Run: pnpm --filter @pixecom/api test:e2e
 *
 * Seeded context:
 *   - 3 ACTIVE products: MOUSE-001, STAND-001, DESKPAD-001
 *   - 1 seed seller (seed-seller@pixecom.io) with 3 seeded sellpages
 *     (used only to verify isolation — NOT shared with test sellers)
 *
 * Test coverage:
 *  1. Auth guard (401 without JWT)
 *  2. POST /api/sellpages — create (201)
 *  3. POST /api/sellpages — duplicate slug → 409
 *  4. POST /api/sellpages — missing required field → 400
 *  5. POST /api/sellpages — invalid productId (not UUID) → 400
 *  6. POST /api/sellpages — non-existent productId → 404
 *  7. GET /api/sellpages — paginated list (shape)
 *  8. GET /api/sellpages — status filter
 *  9. GET /api/sellpages — q search
 * 10. GET /api/sellpages/:id — full detail with product snapshot
 * 11. GET /api/sellpages/:id — tenant isolation (other seller's page → 404)
 * 12. GET /api/sellpages/:id — non-UUID → 400
 * 13. PATCH /api/sellpages/:id — partial update (slug + titleOverride)
 * 14. PATCH /api/sellpages/:id — empty body → 400
 * 15. PATCH /api/sellpages/:id — duplicate slug → 409
 * 16. POST /api/sellpages/:id/publish — DRAFT → PUBLISHED
 * 17. POST /api/sellpages/:id/publish — already PUBLISHED → 400
 * 18. POST /api/sellpages/:id/unpublish — PUBLISHED → DRAFT
 * 19. POST /api/sellpages/:id/unpublish — already DRAFT → 400
 * 20. URL preview — no domain → <unassigned-domain>/{slug}
 */
describe('Sellpages (e2e)', () => {
  let app: INestApplication;

  // Two sellers to test tenant isolation
  let sellerAToken: string;
  let sellerBToken: string;

  // Discovered product IDs from catalog
  let mouseProductId: string;
  let standProductId: string;

  // Created sellpage IDs (seller A)
  let sellpageId: string;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'sp') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const registerAndGetToken = async (prefix = 'sp'): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: uniqueEmail(prefix),
        password: 'Password123!',
        displayName: `E2E Seller ${prefix}`,
      })
      .expect(201);
    return res.body.accessToken as string;
  };

  const post = (path: string, token: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const patch = (path: string, token: string, body: object) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

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

    // Register two sellers for isolation tests
    [sellerAToken, sellerBToken] = await Promise.all([
      registerAndGetToken('sp-a'),
      registerAndGetToken('sp-b'),
    ]);

    // Discover seeded product IDs
    const listRes = await request(app.getHttpServer())
      .get('/api/products?limit=100')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    const products: Array<{ id: string; code: string }> = listRes.body.data;
    mouseProductId = products.find((p) => p.code === 'MOUSE-001')?.id ?? '';
    standProductId = products.find((p) => p.code === 'STAND-001')?.id ?? '';

    if (!mouseProductId || !standProductId) {
      throw new Error(
        'Seed products missing! Run: pnpm --filter @pixecom/database db:seed',
      );
    }
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1 — Auth guard
  // ─────────────────────────────────────────────────────────────────────────

  describe('1. Auth guard', () => {
    it('GET /api/sellpages returns 401 without JWT', async () => {
      await request(app.getHttpServer()).get('/api/sellpages').expect(401);
    });

    it('POST /api/sellpages returns 401 without JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/sellpages')
        .send({ productId: mouseProductId, slug: 'no-auth' })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2 — CREATE
  // ─────────────────────────────────────────────────────────────────────────

  describe('2. POST /api/sellpages — create', () => {
    it('creates a sellpage and returns 201 with expected shape', async () => {
      const res = await post('/api/sellpages', sellerAToken, {
        productId: mouseProductId,
        slug: 'mouse-offer-a',
        titleOverride: 'Best Mouse Deal',
      }).expect(201);

      const body = res.body;
      expect(body).toMatchObject({
        id: expect.any(String),
        productId: mouseProductId,
        slug: 'mouse-offer-a',
        status: 'DRAFT',
        sellpageType: 'SINGLE',
        titleOverride: 'Best Mouse Deal',
        urlPreview: '<unassigned-domain>/mouse-offer-a',
        stats: {
          revenue: 0,
          cost: 0,
          youTake: 0,
          hold: 0,
          cashToBalance: 0,
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Save for subsequent tests
      sellpageId = body.id as string;
      expect(sellpageId).toBeTruthy();
    });

    it('creates second sellpage for seller A (different slug)', async () => {
      const res = await post('/api/sellpages', sellerAToken, {
        productId: standProductId,
        slug: 'stand-offer-a',
      }).expect(201);

      expect(res.body.slug).toBe('stand-offer-a');
      expect(res.body.status).toBe('DRAFT');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3 — Duplicate slug
  // ─────────────────────────────────────────────────────────────────────────

  describe('3. POST /api/sellpages — duplicate slug', () => {
    it('returns 409 when slug is already used by this seller', async () => {
      // Same slug as created in test 2
      await post('/api/sellpages', sellerAToken, {
        productId: mouseProductId,
        slug: 'mouse-offer-a',
      }).expect(409);
    });

    it('allows the same slug for a different seller (no conflict)', async () => {
      // Seller B can use the same slug as Seller A — no cross-tenant conflict
      await post('/api/sellpages', sellerBToken, {
        productId: mouseProductId,
        slug: 'mouse-offer-a',
      }).expect(201);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 — Validation (missing / bad fields)
  // ─────────────────────────────────────────────────────────────────────────

  describe('4. POST /api/sellpages — validation', () => {
    it('returns 400 when productId is missing', async () => {
      await post('/api/sellpages', sellerAToken, {
        slug: 'no-product',
      }).expect(400);
    });

    it('returns 400 when slug is missing', async () => {
      await post('/api/sellpages', sellerAToken, {
        productId: mouseProductId,
      }).expect(400);
    });

    it('returns 400 when slug is empty string', async () => {
      await post('/api/sellpages', sellerAToken, {
        productId: mouseProductId,
        slug: '',
      }).expect(400);
    });

    it('returns 400 when productId is not a valid UUID', async () => {
      await post('/api/sellpages', sellerAToken, {
        productId: 'not-a-uuid',
        slug: 'bad-product-id',
      }).expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 — Non-existent productId
  // ─────────────────────────────────────────────────────────────────────────

  describe('5. POST /api/sellpages — non-existent product', () => {
    it('returns 404 when productId does not exist', async () => {
      // Use a valid v4-format UUID that doesn't exist in the DB
      await post('/api/sellpages', sellerAToken, {
        productId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        slug: 'ghost-product-page',
      }).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 — LIST
  // ─────────────────────────────────────────────────────────────────────────

  describe('6. GET /api/sellpages — list', () => {
    it('returns paginated list with correct shape', async () => {
      const res = await get('/api/sellpages', sellerAToken).expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });

      // Seller A has at least 2 sellpages
      expect(res.body.total).toBeGreaterThanOrEqual(2);

      const first = res.body.data[0];
      expect(first).toMatchObject({
        id: expect.any(String),
        productId: expect.any(String),
        slug: expect.any(String),
        status: expect.stringMatching(/^(DRAFT|PUBLISHED|ARCHIVED)$/),
        urlPreview: expect.any(String),
        stats: expect.objectContaining({ revenue: 0 }),
      });
    });

    it('seller B only sees their own sellpages (tenant isolation)', async () => {
      // Seller B created 1 page in test 3
      const res = await get('/api/sellpages', sellerBToken).expect(200);
      const ids = (res.body.data as Array<{ id: string }>).map((s) => s.id);
      // Must not contain seller A's sellpage
      expect(ids).not.toContain(sellpageId);
    });

    it('status filter returns only matching sellpages', async () => {
      // Publish one of Seller A's pages first
      await post(
        `/api/sellpages/${sellpageId}/publish`,
        sellerAToken,
        {},
      ).expect(200);

      const res = await get(
        '/api/sellpages?status=PUBLISHED',
        sellerAToken,
      ).expect(200);

      const statuses = (res.body.data as Array<{ status: string }>).map(
        (s) => s.status,
      );
      expect(statuses.every((s) => s === 'PUBLISHED')).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      // Unpublish to reset for later tests
      await post(
        `/api/sellpages/${sellpageId}/unpublish`,
        sellerAToken,
        {},
      ).expect(200);
    });

    it('q search filters by slug', async () => {
      const res = await get(
        '/api/sellpages?q=mouse-offer',
        sellerAToken,
      ).expect(200);

      const slugs = (res.body.data as Array<{ slug: string }>).map(
        (s) => s.slug,
      );
      expect(slugs.some((slug) => slug.includes('mouse-offer'))).toBe(true);
    });

    it('q search filters by titleOverride', async () => {
      const res = await get(
        '/api/sellpages?q=Best+Mouse',
        sellerAToken,
      ).expect(200);

      expect(res.body.total).toBeGreaterThanOrEqual(1);
      const titles = (
        res.body.data as Array<{ titleOverride: string | null }>
      ).map((s) => s.titleOverride ?? '');
      expect(titles.some((t) => t.toLowerCase().includes('mouse'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7 — DETAIL
  // ─────────────────────────────────────────────────────────────────────────

  describe('7. GET /api/sellpages/:id — detail', () => {
    it('returns full detail with product snapshot', async () => {
      const res = await get(`/api/sellpages/${sellpageId}`, sellerAToken).expect(200);

      expect(res.body).toMatchObject({
        id: sellpageId,
        slug: 'mouse-offer-a',
        status: 'DRAFT',
        urlPreview: '<unassigned-domain>/mouse-offer-a',
        stats: { revenue: 0, cost: 0, youTake: 0, hold: 0, cashToBalance: 0 },
        product: expect.objectContaining({
          id: mouseProductId,
          name: expect.any(String),
          slug: expect.any(String),
          basePrice: expect.any(String),
          heroImageUrl: expect.anything(), // string or null
        }),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('returns 404 for another seller\'s sellpage (tenant isolation)', async () => {
      // sellpageId belongs to Seller A — Seller B should get 404
      await get(`/api/sellpages/${sellpageId}`, sellerBToken).expect(404);
    });

    it('returns 400 for a non-UUID id param', async () => {
      await get('/api/sellpages/not-a-uuid', sellerAToken).expect(400);
    });

    it('returns 404 for a non-existent UUID', async () => {
      await get(
        '/api/sellpages/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        sellerAToken,
      ).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8 — UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  describe('8. PATCH /api/sellpages/:id — update', () => {
    it('updates slug and titleOverride', async () => {
      const res = await patch(`/api/sellpages/${sellpageId}`, sellerAToken, {
        slug: 'mouse-offer-a-updated',
        titleOverride: 'Updated Mouse Deal',
      }).expect(200);

      expect(res.body).toMatchObject({
        id: sellpageId,
        slug: 'mouse-offer-a-updated',
        titleOverride: 'Updated Mouse Deal',
        urlPreview: '<unassigned-domain>/mouse-offer-a-updated',
      });
    });

    it('returns 400 for empty body (no fields)', async () => {
      await patch(`/api/sellpages/${sellpageId}`, sellerAToken, {}).expect(400);
    });

    it('returns 409 when new slug conflicts with existing sellpage', async () => {
      // 'stand-offer-a' is already taken by seller A's second sellpage
      await patch(`/api/sellpages/${sellpageId}`, sellerAToken, {
        slug: 'stand-offer-a',
      }).expect(409);
    });

    it('returns 404 when updating another seller\'s sellpage', async () => {
      await patch(`/api/sellpages/${sellpageId}`, sellerBToken, {
        titleOverride: 'Hacked',
      }).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9 — PUBLISH
  // ─────────────────────────────────────────────────────────────────────────

  describe('9. POST /api/sellpages/:id/publish', () => {
    it('transitions DRAFT → PUBLISHED', async () => {
      const res = await post(
        `/api/sellpages/${sellpageId}/publish`,
        sellerAToken,
        {},
      ).expect(200);

      expect(res.body.status).toBe('PUBLISHED');
    });

    it('returns 400 when already PUBLISHED', async () => {
      // sellpageId is now PUBLISHED from previous test
      await post(
        `/api/sellpages/${sellpageId}/publish`,
        sellerAToken,
        {},
      ).expect(400);
    });

    it('returns 404 when publishing another seller\'s sellpage', async () => {
      await post(
        `/api/sellpages/${sellpageId}/publish`,
        sellerBToken,
        {},
      ).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 10 — UNPUBLISH
  // ─────────────────────────────────────────────────────────────────────────

  describe('10. POST /api/sellpages/:id/unpublish', () => {
    it('transitions PUBLISHED → DRAFT', async () => {
      // sellpageId is PUBLISHED from test 9
      const res = await post(
        `/api/sellpages/${sellpageId}/unpublish`,
        sellerAToken,
        {},
      ).expect(200);

      expect(res.body.status).toBe('DRAFT');
    });

    it('returns 400 when sellpage is already DRAFT', async () => {
      // sellpageId is now DRAFT again
      await post(
        `/api/sellpages/${sellpageId}/unpublish`,
        sellerAToken,
        {},
      ).expect(400);
    });

    it('returns 404 when unpublishing another seller\'s sellpage', async () => {
      await post(
        `/api/sellpages/${sellpageId}/unpublish`,
        sellerBToken,
        {},
      ).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 11 — URL preview (no domain → placeholder)
  // ─────────────────────────────────────────────────────────────────────────

  describe('11. URL preview', () => {
    it('returns <unassigned-domain>/{slug} when no domain is linked', async () => {
      const res = await get(`/api/sellpages/${sellpageId}`, sellerAToken).expect(200);
      const expectedSlug = res.body.slug as string;
      expect(res.body.urlPreview).toBe(`<unassigned-domain>/${expectedSlug}`);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 12 — Pagination
  // ─────────────────────────────────────────────────────────────────────────

  describe('12. Pagination', () => {
    it('respects limit param', async () => {
      const res = await get('/api/sellpages?limit=1', sellerAToken).expect(200);
      expect(res.body.limit).toBe(1);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('respects page param', async () => {
      const p1 = await get('/api/sellpages?limit=1&page=1', sellerAToken).expect(200);
      const p2 = await get('/api/sellpages?limit=1&page=2', sellerAToken).expect(200);

      if (p1.body.total > 1) {
        const p1Id = p1.body.data[0]?.id;
        const p2Id = p2.body.data[0]?.id;
        expect(p1Id).not.toBe(p2Id);
      }
    });

    it('caps limit at 100', async () => {
      const res = await get('/api/sellpages?limit=9999', sellerAToken).expect(200);
      expect(res.body.limit).toBe(100);
    });
  });
});
