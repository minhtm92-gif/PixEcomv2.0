import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Auth E2E Tests — Milestone 2.1.2
 *
 * Requires a live PostgreSQL database (pixecom-postgres on port 5434).
 * Set DATABASE_URL in .env before running.
 *
 * Run: pnpm --filter @pixecom/api test:e2e
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;

  // Unique email per test run to avoid conflicts across runs
  const uniqueEmail = () =>
    `test-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

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
  // Test 1: Register → Me
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 1: Register then GET /me', () => {
    it('should register a new seller and return valid access token', async () => {
      const email = uniqueEmail();
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          displayName: 'E2E Test Seller',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(email);
      expect(res.body.seller).toHaveProperty('id');
      expect(res.body.seller).toHaveProperty('slug');
      // Cookie should be set
      expect(res.headers['set-cookie']).toBeDefined();
      expect(
        (res.headers['set-cookie'] as unknown as string[]).some((c: string) =>
          c.startsWith('refresh_token='),
        ),
      ).toBe(true);
    });

    it('should allow GET /me with a valid access token', async () => {
      const email = uniqueEmail();
      const registerRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          displayName: 'Me Test Seller',
        })
        .expect(201);

      const accessToken = registerRes.body.accessToken as string;

      const meRes = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meRes.body.email).toBe(email);
      expect(meRes.body).toHaveProperty('sellerId');
      expect(meRes.body).toHaveProperty('role');
      expect(meRes.body.role).toBe('OWNER');
    });

    it('should reject GET /me with no token (401)', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Login → Refresh rotates token (old token rejected)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 2: Login → Refresh rotates token', () => {
    it('should rotate refresh token on refresh and reject old token', async () => {
      const email = uniqueEmail();
      const password = 'Password123!';

      // Register first
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password, displayName: 'Rotation Tester' })
        .expect(201);

      // Login to get cookie T1
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      const cookiesT1 = loginRes.headers['set-cookie'] as unknown as string[];
      expect(cookiesT1).toBeDefined();
      const cookieT1 = cookiesT1.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(cookieT1).toBeDefined();

      // Use T1 to refresh → get T2
      const refreshRes1 = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookieT1!)
        .expect(200);

      expect(refreshRes1.body).toHaveProperty('accessToken');
      const cookiesT2 = refreshRes1.headers['set-cookie'] as unknown as string[];
      const cookieT2 = cookiesT2.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(cookieT2).toBeDefined();

      // Use OLD T1 again → should be rejected (401)
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookieT1!)
        .expect(401);

      // T2 should still be valid
      const refreshRes2 = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookieT2!)
        .expect(200);

      expect(refreshRes2.body).toHaveProperty('accessToken');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Logout → Refresh rejected
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 3: Logout → Refresh rejected', () => {
    it('should invalidate refresh token on logout', async () => {
      const email = uniqueEmail();
      const password = 'Password123!';

      // Register + login
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password, displayName: 'Logout Tester' })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const cookie = cookies.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(cookie).toBeDefined();

      // Logout
      const logoutRes = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie!)
        .expect(200);

      expect(logoutRes.body.message).toBe('Logged out');

      // Try refresh after logout → 401
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie!)
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Admin-login endpoint + login type separation (Task A3)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 4: POST /auth/admin-login — login type separation', () => {
    /**
     * Because E2E tests run against a live DB and register() never creates
     * superadmin accounts (correct by design), these tests verify the
     * non-superadmin side of the separation:
     *
     *   - Seller account → /auth/login      ✅ 200
     *   - Seller account → /auth/admin-login ❌ 401 "Not an admin account"
     *
     * The superadmin → /auth/login rejection path requires a seeded superadmin
     * account and is tested via the staging seed flow.
     */

    it('POST /auth/admin-login rejects a regular seller account (401)', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'Password123!', displayName: 'Admin Type Test' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/auth/admin-login')
        .send({ email, password: 'Password123!' })
        .expect(401);

      expect(res.body.message).toBe('Not an admin account');
    });

    it('POST /auth/admin-login returns 400 on missing email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin-login')
        .send({ password: 'Password123!' })
        .expect(400);
    });

    it('POST /auth/admin-login returns 400 on missing password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin-login')
        .send({ email: 'admin@example.com' })
        .expect(400);
    });

    it('POST /auth/admin-login returns 401 on wrong password', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'Password123!', displayName: 'WrongPwd Test' })
        .expect(201);

      // Wrong password — hits the bcrypt check before the type check
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin-login')
        .send({ email, password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('POST /auth/admin-login returns 401 on unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin-login')
        .send({ email: 'nobody@pixecom-e2e-ghost.io', password: 'Password123!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('POST /auth/login returns 401 on unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@pixecom-e2e-ghost2.io', password: 'Password123!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('GET /auth/me includes isSuperadmin field (false for new sellers)', async () => {
      const email = uniqueEmail();
      const registerRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'Password123!', displayName: 'Me Test isSuperadmin' })
        .expect(201);

      const meRes = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registerRes.body.accessToken as string}`)
        .expect(200);

      expect(meRes.body).toHaveProperty('isSuperadmin');
      expect(meRes.body.isSuperadmin).toBe(false);
    });

    it('POST /auth/login refresh flow still works normally', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'Password123!', displayName: 'Refresh After Login' })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Password123!' })
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const cookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      expect(cookie).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie!)
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional: Input validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Input validation', () => {
    it('should reject register with short password (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'valid@test.com', password: 'short', displayName: 'X' })
        .expect(400);
    });

    it('should reject register with invalid email (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          displayName: 'X',
        })
        .expect(400);
    });

    it('should reject duplicate email registration (409)', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'Password123!', displayName: 'First' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'Password123!', displayName: 'Second' })
        .expect(409);
    });

    it('should return 501 for Google SSO stub', async () => {
      await request(app.getHttpServer()).post('/api/auth/google').expect(501);
    });
  });
});
