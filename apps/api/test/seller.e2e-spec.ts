import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Seller Module E2E Tests — Milestone 2.1.3
 *
 * Requires a live PostgreSQL database (pixecom-postgres on port 5434).
 * Run: pnpm --filter @pixecom/api test:e2e
 *
 * Isolation guarantee: sellerId is always sourced from JWT, not route params.
 * These tests verify that each seller only sees and modifies their own data.
 */
describe('Seller Module (e2e)', () => {
  let app: INestApplication;

  const uniqueEmail = () =>
    `seller-e2e-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  /** Register a seller and return accessToken + sellerId */
  const registerSeller = async (displayName: string) => {
    const email = uniqueEmail();
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName })
      .expect(201);

    return {
      accessToken: res.body.accessToken as string,
      sellerId: res.body.seller.id as string,
      email,
      seller: res.body.seller as { id: string; name: string; slug: string },
    };
  };

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
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: GET /sellers/me — returns own profile
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/sellers/me', () => {
    it('should return the authenticated seller profile', async () => {
      const { accessToken, sellerId } = await registerSeller('ProfileSeller');

      const res = await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(sellerId);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('slug');
      expect(res.body).toHaveProperty('isActive');
      expect(res.body.isActive).toBe(true);
    });

    it('should return 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/sellers/me').expect(401);
    });

    it('should return 401 with an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', 'Bearer this.is.invalid')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: PATCH /sellers/me — updates profile
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /api/sellers/me', () => {
    it('should update the seller name', async () => {
      const { accessToken, sellerId } = await registerSeller('OriginalName');

      const res = await request(app.getHttpServer())
        .patch('/api/sellers/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'UpdatedName' })
        .expect(200);

      expect(res.body.id).toBe(sellerId);
      expect(res.body.name).toBe('UpdatedName');
    });

    it('should persist the updated name on subsequent GET', async () => {
      const { accessToken } = await registerSeller('BeforeUpdate');

      await request(app.getHttpServer())
        .patch('/api/sellers/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'AfterUpdate' })
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getRes.body.name).toBe('AfterUpdate');
    });

    it('should reject a PATCH with no fields (400)', async () => {
      const { accessToken } = await registerSeller('NoPatchFields');

      await request(app.getHttpServer())
        .patch('/api/sellers/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should reject a PATCH with invalid logoUrl (400)', async () => {
      const { accessToken } = await registerSeller('BadLogoSeller');

      await request(app.getHttpServer())
        .patch('/api/sellers/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ logoUrl: 'not-a-url' })
        .expect(400);
    });

    it('should return 401 without a token', async () => {
      await request(app.getHttpServer())
        .patch('/api/sellers/me')
        .send({ name: 'Sneaky' })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: GET /sellers/me/settings — returns own settings
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/sellers/me/settings', () => {
    it('should return seller settings with defaults', async () => {
      const { accessToken, sellerId } = await registerSeller('SettingsSeller');

      const res = await request(app.getHttpServer())
        .get('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.sellerId).toBe(sellerId);
      expect(res.body.defaultCurrency).toBe('USD');
      expect(res.body.timezone).toBe('UTC');
    });

    it('should return 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/api/sellers/me/settings')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: PATCH /sellers/me/settings — updates settings
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /api/sellers/me/settings', () => {
    it('should update brandName and defaultCurrency', async () => {
      const { accessToken, sellerId } =
        await registerSeller('SettingsUpdater');

      const res = await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ brandName: 'My Brand', defaultCurrency: 'EUR' })
        .expect(200);

      expect(res.body.sellerId).toBe(sellerId);
      expect(res.body.brandName).toBe('My Brand');
      expect(res.body.defaultCurrency).toBe('EUR');
    });

    it('should persist updated settings on subsequent GET', async () => {
      const { accessToken } = await registerSeller('PersistSettings');

      await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ timezone: 'Asia/Bangkok', supportEmail: 'support@shop.com' })
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getRes.body.timezone).toBe('Asia/Bangkok');
      expect(getRes.body.supportEmail).toBe('support@shop.com');
    });

    it('should reject PATCH with no fields (400)', async () => {
      const { accessToken } = await registerSeller('EmptySettingsPatch');

      await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should reject invalid currency length (400)', async () => {
      const { accessToken } = await registerSeller('BadCurrencySeller');

      await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ defaultCurrency: 'TOOLONG' })
        .expect(400);
    });

    it('should reject invalid supportEmail (400)', async () => {
      const { accessToken } = await registerSeller('BadEmailSeller');

      await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ supportEmail: 'not-an-email' })
        .expect(400);
    });

    it('should return 401 without a token', async () => {
      await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .send({ brandName: 'Hack' })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Seller isolation — A cannot read B's data
  // ─────────────────────────────────────────────────────────────────────────

  describe('Seller isolation', () => {
    it('each seller only sees their own profile via /sellers/me', async () => {
      const sellerA = await registerSeller('IsolationSellerA');
      const sellerB = await registerSeller('IsolationSellerB');

      // A can read their own data
      const resA = await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', `Bearer ${sellerA.accessToken}`)
        .expect(200);

      // B can read their own data
      const resB = await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', `Bearer ${sellerB.accessToken}`)
        .expect(200);

      // Each response reflects their own sellerId
      expect(resA.body.id).toBe(sellerA.sellerId);
      expect(resB.body.id).toBe(sellerB.sellerId);

      // They are different sellers
      expect(resA.body.id).not.toBe(resB.body.id);
    });

    it('each seller only sees their own settings via /sellers/me/settings', async () => {
      const sellerA = await registerSeller('IsoSettingsA');
      const sellerB = await registerSeller('IsoSettingsB');

      // Update A's settings
      await request(app.getHttpServer())
        .patch('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${sellerA.accessToken}`)
        .send({ brandName: 'Brand A Only' })
        .expect(200);

      // B reads their own settings — must NOT see A's brand
      const resB = await request(app.getHttpServer())
        .get('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${sellerB.accessToken}`)
        .expect(200);

      expect(resB.body.brandName).toBeNull();
      expect(resB.body.sellerId).toBe(sellerB.sellerId);

      // A reads their own settings — sees their brand
      const resA = await request(app.getHttpServer())
        .get('/api/sellers/me/settings')
        .set('Authorization', `Bearer ${sellerA.accessToken}`)
        .expect(200);

      expect(resA.body.brandName).toBe('Brand A Only');
    });

    it('seller A PATCH does not affect seller B data', async () => {
      const sellerA = await registerSeller('PatchIsoA');
      const sellerB = await registerSeller('PatchIsoB');

      const originalBName = sellerB.seller.name;

      // A tries to update their own name
      await request(app.getHttpServer())
        .patch('/api/sellers/me')
        .set('Authorization', `Bearer ${sellerA.accessToken}`)
        .send({ name: 'A Changed Name' })
        .expect(200);

      // B's name must be unchanged
      const resB = await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', `Bearer ${sellerB.accessToken}`)
        .expect(200);

      expect(resB.body.name).toBe(originalBName);
    });
  });
});
