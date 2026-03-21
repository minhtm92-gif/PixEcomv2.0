# BUG-13 — Superadmin Login Fix + Admin Seed Working Log

**Date:** 2026-02-22
**Branch:** `feature/2.4.2-alpha-ads-seed-v1`
**Commit:** `d621500`
**Author:** Backend Agent (Claude Sonnet 4.6)

---

## Problem

`POST /api/auth/admin-login` with a pure superadmin account (no `SellerUser` row) always
returned **401 "No active seller account found"**.

**Root cause in `apps/api/src/auth/auth.service.ts` line 140-148:**
After the `loginType` guard at line 138, the code unconditionally queried `SellerUser` and
threw `UnauthorizedException` when none was found — even for admin logins where a seller
context is optional.

Secondary issues discovered:
- `refresh()` also required a `SellerUser`, so token refresh for a pure admin would fail.
- `getMe()` would attempt to query `SellerUser` using the literal string `'ADMIN'` as
  `sellerId`, returning no role instead of the expected `sellerId: null` response.
- `AuthPayload.seller` type was `{ id; name; slug }` (non-nullable) — compile-time mismatch.

---

## Task 1 — auth.service.ts Changes

### 1a. `AuthPayload` type — allow `seller: null`

**Before:**
```typescript
seller: {
  id: string;
  name: string;
  slug: string;
};
```

**After:**
```typescript
seller: {
  id: string;
  name: string;
  slug: string;
} | null;
```

---

### 1b. `login()` — admin branch added before seller branch

**Before (lines 140-165):**
```typescript
const sellerUser = await this.prisma.sellerUser.findFirst({ ... });
if (!sellerUser) {
  throw new UnauthorizedException('No active seller account found');
}
// ... tokens + return seller {...}
```

**After:**
```typescript
// Admin login: seller context is optional
if (loginType === 'admin') {
  const sellerUser = await this.prisma.sellerUser.findFirst({
    where: { userId: user.id, isActive: true },
    include: { seller: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const tokens = await this.generateTokens(
    user.id,
    sellerUser?.sellerId ?? 'ADMIN',
    sellerUser?.role ?? 'ADMIN',
    true,
  );

  return {
    ...tokens,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    seller: sellerUser
      ? { id: sellerUser.seller.id, name: sellerUser.seller.name, slug: sellerUser.seller.slug }
      : null,
  };
}

// Seller login: seller context is REQUIRED (unchanged below)
const sellerUser = await this.prisma.sellerUser.findFirst({ ... });
if (!sellerUser) { throw ...; }
```

---

### 1c. `refresh()` — handle admin users without sellerUser

**Before:**
```typescript
const sellerUser = await this.prisma.sellerUser.findFirst({ ... });
if (!sellerUser) { throw new UnauthorizedException('No active seller account found'); }
const user = await this.prisma.user.findUnique({ ... });
return this.generateTokens(stored.userId, sellerUser.sellerId, sellerUser.role, ...);
```

**After:**
```typescript
const [sellerUser, user] = await Promise.all([
  this.prisma.sellerUser.findFirst({ ... }),
  this.prisma.user.findUnique({ where: { id: stored.userId }, select: { isSuperadmin: true } }),
]);

// Superadmin may have no sellerUser — allowed
if (!sellerUser && !user?.isSuperadmin) {
  throw new UnauthorizedException('No active seller account found');
}

return this.generateTokens(
  stored.userId,
  sellerUser?.sellerId ?? 'ADMIN',
  sellerUser?.role ?? 'ADMIN',
  user?.isSuperadmin ?? false,
);
```

---

### 1d. `getMe()` — handle sellerId='ADMIN'

**Before:**
```typescript
// always queried sellerUser with whatever sellerId came from JWT
const sellerUser = await this.prisma.sellerUser.findFirst({
  where: { userId, sellerId, isActive: true },
  select: { role: true },
});
return { ..., sellerId, role: sellerUser?.role ?? null, ... };
```

**After:**
```typescript
// Admin JWT has sellerId='ADMIN' — no real seller context
if (sellerId === 'ADMIN') {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    sellerId: null,
    role: null,
    isSuperadmin: user.isSuperadmin,
  };
}
// ... existing sellerUser query for real sellers
```

---

## Task 2 — Seed Admin Account

**File:** `packages/database/prisma/seed.ts`

Added at end of `main()` before the summary logging block:

```typescript
// bcrypt hash of "admin123456" at cost 10 — pre-computed for idempotency
await prisma.user.upsert({
  where: { email: 'admin@pixecom.com' },
  update: { isSuperadmin: true },
  create: {
    email: 'admin@pixecom.com',
    passwordHash: '$2b$10$cUujddZFj9TelHT.IQTGgeHpZx.Tp59yCx0dR82aADolWZz4gq6n.',
    displayName: 'PixEcom Admin',
    isSuperadmin: true,
  },
});
console.log('Superadmin seeded: admin@pixecom.com / admin123456');
```

**Credentials:** `admin@pixecom.com` / `admin123456`

No new schema column. No bcrypt import needed — hash pre-computed consistent with the
existing `seed-seller@pixecom.io` approach in the same file.

---

## Task 3 — seed-alpha.ts Update

**File:** `packages/database/prisma/seed-alpha.ts`

**Before:**
```typescript
const targetEmail = process.env.ALPHA_SEED_EMAIL || 'admin@pixelxlab.com';
// ...
console.error('❌ User admin@pixelxlab.com not found or has no seller. Register first.');
```

**After:**
```typescript
const targetEmail = process.env.ALPHA_SEED_EMAIL || 'admin@pixecom.com';
// ...
console.error(`❌ User ${targetEmail} not found or has no seller. Register first or set ALPHA_SEED_EMAIL env var.`);
```

---

## E2E Tests

**File:** `apps/api/src/auth/auth.service.admin.spec.ts` (14 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | admin-login: no sellerUser → `seller: null` | BUG-13 happy path |
| 2 | admin-login: with sellerUser → seller data populated | Admin with seller access |
| 3 | seller endpoint: superadmin rejected → 401 | Cross-portal separation |
| 4 | admin endpoint: regular seller rejected → 401 | Cross-portal separation |
| 5 | admin-login: wrong password → 401 | Auth integrity |
| 6 | seller login: valid sellerUser → seller data | Backward compat |
| 7 | seller login: no sellerUser → 401 | Backward compat |
| 8 | getMe: sellerId=ADMIN → sellerId: null | Admin me endpoint |
| 9 | getMe: real sellerId → sellerId + role exposed | Seller me endpoint |
| 10 | getMe: inactive user → 401 | Auth integrity |
| 11 | refresh: superadmin no sellerUser → succeeds | Admin refresh |
| 12 | refresh: non-admin no sellerUser → 401 | Seller isolation |
| 13 | refresh: expired token → 401 | Token expiry |
| 14 | refresh: unknown token → 401 | Token validity |

---

## Verification

### TypeScript check
```
npx tsc --noEmit  →  no output, exit 0 ✅
```

### Tests
```
npm test -- --passWithNoTests

Test Suites: 4 passed, 4 total
Tests:       40 passed, 40 total  ✅
(26 existing + 14 new)
```

### Expected curl behaviour after seeding

```bash
# Admin login (no seller) → 200, seller: null
curl -X POST http://localhost:3000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pixecom.com","password":"admin123456"}'
# → { accessToken, user: { id, email, displayName }, seller: null }

# Seller login with admin email → 401
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pixecom.com","password":"admin123456"}'
# → 401 "Admin accounts must login at /admin"

# GET /auth/me with admin token → sellerId: null, isSuperadmin: true
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <adminAccessToken>"
# → { id, email, displayName, avatarUrl, sellerId: null, role: null, isSuperadmin: true }
```

---

## Impact Summary

| Scope | Effect |
|-------|--------|
| `AuthService.login()` | Admin branch added, seller branch unchanged |
| `AuthService.refresh()` | Superadmins without SellerUser no longer blocked |
| `AuthService.getMe()` | sellerId='ADMIN' returns sellerId: null |
| `AuthPayload.seller` | Type widened to `{...} | null` |
| Seller login flow | No change — backward compatible |
| seed.ts | admin@pixecom.com upserted with isSuperadmin: true |
| seed-alpha.ts | Default email updated to admin@pixecom.com |
