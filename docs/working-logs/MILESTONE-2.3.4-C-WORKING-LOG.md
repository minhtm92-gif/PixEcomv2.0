# Milestone 2.3.4-C Working Log — Analytics Overview (Business-First KPIs)

**Branch:** `feature/2.3.4c-analytics-overview`
**Base:** `develop` @ `a0b7123`
**Commit:** `2dc6a7a`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — 240 E2E tests pass (227 existing + 13 new)

---

## Scope

Seller-facing analytics overview endpoint. Aggregates order revenue + ad spend to produce business-first KPIs: YouTake, Hold, CashToBalance, ROAS, and per-sellpage/per-source breakdowns.

### Endpoint

```
GET /api/analytics/overview
```

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFrom` | YYYY-MM-DD | today UTC | Start of date range |
| `dateTo` | YYYY-MM-DD | today UTC | End of date range |
| `sellpageId` | UUID | — | Optional — filter to one sellpage |
| `includeSources` | comma-separated | all | Ad sources to include (e.g. `META,GOOGLE`) |
| `timezone` | string | UTC | Accepted but not applied (Phase 1) |

---

## Response Shape

```json
{
  "dateFrom": "2026-02-01",
  "dateTo": "2026-02-19",
  "kpis": {
    "revenue": 5000.00,
    "youTake": 3500.00,
    "hold": 1050.00,
    "cashToBalance": 2450.00,
    "adSpend": 800.00,
    "roas": 6.25,
    "orders": 42,
    "purchases": 38
  },
  "bySource": [
    { "source": "META", "spend": 600.00, "purchases": 28, "revenue": 3800.00, "roas": 6.33 },
    { "source": "GOOGLE", "spend": 200.00, "purchases": 10, "revenue": 1200.00, "roas": 6.00 }
  ],
  "bySellpage": [
    {
      "sellpageId": "uuid",
      "url": "https://domain.com/summer-sale",
      "revenue": 5000.00,
      "orders": 42,
      "youTake": 3500.00,
      "adSpend": 800.00,
      "roas": 6.25
    }
  ]
}
```

---

## Data Sources

| Metric | Source |
|--------|--------|
| Revenue, order count | `orders` table — `status NOT IN (CANCELLED, REFUNDED)` |
| Ad spend, purchases, link clicks | `sellpage_stats_daily` grouped by `sellpageId + adSource` |
| Sellpage URL | `sellpages` join → `domains` for `hostname` |

---

## Money Model

Constants (Phase 1 — no DB config):

```typescript
const DEFAULT_SELLER_TAKE_PERCENT = 0.70;
const DEFAULT_HOLD_PERCENT = 0.30;
```

Calculations:
```
youTake       = revenue × 0.70
hold          = youTake × 0.30
unhold        = 0 (no release events in Phase 1)
cashToBalance = youTake - hold + unhold
```

---

## Query Strategy (3-Query Pattern)

```
Query 1: order.groupBy({ by: ['sellpageId'], _sum: { total }, _count: { id } })
  → Revenue and order count per sellpage

Query 2: sellpageStatsDaily.groupBy({ by: ['sellpageId', 'adSource'], _sum: { adSpend, purchases, linkClicks } })
  → Ad cost and attributed purchases per sellpage per source

Query 3: sellpage.findMany({ where: { id: { in: sellpageIds } }, select: { id, slug, domain } })
  → Sellpage metadata for URL construction
```

Joined in memory — no raw SQL, no complex Prisma joins across unrelated tables.

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/analytics/analytics.module.ts` | Module registration |
| `apps/api/src/analytics/analytics.controller.ts` | GET /analytics/overview |
| `apps/api/src/analytics/analytics.service.ts` | 3-query aggregation + money model |
| `apps/api/src/analytics/dto/overview-query.dto.ts` | 5 query params with transforms |
| `apps/api/test/analytics-overview.e2e-spec.ts` | 13 E2E tests |
| `packages/database/prisma/migrations/20260219210000_analytics_234c/migration.sql` | orders(sellerId, createdAt) index |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `AnalyticsModule` |
| `packages/database/prisma/schema.prisma` | `@@index([sellerId, createdAt])` on Order |

---

## TypeScript Fixes

| Error | Fix |
|-------|-----|
| `TS2307: Cannot find module '@prisma/client'` | Removed unused `import { Prisma }` — API package resolves Prisma through `@pixecom/database` |
| `TS4053: Return type uses 'OverviewResult' which is not exported` | Added `export` keyword to `OverviewResult` interface |

---

## E2E Test Coverage (13 tests)

| # | Test |
|---|------|
| 1 | 401 without JWT |
| 2 | Empty response for fresh seller |
| 3 | Correct revenue + order count |
| 4 | YouTake / Hold / CashToBalance calculation |
| 5 | ROAS = revenue / spend |
| 6 | bySellpage breakdown |
| 7 | bySource breakdown |
| 8 | dateFrom/dateTo filter |
| 9 | sellpageId filter |
| 10 | CANCELLED + REFUNDED orders excluded from revenue |
| 11 | Tenant isolation |
| 12 | includeSources filter |
| 13 | Sellpage URL construction |

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 227 | **240** | +13 |
