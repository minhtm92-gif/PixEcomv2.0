import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MetaService } from '../src/meta/meta.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Campaigns CRUD + Meta Lifecycle E2E Tests — Task C2
 *
 * Requires live PostgreSQL on port 5434.
 * MetaService is mocked via jest.spyOn — no real Meta API calls are made.
 *
 * Coverage:
 *  1.  POST /campaigns — 401 without JWT
 *  2.  POST /campaigns — 400 for missing required fields
 *  3.  POST /campaigns — 404 for unknown sellpageId
 *  4.  POST /campaigns — 400 for invalid/inactive adAccountId
 *  5.  POST /campaigns — 201 creates campaign (status=PAUSED, externalCampaignId=null)
 *  6.  GET  /campaigns — 401 without JWT
 *  7.  GET  /campaigns — 200 returns seller's campaigns
 *  8.  GET  /campaigns — filter by status
 *  9.  GET  /campaigns — filter by sellpageId
 *  10. GET  /campaigns/:id — 404 for unknown id
 *  11. GET  /campaigns/:id — 200 returns campaign detail with related fields
 *  12. GET  /campaigns/:id — 404 for Seller B accessing Seller A's campaign (tenant isolation)
 *  13. PATCH /campaigns/:id — 400 for non-UUID param
 *  14. PATCH /campaigns/:id — 200 updates name/budget
 *  15. POST /campaigns/:id/launch — 200 + sets externalCampaignId + status=ACTIVE
 *  16. POST /campaigns/:id/launch — 409 when campaign already launched
 *  17. PATCH /campaigns/:id/pause — 200 + sets status=PAUSED
 *  18. PATCH /campaigns/:id/pause — 409 when status is not ACTIVE
 *  19. PATCH /campaigns/:id/resume — 200 + sets status=ACTIVE
 *  20. PATCH /campaigns/:id/resume — 409 when status is not PAUSED
 *  21. POST /campaigns/:id/launch — 404 for Seller B using Seller A's campaignId
 */
describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let metaService: MetaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;

  // Seeded IDs
  let productId: string;
  let sellpageId: string;
  let adAccountId: string;   // FbConnection (AD_ACCOUNT)
  let campaignId: string;    // Created in test 5, reused in later tests

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uid = (prefix = 'c2') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-5)}`;

  const uniqueEmail = (prefix = 'c2') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const login = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password123!' });

  // ─── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    metaService = app.get(MetaService);

    // ── Register + login Seller A ─────────────────────────────────────────
    const emailA = uniqueEmail('c2-a');
    const resA = await register(emailA, 'C2 SellerA');
    sellerAId = resA.body.seller?.id;
    const loginA = await login(emailA);
    sellerAToken = loginA.body.accessToken;

    // ── Register + login Seller B ─────────────────────────────────────────
    const emailB = uniqueEmail('c2-b');
    await register(emailB, 'C2 SellerB');
    const loginB = await login(emailB);
    sellerBToken = loginB.body.accessToken;

    // ── Seed: Product ─────────────────────────────────────────────────────
    const product = await prisma.product.create({
      data: {
        productCode: uid('PC'),
        name: 'C2 Test Product',
        slug: uid('c2-prod'),
        basePrice: 99.99,
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    // ── Seed: Sellpage for Seller A ───────────────────────────────────────
    const sellpage = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: uid('c2-sp'),
        status: 'PUBLISHED',
      },
    });
    sellpageId = sellpage.id;

    // ── Seed: FbConnection AD_ACCOUNT for Seller A ────────────────────────
    const adAccount = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        externalId: `act_${Date.now()}`,
        name: 'C2 Test Ad Account',
        isActive: true,
        // accessTokenEnc set for MetaService token resolution
        accessTokenEnc: null, // will be mocked
      },
    });
    adAccountId = adAccount.id;
  });

  afterAll(async () => {
    // Cleanup seeded data (cascade deletes will handle campaigns/adsets)
    await prisma.campaign.deleteMany({
      where: { sellpageId },
    });
    await prisma.fbConnection.deleteMany({
      where: { id: adAccountId },
    });
    await prisma.sellpage.deleteMany({
      where: { id: sellpageId },
    });
    await prisma.product.deleteMany({
      where: { id: productId },
    });
    await app.close();
  });

  // ─── Test 1: 401 without JWT ───────────────────────────────────────────────

  it('1. POST /campaigns — 401 without JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/campaigns')
      .send({ name: 'Test', sellpageId, adAccountId, budget: 10, budgetType: 'DAILY' })
      .expect(401);
  });

  // ─── Test 2: 400 missing required fields ──────────────────────────────────

  it('2. POST /campaigns — 400 missing required fields', async () => {
    await request(app.getHttpServer())
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Test' }) // missing sellpageId, adAccountId, budget, budgetType
      .expect(400);
  });

  // ─── Test 3: 404 unknown sellpageId ───────────────────────────────────────

  it('3. POST /campaigns — 404 unknown sellpageId', async () => {
    await request(app.getHttpServer())
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Test',
        sellpageId: '00000000-0000-0000-0000-000000000000',
        adAccountId,
        budget: 10,
        budgetType: 'DAILY',
      })
      .expect(404);
  });

  // ─── Test 4: 400 invalid adAccountId ─────────────────────────────────────

  it('4. POST /campaigns — 400 invalid adAccountId', async () => {
    await request(app.getHttpServer())
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Test',
        sellpageId,
        adAccountId: '00000000-0000-0000-0000-000000000001',
        budget: 10,
        budgetType: 'DAILY',
      })
      .expect(400);
  });

  // ─── Test 5: 201 create campaign ──────────────────────────────────────────

  it('5. POST /campaigns — 201 creates campaign (status=PAUSED, externalCampaignId=null)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'C2 Test Campaign',
        sellpageId,
        adAccountId,
        budget: 50.00,
        budgetType: 'DAILY',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'C2 Test Campaign',
      sellpageId,
      adAccountId,
      budget: 50,
      budgetType: 'DAILY',
      status: 'PAUSED',
      externalCampaignId: null,
    });
    expect(res.body.id).toBeDefined();
    campaignId = res.body.id;
  });

  // ─── Test 6: 401 list without JWT ─────────────────────────────────────────

  it('6. GET /campaigns — 401 without JWT', async () => {
    await request(app.getHttpServer()).get('/api/campaigns').expect(401);
  });

  // ─── Test 7: 200 list returns seller's campaigns ──────────────────────────

  it('7. GET /campaigns — 200 returns seller campaigns', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const campaign = res.body.items.find((c: any) => c.id === campaignId);
    expect(campaign).toBeDefined();
    expect(campaign.sellpage).toBeDefined();
    expect(campaign.adAccount).toBeDefined();
    expect(typeof campaign.adsetsCount).toBe('number');
  });

  // ─── Test 8: filter by status ─────────────────────────────────────────────

  it('8. GET /campaigns — filter by status=PAUSED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/campaigns?status=PAUSED')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.items.every((c: any) => c.status === 'PAUSED')).toBe(true);
  });

  // ─── Test 9: filter by sellpageId ─────────────────────────────────────────

  it('9. GET /campaigns — filter by sellpageId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/campaigns?sellpageId=${sellpageId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.items.every((c: any) => c.sellpageId === sellpageId)).toBe(true);
  });

  // ─── Test 10: 404 unknown campaign ────────────────────────────────────────

  it('10. GET /campaigns/:id — 404 unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/campaigns/00000000-0000-0000-0000-000000000002')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(404);
  });

  // ─── Test 11: 200 campaign detail ─────────────────────────────────────────

  it('11. GET /campaigns/:id — 200 campaign detail with related fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: campaignId,
      name: 'C2 Test Campaign',
      status: 'PAUSED',
      externalCampaignId: null,
    });
    expect(res.body.sellpage).toBeDefined();
    expect(res.body.adAccount).toBeDefined();
    expect(typeof res.body.adsetsCount).toBe('number');
  });

  // ─── Test 12: tenant isolation ────────────────────────────────────────────

  it('12. GET /campaigns/:id — 404 tenant isolation (Seller B cannot access Seller A campaign)', async () => {
    await request(app.getHttpServer())
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);
  });

  // ─── Test 13: 400 non-UUID param ──────────────────────────────────────────

  it('13. PATCH /campaigns/:id — 400 for non-UUID param', async () => {
    await request(app.getHttpServer())
      .patch('/api/campaigns/not-a-uuid')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'New Name' })
      .expect(400);
  });

  // ─── Test 14: 200 update ──────────────────────────────────────────────────

  it('14. PATCH /campaigns/:id — 200 updates name and budget', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'C2 Updated Campaign', budget: 75.00 })
      .expect(200);

    expect(res.body.name).toBe('C2 Updated Campaign');
    expect(res.body.budget).toBe(75);
  });

  // ─── Test 15: 200 launch ─────────────────────────────────────────────────

  it('15. POST /campaigns/:id/launch — 200 sets externalCampaignId + status=ACTIVE', async () => {
    const mockMetaId = 'meta_campaign_123456789';

    // Mock MetaService.post to return a fake Meta campaign id
    jest.spyOn(metaService, 'post').mockResolvedValueOnce({ id: mockMetaId } as any);

    const res = await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/launch`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.externalCampaignId).toBe(mockMetaId);

    // Verify DB updated
    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true, externalCampaignId: true },
    });
    expect(dbCampaign?.status).toBe('ACTIVE');
    expect(dbCampaign?.externalCampaignId).toBe(mockMetaId);
  });

  // ─── Test 16: 409 launch already launched ────────────────────────────────

  it('16. POST /campaigns/:id/launch — 409 when already launched', async () => {
    await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/launch`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(409);
  });

  // ─── Test 17: 200 pause ───────────────────────────────────────────────────

  it('17. PATCH /campaigns/:id/pause — 200 sets status=PAUSED', async () => {
    // Mock MetaService.post for pause call
    jest.spyOn(metaService, 'post').mockResolvedValueOnce({ success: true } as any);

    const res = await request(app.getHttpServer())
      .patch(`/api/campaigns/${campaignId}/pause`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.status).toBe('PAUSED');

    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    expect(dbCampaign?.status).toBe('PAUSED');
  });

  // ─── Test 18: 409 pause when not ACTIVE ──────────────────────────────────

  it('18. PATCH /campaigns/:id/pause — 409 when status is not ACTIVE', async () => {
    // Campaign is already PAUSED from test 17
    await request(app.getHttpServer())
      .patch(`/api/campaigns/${campaignId}/pause`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(409);
  });

  // ─── Test 19: 200 resume ──────────────────────────────────────────────────

  it('19. PATCH /campaigns/:id/resume — 200 sets status=ACTIVE', async () => {
    // Mock MetaService.post for resume call
    jest.spyOn(metaService, 'post').mockResolvedValueOnce({ success: true } as any);

    const res = await request(app.getHttpServer())
      .patch(`/api/campaigns/${campaignId}/resume`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.status).toBe('ACTIVE');

    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    expect(dbCampaign?.status).toBe('ACTIVE');
  });

  // ─── Test 20: 409 resume when not PAUSED ─────────────────────────────────

  it('20. PATCH /campaigns/:id/resume — 409 when status is not PAUSED', async () => {
    // Campaign is ACTIVE from test 19
    await request(app.getHttpServer())
      .patch(`/api/campaigns/${campaignId}/resume`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(409);
  });

  // ─── Test 21: 404 cross-tenant launch ────────────────────────────────────

  it('21. POST /campaigns/:id/launch — 404 tenant isolation (Seller B cannot launch Seller A campaign)', async () => {
    await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/launch`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);
  });
});
