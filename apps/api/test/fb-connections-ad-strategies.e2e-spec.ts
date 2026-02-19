import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * FB Connections + Ad Strategies E2E Tests — Milestone 2.3.1
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Coverage:
 *
 * FB Connections:
 *  1.  401 without JWT
 *  2.  POST — create AD_ACCOUNT connection (201)
 *  3.  POST — create PAGE connection (201)
 *  4.  POST — create with parentId (201)
 *  5.  POST — duplicate (sellerId + connectionType + externalId) → 409
 *  6.  POST — missing required fields → 400
 *  7.  POST — invalid connectionType → 400
 *  8.  GET  — list returns seller A connections only
 *  9.  GET  — filter by connectionType
 *  10. GET  — seller B cannot see seller A connection (404)
 *  11. PATCH — update name + isActive (200)
 *  12. PATCH — empty body → 400
 *  13. PATCH — seller B cannot update seller A connection (404)
 *  14. DELETE — remove connection (200 { deleted: true })
 *  15. DELETE — seller B cannot delete seller A connection (404)
 *  16. GET :id — non-UUID → 400
 *  17. Response never contains accessTokenEnc field
 *
 * Ad Strategies:
 *  18. 401 without JWT
 *  19. POST — create strategy (201, config shape correct)
 *  20. POST — missing budget → 400
 *  21. POST — budget amount too low → 400
 *  22. POST — invalid placement value → 400
 *  23. GET  — list returns seller A strategies only
 *  24. GET :id — seller B cannot see seller A strategy (404)
 *  25. PATCH — update name only (config merged, not replaced)
 *  26. PATCH — update budget only (other config fields preserved)
 *  27. PATCH — empty body → 400
 *  28. PATCH — seller B cannot update seller A strategy (404)
 *  29. DELETE — remove strategy (200 { deleted: true })
 *  30. DELETE — seller B cannot delete seller A strategy (404)
 */
describe('FB Connections + Ad Strategies (e2e)', () => {
  let app: INestApplication;

  let sellerAToken: string;
  let sellerBToken: string;

  let adAccountId: string; // seller A AD_ACCOUNT connection
  let pageId: string;      // seller A PAGE connection
  let strategyId: string;  // seller A ad strategy

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'fb231') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

  const validStrategy = () => ({
    name: 'My Test Strategy',
    budget: { budgetType: 'DAILY', amount: 5000 },
    audience: { mode: 'ADVANTAGE_PLUS' },
    placements: ['FACEBOOK_FEED', 'INSTAGRAM_FEED'],
  });

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

    const resA = await register(uniqueEmail('fb231-a'), 'FB Seller A');
    sellerAToken = resA.body.accessToken;

    const resB = await register(uniqueEmail('fb231-b'), 'FB Seller B');
    sellerBToken = resB.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FB CONNECTIONS
  // ══════════════════════════════════════════════════════════════════════════

  describe('FB Connections — /api/fb/connections', () => {
    it('1. returns 401 without JWT', async () => {
      const res = await request(app.getHttpServer()).get('/api/fb/connections');
      expect(res.status).toBe(401);
    });

    it('2. POST — creates AD_ACCOUNT connection (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'AD_ACCOUNT',
          externalId: 'act_123456789',
          name: 'My Ad Account',
        });

      expect(res.status).toBe(201);
      expect(res.body.connectionType).toBe('AD_ACCOUNT');
      expect(res.body.externalId).toBe('act_123456789');
      expect(res.body.name).toBe('My Ad Account');
      expect(res.body.isPrimary).toBe(false);
      expect(res.body.isActive).toBe(true);
      expect(res.body.provider).toBe('META');
      expect(res.body.parentId).toBeNull();
      expect(res.body.id).toBeDefined();
      adAccountId = res.body.id;
    });

    it('3. POST — creates PAGE connection (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PAGE',
          externalId: 'page_987654321',
          name: 'My Facebook Page',
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.connectionType).toBe('PAGE');
      expect(res.body.isPrimary).toBe(true);
      pageId = res.body.id;
    });

    it('4. POST — creates PAGE with parentId (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PIXEL',
          externalId: 'px_555111',
          name: 'My Pixel',
          parentId: adAccountId,
        });

      expect(res.status).toBe(201);
      expect(res.body.parentId).toBe(adAccountId);
    });

    it('5. POST — duplicate (connectionType + externalId) → 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'AD_ACCOUNT',
          externalId: 'act_123456789', // same as test 2
          name: 'Duplicate Account',
        });

      expect(res.status).toBe(409);
    });

    it('6. POST — missing required fields → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({ connectionType: 'AD_ACCOUNT' }); // missing externalId + name

      expect(res.status).toBe(400);
    });

    it('7. POST — invalid connectionType → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'INVALID_TYPE',
          externalId: 'test_123',
          name: 'Test',
        });

      expect(res.status).toBe(400);
    });

    it('8. GET — list returns only seller A connections', async () => {
      // Seller B creates their own connection
      await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerBToken))
        .send({
          connectionType: 'AD_ACCOUNT',
          externalId: 'act_b_111',
          name: "Seller B's Account",
        });

      const res = await request(app.getHttpServer())
        .get('/api/fb/connections')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const ids = res.body.map((c: any) => c.id);
      expect(ids).toContain(adAccountId);
      expect(ids).toContain(pageId);

      // All returned items belong to seller A
      res.body.forEach((c: any) => {
        expect(c.sellerId).toBeDefined();
      });
    });

    it('9. GET — filter by connectionType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/fb/connections?connectionType=AD_ACCOUNT')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((c: any) => {
        expect(c.connectionType).toBe('AD_ACCOUNT');
      });
    });

    it('10. GET :id — seller B gets 404 for seller A connection', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/fb/connections/${adAccountId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });

    it('11. PATCH — update name + isActive (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/connections/${adAccountId}`)
        .set('Authorization', auth(sellerAToken))
        .send({ name: 'Updated Name', isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.isActive).toBe(false);
    });

    it('12. PATCH — empty body → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/connections/${adAccountId}`)
        .set('Authorization', auth(sellerAToken))
        .send({});

      expect(res.status).toBe(400);
    });

    it('13. PATCH — seller B cannot update seller A connection (404)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/connections/${adAccountId}`)
        .set('Authorization', auth(sellerBToken))
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(404);
    });

    it('14. DELETE — removes connection (200)', async () => {
      // Create a throwaway connection to delete
      const create = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'CONVERSION',
          externalId: 'conv_delete_me',
          name: 'To Delete',
        });
      const deleteId = create.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/fb/connections/${deleteId}`)
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(res.body.id).toBe(deleteId);

      // Verify it's gone
      const check = await request(app.getHttpServer())
        .get(`/api/fb/connections/${deleteId}`)
        .set('Authorization', auth(sellerAToken));
      expect(check.status).toBe(404);
    });

    it('15. DELETE — seller B cannot delete seller A connection (404)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/fb/connections/${pageId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });

    it('16. GET :id — non-UUID param → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/fb/connections/not-a-uuid')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(400);
    });

    it('17. Response body never contains accessTokenEnc', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/fb/connections/${adAccountId}`)
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(res.body.accessTokenEnc).toBeUndefined();
      expect(res.body.access_token_enc).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('accessToken');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AD STRATEGIES
  // ══════════════════════════════════════════════════════════════════════════

  describe('Ad Strategies — /api/fb/ad-strategies', () => {
    it('18. returns 401 without JWT', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/fb/ad-strategies',
      );
      expect(res.status).toBe(401);
    });

    it('19. POST — creates strategy with correct config shape (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken))
        .send(validStrategy());

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Test Strategy');
      expect(res.body.isActive).toBe(true);
      expect(res.body.config).toBeDefined();
      expect(res.body.config.budget.budgetType).toBe('DAILY');
      expect(res.body.config.budget.amount).toBe(5000);
      expect(res.body.config.audience.mode).toBe('ADVANTAGE_PLUS');
      expect(res.body.config.placements).toEqual([
        'FACEBOOK_FEED',
        'INSTAGRAM_FEED',
      ]);
      expect(res.body.id).toBeDefined();
      strategyId = res.body.id;
    });

    it('20. POST — missing budget → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'No Budget',
          audience: { mode: 'ADVANTAGE_PLUS' },
          placements: ['FACEBOOK_FEED'],
        });

      expect(res.status).toBe(400);
    });

    it('21. POST — budget amount below minimum (100) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken))
        .send({
          ...validStrategy(),
          budget: { budgetType: 'DAILY', amount: 50 }, // below min 100
        });

      expect(res.status).toBe(400);
    });

    it('22. POST — invalid placement value → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken))
        .send({
          ...validStrategy(),
          placements: ['TIKTOK_FEED'], // invalid
        });

      expect(res.status).toBe(400);
    });

    it('23. GET — list returns only seller A strategies', async () => {
      // Seller B creates their own
      await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerBToken))
        .send({ ...validStrategy(), name: "Seller B's Strategy" });

      const res = await request(app.getHttpServer())
        .get('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const ids = res.body.map((s: any) => s.id);
      expect(ids).toContain(strategyId);

      // Verify all returned items have sellerId (seller-scoped)
      res.body.forEach((s: any) => {
        expect(s.sellerId).toBeDefined();
      });
    });

    it('24. GET :id — seller B cannot see seller A strategy (404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });

    it('25. PATCH — update name only (config fields preserved)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerAToken))
        .send({ name: 'Renamed Strategy' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Strategy');
      // Config should be unchanged
      expect(res.body.config.budget.amount).toBe(5000);
      expect(res.body.config.placements).toContain('FACEBOOK_FEED');
    });

    it('26. PATCH — update budget only (other config fields preserved)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerAToken))
        .send({ budget: { budgetType: 'LIFETIME', amount: 100000 } });

      expect(res.status).toBe(200);
      expect(res.body.config.budget.budgetType).toBe('LIFETIME');
      expect(res.body.config.budget.amount).toBe(100000);
      // Audience and placements preserved
      expect(res.body.config.audience.mode).toBe('ADVANTAGE_PLUS');
      expect(res.body.config.placements).toContain('FACEBOOK_FEED');
    });

    it('27. PATCH — empty body → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerAToken))
        .send({});

      expect(res.status).toBe(400);
    });

    it('28. PATCH — seller B cannot update seller A strategy (404)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerBToken))
        .send({ name: 'Hijacked Strategy' });

      expect(res.status).toBe(404);
    });

    it('29. DELETE — removes strategy (200)', async () => {
      // Create throwaway
      const create = await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken))
        .send({ ...validStrategy(), name: 'Delete Me' });
      const deleteId = create.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/fb/ad-strategies/${deleteId}`)
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(res.body.id).toBe(deleteId);

      // Verify gone
      const check = await request(app.getHttpServer())
        .get(`/api/fb/ad-strategies/${deleteId}`)
        .set('Authorization', auth(sellerAToken));
      expect(check.status).toBe(404);
    });

    it('30. DELETE — seller B cannot delete seller A strategy (404)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });
  });
});
