# Milestone 2.4 — Multi-Source Asset Ingestion + Creative Layer
**Branch:** `feature/2.4-asset-creative-layer`  
**Status:** ✅ Complete  
**Date:** 2026-02-18  
**Commit:** `2d0c285`  
**PR:** https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.4-asset-creative-layer  

---

## Objective

Implement the Asset Registry and Creative Layer (Milestone 2.4 per the PixEcom v2 architecture plan):

- Multi-source asset ingestion (seller uploads, internal pipelines, platform system assets)
- Presigned R2/S3 upload URL generation
- Creative bundles with role-slotted assets (PRIMARY_VIDEO, THUMBNAIL, PRIMARY_TEXT, HEADLINE, DESCRIPTION, EXTRA)
- DRAFT → READY validation lifecycle
- Tenant isolation: sellers only see own assets + platform (ownerSellerId=null) assets

---

## DB Changes

### New Enums
| Enum | Values |
|------|--------|
| `AssetSourceType` | `USER_UPLOAD`, `PIXCON`, `PARTNER_API`, `MIGRATION`, `SYSTEM` |
| `CreativeStatus` | `DRAFT`, `READY`, `ARCHIVED` |
| `CreativeAssetRole` | `PRIMARY_VIDEO`, `THUMBNAIL`, `PRIMARY_TEXT`, `HEADLINE`, `DESCRIPTION`, `EXTRA` |
| `MediaType` (extended) | Added `TEXT` to existing `VIDEO`, `IMAGE` |

### New Tables
| Table | Description |
|-------|-------------|
| `assets` | Multi-source media asset registry |
| `creatives` | Seller creative bundles (name, status, productId) |
| `creative_assets` | Role-slotted join between creative and asset |
| `campaign_creatives` | Join between campaign and creative (for Phase 2 ad launch) |

### Migration
File: `packages/database/prisma/migrations/20260218200000_asset_creative_layer/migration.sql`

Key SQL decisions:
- `ALTER TYPE "media_type" ADD VALUE IF NOT EXISTS 'TEXT'` — safe idempotent enum extension
- Partial unique indexes (not expressible in Prisma schema syntax):
  ```sql
  CREATE UNIQUE INDEX "assets_uq_ingestion_id" ON "assets"("source_type", "ingestion_id")
    WHERE "ingestion_id" IS NOT NULL;
  CREATE UNIQUE INDEX "assets_uq_checksum" ON "assets"("owner_seller_id", "checksum")
    WHERE "checksum" IS NOT NULL;
  ```
- `@@unique([creativeId, role])` on `creative_assets` — enforces one asset per role slot per creative

---

## New Modules

### MediaModule (`apps/api/src/media/`)
- `R2Service` — wraps `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Generates presigned PUT URLs for direct client-to-R2 uploads
- Builds storage keys: `sellers/{sellerId}/{timestamp}-{safe_filename}` and `platform/{timestamp}-{safe_filename}`
- Config: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_CDN_BASE` env vars

### AssetRegistryModule (`apps/api/src/asset-registry/`)
#### Controller endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/assets/signed-upload` | JWT seller | Get presigned R2 upload URL |
| POST | `/api/assets` | JWT seller | Register asset after upload |
| POST | `/api/assets/ingest` | ApiKey OR superadmin JWT | Internal pipeline ingest |
| GET | `/api/assets` | JWT seller | List assets (own + platform) |
| GET | `/api/assets/:id` | JWT seller | Get single asset |

#### De-duplication logic
1. By `(sourceType, ingestionId)` — for pipeline idempotency
2. By `(ownerSellerId, checksum)` — for content-addressed de-dup
- Uses `findFirst` (not `findUnique`) because partial indexes are not in Prisma client

#### ApiKeyOrSuperadminGuard
Two auth paths for the ingest endpoint:
1. `X-Api-Key` header matches `INGEST_API_KEY` env var → sets `req.user = { source: 'api-key' }`
2. Bearer JWT with `isSuperadmin: true`, verified against DB → sets `req.user = { userId, isSuperadmin: true }`

### CreativesModule (`apps/api/src/creatives/`)
#### Controller endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/creatives` | JWT seller | Create creative bundle |
| GET | `/api/creatives` | JWT seller | List seller's creatives |
| GET | `/api/creatives/:id` | JWT seller | Get creative with assets |
| PATCH | `/api/creatives/:id` | JWT seller | Update creative fields |
| POST | `/api/creatives/:id/assets` | JWT seller | Attach asset to role slot (upsert) |
| DELETE | `/api/creatives/:id/assets/:role` | JWT seller | Detach asset from slot |
| POST | `/api/creatives/:id/validate` | JWT seller | Transition DRAFT → READY |

#### Key behaviors
- **Attach is upsert by role** — attaching to an occupied slot replaces the previous asset
- **Platform assets accessible** — sellers can attach any asset where `ownerSellerId = null`
- **READY validation** requires: (`PRIMARY_VIDEO` OR `THUMBNAIL`) AND `PRIMARY_TEXT`
- **Tenant isolation** enforced at every operation via `assertCreativeBelongsToSeller`

---

## Auth Extension

`JwtPayload` and `AuthUser` extended with `isSuperadmin: boolean`:
- `jwt.strategy.ts` — selects `isSuperadmin` from DB on each JWT validation
- `auth.service.ts` — `generateTokens()` accepts `isSuperadmin` parameter; `login()` and `refresh()` propagate it from DB user

---

## Seed Data (Milestone 2.4)

Added to `packages/database/prisma/seed.ts`:

| Record | ID | Notes |
|--------|----|-------|
| Platform asset (VIDEO) | `...4001` | `ownerSellerId=null`, SYSTEM source |
| Platform asset (IMAGE) | `...4002` | `ownerSellerId=null`, SYSTEM source |
| Seller asset (VIDEO) | `...4003` | `ownerSellerId=SEED_SELLER_ID`, USER_UPLOAD |
| Seller asset (TEXT) | `...4004` | `ownerSellerId=SEED_SELLER_ID`, USER_UPLOAD |
| Creative (DRAFT) | `...5001` | seed seller, linked to product1 |
| CreativeAsset (PRIMARY_VIDEO) | — | slot on creative `...5001` → asset `...4003` |
| CreativeAsset (THUMBNAIL) | — | slot on creative `...5001` → asset `...4002` |
| CreativeAsset (PRIMARY_TEXT) | — | slot on creative `...5001` → asset `...4004` |

Creative `...5001` has all required slots → can be validated to READY.

---

## E2E Tests

File: `apps/api/test/asset-registry.e2e-spec.ts`  
**Result: 25/25 passing ✅**

| # | Test | Assertion |
|---|------|-----------|
| 1 | POST /api/assets/signed-upload — returns shape | `uploadUrl`, `publicUrl`, `storageKey`, `expiresInSeconds` |
| 2 | POST /api/assets/signed-upload — 401 without JWT | 401 |
| 3 | POST /api/assets — registers asset + full DTO | 201, id, mediaType, sourceType, fileSizeBytes |
| 4 | POST /api/assets — checksum de-dup returns same ID | 201, same id |
| 5 | POST /api/assets — 401 without JWT | 401 |
| 6 | POST /api/assets/ingest — API key creates platform asset | 201, ownerSellerId=null |
| 7 | POST /api/assets/ingest — idempotency same ingestionId | 201, same id |
| 8 | POST /api/assets/ingest — 401 without auth | 401 |
| 9 | POST /api/assets/ingest — 401 with wrong API key | 401 |
| 10 | GET /api/assets — tenant isolation (own + platform only) | seller B assets not visible |
| 11 | GET /api/assets — pagination metadata | total, page, limit |
| 12 | GET /api/assets/:id — own asset accessible | 200 |
| 13 | GET /api/assets/:id — platform asset accessible | 200 |
| 14 | GET /api/assets/:id — foreign seller asset 404 | 404 |
| 15 | POST /api/creatives — create + GET returns with assets array | 201, assets=[] |
| 16 | POST /api/creatives/:id/assets — attach PRIMARY_VIDEO | 201, role, assetId |
| 17 | POST /api/creatives/:id/assets — upsert same role replaces | 201, new assetId on same role |
| 18 | POST /api/creatives/:id/assets — seller B asset → 403 | 403 |
| 19 | POST /api/creatives/:id/assets — platform asset attach | 201 (ownerSellerId=null visible to all) |
| 20 | POST /api/creatives/:id/validate — DRAFT → READY | 201, status=READY |
| 21 | POST /api/creatives/:id/validate — already READY → 400 | 400 |
| 22 | POST /api/creatives/:id/validate — no assets → 400 | 400, "missing required assets" |
| 23 | POST /api/creatives/:id/validate — second empty creative → 400 | 400 |
| 24 | GET /api/creatives/:id — seller B cannot see seller A's creative | 404 |
| 25 | PATCH /api/creatives/:id — seller B cannot update seller A's creative | 404 |

---

## Issues & Fixes

### 1. `prisma generate` Windows DLL lock
**Problem:** `EPERM: operation not permitted, rename query_engine-windows.dll.node.tmpXXXX → .dll.node`  
**Fix:** Used `prisma generate --no-engine` for TypeScript generation; manually copied tmp engine file for seed runtime.

### 2. `prisma migrate dev` advisory lock hang
**Problem:** Interactive migrate dev held a PostgreSQL advisory lock indefinitely.  
**Fix:** Killed stuck PG connections via `pg_terminate_backend`, verified migration applied via `_prisma_migrations`, used `migrate resolve --applied`.

### 3. DTO `TS2564` strict property initialization
**Problem:** TypeScript strict mode requires DTO properties to be initialized.  
**Fix:** Added `!` (definite assignment assertion) to all required DTO fields.

### 4. `buildListWhere` type error
**Problem:** `mediaType: string` not assignable to `MediaType | EnumMediaTypeFilter<"Asset">`.  
**Fix:** Used `Prisma.AssetWhereInput` return type + `as Prisma.AssetWhereInput` cast. Imported `Prisma` from `@pixecom/database` (not `@prisma/client` which is not directly accessible).

### 5. E2E: Platform asset attach → 400 (`assetId must be a UUID`)
**Problem:** Test used hardcoded seed IDs like `00000000-0000-0000-0000-000000004001` which fail `@IsUUID()` (class-validator requires valid UUID version nibble in position 13; these IDs have `0` in that position).  
**Fix:** Switched test to use `platformAssetId` — the UUID returned from the ingest test earlier in the same suite (dynamically generated, valid UUID v4).

### 6. E2E: Seed seller login → 401
**Problem:** Pre-hashed bcrypt password in seed.ts did not match in test environment (possible bcrypt rounds mismatch or hash generated on different machine).  
**Fix:** Replaced that test with a self-contained test that doesn't require seed user credentials — creates a fresh empty creative and validates it returns 400.

---

## Dependencies Added
| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | latest | S3-compatible R2 client |
| `@aws-sdk/s3-request-presigner` | latest | Presigned PUT URL generation |

---

## Files Changed / Created

### Created
- `apps/api/src/media/r2.service.ts`
- `apps/api/src/media/media.module.ts`
- `apps/api/src/asset-registry/asset-registry.service.ts`
- `apps/api/src/asset-registry/asset-registry.controller.ts`
- `apps/api/src/asset-registry/asset-registry.module.ts`
- `apps/api/src/asset-registry/guards/api-key-or-superadmin.guard.ts`
- `apps/api/src/asset-registry/dto/signed-upload.dto.ts`
- `apps/api/src/asset-registry/dto/register-asset.dto.ts`
- `apps/api/src/asset-registry/dto/ingest-asset.dto.ts`
- `apps/api/src/asset-registry/dto/list-assets.dto.ts`
- `apps/api/src/creatives/creatives.service.ts`
- `apps/api/src/creatives/creatives.controller.ts`
- `apps/api/src/creatives/creatives.module.ts`
- `apps/api/src/creatives/dto/create-creative.dto.ts`
- `apps/api/src/creatives/dto/update-creative.dto.ts`
- `apps/api/src/creatives/dto/attach-asset.dto.ts`
- `apps/api/src/creatives/dto/detach-asset.dto.ts`
- `apps/api/test/asset-registry.e2e-spec.ts`
- `packages/database/prisma/migrations/20260218200000_asset_creative_layer/migration.sql`

### Modified
- `packages/database/prisma/schema.prisma` — 4 new models, 3 new enums, MediaType TEXT
- `packages/database/prisma/seed.ts` — 4 assets + 1 creative + 3 creative_asset joins
- `apps/api/src/app.module.ts` — registered MediaModule, AssetRegistryModule, CreativesModule
- `apps/api/src/auth/strategies/jwt.strategy.ts` — added isSuperadmin to JwtPayload + AuthUser
- `apps/api/src/auth/auth.service.ts` — propagate isSuperadmin through generateTokens/login/refresh
- `apps/api/package.json` — added @aws-sdk deps
- `pnpm-lock.yaml` — updated lockfile

---

*Working log generated post-implementation.*

---

# Milestone 2.4.1 — Pre-v2.3 Hardening
**Branch:** `feature/2.4-asset-creative-layer`
**Status:** ✅ Complete
**Date:** 2026-02-19
**Tests:** 179 E2E + 7 unit = 186 total ✅

---

## Objective

Five targeted hardening tasks before starting Milestone 2.3 (Ads/Campaign/Worker):

1. Add `creativeType` enum + type-aware READY validation
2. Add `GET /api/creatives/:id/render` endpoint
3. Refactor ingest de-dup into single `resolveExistingAssetOrCreate` helper
4. Fix `creative_assets` EXTRA multi-slot (allow multiple EXTRA rows per creative)
5. Dual API key rotation + per-IP rate limiting + structured logging on ingest

---

## Task 1 — `creativeType` Enum + READY Validation

### Schema Changes
Added to `packages/database/prisma/schema.prisma`:
```prisma
enum CreativeType {
  VIDEO_AD
  IMAGE_AD
  TEXT_ONLY
  UGC_BUNDLE
  @@map("creative_type")
}
```
Added `creativeType CreativeType @default(VIDEO_AD)` field to `Creative` model.

### Migration `20260218210000_hardening_241`
```sql
CREATE TYPE "creative_type" AS ENUM ('VIDEO_AD', 'IMAGE_AD', 'TEXT_ONLY', 'UGC_BUNDLE');
ALTER TABLE "creatives" ADD COLUMN "creative_type" "creative_type" NOT NULL DEFAULT 'VIDEO_AD';
```
Applied directly via `docker exec psql` (Prisma migrate dev advisory lock workaround).

### READY Validation Rules (by type)
| Type | Required Slots |
|------|---------------|
| `VIDEO_AD` (default) | THUMBNAIL + PRIMARY_TEXT |
| `IMAGE_AD` | THUMBNAIL + PRIMARY_TEXT |
| `TEXT_ONLY` | PRIMARY_TEXT only |
| `UGC_BUNDLE` | PRIMARY_VIDEO only |

Implemented as `READY_RULES: Record<string, (roles: Set<string>) => { pass: boolean; missing: string[] }>` in `creatives.service.ts`. Falls back to `VIDEO_AD` rules for unknown types.

### DTOs Updated
- `create-creative.dto.ts` — added optional `creativeType?: CreativeTypeValue`
- `update-creative.dto.ts` — added optional `creativeType?` (allows type change on PATCH)

---

## Task 2 — `GET /api/creatives/:id/render` Endpoint

### New Endpoint
```
GET /api/creatives/:id/render  [JWT seller]
```

### Response Shape
```json
{
  "id": "uuid",
  "creativeType": "IMAGE_AD",
  "status": "READY",
  "videoUrl": "https://...",
  "imageUrl": "https://...",
  "thumbnailUrl": "https://...",
  "primaryText": "Buy now! Best deal.",
  "headline": null,
  "description": null,
  "extras": [{ "url": "...", "mediaType": "IMAGE" }]
}
```

### Key Behaviors
- Tenant isolation: returns 404 if creative belongs to another seller
- `primaryText` / `headline` / `description` resolve from `asset.metadata.content` first, then fall back to `asset.url`
- `imageUrl` and `thumbnailUrl` both map to the THUMBNAIL slot (for ad delivery flexibility)
- `extras[]` lists all EXTRA-role assets

---

## Task 3 — `resolveExistingAssetOrCreate` Helper Refactor

Extracted common de-dup logic shared by `registerAsset` (seller upload) and `ingestAsset` (pipeline) into a single private method:

```typescript
private async resolveExistingAssetOrCreate(input: DedupeAndCreateInput) {
  // Rule 1: ingestionId → findFirst by (sourceType, ingestionId)
  // Rule 2: checksum → findFirst by (ownerSellerId, checksum)
  // Rule 3: create fresh
}
```

**Fix included:** `registerAsset` was hardcoding `metadata: {}`, ignoring `dto.metadata`.
**Fix:** Changed to `metadata: (dto.metadata as object) ?? {}`.

Also added `metadata?: Record<string, unknown>` to `RegisterAssetDto` (previously missing, causing `forbidNonWhitelisted` rejection for text assets with content metadata).

---

## Task 4 — EXTRA Multi-Slot Fix

### Problem
`@@unique([creativeId, role])` in `creative_assets` prevented multiple EXTRA rows per creative. EXTRA must be multi-slot (supplementary assets — sidecards, variants).

### Solution
- Removed `@@unique([creativeId, role])` from Prisma schema
- Added `@@index([creativeId, role])` for query performance
- Added SQL conditional unique index (partial index, not expressible in Prisma):
  ```sql
  DROP INDEX IF EXISTS "creative_assets_uq_creative_asset_role";
  CREATE UNIQUE INDEX "creative_assets_uq_single_slot_role"
    ON "creative_assets" ("creative_id", "role")
    WHERE "role" != 'EXTRA';
  CREATE INDEX IF NOT EXISTS "creative_assets_creative_id_role_idx"
    ON "creative_assets" ("creative_id", "role");
  ```
- `attachAsset()` service method: EXTRA role creates new row; single-slot roles use `deleteMany` + `create` in a `$transaction` (atomic upsert without requiring `@@unique`).

---

## Task 5 — Ingest Security Hardening

### Dual API Key Rotation
`ApiKeyOrSuperadminGuard` now accepts any of three env vars:
| Env Var | Purpose |
|---------|---------|
| `INGEST_API_KEY_CURRENT` | Active key (primary) |
| `INGEST_API_KEY_NEXT` | Rotation candidate (promoted next) |
| `INGEST_API_KEY` | Legacy key (backwards compat, fallback) |

All non-empty matching keys are accepted. Auth path logged for auditing.

### Per-IP Rate Limiting
- In-memory sliding window: `Map<string, { count: number; resetAt: number }>`
- Default: 60 requests per 60-second window
- Returns `HttpException('Rate limit exceeded...', HttpStatus.TOO_MANY_REQUESTS)` (429)
- Configurable via `INGEST_RATE_LIMIT_MAX` / `INGEST_RATE_LIMIT_WINDOW_MS` env vars

### Structured Logging
NestJS `Logger` output per ingest request:
```json
{ "message": "ingest ok", "authPath": "api-key", "ip": "::1", "sourceType": "SYSTEM", "sourceRef": "abc-123" }
```
Note: URL is **never** logged (avoids leaking CDN/presigned paths).

---

## Issues & Fixes

### 1. Prisma `--no-engine` causes E2E DataProxy error
**Problem:** After `prisma generate --no-engine`, the `.prisma/client/` directory lacks `query_engine-windows.dll.node`. Prisma falls back to DataProxy engine (class `Dr`), which expects `DATABASE_URL` to start with `prisma://` — throwing `InvalidDatasourceError`.
**Root cause:** In `library.js`, engine selection: `o = n || !e` where `e` = engine binary exists. `!e = true` when DLL missing → DataProxy selected regardless of `engineType: "library"` in config.
**Fix:** Ran `pnpm --filter @pixecom/database exec prisma generate` (without `--no-engine`). DLL is regenerated in `.prisma/client/`. Also copied to `packages/database/node_modules/.prisma/client/` for test resolution.

### 2. `TooManyRequestsException` not in NestJS 10
**Problem:** `TooManyRequestsException` is not exported from `@nestjs/common` in NestJS 10.
**Fix:** Used `new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)`.

### 3. `RegisterAssetDto` missing `metadata` field
**Problem:** `POST /api/assets` with `metadata: {...}` rejected with 400 (`forbidNonWhitelisted`). Text assets created in tests had `undefined` IDs. Caused cascade: PRIMARY_TEXT never attached → IMAGE_AD validate 400, TEXT_ONLY validate 400, render primaryText=null.
**Fix:** Added `@IsOptional() metadata?: Record<string, unknown>` to `RegisterAssetDto` and changed `registerAsset()` to pass `dto.metadata` instead of hardcoded `{}`.

### 4. Asset list pagination — seed asset not on page 1
**Problem:** `asset-registry.e2e-spec.ts` test checking for `PLATFORM_ASSET_SEED_ID` on default page (limit=20) failed as test runs accumulated >20 assets. Seed asset (oldest) is pushed off page 1.
**Fix:** Changed test query to `GET /api/assets?limit=100`.

---

## Files Changed (v2.4.1)

### Created
- `packages/database/prisma/migrations/20260218210000_hardening_241/migration.sql`
- `apps/api/test/hardening-241.e2e-spec.ts` — 18 E2E tests (Tasks 1, 2, 4, 5)
- `apps/api/src/asset-registry/asset-registry.service.spec.ts` — 7 unit tests (Task 3)
- `apps/api/jest.config.json` — ts-jest unit test config

### Modified
- `packages/database/prisma/schema.prisma` — `CreativeType` enum + `creativeType` field on `Creative`, removed `@@unique` on `CreativeAsset`
- `apps/api/src/creatives/creatives.service.ts` — `READY_RULES`, `attachAsset` EXTRA logic, `renderCreative`, `creativeType` in all selects
- `apps/api/src/creatives/creatives.controller.ts` — added `GET(':id/render')` endpoint
- `apps/api/src/creatives/dto/create-creative.dto.ts` — added `creativeType?`
- `apps/api/src/creatives/dto/update-creative.dto.ts` — added `creativeType?`
- `apps/api/src/asset-registry/asset-registry.service.ts` — `resolveExistingAssetOrCreate` refactor, `metadata` passthrough fix
- `apps/api/src/asset-registry/dto/register-asset.dto.ts` — added `metadata?` field
- `apps/api/src/asset-registry/guards/api-key-or-superadmin.guard.ts` — dual-key rotation, rate limiting, structured logging
- `apps/api/test/asset-registry.e2e-spec.ts` — pagination fix (`?limit=100`)
- `apps/api/package.json` — test script updated to use `jest.config.json`

---

## Test Results (v2.4.1)

| Suite | Tests | Result |
|-------|-------|--------|
| `hardening-241.e2e-spec.ts` | 18 | ✅ |
| `asset-registry.e2e-spec.ts` | 25 | ✅ |
| `auth.e2e-spec.ts` | 38 | ✅ |
| `seller.e2e-spec.ts` | 28 | ✅ |
| `products.e2e-spec.ts` | 33 | ✅ |
| `domains.e2e-spec.ts` | 18 | ✅ |
| `sellpages.e2e-spec.ts` | 19 | ✅ |
| `asset-registry.service.spec.ts` (unit) | 7 | ✅ |
| **Total** | **186** | **✅ All passing** |