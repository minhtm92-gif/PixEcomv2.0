# Milestone 2.2.1 — Product Catalog (Read-only) + Pricing Preview Working Log

**Status:** ✅ Complete — awaiting CTO approval before merge
**Branch:** `feature/2.2.1-product-catalog`
**Commit:** `e3e5398` (`e3e539830a6788d87370e074b8afcc690c8827ad`)
**PR:** https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.2.1-product-catalog
**Date:** 2026-02-18
**Tests:** 41 new e2e tests → **69 total (28 prev + 41 new), all passing**

---

## Scope

Implement read-only product catalog and creative asset browsing for the seller portal.
Sellers can browse the shared platform catalog, see variants, pricing preview
(`youTakeEstimate`), labels, and all creative assets. No mutations, no schema changes.

**Key constraints:**
- Products are **platform-level** — `NO sellerId` scoping on catalog queries
- All endpoints still **require JWT** (seller portal, authenticated context)
- `youTakeEstimate` is deterministic — no order/ad-spend involvement
- Phase 1 asset stats are **stubs** (`spend: 0, roas: null`) — MetaProvider wired in Phase 2
- Zero schema changes (uses existing `Product`, `ProductVariant`, `ProductLabel`,
  `AssetMedia`, `AssetThumbnail`, `AssetAdtext`, `PricingRule` from 2.1.1)

---

## Endpoints Delivered

### ProductsModule
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/products` | Paginated catalog of ACTIVE products |
| `GET` | `/api/products/:id` | Full product detail + active variants |
| `GET` | `/api/products/:id/variants` | Active variants list (separate endpoint) |

### AssetsModule
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/products/:id/assets/media` | Media assets (video + image) |
| `GET` | `/api/products/:id/assets/thumbnails` | Thumbnail assets |
| `GET` | `/api/products/:id/assets/adtexts` | Ad text assets |

---

## Step 1 — Branch Setup

```bash
git checkout -b feature/2.2.1-product-catalog
# branched from main @ 72ee379
```

---

## Step 2 — DTOs

### `apps/api/src/products/dto/list-products.dto.ts`

```typescript
export class ListProductsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;

  @IsOptional() @IsString() @MaxLength(100)
  label?: string;           // filter by label slug

  @IsOptional() @IsString() @MaxLength(255)
  q?: string;               // case-insensitive search: name OR productCode
}
```

**Design decisions:**
- `@Type(() => Number)` — class-transformer coerces query string `"1"` → number `1`
- `page` min is 1 (not 0) — 1-based pagination, 400 on `page=0`
- No `max` on `limit` in DTO (kept simple); service enforces `Math.min(limit, 100)`
- `label` takes a slug string, not an ID — human-readable, stable URLs

### `apps/api/src/products/dto/product-card.dto.ts`

TypeScript interface (not class-validator DTO — it's an output shape, not validated input):

```typescript
export interface ProductCardDto {
  id: string;
  code: string;
  name: string;
  slug: string;
  heroImageUrl: string | null;
  suggestedRetailPrice: string;   // Prisma Decimal serialised as string
  youTakeEstimate: string | null; // null if no active pricing rule
  labels: ProductLabelDto[];
}
```

`suggestedRetailPrice` comes from the **active PricingRule's `suggestedRetail`**,
falling back to `Product.basePrice` only if no active rule exists.

### `apps/api/src/products/dto/product-detail.dto.ts`

Extends `ProductCardDto` with:
- `variants: ProductVariantDto[]` — active variants, ordered by `position asc`
- `description`, `descriptionBlocks`, `shippingInfo`, `tags`, `currency`, `status`
- `createdAt`, `updatedAt` (ISO 8601 strings)

`ProductVariantDto` introduces `effectivePrice`:
```
effectivePrice = priceOverride ?? product.basePrice
```

---

## Step 3 — ProductsService

### List (`listProducts`)

Uses a `$transaction([findMany, count])` to atomically fetch page + total in one round-trip.

Pricing rule subquery (nested relation filter inside `select`):
```typescript
pricingRules: {
  where: {
    isActive: true,
    effectiveFrom: { lte: new Date() },
    OR: [
      { effectiveUntil: null },
      { effectiveUntil: { gt: new Date() } },
    ],
  },
  orderBy: { effectiveFrom: 'desc' },
  take: 1,   // ← most recently effective rule wins
  select: { suggestedRetail, sellerTakePercent, sellerTakeFixed },
}
```

Hero image (thumbnail) subquery:
```typescript
assetThumbs: {
  orderBy: [{ isCurrent: 'desc' }, { position: 'asc' }],
  take: 1,   // ← prefer isCurrent=true, then lowest position
  select: { url: true },
}
```

### Where clause builder (`buildListWhere`)

Builds an `AND` conditions array so filters compose cleanly:
```typescript
const conditions = [{ status: 'ACTIVE' }];
if (dto.label) conditions.push({ labels: { some: { label: { slug: dto.label } } } });
if (dto.q)    conditions.push({ OR: [{ name: { contains: q, mode: 'insensitive' } },
                                     { productCode: { contains: q, mode: 'insensitive' } }] });
return { AND: conditions };
```

### `mapToCard` — Pricing logic

```typescript
if (rule.sellerTakeFixed !== null) {
  // FIXED OVERRIDE: use the fixed amount exactly
  youTakeEstimate = rule.sellerTakeFixed.toString();
} else {
  // PERCENTAGE: suggestedRetail × (sellerTakePercent / 100)
  const pct = Number(rule.sellerTakePercent) / 100;
  const estimate = Number(rule.suggestedRetail) * pct;
  youTakeEstimate = estimate.toFixed(2);   // 2dp string
}
```

**Priority:** fixed > percentage > null (no rule). Fully deterministic — no runtime
variables (no order data, no ad spend).

### `mapToVariant` — effectivePrice

```typescript
effectivePrice = variant.priceOverride !== null
  ? variant.priceOverride.toString()   // variant-level override
  : basePrice.toString();              // fall back to product base price
```

---

## Step 4 — ProductsController

```typescript
@Controller('products')
@UseGuards(JwtAuthGuard)              // class-level guard: all routes protected
export class ProductsController {
  @Get()          listProducts(@Query() query: ListProductsDto)
  @Get(':id')     getProduct(@Param('id', ParseUUIDPipe) id: string)
  @Get(':id/variants') getVariants(@Param('id', ParseUUIDPipe) id: string)
}
```

`ParseUUIDPipe` on `:id` — returns 400 for non-UUID values before hitting the service.

---

## Step 5 — AssetsService

Three methods (`getMedia`, `getThumbnails`, `getAdtexts`) all follow the same pattern:

1. `assertProductActive(productId)` — shared private method, throws 404 if not found/ACTIVE
2. `findMany({ where: { productId }, orderBy: [...] })`
3. Spread `STUB_STATS = { spend: 0, roas: null }` onto each returned item

```typescript
const STUB_STATS = { spend: 0, roas: null as number | null };

// Each item:
return rows.map(r => ({ ...r, ...STUB_STATS, createdAt: r.createdAt.toISOString() }));
```

**Why stub stats?** Phase 1 has no MetaProvider. The fields are reserved in the response
shape so frontend consumers can render placeholders without a schema change later.

Ordering:
- Media: `[{ version: 'asc' }, { position: 'asc' }]` — version sorts `b1 < v1` alphabetically
- Thumbnails: `[{ version: 'asc' }, { position: 'asc' }]`
- Adtexts: `[{ version: 'asc' }]`

---

## Step 6 — AssetsController

```typescript
@Controller('products/:productId/assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  @Get('media')       getMedia(@Param('productId', ParseUUIDPipe) productId: string)
  @Get('thumbnails')  getThumbnails(...)
  @Get('adtexts')     getAdtexts(...)
}
```

Nested under `products/:productId/assets/*` — keeps URL structure hierarchical
and consistent with the product resource.

---

## Step 7 — Modules

### `products.module.ts`
```typescript
@Module({
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],  // exported for future Sellpage/Order modules
})
```

### `assets.module.ts`
```typescript
@Module({
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
```

### `app.module.ts` update
```typescript
imports: [..., SellerModule, ProductsModule, AssetsModule]
```

---

## Step 8 — Seed Script

**File:** `packages/database/prisma/seed.ts` — full implementation replacing stub.
Idempotent: all writes use `upsert` with fixed IDs or unique slugs.

### Products seeded

| Code | Product | Labels | Pricing | youTakeEstimate |
|------|---------|--------|---------|----------------|
| MOUSE-001 | SlimPro Wireless Mouse | bestseller, trending | % — 49.99 × 40% | **20.00** |
| STAND-001 | ProStand Laptop Stand | bestseller, new-arrival | fixed — 15.00 | **15.00** |
| DESKPAD-001 | UltraClean Desk Pad | limited-edition, trending | % — 39.99 × 35% | **14.00** |

### Variants (8 total)
| Product | Variants | priceOverride |
|---------|----------|--------------|
| MOUSE-001 | Black, White, Rose Gold | Rose Gold: 32.99 |
| STAND-001 | Silver, Space Gray | Space Gray: 37.99 |
| DESKPAD-001 | Black/XL, Grey/XL, Pink/XL | Pink/XL: 26.99 |

### Assets (on MOUSE-001 only)
| Type | Items | Versions |
|------|-------|---------|
| AssetMedia | 2 | v1 (main video), b1 (B-roll lifestyle) |
| AssetThumbnail | 2 | v1 (isCurrent=true), b1 |
| AssetAdtext | 2 | v1 (with description), b1 (description=null) |

### Seed run output
```
Seeding database...
Labels seeded
Product 1 (SlimPro Wireless Mouse) seeded
Product 2 (ProStand Laptop Stand) seeded
Product 3 (UltraClean Desk Pad) seeded
Summary: 3 products, 8 variants, 4 labels, 2 media, 2 thumbs, 2 adtexts, 3 pricing rules
Seeding complete.
```

---

## Step 9 — E2E Tests

**File:** `apps/api/test/products.e2e-spec.ts` — 671 lines, 41 tests across 11 describe blocks.

### Test helper pattern

```typescript
// Discover product IDs by code in beforeAll — no hardcoded IDs in tests
const listRes = await request(app.getHttpServer())
  .get('/api/products?limit=100')
  .set('Authorization', `Bearer ${accessToken}`)
  .expect(200);

mouseProductId = products.find(p => p.code === 'MOUSE-001')?.id ?? '';
```

This pattern makes tests resilient to DB state — IDs are resolved at runtime
rather than hardcoded.

### Test matrix (41 tests)

| Describe block | Tests | What's verified |
|---------------|-------|-----------------|
| Auth guard (4) | 401 on all 4 endpoints without token | Guards active |
| Pagination (4) | Default params, page/limit, page 2 differs from page 1, invalid page=0 → 400 | Pagination correct |
| Label filter (4) | bestseller, limited-edition, trending, nonexistent | Filter correct |
| Search (5) | Name match, code match, desk search, no-match, case-insensitive | Search correct |
| Product card shape (2) | Required fields present, heroImageUrl = v1 thumbnail | Serialisation correct |
| GET /products/:id (6) | Full detail, variant fields, Rose Gold priceOverride, Black basePrice, 404, 400 non-UUID | Detail + variants |
| GET /variants (2) | Array returned, ordered by position | Separate endpoint |
| Asset endpoints (8) | Media count, fields+stubs, order, thumbnails, thumb stubs, adtexts, adtext fields, empty arrays | Assets complete |
| youTakeEstimate % case (3) | MOUSE-001 card, MOUSE-001 detail, DESKPAD-001 | Percentage math |
| youTakeEstimate fixed (2) | STAND-001 card (15.00 not 13.75), STAND-001 detail | Fixed override |
| Only ACTIVE in catalog (1) | All returned products verify as status=ACTIVE | Visibility gate |

**Key pricing assertions:**
```typescript
// Percentage case
expect(parseFloat(mouse.youTakeEstimate)).toBeCloseTo(20.0, 2);  // 49.99 × 40%

// Fixed override — must NOT be percentage result
expect(parseFloat(stand.youTakeEstimate)).toBeCloseTo(15.0, 2);   // 15.00, not 13.75
```

**Results: 69/69 tests passing** (28 from 2.1.x + 41 new)

---

## Problems & Resolutions

### Problem 1 — `@prisma/client/runtime/library` import not found

**Symptom:** TypeScript build error: `Cannot find module '@prisma/client/runtime/library'`
```
src/products/products.service.ts:2:25 - error TS2307:
Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

**Root cause:** `Decimal` was imported from the Prisma runtime library path, which is
an internal path not guaranteed to be stable across versions. In Prisma 5, this path
may not be directly importable depending on the build configuration.

**Resolution:** Replaced `Decimal` type with a structural TypeScript interface:
```typescript
// Before
basePrice: Decimal

// After — structural type that matches Prisma's Decimal
basePrice: { toString(): string }
```

This is safer than importing from an internal path and works correctly because
Prisma's `Decimal` class does implement `toString()`. The `Number()` coercion in the
service (`Number(rule.sellerTakePercent)`) also works because Prisma Decimal is
coercible to number.

**Lesson:** Never import from `@prisma/client/runtime/*` — use structural types or
import `Prisma.Decimal` from `@prisma/client` if needed.

### Problem 2 — Seed heredoc truncated by bash

**Symptom:** Writing `seed.ts` via bash heredoc (`cat > file << 'SEEDEOF'`) produced
a truncated file (only 104 lines instead of 165). The `SEEDEOF` delimiter was
interpreted early due to line ending/encoding issues on Windows.

**Root cause:** Bash on Windows (Git Bash / MSYS2) handles CRLF in heredocs
inconsistently — the delimiter match can fail or match early.

**Resolution:** Used a Python-style Node.js `fs.writeFileSync` approach via a
background `Task` agent that split the write into sequential `appendFileSync` calls
with all special characters properly escaped.

**Lesson:** For large multi-line TypeScript files on Windows, use the `Write` tool
(which is not subject to shell escaping) or write via a subprocess that avoids
heredoc entirely.

---

## Architecture Notes

### Platform vs Tenant data model

```
Platform layer (no sellerId)          Seller layer (scoped by sellerId)
─────────────────────────────         ──────────────────────────────────
Product                               Seller
  └── ProductVariant                  Sellpage ──────────────── Product (FK)
  └── ProductLabel (m:m)              Order
  └── AssetMedia                      Campaign
  └── AssetThumbnail
  └── AssetAdtext
  └── PricingRule
```

The read-only catalog endpoints have NO `WHERE sellerId = ?` clauses because
products are shared across all sellers. Authentication is still required
(JWT guard) to ensure only registered sellers can access the portal.

### PricingRule selection logic

```
Query: isActive=true AND effectiveFrom <= NOW AND (effectiveUntil IS NULL OR effectiveUntil > NOW)
Sort:  effectiveFrom DESC
Take:  1   ← most recently activated rule

Result:
  sellerTakeFixed != null  →  youTakeEstimate = sellerTakeFixed (fixed override)
  sellerTakeFixed == null  →  youTakeEstimate = suggestedRetail × (pct / 100) (% calc)
  no result                →  youTakeEstimate = null
```

This logic is co-located in `mapToCard()` which is called identically by
`listProducts` and `getProduct` — single source of truth.

### Variant effectivePrice

```
variant.priceOverride != null  →  effectivePrice = priceOverride   (variant-level)
variant.priceOverride == null  →  effectivePrice = product.basePrice (fallback)
```

Used in both `getProduct()` (included in detail) and `getVariants()` (standalone endpoint).

### Asset stub stats

Every asset item in Phase 1 gets:
```typescript
const STUB_STATS = { spend: 0, roas: null as number | null };
```

This is a constant defined at module scope in `AssetsService`.
The fields are reserved in the JSON response for Phase 2 when MetaProvider
supplies real spend/ROAS data per asset version.

---

## Files Created / Modified

| File | Lines | Action |
|------|-------|--------|
| `apps/api/src/products/dto/list-products.dto.ts` | 51 | Created |
| `apps/api/src/products/dto/product-card.dto.ts` | 43 | Created |
| `apps/api/src/products/dto/product-detail.dto.ts` | 36 | Created |
| `apps/api/src/products/products.service.ts` | 361 | Created |
| `apps/api/src/products/products.controller.ts` | 69 | Created |
| `apps/api/src/products/products.module.ts` | 11 | Created |
| `apps/api/src/assets/assets.service.ts` | 201 | Created |
| `apps/api/src/assets/assets.controller.ts` | 67 | Created |
| `apps/api/src/assets/assets.module.ts` | 11 | Created |
| `apps/api/test/products.e2e-spec.ts` | 671 | Created |
| `packages/database/prisma/seed.ts` | 165 | Modified (full implementation) |
| `apps/api/src/app.module.ts` | +4 lines | Modified (added ProductsModule, AssetsModule) |

**Total:** 1,670 lines added

---

## curl Examples (for manual verification)

```bash
# 1. Get token (register test seller)
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"catalog-test@pixecom.io","password":"Test12345","displayName":"CatalogTest"}' \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).accessToken))")

# 2. List catalog (all ACTIVE, paginated)
curl "http://localhost:3001/api/products" \
  -H "Authorization: Bearer $TOKEN"

# 3. Filter by label
curl "http://localhost:3001/api/products?label=bestseller" \
  -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/products?label=limited-edition" \
  -H "Authorization: Bearer $TOKEN"

# 4. Search
curl "http://localhost:3001/api/products?q=wireless" \
  -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/products?q=MOUSE-001" \
  -H "Authorization: Bearer $TOKEN"

# 5. Pagination
curl "http://localhost:3001/api/products?page=1&limit=2" \
  -H "Authorization: Bearer $TOKEN"

# 6. Product detail (replace {ID} with actual product UUID)
curl "http://localhost:3001/api/products/{ID}" \
  -H "Authorization: Bearer $TOKEN"

# 7. Variants (separate endpoint)
curl "http://localhost:3001/api/products/{ID}/variants" \
  -H "Authorization: Bearer $TOKEN"

# 8. Assets (for MOUSE-001 product ID)
curl "http://localhost:3001/api/products/{MOUSE_ID}/assets/media" \
  -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/products/{MOUSE_ID}/assets/thumbnails" \
  -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/products/{MOUSE_ID}/assets/adtexts" \
  -H "Authorization: Bearer $TOKEN"

# 9. Auth guard test
curl "http://localhost:3001/api/products"       # → 401 Unauthorized
curl "http://localhost:3001/api/products/{ID}"  # → 401 Unauthorized

# 10. Invalid UUID
curl "http://localhost:3001/api/products/not-a-uuid" \
  -H "Authorization: Bearer $TOKEN"
# → 400 Bad Request (ParseUUIDPipe)
```

---

## What's Next — Milestone 2.2.2

Per system architecture, the next milestone is likely:
- Sellpage Module (seller-scoped pages that reference platform products)
- Or dashboard / analytics stub endpoints

**This PR must be approved and merged before 2.2.2 begins.**
No tag in this milestone — `v0.2.0` is applied only when full 2.2 track is complete.
