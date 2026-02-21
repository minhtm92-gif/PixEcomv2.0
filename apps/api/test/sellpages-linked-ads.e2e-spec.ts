import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Sellpage Linked Ads E2E Tests — Task B6
 *
 * Requires live PostgreSQL on port 5434.
 *
 * Coverage:
 *  1.  GET /sellpages/:id/linked-ads — 401 without JWT
 *  2.  GET /sellpages/:id/linked-ads — 400 for non-UUID param
 *  3.  GET /sellpages/:id/linked-ads — 404 for unknown sellpageId
 *  4.  GET /sellpages/:id/linked-ads — empty response when sellpage has no campaigns
 *  5.  GET /sellpages/:id/linked-ads — full chain shape (campaigns → adsets → ads → adPost)
 *  6.  GET /sellpages/:id/linked-ads — adPost is null when ad has no AdPost
 *  7.  GET /sellpages/:id/linked-ads — multiple campaigns returned, ordered by createdAt desc
 *  8.  GET /sellpages/:id/linked-ads — multiple adsets within a campaign returned
 *  9.  GET /sellpages/:id/linked-ads — adPost.externalPostId is null when not set
 *  10. GET /sellpages/:id/linked-ads — tenant isolation: Seller B cannot access Seller A's sellpage
 */
describe('Sellpages Linked Ads (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sellerAToken: string;
  let sellerAId: string;
  let sellerBToken: string;
  let sellerBId: string;

  // Seeded IDs
  let productId: string;
  let sellpageId: string;          // Seller A's sellpage WITH campaigns
  let emptySellpageId: string;     // Seller A's sellpage WITH NO campaigns

  // Campaign / adset / ad / adpost IDs
  let campaign1Id: string;
  let campaign2Id: string;
  let adset1Id: string;
  let adset2Id: string;
  let ad1Id: string;               // has AdPost
  let ad2Id: string;               // no AdPost
  let fbPageId: string;            // FbConnection (PAGE type) used in AdPost
  let fbAdAccountId: string;       // FbConnection (AD_ACCOUNT) used for Campaign

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uid = (prefix = 'b6') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-5)}`;

  const uniqueEmail = (prefix = 'b6la') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
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
    const resA = await register(uniqueEmail('b6-a'), 'B6 Seller A');
    sellerAToken = resA.body.accessToken;
    sellerAId = resA.body.seller.id;

    const resB = await register(uniqueEmail('b6-b'), 'B6 Seller B');
    sellerBToken = resB.body.accessToken;
    sellerBId = resB.body.seller.id;

    // Platform product
    const product = await prisma.product.create({
      data: {
        productCode: `B6LA-${Date.now()}`,
        name: 'B6 Linked Ads Test Product',
        slug: `b6-la-prod-${Date.now()}`,
        basePrice: 59.99,
        status: 'ACTIVE',
      },
    });
    productId = product.id;

    // Sellpage A (will have campaigns)
    const sp = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: uid('sp-main'),
        status: 'PUBLISHED',
      },
    });
    sellpageId = sp.id;

    // Sellpage B (empty — no campaigns)
    const spEmpty = await prisma.sellpage.create({
      data: {
        sellerId: sellerAId,
        productId,
        slug: uid('sp-empty'),
        status: 'DRAFT',
      },
    });
    emptySellpageId = spEmpty.id;

    // FbConnection: AD_ACCOUNT (used by Campaign)
    const fbAdAccount = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'AD_ACCOUNT',
        externalId: uid('act'),
        name: 'B6 Ad Account',
        metadata: {},
      },
    });
    fbAdAccountId = fbAdAccount.id;

    // FbConnection: PAGE (used by AdPost)
    const fbPage = await prisma.fbConnection.create({
      data: {
        sellerId: sellerAId,
        connectionType: 'PAGE',
        externalId: uid('page'),
        name: 'B6 FB Page',
        metadata: {},
      },
    });
    fbPageId = fbPage.id;

    // Campaign 1 (ACTIVE) — created first so it sorts later (desc)
    await new Promise((r) => setTimeout(r, 5)); // ensure distinct createdAt
    const c1 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbAdAccountId,
        name: 'Campaign One',
        budget: 50,
        budgetType: 'DAILY',
        status: 'ACTIVE',
      },
    });
    campaign1Id = c1.id;

    // Campaign 2 (PAUSED) — created second so it sorts first (desc)
    await new Promise((r) => setTimeout(r, 5));
    const c2 = await prisma.campaign.create({
      data: {
        sellerId: sellerAId,
        sellpageId,
        adAccountId: fbAdAccountId,
        name: 'Campaign Two',
        budget: 100,
        budgetType: 'DAILY',
        status: 'PAUSED',
      },
    });
    campaign2Id = c2.id;

    // Adset 1 under Campaign 1
    const as1 = await prisma.adset.create({
      data: {
        sellerId: sellerAId,
        campaignId: campaign1Id,
        name: 'Adset One',
        status: 'ACTIVE',
        targeting: {},
      },
    });
    adset1Id = as1.id;

    // Adset 2 under Campaign 1
    const as2 = await prisma.adset.create({
      data: {
        sellerId: sellerAId,
        campaignId: campaign1Id,
        name: 'Adset Two',
        status: 'PAUSED',
        targeting: {},
      },
    });
    adset2Id = as2.id;

    // Ad 1 under Adset 1 — WILL have an AdPost
    const a1 = await prisma.ad.create({
      data: {
        sellerId: sellerAId,
        adsetId: adset1Id,
        name: 'Ad One',
        status: 'ACTIVE',
      },
    });
    ad1Id = a1.id;

    // Ad 2 under Adset 1 — NO AdPost
    const a2 = await prisma.ad.create({
      data: {
        sellerId: sellerAId,
        adsetId: adset1Id,
        name: 'Ad Two',
        status: 'PAUSED',
      },
    });
    ad2Id = a2.id;

    // AdPost linked to Ad 1
    await prisma.adPost.create({
      data: {
        sellerId: sellerAId,
        adId: ad1Id,
        pageId: fbPageId,
        postSource: 'EXISTING',
        externalPostId: 'ext-post-b6-001',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Tests ─────────────────────────────────────────────────────────────────

  it('1. returns 401 without JWT', async () => {
    await request(app.getHttpServer())
      .get(`/api/sellpages/${sellpageId}/linked-ads`)
      .expect(401);
  });

  it('2. returns 400 for non-UUID param', async () => {
    await get('/api/sellpages/not-a-uuid/linked-ads', sellerAToken).expect(400);
  });

  it('3. returns 404 for unknown sellpageId', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000';
    await get(`/api/sellpages/${unknownId}/linked-ads`, sellerAToken).expect(404);
  });

  it('4. returns empty campaigns array when sellpage has no campaigns', async () => {
    const res = await get(
      `/api/sellpages/${emptySellpageId}/linked-ads`,
      sellerAToken,
    ).expect(200);

    expect(res.body).toEqual({ campaigns: [] });
  });

  it('5. returns full chain shape with correct field names', async () => {
    const res = await get(
      `/api/sellpages/${sellpageId}/linked-ads`,
      sellerAToken,
    ).expect(200);

    expect(res.body).toHaveProperty('campaigns');
    expect(Array.isArray(res.body.campaigns)).toBe(true);

    const campaign = res.body.campaigns.find((c: { id: string }) => c.id === campaign1Id);
    expect(campaign).toBeDefined();
    expect(campaign).toMatchObject({ id: campaign1Id, name: 'Campaign One', status: 'ACTIVE' });
    expect(Array.isArray(campaign.adsets)).toBe(true);

    const adset = campaign.adsets.find((a: { id: string }) => a.id === adset1Id);
    expect(adset).toBeDefined();
    expect(adset).toMatchObject({ id: adset1Id, name: 'Adset One', status: 'ACTIVE' });
    expect(Array.isArray(adset.ads)).toBe(true);

    const ad = adset.ads.find((a: { id: string }) => a.id === ad1Id);
    expect(ad).toBeDefined();
    expect(ad).toMatchObject({ id: ad1Id, name: 'Ad One', status: 'ACTIVE' });

    // adPost present
    expect(ad.adPost).not.toBeNull();
    expect(ad.adPost).toMatchObject({
      externalPostId: 'ext-post-b6-001',
      pageId: fbPageId,
    });
    expect(ad.adPost.createdAt).toBeDefined();
  });

  it('6. adPost is null when ad has no AdPost', async () => {
    const res = await get(
      `/api/sellpages/${sellpageId}/linked-ads`,
      sellerAToken,
    ).expect(200);

    const campaign = res.body.campaigns.find((c: { id: string }) => c.id === campaign1Id);
    const adset = campaign.adsets.find((a: { id: string }) => a.id === adset1Id);
    const ad = adset.ads.find((a: { id: string }) => a.id === ad2Id);

    expect(ad).toBeDefined();
    expect(ad.adPost).toBeNull();
  });

  it('7. campaigns are ordered by createdAt desc (Campaign Two before Campaign One)', async () => {
    const res = await get(
      `/api/sellpages/${sellpageId}/linked-ads`,
      sellerAToken,
    ).expect(200);

    const ids = res.body.campaigns.map((c: { id: string }) => c.id);
    // campaign2 was created after campaign1 → should appear first in desc order
    const idx1 = ids.indexOf(campaign1Id);
    const idx2 = ids.indexOf(campaign2Id);
    expect(idx2).toBeLessThan(idx1);
  });

  it('8. both adsets under Campaign One are returned', async () => {
    const res = await get(
      `/api/sellpages/${sellpageId}/linked-ads`,
      sellerAToken,
    ).expect(200);

    const campaign = res.body.campaigns.find((c: { id: string }) => c.id === campaign1Id);
    const adsetIds = campaign.adsets.map((a: { id: string }) => a.id);
    expect(adsetIds).toContain(adset1Id);
    expect(adsetIds).toContain(adset2Id);
  });

  it('9. adPost.externalPostId is correctly returned (not leaking extra DB fields)', async () => {
    const res = await get(
      `/api/sellpages/${sellpageId}/linked-ads`,
      sellerAToken,
    ).expect(200);

    const campaign = res.body.campaigns.find((c: { id: string }) => c.id === campaign1Id);
    const adset = campaign.adsets.find((a: { id: string }) => a.id === adset1Id);
    const ad = adset.ads.find((a: { id: string }) => a.id === ad1Id);

    // Only these 3 fields should be present on adPost
    const adPostKeys = Object.keys(ad.adPost);
    expect(adPostKeys).toEqual(
      expect.arrayContaining(['externalPostId', 'pageId', 'createdAt']),
    );
    // Should NOT contain internal fields
    expect(adPostKeys).not.toContain('sellerId');
    expect(adPostKeys).not.toContain('adId');
    expect(adPostKeys).not.toContain('postSource');
  });

  it('10. tenant isolation — Seller B cannot access Seller A\'s sellpage', async () => {
    await get(
      `/api/sellpages/${sellpageId}/linked-ads`,
      sellerBToken,
    ).expect(404);
  });
});
