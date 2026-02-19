# Milestone 2.3.4-C Working Log — Analytics Overview

**Branch:** `feature/2.3.4c-analytics-overview`
**Base:** `develop` @ `a0b7123`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — All 240 E2E tests pass (227 existing + 13 new)

---

## Scope

Phase 2.3.4-C implements the **seller KPI dashboard overview endpoint**:

- `GET /api/analytics/overview` — aggregated revenue, cost, money model KPIs, bySource breakdown, bySellpage breakdown

**Explicitly out of scope:** ad-set/ad drilldowns, orders CRUD, payout ledger, timezone conversion (all deferred).

---

## Endpoint

### GET /api/analytics/overview

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFrom` | YYYY-MM-DD | today UTC | Start of date range |
| `dateTo` | YYYY-MM-DD | today UTC | End of date range |
| `sellpageId` | UUID | — | Optional sellpage filter |
| `includeSources` | comma-separated | `META` | Ad sources for cost aggregation |
| `timezone` | IANA string | — | Accepted but not applied (Phase 1) |

**Response shape:**
```json
{
  "dateFrom": "2026-02-10",
  "dateTo": "2026-02-10",
  "kpis": {
    "revenue": 600.00,
    "cost": 70.00,
    "youTake": 420.00,
    "hold": 126.00,
    "unhold": 0,
    "cashToBalance": 294.00,
    "roas": 8.5714,
    "orders": 3,
    "purchases": 7
  },
  "bySource": [
    { "source": "META", "spend": 70.00, "roas": 8.5714, "clicks": 280, "purchases": 7 }
  ],
  "bySellpage": [
    {
      "sellpage": { "id": "...", "url": "https://domain.com/slug" },
      "revenue": 500.00,
      "cost": 50.00,
      "youTake": 350.00,
      "hold": 105.00,
      "cashToBalance": 245.00,
      "roas": 10.0,
      "orders": 2
    }
  ]
}
```

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/analytics/analytics.service.ts` | Core service: 3-query overview aggregation |
| `apps/api/src/analytics/analytics.controller.ts` | REST controller: GET /overview |
| `apps/api/src/analytics/analytics.module.ts` | NestJS module registration |
| `apps/api/src/analytics/dto/overview-query.dto.ts` | Query DTO: 5 validated params |
| `apps/api/test/analytics-overview.e2e-spec.ts` | 13 E2E tests |
| `packages/database/prisma/migrations/20260219210000_analytics_234c/migration.sql` | Index on orders(seller_id, created_at) |
| `docs/MILESTONE-2.3.4-C-WORKING-LOG.md` | This file |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `AnalyticsModule` to imports |
| `packages/database/prisma/schema.prisma` | Added `@@index([sellerId, createdAt])` to `Order` |

---

## Data Sources

### Revenue + Orders — `orders` table

```
revenue = SUM(order.total)  WHERE sellerId=X AND createdAt BETWEEN from AND to
                             AND status NOT IN ('CANCELLED', 'REFUNDED')
orders  = COUNT(order.id)   (same filter)
```

Grouped by `sellpageId` for bySellpage breakdown in a single `groupBy` query.

### Cost + Purchases + Clicks — `sellpage_stats_daily` table

```
cost      = SUM(adSpend)    WHERE sellerId=X AND adSource IN sources AND statDate BETWEEN from AND to
purchases = SUM(purchases)
clicks    = SUM(linkClicks)
```

Grouped by `(sellpageId, adSource)` — one query covers both bySellpage and bySource breakdowns.

### Sellpage URLs — `sellpages` table (with domain join)

Fetched in a single batch query for all sellpageIds that appeared in results. URL pattern: `https://{domain.hostname}/{slug}` or `<unassigned-domain>/{slug}`.

---

## Money Formulas (Phase 1 MVP)

```
youTake        = revenue × 0.70      (DEFAULT_SELLER_TAKE_PERCENT)
hold           = youTake × 0.30      (DEFAULT_HOLD_PERCENT)
unhold         = 0                    (no unhold ledger in Phase 1)
cashToBalance  = youTake - hold + unhold
roas           = revenue / cost       (0 if cost = 0)
```

**Why constants, not SellerSettings?**
- `SellerSettings` does not have `sellerTakePercent`/`holdPercent` fields.
- `PricingRule` has those fields but is product-level/platform-owned (not seller-specific).
- Constants defined at module level in `analytics.service.ts` — easy to swap when a seller-level setting is added.

---

## Query Pattern (3 queries)

| # | Query | Purpose |
|---|-------|---------|
| 1 | `order.groupBy({ by: ['sellpageId'], _sum: { total }, _count: { id } })` | Revenue + order count, grouped by sellpage |
| 2 | `sellpageStatsDaily.groupBy({ by: ['sellpageId', 'adSource'], _sum: { adSpend, purchases, linkClicks } })` | Cost + ad metrics, grouped by sellpage+source |
| 3 | `sellpage.findMany({ where: { id: { in: [ids] } }, select: { id, slug, domain } })` | Sellpage slug+domain for URL building |

Total: **3 queries** per request regardless of date range or number of sellpages.

---

## Migration

**Name:** `20260219210000_analytics_234c`

```sql
CREATE INDEX IF NOT EXISTS "orders_seller_id_created_at_idx"
  ON "orders" ("seller_id", "created_at");
```

**Why:** Existing `orders` indexes: `(sellerId, status)` and `(sellerId, sellpageId)`. No date-range index existed. Revenue aggregation filters by `(sellerId, createdAt BETWEEN x AND y)` — without this index, a full seller-scoped table scan would be required.

**Applied via:** Direct `psql` injection + manual `_prisma_migrations` registration.

---

## Issues Encountered & Fixes

### Issue 1: `import { Prisma } from '@prisma/client'` not resolving

**Symptom:** TS2307 — module not found. The API package resolves Prisma via the database package, not a direct `@prisma/client` dependency.

**Fix:** Removed the unused import. No Prisma namespace types were actually needed in the service.

### Issue 2: `OverviewResult` interface not exported — TS4053

**Symptom:** Controller method return type uses `OverviewResult` from service module but it wasn't exported, so TypeScript couldn't name it in declarations.

**Fix:** Added `export` to the `OverviewResult` interface in `analytics.service.ts`.

---

## E2E Test Coverage (13 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | 401 without JWT | Auth guard |
| 2 | All zeros for far-future date | Zero state + response shape |
| 3 | Revenue + orders computed correctly | Order aggregation (3 confirmed orders = 600) |
| 4 | youTake / hold / cashToBalance | Money model derivation (70%/30%) |
| 5 | Cost from sellpage_stats_daily | Ad spend aggregation (50+20=70) |
| 6 | ROAS = revenue/cost | ROAS calculation (600/70≈8.57) |
| 7 | Purchases from sellpage_stats_daily | Purchases aggregation (5+2=7) |
| 8 | sellpageId filter scopes both revenue and cost | Sellpage filter isolation |
| 9 | bySellpage sum = kpis totals | Breakdown consistency |
| 10 | bySource row present for META | Source breakdown |
| 11 | Tenant isolation | Seller B sees own 9999, not Seller A's 600 |
| 12 | CANCELLED + REFUNDED excluded | Order status filter |
| 13 | Stats + orders outside date range excluded | Date boundary precision |

---

## Curl Examples

```bash
# Today's overview (default)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/analytics/overview"

# Date range
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/analytics/overview?dateFrom=2026-02-01&dateTo=2026-02-19"

# Filtered by sellpage
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/analytics/overview?dateFrom=2026-02-10&dateTo=2026-02-10&sellpageId=<uuid>"

# Multi-source (future)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/analytics/overview?includeSources=META,GOOGLE"
```

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 227 | **240** | +13 |

All 9 existing test suites continued to pass unmodified.
