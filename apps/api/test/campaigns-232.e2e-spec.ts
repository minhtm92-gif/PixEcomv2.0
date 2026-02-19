import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Milestone 2.3.2 — Campaigns Module E2E Tests
 *
 * Prerequisites (seeded via pnpm --filter @pixecom/database db:seed):
 *   - 3 ACTIVE products: MOUSE-001, STAND-001, DESKPAD-001
 *
 * Covers:
 *  1) Happy path: create campaign → adset + ad + adpost + creative link returned
 *  2) Preview returns computed shape without DB writes
 *  3) Seller isolation: Seller A cannot read/update Seller B campaign (404)
 *  4) Cannot create with inactive fbConnection or adStrategy; wrong conn type
 *  5) Cannot attach non-READY creative; cross-tenant creative blocked
 *  6) Status toggle (ACTIVE→PAUSED→ACTIVE); ARCHIVED/DELETED blocks toggle
 *  7) List returns only seller campaigns; status filter + includeArchived work
 *  8) DTO validation edge cases (empty name, bad UUID, budget < min, no auth)
 */
describe('Campaigns 2.3.2 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Seller A context
  let sellerAToken: string;
  let sellerAId: string;
  let sellpageAId: string;
  let adAccountAId: string; // FbConnection AD_ACCOUNT
  let pageAId: string;      // FbConnection PAGE
  let strategyAId: string;  // AdStrategy
  let creativeReadyId: string;
  let creativeDraftId: string;
  let inactiveAdAccountId: string;
  let inactiveStrategyId: string;

  // Seller B context
  let sellerBToken: string;
  let sellerBId: string;

  // Campaign IDs set across tests
  let campaignAId: string;
  let campaign2Id: string; // second campaign for list tests

  const uniqueEmail = (prefix = 'c232') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

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

    prisma = app.get(PrismaService);

    // ── Register Seller A ──────────────────────────────────────────────────
    const resA = await register(uniqueEmail('c232-a'), 'Campaign Seller A');
    expect(resA.status).toBe(201);
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    // ── Register Seller B ──────────────────────────────────────────────────
    const resB = await register(uniqueEmail('c232-b'), 'Campaign Seller B');
    expect(resB.status).toBe(201);
    sellerBToken = resB.body.accessToken;
    sellerBId = resB.body.seller.id;

    // ── Discover seeded product (required for sellpage creation) ───────────
    const prodRes = await request(app.getHttpServer())
      .get('/api/products?limit=100')
      .set('Authorization', auth(sellerAToken))
      .expect(200);
    const products: Array<{ id: string; code: string }> = prodRes.body.data;
    const mouseProduct = products.find((p) => p.code === 'MOUSE-001');
    if (!mouseProduct) {
      throw new Error('Seed products missing! Run: pnpm --filter @pixecom/database db:seed');
    }

    // ── Create sellpage for Seller A via API ───────────────────────────────
    const spRes = await request(app.getHttpServer())
      .post('/api/sellpages')
      .set('Authorization', auth(sellerAToken))
      .send({
        productId: mouseProduct.id,
        slug: `c232-sp-${Date.now()}-${Math.random().toString(36).slice(-4)}`,
      });
    expect(spRes.status).toBe(201);
    sellpageAId = spRes.body.id;

    // ── Seed FbConnections for Seller A via Prisma ─────────────────────────
    // AD_ACCOUNT connection (active)
    const adAcct = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        name: 'Test Ad Account',
        externalId: `act_${Date.now()}`,
        accessTokenEnc: 'test-token-enc',
        isActive: true,
      },
      select: { id: true },
    });
    adAccountAId = adAcct.id;

    // PAGE connection (active)
    const page = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'PAGE',
        name: 'Test Page',
        externalId: `page_${Date.now()}`,
        accessTokenEnc: 'test-token-enc',
        isActive: true,
      },
      select: { id: true },
    });
    pageAId = page.id;

    // INACTIVE AD_ACCOUNT (for test 4)
    const inactiveAcct = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        name: 'Inactive Ad Account',
        externalId: `act_inactive_${Date.now()}`,
        isActive: false,
      },
      select: { id: true },
    });
    inactiveAdAccountId = inactiveAcct.id;

    // ── Seed AdStrategy for Seller A ───────────────────────────────────────
    const strategy = await prisma.adStrategy.create({
      data: {
        sellerId: sellerAId,
        name: 'Test Strategy',
        isActive: true,
        config: {
          budget: {
            amount: 10000,
            budgetType: 'DAILY',
          },
        },
      },
      select: { id: true },
    });
    strategyAId = strategy.id;

    // INACTIVE strategy (for test 4)
    const inactiveStrat = await prisma.adStrategy.create({
      data: {
        sellerId: sellerAId,
        name: 'Inactive Strategy',
        isActive: false,
        config: {},
      },
      select: { id: true },
    });
    inactiveStrategyId = inactiveStrat.id;

    // ── Seed Creatives for Seller A ────────────────────────────────────────
    // READY creative
    const readyCreative = await prisma.creative.create({
      data: {
        sellerId: sellerAId,
        name: 'Ready Creative',
        status: 'READY',
        creativeType: 'IMAGE_AD',
      },
      select: { id: true },
    });
    creativeReadyId = readyCreative.id;

    // DRAFT creative (for test 5)
    const draftCreative = await prisma.creative.create({
      data: {
        sellerId: sellerAId,
        name: 'Draft Creative',
        status: 'DRAFT',
        creativeType: 'IMAGE_AD',
      },
      select: { id: true },
    });
    creativeDraftId = draftCreative.id;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── Test 1: Happy Path — Create Campaign ─────────────────────────────────

  describe('Test 1 — Happy path: create campaign', () => {
    it('POST /api/campaigns → 201 with full hierarchy (adset + ad + adpost + creative)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Summer Sale Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
          budgetType: 'DAILY',
          creativeIds: [creativeReadyId],
          adsetName: 'Summer AdSet',
          adName: 'Summer Ad',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Summer Sale Campaign',
        sellpageId: sellpageAId,
        adAccountId: adAccountAId,
        budget: 5000,
        budgetType: 'DAILY',
        status: 'ACTIVE',
        creativeIds: [creativeReadyId],
      });

      // Nested adsets → ads → adposts
      expect(res.body.adsets).toHaveLength(1);
      expect(res.body.adsets[0].name).toBe('Summer AdSet');
      expect(res.body.adsets[0].ads).toHaveLength(1);
      expect(res.body.adsets[0].ads[0].name).toBe('Summer Ad');
      expect(res.body.adsets[0].ads[0].adPosts).toHaveLength(1);
      expect(res.body.adsets[0].ads[0].adPosts[0].pageId).toBe(pageAId);
      expect(res.body.adsets[0].ads[0].adPosts[0].postSource).toBe('CONTENT_SOURCE');

      // IDs are UUIDs
      expect(res.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      campaignAId = res.body.id;
    });

    it('auto-generates adset/ad names when not provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Auto Name Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 3000,
          budgetType: 'LIFETIME',
        });

      expect(res.status).toBe(201);
      expect(res.body.adsets[0].name).toBe('Auto Name Campaign — AdSet 1');
      expect(res.body.adsets[0].ads[0].name).toBe('Auto Name Campaign — Ad 1');

      campaign2Id = res.body.id;
    });

    it('resolves budget from adStrategy when no budgetAmount given', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Strategy Budget Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          adStrategyId: strategyAId,
          // No budgetAmount — should use strategy config.budget.amount = 10000
        });

      expect(res.status).toBe(201);
      expect(res.body.budget).toBe(10000);
      expect(res.body.budgetType).toBe('DAILY');
      expect(res.body.adStrategyId).toBe(strategyAId);
    });

    it('400 when neither adStrategyId nor budgetAmount provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'No Budget Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── Test 2: Preview — No DB Writes ──────────────────────────────────────

  describe('Test 2 — Preview returns computed shape without DB writes', () => {
    it('POST /api/campaigns/preview → 200 with preview shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns/preview')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Preview Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 7500,
          budgetType: 'DAILY',
          creativeIds: [creativeReadyId],
        });

      expect(res.status).toBe(200);
      expect(res.body.preview).toBe(true);
      expect(res.body.campaign).toMatchObject({
        name: 'Preview Campaign',
        budget: 7500,
        budgetType: 'DAILY',
        status: 'ACTIVE',
        sellpageId: sellpageAId,
        adAccountId: adAccountAId,
      });
      expect(res.body.adset).toMatchObject({
        name: 'Preview Campaign — AdSet 1',
      });
      expect(res.body.ad).toMatchObject({
        name: 'Preview Campaign — Ad 1',
      });
      expect(res.body.adPost).toMatchObject({
        pageId: pageAId,
        postSource: 'CONTENT_SOURCE',
      });
      expect(res.body.creatives).toEqual([creativeReadyId]);
    });

    it('preview does not create any DB records', async () => {
      const previewName = `preview-no-write-${Date.now()}`;
      const countBefore = await prisma.campaign.count({
        where: { sellerId: sellerAId, name: previewName },
      });

      await request(app.getHttpServer())
        .post('/api/campaigns/preview')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: previewName,
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 7500,
          budgetType: 'DAILY',
        });

      const countAfter = await prisma.campaign.count({
        where: { sellerId: sellerAId, name: previewName },
      });

      expect(countAfter).toBe(countBefore); // No new records created
    });
  });

  // ─── Test 3: Seller Isolation ─────────────────────────────────────────────

  describe('Test 3 — Seller isolation (Seller B cannot access Seller A campaign)', () => {
    it('GET /api/campaigns/:id → 404 for cross-tenant read', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/campaigns/${campaignAId}`)
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(404);
    });

    it('GET /api/campaigns → Seller B gets own empty list (no Seller A campaigns)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/campaigns')
        .set('Authorization', auth(sellerBToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((c: any) => c.id);
      expect(ids).not.toContain(campaignAId);
    });

    it('PATCH /:id/status → 404 for cross-tenant update', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaignAId}/status`)
        .set('Authorization', auth(sellerBToken))
        .send({ status: 'PAUSED' });

      expect(res.status).toBe(404);
    });
  });

  // ─── Test 4: Inactive Connection / Strategy ───────────────────────────────

  describe('Test 4 — Cannot create with inactive fbConnection or adStrategy', () => {
    it('400 when adAccountConnectionId is inactive', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Inactive Account Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: inactiveAdAccountId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive/i);
    });

    it('400 when adStrategyId is inactive', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Inactive Strategy Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          adStrategyId: inactiveStrategyId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive/i);
    });

    it('404 when sellpageId belongs to another seller', async () => {
      // Seller B's token but Seller A's sellpage
      const res = await request(app.getHttpServer())
        .post('/api/campaigns/preview')
        .set('Authorization', auth(sellerBToken))
        .send({
          name: 'Cross-Tenant Sellpage Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
        });

      expect(res.status).toBe(404);
    });

    it('400 when adAccountConnectionId references a PAGE connection (wrong type)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Wrong Type Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: pageAId, // PAGE connection, not AD_ACCOUNT
          pageConnectionId: pageAId,
          budgetAmount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/AD_ACCOUNT/);
    });
  });

  // ─── Test 5: Non-READY Creative ───────────────────────────────────────────

  describe('Test 5 — Cannot attach non-READY creative', () => {
    it('400 when creativeIds contains a DRAFT creative', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Draft Creative Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
          creativeIds: [creativeDraftId],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not READY/i);
    });

    it('404 when creativeIds contains a non-existent creative UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Unknown Creative Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
          creativeIds: ['00000000-0000-4000-8000-000000000000'],
        });

      expect(res.status).toBe(404);
    });

    it('404 when creative belongs to another seller', async () => {
      // Seed a READY creative for Seller B directly
      const bCreative = await prisma.creative.create({
        data: {
          sellerId: sellerBId,
          name: 'Seller B Ready Creative',
          status: 'READY',
          creativeType: 'IMAGE_AD',
        },
        select: { id: true },
      });

      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Cross-Tenant Creative Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
          creativeIds: [bCreative.id],
        });

      expect(res.status).toBe(404);
    });
  });

  // ─── Test 6: Status Toggle ────────────────────────────────────────────────

  describe('Test 6 — Status toggle', () => {
    it('PATCH /:id/status PAUSED → 200 status=PAUSED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaignAId}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'PAUSED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAUSED');
    });

    it('PATCH /:id/status ACTIVE → 200 status=ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaignAId}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('400 when toggling an ARCHIVED campaign', async () => {
      const archivedCampaign = await prisma.campaign.create({
        data: {
          sellerId: sellerAId,
          sellpageId: sellpageAId,
          adAccountId: adAccountAId,
          name: 'Archived Toggle Test',
          budget: 1000,
          budgetType: 'DAILY',
          status: 'ARCHIVED',
        },
        select: { id: true },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${archivedCampaign.id}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/ARCHIVED/i);
    });

    it('400 when toggling a DELETED campaign', async () => {
      const deletedCampaign = await prisma.campaign.create({
        data: {
          sellerId: sellerAId,
          sellpageId: sellpageAId,
          adAccountId: adAccountAId,
          name: 'Deleted Toggle Test',
          budget: 1000,
          budgetType: 'DAILY',
          status: 'DELETED',
        },
        select: { id: true },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${deletedCampaign.id}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/DELETED/i);
    });

    it('400 on invalid status value', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaignAId}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Test 7: List Campaigns ───────────────────────────────────────────────

  describe('Test 7 — List returns only seller campaigns; filters work', () => {
    it('GET /api/campaigns → returns only Seller A campaigns (sellerId scoped)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/campaigns')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const c of res.body) {
        expect(c.sellerId).toBe(sellerAId);
      }

      const ids = res.body.map((c: any) => c.id);
      expect(ids).toContain(campaignAId);
      expect(ids).toContain(campaign2Id);
    });

    it('GET /api/campaigns → default excludes ARCHIVED campaigns', async () => {
      const archivedCampaign = await prisma.campaign.create({
        data: {
          sellerId: sellerAId,
          sellpageId: sellpageAId,
          adAccountId: adAccountAId,
          name: 'Archived For List Test',
          budget: 1000,
          budgetType: 'DAILY',
          status: 'ARCHIVED',
        },
        select: { id: true },
      });

      const res = await request(app.getHttpServer())
        .get('/api/campaigns')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const ids = res.body.map((c: any) => c.id);
      expect(ids).not.toContain(archivedCampaign.id);
    });

    it('GET /api/campaigns?includeArchived=true → includes ARCHIVED', async () => {
      const archivedCampaign = await prisma.campaign.create({
        data: {
          sellerId: sellerAId,
          sellpageId: sellpageAId,
          adAccountId: adAccountAId,
          name: 'Archived Include Test',
          budget: 1000,
          budgetType: 'DAILY',
          status: 'ARCHIVED',
        },
        select: { id: true },
      });

      const res = await request(app.getHttpServer())
        .get('/api/campaigns?includeArchived=true')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const ids = res.body.map((c: any) => c.id);
      expect(ids).toContain(archivedCampaign.id);
    });

    it('GET /api/campaigns?status=PAUSED → only PAUSED campaigns', async () => {
      // Ensure campaignAId is PAUSED
      await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaignAId}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'PAUSED' });

      const res = await request(app.getHttpServer())
        .get('/api/campaigns?status=PAUSED')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const c of res.body) {
        expect(c.status).toBe('PAUSED');
      }
      const ids = res.body.map((c: any) => c.id);
      expect(ids).toContain(campaignAId);
    });

    it('GET /api/campaigns/:id → returns nested detail with adsets/ads/adposts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/campaigns/${campaignAId}`)
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(campaignAId);
      expect(Array.isArray(res.body.adsets)).toBe(true);
      expect(res.body.adsets.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.adsets[0].ads)).toBe(true);
      expect(Array.isArray(res.body.adsets[0].ads[0].adPosts)).toBe(true);
      expect(res.body.creativeIds).toContain(creativeReadyId);
    });

    it('GET /api/campaigns → list items have adSetsCount and creativeIds', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/campaigns')
        .set('Authorization', auth(sellerAToken));

      expect(res.status).toBe(200);
      const target = res.body.find((c: any) => c.id === campaignAId);
      expect(target).toBeDefined();
      expect(typeof target.adSetsCount).toBe('number');
      expect(target.adSetsCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(target.creativeIds)).toBe(true);
    });
  });

  // ─── Test 8: Input Validation ─────────────────────────────────────────────

  describe('Test 8 — DTO validation edge cases', () => {
    it('400 when campaign name is empty string', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: '',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
        });

      expect(res.status).toBe(400);
    });

    it('400 when sellpageId is not a UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Bad UUID Campaign',
          sellpageId: 'not-a-uuid',
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
        });

      expect(res.status).toBe(400);
    });

    it('400 when budgetAmount is below minimum (100)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', auth(sellerAToken))
        .send({
          name: 'Low Budget Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 50, // below min of 100
        });

      expect(res.status).toBe(400);
    });

    it('400 on invalid status value in PATCH /:id/status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaignAId}/status`)
        .set('Authorization', auth(sellerAToken))
        .send({ status: 'LAUNCHED' });

      expect(res.status).toBe(400);
    });

    it('401 when no auth token provided to GET /api/campaigns', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/campaigns');

      expect(res.status).toBe(401);
    });

    it('401 when no auth token provided to POST /api/campaigns', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .send({
          name: 'Unauth Campaign',
          sellpageId: sellpageAId,
          adAccountConnectionId: adAccountAId,
          pageConnectionId: pageAId,
          budgetAmount: 5000,
        });

      expect(res.status).toBe(401);
    });
  });
});
