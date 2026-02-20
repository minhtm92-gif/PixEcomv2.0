# Milestone 2.2.2 — Sellpage Module: Working Log

**Branch:** `feature/2.2.2-sellpage-module`
**Commit:** `edf3e20`
**Date:** 2026-02-18
**Status:** ✅ Complete — 103/103 e2e tests passing

---

## Overview

Implemented the Sellpage Module — the core seller workflow where authenticated sellers create, manage, and publish sellpages linked to platform products.

**Key invariant:** `sellerId` is ALWAYS sourced from `@CurrentUser()` (the JWT payload). It is NEVER accepted from a route param or request body. This is the same tenant isolation pattern established in 2.1.3 and ensures a seller can never read or mutate another seller’s sellpages.

---

## Endpoints Delivered

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/sellpages` | Create sellpage | JWT |
| `GET` | `/api/sellpages` | Paginated list (status/q filters) | JWT |
| `GET` | `/api/sellpages/:id` | Full detail + product snapshot | JWT |
| `PATCH` | `/api/sellpages/:id` | Partial update | JWT |
| `POST` | `/api/sellpages/:id/publish` | DRAFT → PUBLISHED | JWT |
| `POST` | `/api/sellpages/:id/unpublish` | PUBLISHED → DRAFT | JWT |

---

## Step-by-Step Implementation
### Step 1 — Create Feature Branch

```bash
git checkout -b feature/2.2.2-sellpage-module
```

No schema migration required. The `Sellpage` model already had `@@unique([sellerId, slug], name: "uq_sellpage_slug")` from the 2.1.1 migration. Verified:
- `SellpageStatus` enum: `DRAFT | PUBLISHED | ARCHIVED`
- `SellpageType` enum: `SINGLE | MULTIPLE`
- `SellerDomain.hostname` field for URL preview

---

### Step 2 — DTOs

**`apps/api/src/sellpages/dto/create-sellpage.dto.ts`**

Required fields use the `!` (definite assignment assertion) pattern to satisfy `strictPropertyInitialization`. Optional fields use `?` with `@IsOptional()`.

```typescript
export class CreateSellpageDto {
  @IsUUID()
  productId!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  slug!: string;

  @IsOptional() @IsUUID()
  domainId?: string;

  @IsOptional() @IsString() @MaxLength(255)
  titleOverride?: string;

  @IsOptional() @IsString()
  descriptionOverride?: string;
}
```

**`apps/api/src/sellpages/dto/update-sellpage.dto.ts`**

All fields optional. The service enforces "at least one field" at the business logic layer rather than in the DTO, to keep the DTO clean.

**`apps/api/src/sellpages/dto/list-sellpages.dto.ts`**

Status filter uses a local `SellpageStatusFilter` enum (mirrors the Prisma enum values) so `@IsEnum()` can validate it. `@Type(() => Number)` enables numeric coercion from query string for `page` and `limit`.

---

### Step 3 — Service Architecture

**`apps/api/src/sellpages/sellpages.service.ts`**

Key design decisions:

#### A. Module-level mapping functions (not class methods)

The `mapToCardDto` and `mapToDetailDto` helpers are defined at module level (outside the class) rather than as private methods. This avoids the TypeScript `ReturnType<typeof this.method>` ambiguity in generic return type signatures.

```typescript
// ❌ Would cause TS2683 — ‘this’ implicitly has type ‘any’
async listSellpages(...): Promise<{
  data: ReturnType<typeof this.mapToDto>[];
}>

// ✅ Module-level function — no ‘this’ ambiguity
function mapToCardDto(sellpage: SellpageCardRow) { ... }
async listSellpages(...): Promise<{
  data: ReturnType<typeof mapToCardDto>[];
}>
```

#### B. SELLPAGE_DETAIL_SELECT — mutable orderBy array

The `SELLPAGE_CARD_SELECT` constant uses `as const` safely. But `SELLPAGE_DETAIL_SELECT` cannot use `as const` because the nested `orderBy` array must be mutable for Prisma’s type system:

```typescript
// ❌ 'as const' makes orderBy readonly — Prisma rejects it
const SELECT = { product: { select: { assetThumbs: {
  orderBy: [{ isCurrent: 'desc' }]  // becomes readonly tuple
}}}} as const;

// ✅ Explicit cast restores mutability
const SELLPAGE_DETAIL_SELECT = {
  ...SELLPAGE_CARD_SELECT,
  product: { select: { assetThumbs: {
    orderBy: [
      { isCurrent: 'desc' as const },
      { position: 'asc' as const },
    ] as { isCurrent?: 'desc' | 'asc'; position?: 'desc' | 'asc' }[],
    take: 1,
    select: { url: true },
  }}},
};
```

#### C. URL Preview Logic

```typescript
function buildUrlPreview(slug: string, domain: { hostname: string } | null): string {
  if (domain) return `https://${domain.hostname}/${slug}`;
  return `<unassigned-domain>/${slug}`;
}
```

The domain join is included in every select (`domain: { select: { id, hostname } }`) so the URL preview is always computed server-side — clients never need to reconstruct it.

#### D. Stats Stubs

```typescript
const STUB_STATS = { revenue: 0, cost: 0, youTake: 0, hold: 0, cashToBalance: 0 };
```

All sellpage responses include `stats: { ...STUB_STATS }`. Shape is intentional and matches the planned Phase 2 stats worker output so the frontend contract is stable.

#### E. Tenant Isolation — Defense in Depth

Every mutation goes through `assertSellpageBelongsToSeller()` before any update:

```typescript
private async assertSellpageBelongsToSeller(sellerId: string, id: string) {
  const sellpage = await this.prisma.sellpage.findUnique({
    where: { id },
    select: { id: true, sellerId: true, status: true },
  });
  if (!sellpage || sellpage.sellerId !== sellerId) {
    throw new NotFoundException('Sellpage not found');
  }
  return sellpage;
}
```

Returning 404 (not 403) is intentional — it prevents ID enumeration attacks across tenants.

#### F. State Machine

```
DRAFT ――publish――▶ PUBLISHED
DRAFT ◄―unpublish―― PUBLISHED
ARCHIVED (terminal — no transitions in Phase 1)
```

`publishSellpage` throws 400 if status is already `PUBLISHED` or `ARCHIVED`.
`unpublishSellpage` throws 400 if status is not `PUBLISHED`.

#### G. Slug Conflict — Pre-flight Check

A friendly 409 is thrown before the DB unique constraint fires:

```typescript
const existing = await this.prisma.sellpage.findUnique({
  where: { uq_sellpage_slug: { sellerId, slug: dto.slug } },
  select: { id: true },
});
if (existing) throw new ConflictException(`Slug "${dto.slug}" is already used by another sellpage`);
```

This gives the caller a clear message rather than a Prisma `P2002` error bubbling up as a 500.

---

### Step 4 — Controller

**`apps/api/src/sellpages/sellpages.controller.ts`**

Strict pattern following 2.1.3 seller module:

```typescript
@Controller('sellpages')
@UseGuards(JwtAuthGuard)
export class SellpagesController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSellpage(@CurrentUser() user: AuthUser, @Body() dto: CreateSellpageDto) {
    return this.sellpagesService.createSellpage(user.sellerId, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publishSellpage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sellpagesService.publishSellpage(user.sellerId, id);
  }
  // ... etc.
}
```

`ParseUUIDPipe` on all `:id` params — non-UUID → 400 before hitting the service.

---

### Step 5 — Module Registration

**`apps/api/src/sellpages/sellpages.module.ts`**
```typescript
@Module({
  providers: [SellpagesService],
  controllers: [SellpagesController],
  exports: [SellpagesService],
})
export class SellpagesModule {}
```

**`apps/api/src/app.module.ts`** — added `SellpagesModule` to imports array.

PrismaModule is `@Global()` so PrismaService is injected directly — no extra imports.

---

### Step 6 — Seed Extension

**`packages/database/prisma/seed.ts`** extended with:

```
Seed User:   seed-seller@pixecom.io (bcrypt hash of "seedpassword123", cost=12)
Seed Seller: Seed Seller Co. (slug: seed-seller-co)
             + SellerUser (role=OWNER) + SellerSettings

Sellpage 1: DRAFT     — mouse-offer        → product1 (MOUSE-001)
Sellpage 2: PUBLISHED — prostand-special   → product2 (STAND-001)
Sellpage 3: DRAFT     — desk-pad-offer     → product3 (DESKPAD-001)
```

All records use fixed UUIDs for idempotent re-seeding:
- User: `00000000-0000-0000-0000-000000001001`
- Seller: `00000000-0000-0000-0000-000000001002`
- Sellpages: `00000000-0000-0000-0000-000000002001` → `2003`

The bcrypt hash is pre-computed to avoid adding `bcrypt` as a seed dependency. The seed is used for dev/testing — not as production auth.

---

### Step 7 — E2E Tests (34 new tests)

**`apps/api/test/sellpages.e2e-spec.ts`**

Test structure mirrors the products e2e — two sellers registered in `beforeAll` to enable tenant isolation testing.

```typescript
// Two sellers registered for isolation tests
let sellerAToken: string;
let sellerBToken: string;

// Product IDs discovered from catalog API (no hardcoded UUIDs)
let mouseProductId: string;
let standProductId: string;
```

**Test coverage:**

| # | Describe | Tests |
|---|----------|-------|
| 1 | Auth guard | 401 on GET + POST without JWT |
| 2 | Create | 201 + shape validation, second sellpage |
| 3 | Duplicate slug | 409 for same seller, 201 for different seller (same slug) |
| 4 | Validation | Missing productId, missing slug, empty slug, invalid productId format |
| 5 | Non-existent product | 404 for valid UUID not in DB |
| 6 | List | Shape, tenant isolation, status filter, q search (slug + titleOverride) |
| 7 | Detail | Full shape with product snapshot, tenant isolation, non-UUID 400, non-existent 404 |
| 8 | Update | Slug + titleOverride, empty body 400, duplicate slug 409, cross-tenant 404 |
| 9 | Publish | DRAFT→PUBLISHED, already-PUBLISHED 400, cross-tenant 404 |
| 10 | Unpublish | PUBLISHED→DRAFT, already-DRAFT 400, cross-tenant 404 |
| 11 | URL preview | Placeholder when no domain |
| 12 | Pagination | limit, page, cap at 100 |

**Fix applied during testing:** Non-existent product UUID was originally `00000000-0000-0000-0000-999999999999`. This was rejected by `@IsUUID()` (version byte `0` ≠ v4 byte `4`), returning 400 instead of 404. Fixed by using a valid v4-format UUID: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`.

---

### Step 8 — Build + Test

```bash
pnpm --filter @pixecom/api build
# ✅ Zero TypeScript errors

pnpm --filter @pixecom/database db:seed
# ✅ Seeding complete.
# Summary: 3 products, 8 variants, 4 labels, 2 media, 2 thumbs, 2 adtexts, 3 pricing rules, 3 sellpages

pnpm --filter @pixecom/api test:e2e
# ✅ Test Suites: 4 passed, 4 total
# ✅ Tests:       103 passed, 103 total
```

---

### Step 9 — Commit + Push

```bash
git add apps/api/src/app.module.ts \
        apps/api/src/sellpages/ \
        apps/api/test/sellpages.e2e-spec.ts \
        packages/database/prisma/seed.ts

git commit -m "feat(sellpages): milestone 2.2.2 — sellpage module with tenant isolation"
git push origin feature/2.2.2-sellpage-module
```

**Commit:** `edf3e20`
**PR:** https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.2.2-sellpage-module

---

## Problems & Resolutions

### Problem 1 — `ReturnType<typeof this.mapToDto>` in generic return type

**Symptom:** `TS2683: ‘this’ implicitly has type ‘any’ because it does not have a type annotation.`

**Root cause:** TypeScript cannot resolve `typeof this.method` in a generic type context within a class method signature — the `this` inside the return type annotation is treated as the outer scope’s `this` reference.

**Fix:** Moved all mapping functions (`mapToCardDto`, `mapToDetailDto`, `buildUrlPreview`, `buildListWhere`) to module scope (outside the class). This eliminates the `this` reference entirely and the `ReturnType<typeof mapToCardDto>` resolves cleanly.

---

### Problem 2 — `as const` makes `orderBy` readonly, breaking Prisma types

**Symptom:**
```
Type 'readonly [{ readonly isCurrent: "desc"; }, ...]' is not assignable to
type 'AssetThumbnailOrderByWithRelationInput[]'.
The type '...' is 'readonly' and cannot be assigned to the mutable type.
```

**Root cause:** `as const` applied to the entire `SELLPAGE_DETAIL_SELECT` object makes every nested array `readonly`. Prisma’s generated types expect a mutable `AssetThumbnailOrderByWithRelationInput[]`, not `readonly [...]`.

**Fix:** `SELLPAGE_CARD_SELECT` keeps `as const` safely. `SELLPAGE_DETAIL_SELECT` is defined without `as const` and instead uses an explicit cast on the `orderBy` array:

```typescript
orderBy: [
  { isCurrent: 'desc' as const },
  { position: 'asc' as const },
] as { isCurrent?: 'desc' | 'asc'; position?: 'desc' | 'asc' }[],
```

The `as const` on individual string literals (`'desc' as const`) ensures Prisma sees the literal string type, not the broader `string` type.

---

### Problem 3 — Zero-pattern UUID rejected by `@IsUUID()` validator

**Symptom:** Test sending `productId: '00000000-0000-0000-0000-999999999999'` got 400 instead of the expected 404.

**Root cause:** `class-validator`’s `@IsUUID()` defaults to UUID v4 validation. In UUID v4, the version nibble (position 13 in the string) must be `4`. The zero-pattern UUID has `0` at position 13, making it invalid UUID v4.

**Fix:** Changed the test UUID to `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee` — syntactically valid UUID v4 (version nibble is `4`) that does not exist in the DB.

---

## Tenant Isolation — Sellpage Flow

```
HTTP Request
    │
    ▼
JwtAuthGuard ────────────────────── validates JWT signature + expiry
    │
    ▼
@CurrentUser() ───────────────────── extracts { userId, sellerId, role }
    │                                    from JWT payload
    ▼
SellpagesController ──────────────── passes sellerId to service
    │                                    NEVER reads sellerId from route or body
    ▼
SellpagesService.assertSellpageBelongsToSeller(sellerId, id)
    │                                    confirms page.sellerId === JWT sellerId
    ▼
Prisma WHERE { sellerId: <from JWT> }  ── DB enforces isolation
```

A seller can only see and mutate their own sellpages. Attempting to access another seller’s sellpage returns 404 (not 403) to prevent ID enumeration.

---

## Sellpage State Machine

```
         ┌─────────────────────────┐
         │          DRAFT          │
         │  (default on create)    │
         └────────────┼────────────┘
                      │ POST /:id/publish
                      ▼
         ┌─────────────────────────┐
         │        PUBLISHED        │◄──── POST /:id/unpublish returns to DRAFT
         └────────────┼────────────┘
                      │ (future: manual archive)
                      ▼
         ┌─────────────────────────┐
         │        ARCHIVED         │  ← terminal in Phase 1, no transitions out
         └─────────────────────────┘
```

**Error conditions:**
- `publish` on PUBLISHED → 400 "Sellpage is already published"
- `publish` on ARCHIVED → 400 "Cannot publish an archived sellpage"
- `unpublish` on DRAFT → 400 "Only published sellpages can be unpublished"

---

## Files Created / Modified

| File | Action | Lines |
|------|--------|-------|
| `apps/api/src/sellpages/dto/create-sellpage.dto.ts` | **Created** | 38 |
| `apps/api/src/sellpages/dto/update-sellpage.dto.ts` | **Created** | 36 |
| `apps/api/src/sellpages/dto/list-sellpages.dto.ts` | **Created** | 46 |
| `apps/api/src/sellpages/sellpages.service.ts` | **Created** | 469 |
| `apps/api/src/sellpages/sellpages.controller.ts` | **Created** | 115 |
| `apps/api/src/sellpages/sellpages.module.ts` | **Created** | 12 |
| `apps/api/test/sellpages.e2e-spec.ts` | **Created** | 485 |
| `apps/api/src/app.module.ts` | **Modified** | +2 lines |
| `packages/database/prisma/seed.ts` | **Modified** | +115 lines |

---

## Test Summary

```
Test Suites: 4 passed, 4 total
Tests:       103 passed, 103 total (34 new in this milestone)
Snapshots:   0 total
Time:        ~11.5 s
```

| Suite | Tests | Status |
|-------|-------|--------|
| auth.e2e-spec.ts | 19 | ✅ |
| seller.e2e-spec.ts | 13 | ✅ |
| products.e2e-spec.ts | 41 (unchanged) | ✅ |
| sellpages.e2e-spec.ts | 34 (new) | ✅ |
