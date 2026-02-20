# Milestone 2.3.4-B Working Log — Ads Manager 3-Tier Read Layer

**Branch:** `feature/2.3.4b-ads-manager-3tier`
**Base:** `develop` @ `46242c4`
**Date:** 2026-02-20
**Status:** ✅ COMPLETE — 257 E2E tests pass (241 existing + 16 new)

---

## Scope

Ads Manager full 3-tier read layer: Campaign → Adset → Ad. Each tier returns identical metric columns aligned to the METRICS-CONTRACT. Includes filters endpoint for dropdown data.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ads-manager/campaigns` | Campaign list with full metrics |
| `GET` | `/api/ads-manager/adsets` | Adset list (requires `campaignId`) with full metrics |
| `GET` | `/api/ads-manager/ads` | Ad list (requires `adsetId`) with full metrics |
| `GET` | `/api/ads-manager/filters` | Dropdown data: campaigns, adsets, ads, statusEnums |

---

## Metrics Contract

All metric columns are present at every level. Source: `ad_stats_daily` — raw counts summed first, ratios derived after.

| Column | Formula | Source |
|--------|---------|--------|
| `spend` | SUM(spend) | ad_stats_daily |
| `impressions` | SUM(impressions) | ad_stats_daily |
| `clicks` | SUM(linkClicks) | ad_stats_daily |
| `ctr` | clicks / impressions × 100 | derived |
| `cpc` | spend / clicks | derived |
| `contentViews` | SUM(contentViews) | ad_stats_daily |
| `costPerContentView` | spend / contentViews | derived |
| `checkout` | SUM(checkoutInitiated) | ad_stats_daily |
| `costPerCheckout` | spend / checkout | derived |
| `purchases` | SUM(purchases) | ad_stats_daily |
| `roas` | SUM(purchaseValue) / spend | derived |
| `cr` | purchases / contentViews × 100 | derived |
| `cr1` | checkout / contentViews × 100 | derived |
| `cr2` | purchases / checkout × 100 | derived |
| `storeMetricsPending` | `true` when no stats rows in range | flag |

**Key rule:** `safeDivide(n, d)` returns `0` when `d = 0` — never null, never NaN. Per METRICS-CONTRACT.md (frozen).

**Summary row:** Aggregated from raw sum of all entityIds, not sum of derived columns.

---

## Platform + Budget

| Entity | `platform` | `budgetPerDay` |
|--------|-----------|---------------|
| Campaign | `"META"` (Phase 1 hardcoded) | `campaign.budget` when `budgetType=DAILY`, else `null` |
| Adset | `"META"` | `null` (no budget field in schema) |
| Ad | `"META"` | `null` (no budget field in schema) |

---

## storeMetricsPending Behaviour

`storeMetricsPending: true` is returned when ALL of these conditions are true:
- `spend = 0`
- `impressions = 0`
- `linkClicks = 0`
- `contentViews = 0`
- `purchases = 0`

This happens when no `ad_stats_daily` rows exist for the entity in the requested date range. The frontend uses this flag to show a skeleton/pending state instead of zeros.

**Not a schema concern** — Phase 1 stats come from MockProvider writing to `ad_stats_daily`. When MetaProvider is wired in Phase 2, the flag becomes `false` automatically.

---

## Tenant Isolation

- `sellerId` always sourced from JWT — never from query params
- Campaign query: `WHERE seller_id = sellerId`
- Adset query: `WHERE seller_id = sellerId AND campaign_id = campaignId` — even if a caller passes a `campaignId` belonging to another seller, `sellerId` constraint returns 0 results (not 403, not data leak)
- Ad query: `WHERE seller_id = sellerId AND adset_id = adsetId` — same isolation pattern

---

## Query Strategy

### Single-pass aggregation pattern (all 3 levels)

```
1. findMany(entities)                         -- fetch entity records for this seller
2. adStatsDaily.groupBy([entityId])           -- sum raw counts per entity in date range
   _sum: spend, impressions, linkClicks,
         contentViews, checkoutInitiated,
         purchases, purchaseValue
3. buildStatsMap(statRows)                    -- O(n) keyed map: entityId → RawAdStats
4. entities.map(e => computeMetrics(statsMap[e.id] ?? zeroRaw()))
5. aggregateSummary(statsMap) → computeMetrics()   -- summary row from raw totals
```

**Why no join?** `groupBy + in` is 2 queries total (entity + stats). This avoids N+1 and keeps the query plan predictable.

**Date range filter:** `statDate: { gte: dateFrom, lte: dateTo }` — only applied if params are present.

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/ads-manager/ads-manager.module.ts` | NestJS module registration |
| `apps/api/src/ads-manager/ads-manager.controller.ts` | 4 GET endpoints |
| `apps/api/src/ads-manager/ads-manager-read.service.ts` | 3-tier aggregation service |
| `apps/api/src/ads-manager/ads-manager.constants.ts` | safeDivide, computeMetrics, zeroRaw, buildDateRange |
| `apps/api/src/ads-manager/dto/campaigns-query.dto.ts` | dateFrom, dateTo, status |
| `apps/api/src/ads-manager/dto/adsets-query.dto.ts` | campaignId (required), dateFrom, dateTo, status |
| `apps/api/src/ads-manager/dto/ads-query.dto.ts` | adsetId (required), dateFrom, dateTo, status |
| `apps/api/src/ads-manager/dto/filters-query.dto.ts` | campaignId?, adsetId? |
| `apps/api/test/ads-manager.e2e-spec.ts` | 16 E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `AdsManagerModule` |

---

## E2E Test Coverage (16 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | 401 without JWT — campaigns | Auth guard |
| 2 | Empty list for fresh seller | Zero-state shape |
| 3 | Returns campaigns with all metrics columns | Full contract |
| 4 | `storeMetricsPending=true` when no stats rows | Flag behaviour |
| 5 | 401 without JWT — adsets | Auth guard |
| 6 | Returns only adsets under `campaignId` + seller scope | Scope filter |
| 7 | Seller B cannot see seller A adsets (tenant isolation) | Isolation |
| 8 | All metric columns present in adset response | Contract |
| 9 | 401 without JWT — ads | Auth guard |
| 10 | Returns only ads under `adsetId` + seller scope | Scope filter |
| 11 | Seller B cannot see seller A ads (tenant isolation) | Isolation |
| 12 | All metric columns present in ad response | Contract |
| 13 | Filters returns campaigns + adsets (campaignId) + ads (adsetId) + statusEnums | Filters shape |
| 14 | Status filter returns only matching status | Filter correctness |
| 15 | Metrics derivation: CTR, CPC, ROAS, CR, CR1, CR2 all correct | Math validation |
| 16 | `storeMetricsPending=false` when stats rows exist | Flag behaviour |

---

## No Schema Changes

No Prisma migration required. All data sourced from existing tables:
- `campaigns`, `adsets`, `ads` — entity metadata
- `ad_stats_daily` — metrics (written by stats worker)
- No new indexes needed (existing `@@index([sellerId, statDate])` on `ad_stats_daily` covers the query)

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 241 | **257** | +16 |
