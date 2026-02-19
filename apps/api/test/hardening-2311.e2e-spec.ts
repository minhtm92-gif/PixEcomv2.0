import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Milestone 2.3.1.1 — Pre-2.3.2 Hardening E2E Tests
 *
 * Covers 3 tasks:
 *
 * Task 1 — Connection Hierarchy Validation
 *  1.  AD_ACCOUNT with parentId → 400
 *  2.  PAGE with parentId → 400
 *  3.  PIXEL without parentId → 400
 *  4.  PIXEL with parentId pointing to AD_ACCOUNT → 201 ✅
 *  5.  PIXEL with parentId pointing to PAGE → 400 (wrong parent type)
 *  6.  CONVERSION without parentId → 400
 *  7.  CONVERSION with parentId pointing to PIXEL → 201 ✅
 *  8.  CONVERSION with parentId pointing to AD_ACCOUNT → 400 (wrong parent type)
 *  9.  Seller B cannot use Seller A parentId → 404
 *
 * Task 2 — isActive Indexes (verified via query behaviour, not DDL)
 *  10. Default list returns only isActive=true (indexes support this filter)
 *
 * Task 3 — Soft Disable (DELETE → isActive=false)
 *  FB Connections:
 *  11. DELETE returns { ok: true, id, isActive: false }
 *  12. Default list excludes disabled connection
 *  13. ?includeInactive=true includes disabled connection
 *  14. Seller B cannot delete Seller A connection → 404 (unchanged)
 *
 *  Ad Strategies:
 *  15. DELETE returns { ok: true, id, isActive: false }
 *  16. Default list excludes disabled strategy
 *  17. ?includeInactive=true includes disabled strategy
 *  18. Seller B cannot delete Seller A strategy → 404 (unchanged)
 */
describe('Hardening 2.3.1.1 — Connections Hierarchy + Soft Disable (e2e)', () => {
  let app: INestApplication;

  let sellerAToken: string;
  let sellerBToken: string;

  let adAccountId: string;  // seller A AD_ACCOUNT
  let pixelId: string;      // seller A PIXEL (child of adAccountId)
  let strategyId: string;   // seller A ad strategy

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uniqueEmail = (prefix = 'hn2311') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

  const validStrategy = () => ({
    name: 'Hardening Strategy',
    budget: { budgetType: 'DAILY', amount: 5000 },
    audience: { mode: 'ADVANTAGE_PLUS' },
    placements: ['FACEBOOK_FEED'],
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

    // Register two sellers
    const resA = await register(uniqueEmail('hn2311-a'), 'HN Seller A');
    sellerAToken = resA.body.accessToken;

    const resB = await register(uniqueEmail('hn2311-b'), 'HN Seller B');
    sellerBToken = resB.body.accessToken;

    // Create Seller A baseline: AD_ACCOUNT → PIXEL chain
    const accRes = await request(app.getHttpServer())
      .post('/api/fb/connections')
      .set('Authorization', auth(sellerAToken))
      .send({
        connectionType: 'AD_ACCOUNT',
        externalId: `act_hn2311_${Date.now()}`,
        name: 'HN Ad Account',
      });
    adAccountId = accRes.body.id;

    const pixRes = await request(app.getHttpServer())
      .post('/api/fb/connections')
      .set('Authorization', auth(sellerAToken))
      .send({
        connectionType: 'PIXEL',
        externalId: `px_hn2311_${Date.now()}`,
        name: 'HN Pixel',
        parentId: adAccountId,
      });
    pixelId = pixRes.body.id;

    // Create Seller A baseline strategy
    const stRes = await request(app.getHttpServer())
      .post('/api/fb/ad-strategies')
      .set('Authorization', auth(sellerAToken))
      .send(validStrategy());
    strategyId = stRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 1 — Connection Hierarchy Validation
  // ══════════════════════════════════════════════════════════════════════════

  describe('Task 1 — Connection Hierarchy Validation', () => {
    it('1. AD_ACCOUNT with parentId → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'AD_ACCOUNT',
          externalId: 'act_with_parent',
          name: 'Bad Account',
          parentId: adAccountId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/AD_ACCOUNT connections must not have a parentId/i);
    });

    it('2. PAGE with parentId → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PAGE',
          externalId: 'page_with_parent',
          name: 'Bad Page',
          parentId: adAccountId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/PAGE connections must not have a parentId/i);
    });

    it('3. PIXEL without parentId → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PIXEL',
          externalId: 'px_no_parent',
          name: 'Parentless Pixel',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/PIXEL connections require a parentId/i);
    });

    it('4. PIXEL with parentId pointing to AD_ACCOUNT → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PIXEL',
          externalId: `px_valid_${Date.now()}`,
          name: 'Valid Pixel',
          parentId: adAccountId,
        });

      expect(res.status).toBe(201);
      expect(res.body.connectionType).toBe('PIXEL');
      expect(res.body.parentId).toBe(adAccountId);
    });

    it('5. PIXEL with parentId pointing to PAGE → 400 (wrong parent type)', async () => {
      // First create a PAGE connection
      const pageRes = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PAGE',
          externalId: `page_for_test_${Date.now()}`,
          name: 'Test Page',
        });
      const pageId = pageRes.body.id;

      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'PIXEL',
          externalId: `px_wrong_parent_${Date.now()}`,
          name: 'Pixel with wrong parent',
          parentId: pageId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/PIXEL requires a parent of type AD_ACCOUNT/i);
    });

    it('6. CONVERSION without parentId → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'CONVERSION',
          externalId: 'conv_no_parent',
          name: 'Parentless Conversion',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CONVERSION connections require a parentId/i);
    });

    it('7. CONVERSION with parentId pointing to PIXEL → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'CONVERSION',
          externalId: `conv_valid_${Date.now()}`,
          name: 'Valid Conversion',
          parentId: pixelId,
        });

      expect(res.status).toBe(201);
      expect(res.body.connectionType).toBe('CONVERSION');
      expect(res.body.parentId).toBe(pixelId);
    });

    it('8. CONVERSION with parentId pointing to AD_ACCOUNT → 400 (wrong parent type)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'CONVERSION',
          externalId: `conv_bad_parent_${Date.now()}`,
          name: 'Conversion with wrong parent',
          parentId: adAccountId, // should be a PIXEL, not AD_ACCOUNT
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CONVERSION requires a parent of type PIXEL/i);
    });

    it('9. Seller B cannot use Seller A parentId → 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerBToken))
        .send({
          connectionType: 'PIXEL',
          externalId: `px_stolen_parent_${Date.now()}`,
          name: 'Cross-tenant Pixel',
          parentId: adAccountId, // belongs to Seller A
        });

      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 2 — isActive Indexes (behaviour verification)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Task 2 — isActive Index Behaviour', () => {
    it('10. Default list returns only isActive=true connections', async () => {
      // Soft-delete the pixel connection
      await request(app.getHttpServer())
        .delete(`/api/fb/connections/${pixelId}`)
        .set('Authorization', auth(sellerAToken));

      const res = await request(app.getHttpServer())
        .get('/api/fb/connections')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      // Disabled pixel must NOT appear in the default list
      const ids = res.body.map((c: any) => c.id);
      expect(ids).not.toContain(pixelId);
      // All returned items must be active
      res.body.forEach((c: any) => {
        expect(c.isActive).toBe(true);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 3 — Soft Disable
  // ══════════════════════════════════════════════════════════════════════════

  describe('Task 3 — Soft Disable (FB Connections)', () => {
    let softDeleteId: string;

    beforeAll(async () => {
      // Create a fresh AD_ACCOUNT for soft-delete tests
      const res = await request(app.getHttpServer())
        .post('/api/fb/connections')
        .set('Authorization', auth(sellerAToken))
        .send({
          connectionType: 'AD_ACCOUNT',
          externalId: `act_softdelete_${Date.now()}`,
          name: 'Soft Delete Target',
        });
      softDeleteId = res.body.id;
    });

    it('11. DELETE → returns { ok: true, id, isActive: false }', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/fb/connections/${softDeleteId}`)
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.id).toBe(softDeleteId);
      expect(res.body.isActive).toBe(false);
    });

    it('12. Default list does NOT return disabled connection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/fb/connections')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const ids = res.body.map((c: any) => c.id);
      expect(ids).not.toContain(softDeleteId);
    });

    it('13. ?includeInactive=true includes disabled connection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/fb/connections?includeInactive=true')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const ids = res.body.map((c: any) => c.id);
      expect(ids).toContain(softDeleteId);

      const found = res.body.find((c: any) => c.id === softDeleteId);
      expect(found.isActive).toBe(false);
    });

    it('14. Seller B cannot soft-delete Seller A connection → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/fb/connections/${adAccountId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });
  });

  describe('Task 3 — Soft Disable (Ad Strategies)', () => {
    let softDeleteStratId: string;

    beforeAll(async () => {
      // Create a fresh strategy for soft-delete tests
      const res = await request(app.getHttpServer())
        .post('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken))
        .send({ ...validStrategy(), name: 'Soft Delete Strategy' });
      softDeleteStratId = res.body.id;
    });

    it('15. DELETE → returns { ok: true, id, isActive: false }', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/fb/ad-strategies/${softDeleteStratId}`)
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.id).toBe(softDeleteStratId);
      expect(res.body.isActive).toBe(false);
    });

    it('16. Default list does NOT return disabled strategy', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/fb/ad-strategies')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const ids = res.body.map((s: any) => s.id);
      expect(ids).not.toContain(softDeleteStratId);
    });

    it('17. ?includeInactive=true includes disabled strategy', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/fb/ad-strategies?includeInactive=true')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const ids = res.body.map((s: any) => s.id);
      expect(ids).toContain(softDeleteStratId);

      const found = res.body.find((s: any) => s.id === softDeleteStratId);
      expect(found.isActive).toBe(false);
    });

    it('18. Seller B cannot soft-delete Seller A strategy → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/fb/ad-strategies/${strategyId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });
  });
});
