import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Ad Units (Adsets + Ads + AdPost) E2E Tests — Task C4
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Coverage:
 *
 * ADSETS
 *  1.  POST /campaigns/:id/adsets — 401 without JWT
 *  2.  POST /campaigns/:id/adsets — 404 unknown campaignId
 *  3.  POST /campaigns/:id/adsets — 400 missing name
 *  4.  POST /campaigns/:id/adsets — 400 campaign is DELETED
 *  5.  POST /campaigns/:id/adsets — 201 creates adset (status=PAUSED)
 *  6.  GET  /campaigns/:id/adsets — 200 lists adsets for campaign
 *  7.  GET  /campaigns/:id/adsets — 404 unknown campaignId
 *  8.  GET  /adsets/:id — 200 adset detail with campaign + adsCount
 *  9.  GET  /adsets/:id — 404 unknown id
 *  10. GET  /adsets/:id — 404 tenant isolation (Seller B)
 *  11. PATCH /adsets/:id — 200 updates name + status
 *  12. PATCH /adsets/:id — 400 no fields provided
 *
 * ADS
 *  13. POST /adsets/:id/ads — 401 without JWT
 *  14. POST /adsets/:id/ads — 404 unknown adsetId
 *  15. POST /adsets/:id/ads — 201 creates ad (status=PAUSED)
 *  16. GET  /adsets/:id/ads — 200 lists ads for adset
 *  17. GET  /ads/:id — 200 ad detail with adset + adPosts[]
 *  18. GET  /ads/:id — 404 unknown id
 *  19. GET  /ads/:id — 404 tenant isolation (Seller B)
 *  20. PATCH /ads/:id — 200 updates name
 *
 * AD POSTS
 *  21. POST /ads/:id/ad-post — 400 invalid pageId
 *  22. POST /ads/:id/ad-post — 201 creates AdPost
 *  23. GET  /ads/:id — adPosts[] includes newly created AdPost
 *  24. POST /ads/:id/ad-post — 404 unknown adId
 */
describe('Ad Units (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;

  // Seeded IDs
  let productId: string;
  let sellpageId: string;
  let adAccountId: string;   // FbConnection AD_ACCOUNT
  let pageConnectionId: string; // FbConnection PAGE
  let campaignId: string;
  let deletedCampaignId: string;

  // Created in tests
  let adsetId: string;
  let adId: string;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uid = (prefix = 'c4') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-5)}`;

  const uniqueEmail = (prefix = 'c4') =>
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

    // ── Register + login Seller A ─────────────────────────────────────────
    const emailA = uniqueEmail('c4-a');
    const resA = await register(emailA, 'C4 SellerA');
    sellerAId = resA.body.seller?.id;
    const loginA = await login(emailA);
    sellerAToken = loginA.body.accessToken;

    // ── Register + login Seller B ─────────────────────────────────────────
    const emailB = uniqueEmail('c4-b');
    await register(emailB, 'C4 SellerB');
    const loginB = await login(emailB);
    sellerBToken = loginB.body.accessToken;

    // ── Seed: Product ─────────────────────────────────────────────────────
    const product = await prisma.product.create({
      data: {
        productCode: uid('PC'),
        name: 'C4 Test Product',
        slug: uid('c4-prod'),
        basePrice: 49.99,
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    // ── Seed: Sellpage ────────────────────────────────────────────────────
    const sellpage = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: uid('c4-sp'),
        status: 'PUBLISHED',
      },
    });
    sellpageId = sellpage.id;

    // ── Seed: FbConnections ───────────────────────────────────────────────
    const adAccount = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        externalId: `act_c4_${Date.now()}`,
        name: 'C4 Ad Account',
        isActive: true,
      },
    });
    adAccountId = adAccount.id;

    const pageConn = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'PAGE',
        externalId: `page_c4_${Date.now()}`,
        name: 'C4 FB Page',
        isActive: true,
      },
    });
    pageConnectionId = pageConn.id;

    // ── Seed: Active campaign ─────────────────────────────────────────────
    const campaign = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId,
        name: 'C4 Active Campaign',
        budget: 100,
        budgetType: 'DAILY',
        status: 'PAUSED',
      },
    });
    campaignId = campaign.id;

    // ── Seed: Deleted campaign ────────────────────────────────────────────
    const deletedCampaign = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId,
        name: 'C4 Deleted Campaign',
        budget: 50,
        budgetType: 'DAILY',
        status: 'DELETED',
      },
    });
    deletedCampaignId = deletedCampaign.id;
  });

  afterAll(async () => {
    await prisma.adPost.deleteMany({ where: { sellerId: sellerAId } });
    await prisma.ad.deleteMany({ where: { sellerId: sellerAId } });
    await prisma.adset.deleteMany({ where: { sellerId: sellerAId } });
    await prisma.campaign.deleteMany({ where: { sellerId: sellerAId } });
    await prisma.fbConnection.deleteMany({ where: { sellerId: sellerAId } });
    await prisma.sellpage.deleteMany({ where: { id: sellpageId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADSETS
  // ══════════════════════════════════════════════════════════════════════════

  it('1. POST /campaigns/:id/adsets — 401 without JWT', async () => {
    await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/adsets`)
      .send({ name: 'Adset 1' })
      .expect(401);
  });

  it('2. POST /campaigns/:id/adsets — 404 unknown campaignId', async () => {
    await request(app.getHttpServer())
      .post('/api/campaigns/00000000-0000-0000-0000-000000000010/adsets')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Adset X' })
      .expect(404);
  });

  it('3. POST /campaigns/:id/adsets — 400 missing name', async () => {
    await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/adsets`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ optimizationGoal: 'LINK_CLICKS' })
      .expect(400);
  });

  it('4. POST /campaigns/:id/adsets — 400 campaign is DELETED', async () => {
    await request(app.getHttpServer())
      .post(`/api/campaigns/${deletedCampaignId}/adsets`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Adset for deleted' })
      .expect(400);
  });

  it('5. POST /campaigns/:id/adsets — 201 creates adset (status=PAUSED)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/adsets`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'C4 Test Adset',
        optimizationGoal: 'LINK_CLICKS',
        targeting: { countries: ['US', 'GB'] },
      })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'C4 Test Adset',
      campaignId,
      status: 'PAUSED',
      optimizationGoal: 'LINK_CLICKS',
    });
    expect(res.body.targeting).toMatchObject({ countries: ['US', 'GB'] });
    expect(res.body.id).toBeDefined();
    adsetId = res.body.id;
  });

  it('6. GET /campaigns/:id/adsets — 200 lists adsets', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/campaigns/${campaignId}/adsets`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const adset = res.body.items.find((a: any) => a.id === adsetId);
    expect(adset).toBeDefined();
    expect(typeof adset.adsCount).toBe('number');
  });

  it('7. GET /campaigns/:id/adsets — 404 unknown campaignId', async () => {
    await request(app.getHttpServer())
      .get('/api/campaigns/00000000-0000-0000-0000-000000000011/adsets')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(404);
  });

  it('8. GET /adsets/:id — 200 adset detail with campaign + adsCount', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/adsets/${adsetId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: adsetId,
      name: 'C4 Test Adset',
      campaignId,
    });
    expect(res.body.campaign).toBeDefined();
    expect(res.body.campaign.id).toBe(campaignId);
    expect(typeof res.body.adsCount).toBe('number');
  });

  it('9. GET /adsets/:id — 404 unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/adsets/00000000-0000-0000-0000-000000000012')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(404);
  });

  it('10. GET /adsets/:id — 404 tenant isolation (Seller B)', async () => {
    await request(app.getHttpServer())
      .get(`/api/adsets/${adsetId}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);
  });

  it('11. PATCH /adsets/:id — 200 updates name + status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/adsets/${adsetId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'C4 Updated Adset', status: 'ACTIVE' })
      .expect(200);

    expect(res.body.name).toBe('C4 Updated Adset');
    expect(res.body.status).toBe('ACTIVE');
  });

  it('12. PATCH /adsets/:id — 400 no fields provided', async () => {
    await request(app.getHttpServer())
      .patch(`/api/adsets/${adsetId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({})
      .expect(400);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADS
  // ══════════════════════════════════════════════════════════════════════════

  it('13. POST /adsets/:id/ads — 401 without JWT', async () => {
    await request(app.getHttpServer())
      .post(`/api/adsets/${adsetId}/ads`)
      .send({ name: 'Ad 1' })
      .expect(401);
  });

  it('14. POST /adsets/:id/ads — 404 unknown adsetId', async () => {
    await request(app.getHttpServer())
      .post('/api/adsets/00000000-0000-0000-0000-000000000020/ads')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Ad X' })
      .expect(404);
  });

  it('15. POST /adsets/:id/ads — 201 creates ad (status=PAUSED)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/adsets/${adsetId}/ads`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'C4 Test Ad' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'C4 Test Ad',
      adsetId,
      status: 'PAUSED',
    });
    expect(res.body.id).toBeDefined();
    adId = res.body.id;
  });

  it('16. GET /adsets/:id/ads — 200 lists ads for adset', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/adsets/${adsetId}/ads`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const ad = res.body.items.find((a: any) => a.id === adId);
    expect(ad).toBeDefined();
    expect(typeof ad.adPostsCount).toBe('number');
  });

  it('17. GET /ads/:id — 200 ad detail with adset + adPosts[]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/ads/${adId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: adId, name: 'C4 Test Ad', adsetId });
    expect(res.body.adset).toBeDefined();
    expect(res.body.adset.id).toBe(adsetId);
    expect(res.body.adPosts).toBeInstanceOf(Array);
  });

  it('18. GET /ads/:id — 404 unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/ads/00000000-0000-0000-0000-000000000030')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(404);
  });

  it('19. GET /ads/:id — 404 tenant isolation (Seller B)', async () => {
    await request(app.getHttpServer())
      .get(`/api/ads/${adId}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);
  });

  it('20. PATCH /ads/:id — 200 updates name', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/ads/${adId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'C4 Updated Ad' })
      .expect(200);

    expect(res.body.name).toBe('C4 Updated Ad');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AD POSTS
  // ══════════════════════════════════════════════════════════════════════════

  it('21. POST /ads/:id/ad-post — 400 invalid pageId (wrong connection type)', async () => {
    // Use adAccountId instead of pageId — should fail validation
    await request(app.getHttpServer())
      .post(`/api/ads/${adId}/ad-post`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        pageId: adAccountId, // AD_ACCOUNT, not PAGE
        postSource: 'CONTENT_SOURCE',
      })
      .expect(400);
  });

  it('22. POST /ads/:id/ad-post — 201 creates AdPost', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/ads/${adId}/ad-post`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        pageId: pageConnectionId,
        postSource: 'CONTENT_SOURCE',
        externalPostId: 'ext_post_abc123',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      adId,
      pageId: pageConnectionId,
      postSource: 'CONTENT_SOURCE',
      externalPostId: 'ext_post_abc123',
    });
    expect(res.body.id).toBeDefined();
  });

  it('23. GET /ads/:id — adPosts[] includes newly created AdPost', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/ads/${adId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);

    expect(res.body.adPosts.length).toBeGreaterThanOrEqual(1);
    const post = res.body.adPosts.find((p: any) => p.externalPostId === 'ext_post_abc123');
    expect(post).toBeDefined();
    expect(post.pageId).toBe(pageConnectionId);
  });

  it('24. POST /ads/:id/ad-post — 404 unknown adId', async () => {
    await request(app.getHttpServer())
      .post('/api/ads/00000000-0000-0000-0000-000000000040/ad-post')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        pageId: pageConnectionId,
        postSource: 'CONTENT_SOURCE',
      })
      .expect(404);
  });
});
