# TASK-A3 Backend Working Log — Separate Admin/Seller Login + SuperadminGuard

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent                                  |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `cb44873`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Implemented portal login separation for PixEcom v2. Before this task, both superadmin and seller accounts could log in through the same `/auth/login` endpoint. This created a security risk: an admin credential leak would grant access to the seller portal, and vice versa.

After this task:

- `POST /api/auth/login` → **seller-only**. Superadmin accounts are blocked with `401 "Admin accounts must login at /admin"`.
- `POST /api/auth/admin-login` → **superadmin-only**. Regular seller accounts are blocked with `401 "Not an admin account"`.
- `GET /api/auth/me` → now returns `isSuperadmin: boolean` so the frontend can render the correct portal UI.
- `SuperadminGuard` → reusable NestJS guard for protecting future admin-only endpoints.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/auth/auth.service.ts` | Modified | `login()` + `getMe()` changes |
| `apps/api/src/auth/auth.controller.ts` | Modified | Added `admin-login` endpoint |
| `apps/api/src/auth/guards/superadmin.guard.ts` | **Created** | New SuperadminGuard |
| `apps/api/test/auth.e2e-spec.ts` | Modified | 8 new E2E test cases (Test 4) |

---

## Detailed Changes

### 1. `auth.service.ts` — `getMe()`

**Before:**
```ts
select: { id, email, displayName, avatarUrl, isActive }
return { id, email, displayName, avatarUrl, sellerId, role }
```

**After:**
```ts
select: { id, email, displayName, avatarUrl, isActive, isSuperadmin }
return { id, email, displayName, avatarUrl, sellerId, role, isSuperadmin }
```

**Reason:** The frontend needs to know if the logged-in user is superadmin to render the correct navigation and guard admin-only routes. The JWT already contains `isSuperadmin` (confirmed in `jwt.strategy.ts`), but `/me` is the canonical identity endpoint; clients that miss the JWT claim or rotate tokens need a reliable source of truth.

---

### 2. `auth.service.ts` — `login()`

**Signature change:**
```ts
// Before
async login(dto: LoginDto): Promise<AuthPayload>

// After
async login(dto: LoginDto, loginType: 'seller' | 'admin' = 'seller'): Promise<AuthPayload>
```

**Added after password verification:**
```ts
if (loginType === 'seller' && user.isSuperadmin) {
  throw new UnauthorizedException('Admin accounts must login at /admin');
}
if (loginType === 'admin' && !user.isSuperadmin) {
  throw new UnauthorizedException('Not an admin account');
}
```

**Reason:** The `LoginDto` is intentionally not changed — it's a stable public contract. The `loginType` is supplied by the controller (not the client), so it cannot be spoofed by the caller. This keeps the DTO clean while giving the service full control over routing logic.

**Default value** `'seller'` ensures backward compatibility if `login()` is called anywhere else in the codebase without the second argument.

**Check order matters:** The type check runs _after_ password verification. This prevents user enumeration — an attacker querying a valid email with wrong password always gets `"Invalid credentials"`, not `"Not an admin account"`. A valid email + correct password + wrong portal returns the portal-specific error.

---

### 3. `auth.guards/superadmin.guard.ts` (NEW)

```ts
@Injectable()
export class SuperadminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);  // JWT validation (throws 401)
    const user = request.user as AuthUser;
    if (!user?.isSuperadmin) {
      throw new ForbiddenException('Superadmin access required');  // 403
    }
    return true;
  }
}
```

**Design decisions:**
- Extends `JwtAuthGuard` (not `CanActivate` directly) so we inherit all JWT validation, including the live `isActive` DB check in `JwtStrategy.validate()`.
- Returns `403 ForbiddenException` (not 401) because the user _is_ authenticated — they just lack the required role. This follows HTTP semantics correctly.
- `isSuperadmin` is re-read from `req.user` which is populated by `JwtStrategy.validate()` with a live DB query — it's not taken from the JWT payload directly, preventing stale-token privilege escalation.
- No module registration needed — it's a provider-level class, injectable wherever needed via `@UseGuards(SuperadminGuard)`.

---

### 4. `auth.controller.ts` — `POST /auth/admin-login` (NEW)

```ts
@Post('admin-login')
@HttpCode(HttpStatus.OK)
async adminLogin(@Body() dto: LoginDto, @Res({ passthrough: false }) res: Response) {
  const result = await this.authService.login(dto, 'admin');
  this.authService.setRefreshCookie(res, result.rawRefreshToken);
  return res.status(HttpStatus.OK).json({
    accessToken: result.accessToken,
    user: result.user,
    seller: result.seller,
  });
}
```

**Existing `login()` updated:**
```ts
// Before
const result = await this.authService.login(dto);

// After
const result = await this.authService.login(dto, 'seller');
```

**Reason:** Both endpoints share the same DTO, cookie flow, and response shape. No duplication of auth logic — the `loginType` param handles the branching inside the service. The cookie path `path: '/api/auth/refresh'` is shared, meaning tokens issued from either portal can be refreshed via the same `/refresh` endpoint — this is intentional since token rotation is portal-agnostic.

---

## Refresh Flow — No Regression

The refresh flow is **unchanged**:
- `POST /auth/refresh` reads the `refresh_token` cookie, validates + rotates it.
- It does NOT re-check `loginType` — a token from `/admin-login` refreshes identically to one from `/login`.
- `isSuperadmin` in the refreshed JWT comes from a live DB query in `refresh()` → `generateTokens()`.
- The `SuperadminGuard` reads `isSuperadmin` from `req.user` (populated by `JwtStrategy.validate()` with a live DB check), so a superadmin whose flag is revoked mid-session will be blocked on next request.

---

## E2E Test Coverage (Test 4 — 8 cases)

| Test | Expected | Reason |
|------|----------|--------|
| `/admin-login` with regular seller credentials | `401 "Not an admin account"` | Type separation working |
| `/admin-login` missing email | `400` | Validation pipe |
| `/admin-login` missing password | `400` | Validation pipe |
| `/admin-login` wrong password | `401 "Invalid credentials"` | bcrypt check fires before type check |
| `/admin-login` unknown email | `401 "Invalid credentials"` | User not found |
| `/login` unknown email | `401 "Invalid credentials"` | Unchanged behaviour |
| `GET /me` includes `isSuperadmin` | `false` for new accounts | Field added to getMe() |
| Refresh works after `/login` | `200 { accessToken }` | No refresh regression |

**Note on superadmin happy-path:** Testing `isSuperadmin=true` accounts via `/admin-login` requires a seeded superadmin user (cannot be created via `register()`). This is covered by the staging seed (`alpha-seller@pixecom.io` is currently `isSuperadmin=false`; a platform superadmin account must be seeded separately). The structural guard — `loginType='admin'` blocks non-superadmin — is fully covered by the test cases above.

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (API) | ✅ Clean — zero errors |
| E2E suite | ⚠️ Cannot run — local PostgreSQL at `127.0.0.1:5434` is not running in this environment. All 8 new test cases compile and are logically verified. |

---

## Security Notes

1. **User enumeration hardening preserved:** The type check fires after bcrypt comparison, so a caller with a valid email + wrong password always receives `"Invalid credentials"` — never the portal-specific error.

2. **No LoginDto changes:** The separation is enforced server-side by the controller route, not by client-supplied parameters. A malicious client cannot pass `loginType` to bypass the check.

3. **SuperadminGuard uses live DB state:** `isSuperadmin` is confirmed via `JwtStrategy.validate()` on every request — not cached from the JWT payload alone — preventing stale-token privilege escalation.
