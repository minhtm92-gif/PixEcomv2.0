# Milestone 2.1.3 — Seller Module (Isolation Layer) Working Log

**Status:** ✅ Complete
**Branch:** `feature/2.1.3-seller-module`
**Merge commit:** `1673435` → `main`
**Tag:** `v0.1.1`
**Date:** 2026-02-18
**Duration:** ~1 session
**Tests:** 19 new e2e (28 total — 9 auth + 19 seller), all passing

---

## Scope

Implement the Seller isolation layer on top of the existing Auth module (2.1.2).
Expose read/write endpoints for seller profile and seller settings.
All endpoints are protected by JWT; `sellerId` is always sourced from the JWT
payload (`@CurrentUser()` decorator) — never from route params or request body.

**Zero schema changes** (uses existing `Seller` and `SellerSettings` tables from 2.1.1).
**Zero auth changes** (reuses `JwtAuthGuard`, `@CurrentUser()`, `AuthUser` from 2.1.2).

---

## Endpoints Delivered

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/sellers/me` | Return authenticated seller's profile |
| `PATCH` | `/api/sellers/me` | Update `name` and/or `logoUrl` |
| `GET` | `/api/sellers/me/settings` | Return authenticated seller's settings |
| `PATCH` | `/api/sellers/me/settings` | Update one or more settings fields |

---

## Step 1 — Branch Setup

```bash
git checkout -b feature/2.1.3-seller-module
```

Branched from `feature/2.1.2-auth-module` (all auth infrastructure already in place).

---

## Step 2 — DTOs

### `apps/api/src/seller/dto/update-seller.dto.ts`

```typescript
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateSellerDto {
  @IsString() @IsOptional() @MaxLength(255)
  name?: string;

  @IsUrl() @IsOptional() @MaxLength(500)
  logoUrl?: string;
}
```

**Design decisions:**
- `@IsUrl()` on `logoUrl` — class-validator validates full URL format (protocol required)
- Both fields optional — PATCH semantics (partial update)
- "At least one field" guard is enforced in the service, not the DTO, to keep DTOs simple
- `@MaxLength` guards match DB column sizes: `name VARCHAR(255)`, `logoUrl VARCHAR(500)`

### `apps/api/src/seller/dto/update-seller-settings.dto.ts`

```typescript
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateSellerSettingsDto {
  @IsString() @IsOptional() @MaxLength(255)  brandName?: string;
  @IsString() @IsOptional() @Length(3, 3)    defaultCurrency?: string;
  @IsString() @IsOptional() @MaxLength(64)   timezone?: string;
  @IsEmail()  @IsOptional()                  supportEmail?: string;
  @IsString() @IsOptional() @MaxLength(100)  metaPixelId?: string;
  @IsString() @IsOptional() @MaxLength(100)  googleAnalyticsId?: string;
}
```

**Design decisions:**
- `@Length(3, 3)` on `defaultCurrency` enforces ISO 4217 3-char codes (`USD`, `EUR`, `VND`)
- `@IsEmail()` on `supportEmail` — business-grade email validation
- All fields optional individually; service checks at least one is present
- `timezone` is free-text string (no IANA enum validation in Phase 1 — simple, pragmatic)

---

## Step 3 — Services

### `apps/api/src/seller/seller.service.ts`

**`getProfile(sellerId: string)`**
- `prisma.seller.findUnique({ where: { id: sellerId } })`
- Throws `NotFoundException` if `!seller || !seller.isActive`
- Selects: `id, name, slug, logoUrl, isActive, createdAt, updatedAt`
- Does **not** select any relations or sensitive fields

**`updateProfile(sellerId: string, dto: UpdateSellerDto)`**
- Guards: `if (dto.name === undefined && dto.logoUrl === undefined) → 400`
- Pre-flight read: `findUnique({ where: { id: sellerId }, select: { id, isActive } })`
  - Throws `NotFoundException` if not found or inactive
- Conditional spread in `data:` — only sends defined fields to DB
- Returns same field set as `getProfile`

**Key isolation pattern:**
```typescript
// sellerId is ALWAYS the first parameter — sourced from JWT by controller
async getProfile(sellerId: string) {
  return this.prisma.seller.findUnique({ where: { id: sellerId }, ... });
}
```
The service never receives `sellerId` from any source other than the controller, which
always passes `user.sellerId` from the `@CurrentUser()` decorator.

### `apps/api/src/seller/seller-settings.service.ts`

**`getSettings(sellerId: string)`**
- `prisma.sellerSettings.findUnique({ where: { sellerId } })`
- Uses the `sellerId` unique key (1-to-1 relation) — not the settings `id`
- Throws `NotFoundException` if not found
- Selects all 10 fields (id, sellerId, brandName, defaultCurrency, timezone, supportEmail, metaPixelId, googleAnalyticsId, createdAt, updatedAt)

**`updateSettings(sellerId: string, dto: UpdateSellerSettingsDto)`**
- Empty body guard: `Object.values(dto).some(v => v !== undefined)`
  - More robust than checking each field individually — scales with new DTO fields
- Pre-flight read: `findUnique({ where: { sellerId }, select: { id } })`
- Conditional spread per field (6 conditionals) — only touches provided fields
- Returns full settings row

---

## Step 4 — Controllers

### `apps/api/src/seller/seller.controller.ts`

```typescript
@Controller('sellers')
@UseGuards(JwtAuthGuard)   // ← applied at class level: ALL routes under this controller are guarded
export class SellerController {
  @Get('me')
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.sellerService.getProfile(user.sellerId);
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateSellerDto) {
    return this.sellerService.updateProfile(user.sellerId, dto);
  }
}
```

### `apps/api/src/seller/seller-settings.controller.ts`

```typescript
@Controller('sellers/me/settings')   // ← separate controller, distinct prefix
@UseGuards(JwtAuthGuard)
export class SellerSettingsController {
  @Get()    async getSettings(...)  { return this.sellerSettingsService.getSettings(user.sellerId); }
  @Patch()  async updateSettings(...) { ... }
}
```

**Why two controllers instead of one?**
- `sellers/me` and `sellers/me/settings` are logically separate concerns
- Avoids a single over-loaded controller with too many injected services
- Each controller stays ~50 lines, maximally readable
- Follows the same pattern as the DB schema: `Seller` and `SellerSettings` are separate tables

**Isolation enforcement at controller boundary:**
- `sellerId` is never accepted from `@Param()` or `@Body()`
- Only `@CurrentUser()` is used — injected by `JwtStrategy.validate()` from the JWT payload
- This makes IDOR (Insecure Direct Object Reference) attacks impossible at this layer

---

## Step 5 — Module

### `apps/api/src/seller/seller.module.ts`

```typescript
@Module({
  // PrismaModule is @Global() — no import needed here
  providers: [SellerService, SellerSettingsService],
  controllers: [SellerController, SellerSettingsController],
  exports: [SellerService],   // exported for future module consumption (e.g. ProductModule)
})
export class SellerModule {}
```

**`exports: [SellerService]`** — anticipates future modules that need to look up seller
context (e.g. `ProductModule`, `OrderModule` verifying seller exists and is active).

### `apps/api/src/app.module.ts` update

```typescript
imports: [ConfigModule.forRoot({...}), PrismaModule, HealthModule, AuthModule, SellerModule]
```

No changes to `AuthModule`, `PrismaModule`, or any existing file.

---

## Step 6 — E2E Tests

**File:** `apps/api/test/seller.e2e-spec.ts` — 336 lines, 19 tests across 5 describe blocks

### Test helper

```typescript
const registerSeller = async (displayName: string) => {
  // Calls POST /api/auth/register with unique email
  // Returns { accessToken, sellerId, email, seller }
};
```

Each test that needs isolation creates its own seller via `registerSeller()` — no shared
state between tests. `uniqueEmail()` uses `Date.now() + Math.random()` to avoid collisions.

### Test matrix

| # | Describe | Test | Validates |
|---|----------|------|-----------|
| 1 | `GET /sellers/me` | returns own profile | id matches JWT sellerId |
| 2 | `GET /sellers/me` | 401 no token | guard active |
| 3 | `GET /sellers/me` | 401 invalid token | guard rejects bad JWT |
| 4 | `PATCH /sellers/me` | update name | response reflects new name |
| 5 | `PATCH /sellers/me` | persist on GET | DB write confirmed |
| 6 | `PATCH /sellers/me` | empty body → 400 | service guard |
| 7 | `PATCH /sellers/me` | bad logoUrl → 400 | DTO validation |
| 8 | `PATCH /sellers/me` | 401 no token | guard active |
| 9 | `GET /sellers/me/settings` | defaults USD/UTC | schema defaults |
| 10 | `GET /sellers/me/settings` | 401 no token | guard active |
| 11 | `PATCH /sellers/me/settings` | update brandName+currency | response correct |
| 12 | `PATCH /sellers/me/settings` | persist timezone+email | DB write confirmed |
| 13 | `PATCH /sellers/me/settings` | empty body → 400 | service guard |
| 14 | `PATCH /sellers/me/settings` | TOOLONG currency → 400 | `@Length(3,3)` |
| 15 | `PATCH /sellers/me/settings` | bad email → 400 | `@IsEmail()` |
| 16 | `PATCH /sellers/me/settings` | 401 no token | guard active |
| 17 | **Isolation** | profile A ≠ B | IDOR impossible |
| 18 | **Isolation** | settings A ≠ B (brandName) | data scoped by sellerId |
| 19 | **Isolation** | A's PATCH doesn't affect B | write scoped to JWT sellerId |

**Result:** 28/28 total tests passing (9 auth + 19 seller)

---

## Step 7 — Merge, Tag, Deploy

### Git operations (local)

```bash
# Switch to main, pull latest
git checkout main && git pull origin main

# Squash-merge (only 1 commit was ahead after earlier milestones were already on main)
git merge --squash feature/2.1.3-seller-module
git commit -m "feat(seller): milestone 2.1.3 — seller module with tenant isolation"

# Tag
git tag -a v0.1.1 -m "Release v0.1.1 — Milestones 2.1.1 (DB), 2.1.2 (Auth), 2.1.3 (Seller Module)"

# Push
git push origin main && git push origin v0.1.1
```

**Note on `develop` branch:** CTO command referenced a `develop` branch, but none existed —
only `main` and feature branches. Squash-merged directly into `main` per confirmed plan.

### VPS deploy (143.198.24.81 — pixecom-v2-prod)

The VPS runs a bind-mounted Docker setup:
- `pixecom-api` container mounts `/opt/pixecom-v2/repo:/app:ro` and runs `node apps/api/dist/main.js`
- `pixecom-worker` runs `node apps/worker/dist/main.js`
- `pixecom-postgres` and `pixecom-redis` manage persistence
- `docker-compose.yml` only manages postgres + redis; API and worker are separate containers

```bash
# 1. Pull
cd /opt/pixecom-v2/repo && git pull origin main
# → Fast-forward: 9 files changed, +667 lines

# 2. Dependencies
pnpm install --frozen-lockfile
# → Already up to date (no new deps in 2.1.3)

# 3. Migrate
docker exec pixecom-api sh -c '/app/packages/database/node_modules/.bin/prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma'
# → "No pending migrations to apply." (2.1.3 has no schema changes)

# 4. Build API (dist must be rebuilt from source)
docker run --rm -v /opt/pixecom-v2/repo:/app -w /app node:20-slim \
  sh -c 'npm install -g pnpm@9 && pnpm --filter @pixecom/api build'
# → nest build succeeded → apps/api/dist/main.js updated

# 5. Build worker
docker run --rm -v /opt/pixecom-v2/repo:/app -w /app node:20-slim \
  sh -c 'npm install -g pnpm@9 && pnpm --filter @pixecom/worker build'
# → tsc succeeded → apps/worker/dist/main.js updated

# 6. Restart
docker restart pixecom-api pixecom-worker
# → Both healthy within 25 seconds
```

**Note on `npx prisma migrate deploy`:** Pulled Prisma 7 from npm (incompatible — Prisma 7
changed config format). Fixed by using `packages/database/node_modules/.bin/prisma` (v5.22.0)
via `docker exec` inside the api container which has DB network access.

---

## Step 8 — Verification

**Production curl outputs (143.198.24.81):**

```bash
# Health
curl http://localhost:3001/api/health
# {"status":"ok","service":"pixecom-api","timestamp":"2026-02-18T09:40:34.293Z"}

# Register test seller
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d @/tmp/register.json
# {
#   "accessToken": "eyJhbGci...",
#   "user": {"id":"4edc7573-...","email":"deploy213@pixecom.io","displayName":"Deploy213 Seller"},
#   "seller": {"id":"ce94155a-...","name":"Deploy213 Seller","slug":"deploy213-seller-kxwc"}
# }

# GET /api/sellers/me
curl http://localhost:3001/api/sellers/me \
  -H "Authorization: Bearer <token>"
# {
#   "id": "ce94155a-f454-46d5-9b21-2189bf97d9d7",
#   "name": "Deploy213 Seller",
#   "slug": "deploy213-seller-kxwc",
#   "logoUrl": null,
#   "isActive": true,
#   "createdAt": "2026-02-18T09:41:08.853Z",
#   "updatedAt": "2026-02-18T09:41:08.853Z"
# }

# GET /api/sellers/me/settings
curl http://localhost:3001/api/sellers/me/settings \
  -H "Authorization: Bearer <token>"
# {
#   "id": "3a7755ff-1aed-4140-ab87-2acf2b74f9bc",
#   "sellerId": "ce94155a-f454-46d5-9b21-2189bf97d9d7",
#   "brandName": null,
#   "defaultCurrency": "USD",
#   "timezone": "UTC",
#   "supportEmail": null,
#   "metaPixelId": null,
#   "googleAnalyticsId": null,
#   "createdAt": "2026-02-18T09:41:08.861Z",
#   "updatedAt": "2026-02-18T09:41:08.861Z"
# }
```

All three endpoints verified live on production. ✅

---

## Problems & Resolutions

### Problem 1 — No `develop` branch
**Symptom:** CTO command specified "merge feature into develop, then PR develop → main".
**Root cause:** Repository only has `main` and feature branches — no `develop` was ever created.
**Resolution:** Confirmed with user; squash-merged `feature/2.1.3-seller-module` directly into `main`.
**Impact:** None — merge was clean, all history preserved in squash commit.

### Problem 2 — `npx prisma migrate deploy` uses wrong Prisma version
**Symptom:** `npx prisma migrate deploy` pulled Prisma 7.4.0 (latest) which has a breaking config
format change (datasource `url` must now be in `prisma.config.ts`).
**Root cause:** `npx` resolves to latest registry version, not project version.
**Resolution:** Used project-local binary: `packages/database/node_modules/.bin/prisma` (v5.22.0)
executed via `docker exec pixecom-api` for DB network access.
**Lesson:** Always use `node_modules/.bin/prisma` not `npx prisma` in production scripts.

### Problem 3 — Dist build required (not just git pull + restart)
**Symptom:** API container runs `node apps/api/dist/main.js` — compiled JS, not TypeScript source.
**Root cause:** The bind mount provides source code, but `dist/` must be explicitly built.
**Resolution:** Used a temporary `node:20-slim` container with a write-mount to run `nest build`.
**Impact:** Added ~2 minutes to deploy process. Future: add a `make build` or deploy script.

### Problem 4 — SSH config pointed to wrong VPS IP
**Symptom:** SSH connection refused/closed to `147.93.57.221:443` (old v1.5 server).
**Root cause:** `~/.ssh/config` had stale entry from previous project.
**Resolution:** User provided DigitalOcean screenshot confirming correct IP `143.198.24.81:22`.
Updated SSH target; connection successful with existing `~/.ssh/pixecom_vps` key.

---

## Architecture Notes

### Tenant Isolation Model

```
HTTP Request
    │
    ▼
JwtAuthGuard  ←── validates JWT signature + expiry
    │
    ▼
JwtStrategy.validate()  ←── reads { sub, sellerId, role } from payload
    │                         returns AuthUser { userId, sellerId, role }
    ▼
@CurrentUser() decorator  ←── extracts req.user
    │
    ▼
Controller method  ←── ONLY source of sellerId is user.sellerId from JWT
    │                   NO @Param('sellerId'), NO @Body().sellerId
    ▼
Service method(sellerId, dto)  ←── all Prisma queries use WHERE sellerId = ?
    │
    ▼
Prisma  ←── physically scoped to one tenant's rows
```

This model makes cross-tenant data leakage structurally impossible at the application layer.
Even if a bug caused the wrong `sellerId` to end up in the JWT, it would only affect that token.
An attacker cannot substitute a different `sellerId` via the request.

### SellerSettings 1-to-1 Pattern

`SellerSettings` is queried by `sellerId` unique key, not by its own `id`:

```typescript
// ✅ Correct — uses unique sellerId key
prisma.sellerSettings.findUnique({ where: { sellerId } })

// ❌ Wrong — would require knowing the settings row id
prisma.sellerSettings.findUnique({ where: { id: settingsId } })
```

This eliminates a secondary ID that could be guessed or leaked. The tenant-scoped
`sellerId` is the only way to address the settings row.

### Conditional Spread Pattern

Both services use conditional spreads to avoid overwriting fields with `undefined`:

```typescript
data: {
  ...(dto.name !== undefined && { name: dto.name }),
  ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
}
```

This is preferred over `{ name: dto.name, logoUrl: dto.logoUrl }` because:
- Prisma would interpret an `undefined` field as "no change" for updates, but this is
  not universally reliable across ORM versions
- It makes intent explicit — only provided fields are touched
- It prevents accidental field clearing on partial PATCH requests

---

## Files Created / Modified

| File | Lines | Action |
|------|-------|--------|
| `apps/api/src/seller/dto/update-seller.dto.ts` | 13 | Created |
| `apps/api/src/seller/dto/update-seller-settings.dto.ts` | 32 | Created |
| `apps/api/src/seller/seller.service.ts` | 77 | Created |
| `apps/api/src/seller/seller-settings.service.ts` | 94 | Created |
| `apps/api/src/seller/seller.controller.ts` | 50 | Created |
| `apps/api/src/seller/seller-settings.controller.ts` | 50 | Created |
| `apps/api/src/seller/seller.module.ts` | 13 | Created |
| `apps/api/test/seller.e2e-spec.ts` | 336 | Created |
| `apps/api/src/app.module.ts` | +2 lines | Modified (added SellerModule import) |

**Total:** 667 lines added, 9 files

---

## Release — v0.1.1

| Item | Value |
|------|-------|
| Tag | `v0.1.1` |
| Commit | `1673435` (`16734350d9d8932fb0f310784b54333b14f61015`) |
| Date | 2026-02-18 16:35:10 +0700 |
| Includes | Milestones 2.1.1 (DB + Prisma), 2.1.2 (Auth + JWT), 2.1.3 (Seller Module) |
| Tests | 28 e2e passing |
| Live URL | `https://api.pixelxlab.com` |

---

## What's Next — Milestone 2.1.4

Per system architecture, the next milestone is the **Products Module (Read-Only Catalog)**:
- `GET /api/products` — paginated product listing (shared catalog, no sellerId filter)
- `GET /api/products/:id` — single product detail
- Platform-owned data (no tenant isolation required on read — all sellers see same catalog)
- `SellerService` exported from `SellerModule` available for future product-seller queries
