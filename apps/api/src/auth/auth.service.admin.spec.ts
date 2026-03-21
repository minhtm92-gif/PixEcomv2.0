/**
 * auth.service.admin.spec.ts
 *
 * Unit tests for BUG-13 fix: Superadmin login without a seller account.
 *
 * Covers:
 *  - Admin login (no sellerUser) → 200, seller: null, sellerId='ADMIN' in token
 *  - Admin login (with sellerUser) → 200, seller data populated
 *  - Seller endpoint rejects superadmin → 401
 *  - Admin endpoint rejects regular seller → 401
 *  - getMe with sellerId='ADMIN' → sellerId: null
 *  - getMe with real sellerId → sellerId exposed
 *  - refresh() with superadmin, no sellerUser → succeeds
 *  - refresh() with regular user, no sellerUser → 401
 */

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ADMIN_USER_ID = 'admin-user-uuid';
const SELLER_USER_ID = 'seller-user-uuid';
const SELLER_ID = 'seller-uuid';

const adminUser = {
  id: ADMIN_USER_ID,
  email: 'admin@pixecom.com',
  displayName: 'PixEcom Admin',
  passwordHash: '', // filled in beforeAll
  isActive: true,
  isSuperadmin: true,
};

const sellerUser = {
  id: SELLER_USER_ID,
  email: 'seller@pixecom.com',
  displayName: 'Test Seller',
  passwordHash: '',
  isActive: true,
  isSuperadmin: false,
};

const sellerRecord = {
  sellerId: SELLER_ID,
  role: 'OWNER',
  seller: { id: SELLER_ID, name: 'Test Shop', slug: 'test-shop' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePrismaMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    sellerUser: {
      findFirst: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function makeConfigMock() {
  return {
    get: (key: string, def?: string) => {
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'REFRESH_TOKEN_PEPPER') return 'test-pepper';
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'COOKIE_SECURE') return 'false';
      if (key === 'COOKIE_DOMAIN') return '';
      return def ?? undefined;
    },
  };
}

function makeJwtMock() {
  return {
    sign: jest.fn().mockReturnValue('mock.access.token'),
  };
}

async function makeModule(prismaMock: unknown) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: JwtService, useValue: makeJwtMock() },
      { provide: ConfigService, useValue: makeConfigMock() },
    ],
  }).compile();
  return module.get<AuthService>(AuthService);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  adminUser.passwordHash = await bcrypt.hash('admin123456', 10);
  sellerUser.passwordHash = await bcrypt.hash('seller123456', 10);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthService — admin login (BUG-13)', () => {
  // ── Test 1: Admin without sellerUser → seller: null ──────────────────────

  it('1. admin-login: superadmin without sellerUser returns seller: null', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue(null); // no sellerUser
    const service = await makeModule(prisma);

    const result = await service.login(
      { email: 'admin@pixecom.com', password: 'admin123456' },
      'admin',
    );

    expect(result.seller).toBeNull();
    expect(result.accessToken).toBe('mock.access.token');
    expect(result.user.email).toBe('admin@pixecom.com');
  });

  // ── Test 2: Admin with sellerUser → seller populated ─────────────────────

  it('2. admin-login: superadmin WITH sellerUser returns seller data', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue(sellerRecord);
    const service = await makeModule(prisma);

    const result = await service.login(
      { email: 'admin@pixecom.com', password: 'admin123456' },
      'admin',
    );

    expect(result.seller).not.toBeNull();
    expect(result.seller!.id).toBe(SELLER_ID);
    expect(result.seller!.name).toBe('Test Shop');
    expect(result.seller!.slug).toBe('test-shop');
  });

  // ── Test 3: Seller endpoint rejects superadmin → 401 ─────────────────────

  it('3. seller login: superadmin is rejected with 401', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
    const service = await makeModule(prisma);

    await expect(
      service.login({ email: 'admin@pixecom.com', password: 'admin123456' }, 'seller'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Test 4: Admin endpoint rejects regular seller → 401 ──────────────────

  it('4. admin login: regular seller account is rejected with 401', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(sellerUser);
    const service = await makeModule(prisma);

    await expect(
      service.login({ email: 'seller@pixecom.com', password: 'seller123456' }, 'admin'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Test 5: Wrong password → 401 ─────────────────────────────────────────

  it('5. admin login: wrong password returns 401', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
    const service = await makeModule(prisma);

    await expect(
      service.login({ email: 'admin@pixecom.com', password: 'wrongpass' }, 'admin'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Test 6: Seller login still works for non-admin ────────────────────────

  it('6. seller login: regular seller with valid sellerUser returns seller data', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(sellerUser);
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue(sellerRecord);
    const service = await makeModule(prisma);

    const result = await service.login(
      { email: 'seller@pixecom.com', password: 'seller123456' },
      'seller',
    );

    expect(result.seller).not.toBeNull();
    expect(result.seller!.id).toBe(SELLER_ID);
  });

  // ── Test 7: Seller login fails if no sellerUser ────────────────────────────

  it('7. seller login: no sellerUser throws 401', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(sellerUser);
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue(null);
    const service = await makeModule(prisma);

    await expect(
      service.login({ email: 'seller@pixecom.com', password: 'seller123456' }, 'seller'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── getMe with ADMIN sellerId ────────────────────────────────────────────────

describe('AuthService.getMe — ADMIN sellerId (BUG-13)', () => {
  // ── Test 8: getMe with sellerId='ADMIN' → sellerId: null ─────────────────

  it('8. getMe: sellerId=ADMIN returns sellerId: null, no DB query for sellerUser', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: ADMIN_USER_ID,
      email: 'admin@pixecom.com',
      displayName: 'PixEcom Admin',
      avatarUrl: null,
      isActive: true,
      isSuperadmin: true,
    });
    const service = await makeModule(prisma);

    const result = await service.getMe(ADMIN_USER_ID, 'ADMIN');

    expect(result.sellerId).toBeNull();
    expect(result.role).toBeNull();
    expect(result.isSuperadmin).toBe(true);
    // sellerUser.findFirst must NOT have been called
    expect(prisma.sellerUser.findFirst).not.toHaveBeenCalled();
  });

  // ── Test 9: getMe with real sellerId → sellerId exposed ──────────────────

  it('9. getMe: with real sellerId returns sellerId and role from sellerUser', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: SELLER_USER_ID,
      email: 'seller@pixecom.com',
      displayName: 'Test Seller',
      avatarUrl: null,
      isActive: true,
      isSuperadmin: false,
    });
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue({ role: 'OWNER' });
    const service = await makeModule(prisma);

    const result = await service.getMe(SELLER_USER_ID, SELLER_ID);

    expect(result.sellerId).toBe(SELLER_ID);
    expect(result.role).toBe('OWNER');
    expect(result.isSuperadmin).toBe(false);
  });

  // ── Test 10: getMe with inactive user → 401 ───────────────────────────────

  it('10. getMe: inactive user throws 401', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: ADMIN_USER_ID,
      email: 'admin@pixecom.com',
      displayName: 'PixEcom Admin',
      avatarUrl: null,
      isActive: false,
      isSuperadmin: true,
    });
    const service = await makeModule(prisma);

    await expect(service.getMe(ADMIN_USER_ID, 'ADMIN')).rejects.toThrow(UnauthorizedException);
  });
});

// ─── refresh() with admin user ────────────────────────────────────────────────

describe('AuthService.refresh — admin user (BUG-13)', () => {
  const REFRESH_HASH = 'mocked-hash-hex';
  const STORED_TOKEN = {
    id: 'stored-token-id',
    userId: ADMIN_USER_ID,
    token: REFRESH_HASH,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    user: { id: ADMIN_USER_ID, isActive: true },
  };

  // ── Test 11: refresh for admin without sellerUser succeeds ────────────────

  it('11. refresh: superadmin without sellerUser succeeds (ADMIN token)', async () => {
    const prisma = makePrismaMock();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(STORED_TOKEN);
    // No sellerUser
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ isSuperadmin: true });
    const service = await makeModule(prisma);

    const result = await service.refresh('any-raw-token');

    expect(result.accessToken).toBe('mock.access.token');
  });

  // ── Test 12: refresh for regular user without sellerUser → 401 ────────────

  it('12. refresh: non-admin user without sellerUser throws 401', async () => {
    const prisma = makePrismaMock();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      ...STORED_TOKEN,
      userId: SELLER_USER_ID,
      user: { id: SELLER_USER_ID, isActive: true },
    });
    (prisma.sellerUser.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ isSuperadmin: false });
    const service = await makeModule(prisma);

    await expect(service.refresh('any-raw-token')).rejects.toThrow(UnauthorizedException);
  });

  // ── Test 13: refresh with expired token → 401 ─────────────────────────────

  it('13. refresh: expired token throws 401', async () => {
    const prisma = makePrismaMock();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      ...STORED_TOKEN,
      expiresAt: new Date(Date.now() - 1000), // expired
    });
    const service = await makeModule(prisma);

    await expect(service.refresh('any-raw-token')).rejects.toThrow(UnauthorizedException);
  });

  // ── Test 14: refresh with unknown token → 401 ─────────────────────────────

  it('14. refresh: unknown token throws 401', async () => {
    const prisma = makePrismaMock();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
    const service = await makeModule(prisma);

    await expect(service.refresh('unknown-raw-token')).rejects.toThrow(UnauthorizedException);
  });
});
