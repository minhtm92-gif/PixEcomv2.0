import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Seller Domain Module E2E Tests — Milestone 2.2.3
 *
 * Requires a live PostgreSQL database (pixecom-postgres on port 5434)
 * with seed data already applied:
 *   pnpm --filter @pixecom/database db:seed
 *
 * Run: pnpm --filter @pixecom/api test:e2e
 *
 * Test coverage (20 tests):
 *  1.  Auth guard — 401 on all endpoints without JWT
 *  2.  POST /api/domains — create with normalized hostname (lowercase, strip protocol)
 *  3.  POST /api/domains — invalid hostname → 400
 *  4.  POST /api/domains — hostname with protocol stripped correctly
 *  5.  POST /api/domains — duplicate for same seller → 409
 *  6.  POST /api/domains — hostname owned by another seller → 409
 *  7.  GET /api/domains — returns only seller's domains (tenant isolation)
 *  8.  GET /api/domains — response shape (id, hostname, status, isPrimary, verification)
 *  9.  PATCH /api/domains/:id — set isPrimary=true unsets previous primary (transaction)
 * 10.  PATCH /api/domains/:id — empty body → 400
 * 11.  PATCH /api/domains/:id — cross-seller → 404
 * 12.  POST /api/domains/:id/verify — { force: true } marks VERIFIED
 * 13.  POST /api/domains/:id/verify — { force: false } → 400
 * 14.  POST /api/domains/:id/verify — already VERIFIED → 400
 * 15.  DELETE /api/domains/:id — deletes domain, returns { deleted: true }
 * 16.  DELETE /api/domains/:id — blocked when used by a sellpage → 409
 * 17.  DELETE /api/domains/:id — cross-seller → 404
 * 18.  Sellpage: publish fails when domain is PENDING
 * 19.  Sellpage: publish succeeds when domain is VERIFIED
 * 20.  Sellpage: urlPreview reflects domain after domain set + publish
 */
describe('Seller Domains (e2e)', () => {
  let app: INestApplication;

  let sellerAToken: string;
  let sellerBToken: string;

  // Product IDs resolved from catalog
  let mouseProductId: string;
  let standProductId: string;

  // Domain IDs created during tests
  let domainAId: string;       // seller A — will be verified and tested
  let domainA2Id: string;      // seller A — second domain for primary test
  let domainBId: string;       // seller B — for cross-seller 409 test

  // Sellpage IDs for domain integration tests
  let sellpageWithPendingDomainId: string;
  let sellpageWithVerifiedDomainId: string;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'dom') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const uniqueHostname = (prefix = 'test') =>
    `${prefix}-${Date.now()}.e2e-domain.io`;

  const registerAndGetToken = async (prefix = 'dom'): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: uniqueEmail(prefix),
        password: 'Password123!',
        displayName: `Domain Tester ${prefix}`,
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

  const del = (path: string, token: string) =>
    request(app.getHttpServer())
      .delete(path)
      .set('Authorization', `Bearer ${token}`);

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

    [sellerAToken, sellerBToken] = await Promise.all([
      registerAndGetToken('dom-a'),
      registerAndGetToken('dom-b'),
    ]);

    // Discover product IDs for sellpage integration tests
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
    it('GET /api/domains returns 401 without JWT', async () => {
      await request(app.getHttpServer()).get('/api/domains').expect(401);
    });

    it('POST /api/domains returns 401 without JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/domains')
        .send({ domain: 'test.example.com' })
        .expect(401);
    });

    it('POST /api/domains/:id/verify returns 401 without JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/domains/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/verify')
        .send({ force: true })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2 — CREATE
  // ─────────────────────────────────────────────────────────────────────────

  describe('2. POST /api/domains — create', () => {
    it('creates a domain and returns 201 with expected shape', async () => {
      const hostname = uniqueHostname('seller-a');
      const res = await post('/api/domains', sellerAToken, {
        domain: hostname,
      }).expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        hostname,
        status: 'PENDING',
        isPrimary: false,
        verification: {
          type: 'TXT',
          name: '_pixecom',
          value: expect.any(String),
        },
        verifiedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // verification token is non-empty
      expect(res.body.verification.value.length).toBeGreaterThan(10);

      domainAId = res.body.id as string;
    });

    it('normalizes hostname — strips https:// and paths', async () => {
      const hostname = uniqueHostname('normalized-a');
      const res = await post('/api/domains', sellerAToken, {
        domain: `HTTPS://${hostname.toUpperCase()}/some/path?q=1`,
      }).expect(201);

      // Stored hostname is lowercase, no protocol, no path
      expect(res.body.hostname).toBe(hostname);

      domainA2Id = res.body.id as string;
    });

    it('creates a domain for seller B (same hostname namespace)', async () => {
      const hostname = uniqueHostname('seller-b');
      const res = await post('/api/domains', sellerBToken, {
        domain: hostname,
      }).expect(201);

      domainBId = res.body.id as string;
      expect(res.body.hostname).toBe(hostname);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3 — Validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('3. POST /api/domains — invalid hostname', () => {
    it('returns 400 for a bare label (no dot)', async () => {
      await post('/api/domains', sellerAToken, {
        domain: 'localhost',
      }).expect(400);
    });

    it('returns 400 for a hostname with spaces', async () => {
      await post('/api/domains', sellerAToken, {
        domain: 'my shop.example.com',
      }).expect(400);
    });

    it('returns 400 for an empty string', async () => {
      await post('/api/domains', sellerAToken, {
        domain: '',
      }).expect(400);
    });

    it('returns 400 for a missing domain field', async () => {
      await post('/api/domains', sellerAToken, {}).expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 — Duplicate / global uniqueness
  // ─────────────────────────────────────────────────────────────────────────

  describe('4. Duplicate hostname enforcement', () => {
    it('returns 409 when same seller tries to add the same domain twice', async () => {
      // domainA2Id was created from a normalized hostname — re-add the same one
      const listRes = await get('/api/domains', sellerAToken).expect(200);
      const domains = listRes.body as Array<{ id: string; hostname: string }>;
      const domainA2 = domains.find((d) => d.id === domainA2Id);
      expect(domainA2).toBeDefined();

      await post('/api/domains', sellerAToken, {
        domain: domainA2!.hostname,
      }).expect(409);
    });

    it('returns 409 when seller B tries to add a domain already owned by seller A', async () => {
      const listRes = await get('/api/domains', sellerAToken).expect(200);
      const domains = listRes.body as Array<{ id: string; hostname: string }>;
      const domainA = domains.find((d) => d.id === domainAId);
      expect(domainA).toBeDefined();

      // Seller B tries to claim seller A's domain
      await post('/api/domains', sellerBToken, {
        domain: domainA!.hostname,
      }).expect(409);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 — LIST + tenant isolation
  // ─────────────────────────────────────────────────────────────────────────

  describe('5. GET /api/domains — list', () => {
    it('returns only seller A domains for seller A', async () => {
      const res = await get('/api/domains', sellerAToken).expect(200);
      const domains = res.body as Array<{ id: string }>;
      const ids = domains.map((d) => d.id);
      expect(ids).toContain(domainAId);
      expect(ids).toContain(domainA2Id);
      expect(ids).not.toContain(domainBId);
    });

    it('returns only seller B domains for seller B', async () => {
      const res = await get('/api/domains', sellerBToken).expect(200);
      const ids = (res.body as Array<{ id: string }>).map((d) => d.id);
      expect(ids).toContain(domainBId);
      expect(ids).not.toContain(domainAId);
    });

    it('domain shape includes verification object', async () => {
      const res = await get('/api/domains', sellerAToken).expect(200);
      const domain = (res.body as Array<Record<string, unknown>>)[0];
      expect(domain).toMatchObject({
        id: expect.any(String),
        hostname: expect.any(String),
        status: expect.stringMatching(/^(PENDING|VERIFIED|FAILED)$/),
        isPrimary: expect.any(Boolean),
        verification: expect.objectContaining({
          type: 'TXT',
          name: '_pixecom',
          value: expect.any(String),
        }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 — PATCH (set primary)
  // ─────────────────────────────────────────────────────────────────────────

  describe('6. PATCH /api/domains/:id — set primary', () => {
    it('returns 400 for empty body', async () => {
      await patch(`/api/domains/${domainAId}`, sellerAToken, {}).expect(400);
    });

    it('setting isPrimary=true sets this domain as primary', async () => {
      const res = await patch(`/api/domains/${domainAId}`, sellerAToken, {
        isPrimary: true,
      }).expect(200);

      expect(res.body.isPrimary).toBe(true);
      expect(res.body.id).toBe(domainAId);
    });

    it('setting isPrimary=true on another domain unsets the first (transaction)', async () => {
      // domainA2Id becomes primary — domainAId should no longer be primary
      await patch(`/api/domains/${domainA2Id}`, sellerAToken, {
        isPrimary: true,
      }).expect(200);

      const listRes = await get('/api/domains', sellerAToken).expect(200);
      const domains = listRes.body as Array<{ id: string; isPrimary: boolean }>;

      const domainA = domains.find((d) => d.id === domainAId);
      const domainA2 = domains.find((d) => d.id === domainA2Id);

      expect(domainA2?.isPrimary).toBe(true);
      expect(domainA?.isPrimary).toBe(false);
    });

    it('returns 404 when updating another seller domain', async () => {
      await patch(`/api/domains/${domainBId}`, sellerAToken, {
        isPrimary: true,
      }).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7 — VERIFY (stub)
  // ─────────────────────────────────────────────────────────────────────────

  describe('7. POST /api/domains/:id/verify — stub', () => {
    it('returns 400 when force is false', async () => {
      await post(`/api/domains/${domainAId}/verify`, sellerAToken, {
        force: false,
      }).expect(400);
    });

    it('returns 400 when force field is missing', async () => {
      await post(`/api/domains/${domainAId}/verify`, sellerAToken, {}).expect(
        400,
      );
    });

    it('marks domain VERIFIED when force=true', async () => {
      const res = await post(
        `/api/domains/${domainAId}/verify`,
        sellerAToken,
        { force: true },
      ).expect(200);

      expect(res.body.status).toBe('VERIFIED');
      expect(res.body.verifiedAt).not.toBeNull();
      expect(res.body.id).toBe(domainAId);
    });

    it('returns 400 when domain is already VERIFIED', async () => {
      await post(`/api/domains/${domainAId}/verify`, sellerAToken, {
        force: true,
      }).expect(400);
    });

    it('returns 404 when verifying another seller domain', async () => {
      await post(`/api/domains/${domainBId}/verify`, sellerAToken, {
        force: true,
      }).expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8 — DELETE
  // ─────────────────────────────────────────────────────────────────────────

  describe('8. DELETE /api/domains/:id', () => {
    it('returns 404 when deleting another seller domain', async () => {
      await del(`/api/domains/${domainBId}`, sellerAToken).expect(404);
    });

    it('blocks delete when domain is used by a sellpage (409)', async () => {
      // Create a sellpage that uses domainA2Id
      const spRes = await post('/api/sellpages', sellerAToken, {
        productId: mouseProductId,
        slug: `domain-delete-test-${Date.now()}`,
        domainId: domainA2Id,
      }).expect(201);

      const spId = spRes.body.id as string;

      // Domain is now in use — delete should be blocked
      await del(`/api/domains/${domainA2Id}`, sellerAToken).expect(409);

      // Clean up: remove domainId from sellpage first
      // (by updating to null — we set domainId: null via PATCH)
      await patch(`/api/sellpages/${spId}`, sellerAToken, {
        domainId: null,
      }).expect(200);

      // Now delete should succeed
      const delRes = await del(
        `/api/domains/${domainA2Id}`,
        sellerAToken,
      ).expect(200);
      expect(delRes.body).toMatchObject({ deleted: true, id: domainA2Id });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9 — Sellpage publish integration (domain verification gate)
  // ─────────────────────────────────────────────────────────────────────────

  describe('9. Sellpage publish — domain verification gate', () => {
    beforeAll(async () => {
      // Create a PENDING domain for this test suite
      const pendingDomainRes = await post('/api/domains', sellerAToken, {
        domain: `pending-gate-${Date.now()}.e2e-domain.io`,
      }).expect(201);
      const pendingDomainId = pendingDomainRes.body.id as string;

      // Create sellpage with PENDING domain
      const sp1Res = await post('/api/sellpages', sellerAToken, {
        productId: standProductId,
        slug: `pending-domain-sp-${Date.now()}`,
        domainId: pendingDomainId,
      }).expect(201);
      sellpageWithPendingDomainId = sp1Res.body.id as string;

      // Create sellpage with the already-VERIFIED domainAId
      const sp2Res = await post('/api/sellpages', sellerAToken, {
        productId: mouseProductId,
        slug: `verified-domain-sp-${Date.now()}`,
        domainId: domainAId,
      }).expect(201);
      sellpageWithVerifiedDomainId = sp2Res.body.id as string;
    }, 30_000);

    it('publish fails (400) when domainId is set to a PENDING domain', async () => {
      const res = await post(
        `/api/sellpages/${sellpageWithPendingDomainId}/publish`,
        sellerAToken,
        {},
      ).expect(400);

      expect(res.body.message).toMatch(/VERIFIED/i);
    });

    it('publish succeeds when domainId is set to a VERIFIED domain', async () => {
      const res = await post(
        `/api/sellpages/${sellpageWithVerifiedDomainId}/publish`,
        sellerAToken,
        {},
      ).expect(200);

      expect(res.body.status).toBe('PUBLISHED');
    });

    it('urlPreview includes domain hostname after publishing with verified domain', async () => {
      const res = await get(
        `/api/sellpages/${sellpageWithVerifiedDomainId}`,
        sellerAToken,
      ).expect(200);

      // domainAId hostname should appear in the URL preview
      expect(res.body.urlPreview).toMatch(/^https:\/\//);
      expect(res.body.urlPreview).toContain('.e2e-domain.io/');
    });

    it('sellpage without a domain can still be published normally', async () => {
      const spRes = await post('/api/sellpages', sellerAToken, {
        productId: standProductId,
        slug: `no-domain-sp-${Date.now()}`,
      }).expect(201);

      const res = await post(
        `/api/sellpages/${spRes.body.id as string}/publish`,
        sellerAToken,
        {},
      ).expect(200);

      expect(res.body.status).toBe('PUBLISHED');
      expect(res.body.urlPreview).toMatch(/^<unassigned-domain>/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 10 — Non-UUID param → 400
  // ─────────────────────────────────────────────────────────────────────────

  describe('10. ParseUUIDPipe guards', () => {
    it('PATCH /api/domains/bad-id returns 400', async () => {
      await patch('/api/domains/not-a-uuid', sellerAToken, {
        isPrimary: true,
      }).expect(400);
    });

    it('DELETE /api/domains/bad-id returns 400', async () => {
      await del('/api/domains/not-a-uuid', sellerAToken).expect(400);
    });

    it('POST /api/domains/bad-id/verify returns 400', async () => {
      await post('/api/domains/not-a-uuid/verify', sellerAToken, {
        force: true,
      }).expect(400);
    });
  });
});
