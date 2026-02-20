# Milestone 2.3.5 Working Log — Ads Manager Store Metrics Join

**Branch:** `feature/2.3.5-store-metrics-join`
**Base:** `develop` @ `0def8ab` (post 2.3.4-B)
**Date:** 2026-02-20
**Status:** ✅ COMPLETE — 270 E2E tests run; 265 passing (13 new, all green). 5 pre-existing failures unrelated to this milestone.

---

## Scope

UTM attribution layer + `store_entity_stats_daily` rollup table + join into all 3 Ads Manager tiers. Store-side metrics (contentViews, checkouts, purchases, revenue) now source from order UTM data rather than `ad_stats_daily`.

### What Changed

| Layer | Change |
|-------|--------|
| DB schema | New `store_entity_stats_daily` table; UTM fields added to `orders` |
| Migration | `20260220100000_store_entity_stats` applied via docker psql pipe |
| New service | `StoreMetricsService` — upsertFromOrders + getStoreStatsMap |
| Constants rewrite | `RawAdStats` / `RawStoreStats` split; `computeMetrics` takes both inputs |
| Service rewrite | `AdsManagerReadService` — 3-source join at all 3 levels |
| Tests | 13 new E2E tests in `ads-manager-store-join.e2e-spec.ts` |
| Test fix | `ads-manager.e2e-spec.ts` test #15 updated to seed `store_entity_stats_daily` |

---

## Architecture

### Two-source metrics join (frozen)

```
ad_stats_daily           store_entity_stats_daily
  spend                    contentViews
  impressions              checkouts
  linkClicks               purchases
                           revenue
       ↓                        ↓
   RawAdStats             RawStoreStats
            ↘            ↙
           computeMetrics(ad, store)
                  ↓
            DerivedMetrics
  spend / impressions / clicks
  ctr (clicks/impressions×100)   ← ads-side
  cpc (spend/clicks)             ← ads-side
  contentViews                   ← store-side
  costPerContentView (spend/cv)  ← cross
  checkout                       ← store-side
  costPerCheckout (spend/co)     ← cross
  purchases                      ← store-side
  roas (revenue/spend)           ← cross-source
  cr  (purchases/cv×100)         ← store-side
  cr1 (checkouts/cv×100)         ← store-side
  cr2 (purchases/co×100)         ← store-side
  storeMetricsPending            ← true when BOTH sources zero
```

### UTM attribution standard

| UTM field | Format | Level |
|-----------|--------|-------|
| `utm_campaign` | `c_<campaignId>` | CAMPAIGN |
| `utm_term` | `as_<adsetId>` | ADSET |
| `utm_content` | `a_<adId>` | AD |

**UTM N/A isolation:** Orders with any UTM field = `'N/A'` or `null` are **never** rolled up. They are completely excluded from `upsertFromOrders()` and never appear in `store_entity_stats_daily`.

### storeMetricsPending logic

`storeMetricsPending: true` when ALL of:
- `ad.spend = 0` AND `ad.impressions = 0` AND `ad.linkClicks = 0`
- `store.contentViews = 0` AND `store.checkouts = 0` AND `store.purchases = 0` AND `store.revenue = 0`

Triggers when no `ad_stats_daily` rows AND no `store_entity_stats_daily` rows exist for the entity in the requested date range.

---

## Migration Strategy

**No `db push` allowed.** Applied SQL directly:

```bash
cat packages/database/prisma/migrations/20260220100000_store_entity_stats/migration.sql \
  | docker exec -i pixecom-postgres psql -U pixecom -d pixecom_v2
```

Then registered in `_prisma_migrations` via manual INSERT so Prisma deploy sees it as applied.

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/ads-manager/store-metrics.service.ts` | UTM rollup + store stats reader |
| `apps/api/test/ads-manager-store-join.e2e-spec.ts` | 13 new E2E tests |
| `packages/database/prisma/migrations/20260220100000_store_entity_stats/migration.sql` | DB migration |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/ads-manager/ads-manager.constants.ts` | Split RawAdStats/RawStoreStats; computeMetrics takes both; fix CAMPAIGN_STATUSES (DELETED not DRAFT) |
| `apps/api/src/ads-manager/ads-manager-read.service.ts` | 3-source join at Campaign/Adset/Ad levels; uses StoreMetricsService |
| `apps/api/src/ads-manager/ads-manager.module.ts` | Added StoreMetricsService to providers + exports |
| `apps/api/test/ads-manager.e2e-spec.ts` | Seed store_entity_stats_daily in beforeAll; fix test #15 (ROAS/CR assertions) |
| `packages/database/prisma/schema.prisma` | Order UTM fields + StoreEntityStatsDaily model + Seller relation |

---

## Metrics Contract Changes

| Metric | Before 2.3.5 | After 2.3.5 |
|--------|-------------|------------|
| `contentViews` | `ad_stats_daily.contentViews` | `store_entity_stats_daily.content_views` |
| `checkout` | `ad_stats_daily.checkoutInitiated` | `store_entity_stats_daily.checkouts` |
| `purchases` | `ad_stats_daily.purchases` | `store_entity_stats_daily.purchases` |
| `roas` | `ad_stats_daily.purchaseValue / spend` | `store_entity_stats_daily.revenue / spend` |
| `cr` | `ad_stats_daily.purchases / contentViews × 100` | `store.purchases / store.contentViews × 100` |
| `cr1` | `ad_stats_daily.checkoutInitiated / contentViews × 100` | `store.checkouts / store.contentViews × 100` |
| `cr2` | `ad_stats_daily.purchases / checkoutInitiated × 100` | `store.purchases / store.checkouts × 100` |

`ad_stats_daily.contentViews`, `checkoutInitiated`, `purchases`, `purchaseValue` fields still exist in schema (for stats worker compatibility) but are **no longer used by computeMetrics**.

---

## E2E Test Coverage (13 new tests)

| # | Test | Validates |
|---|------|-----------
| 1 | Campaign join — store stats appear in response | Two-source join works |
| 2 | CR math — cr=10, cr1=20, cr2=50, roas=15 | Math correctness |
| 3 | ROAS = store.revenue / ad.spend (cross-source) | Cross-source ROAS |
| 4 | UTM N/A orders excluded from store stats | N/A isolation |
| 5 | Null UTM orders excluded from store stats | Null isolation |
| 6 | Adset level join — store stats appear | Adset tier |
| 7 | Ad level join — store stats appear | Ad tier |
| 8 | Tenant isolation — seller B order using seller A campaign ID excluded | Tenant safety |
| 9 | storeMetricsPending=false when store stats seeded | Flag behaviour |
| 10 | storeMetricsPending=true when only N/A orders (no store stats) | Flag behaviour |
| 11 | Summary row — aggregates raw counts across all entities | Summary correctness |
| 12 | costPerContentView = spend / contentViews | Derived metric |
| 13 | costPerCheckout = spend / checkouts | Derived metric |

---

## Issues Encountered

### Issue 1 — Migration pipe method
`docker exec -i pixecom-postgres psql -U pixecom -d pixecom_v2 -f /dev/stdin` failed silently.
**Fix:** Used stdin redirect: `cat migration.sql | docker exec -i pixecom-postgres psql ...`

### Issue 2 — CAMPAIGN_STATUSES had wrong values
Constants file had `'DRAFT'` and `'COMPLETED'` in `CAMPAIGN_STATUSES`. Actual schema enum is `ACTIVE|PAUSED|ARCHIVED|DELETED`.
**Fix:** Updated to `['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']`.

### Issue 3 — ads-manager.e2e-spec.ts test #15 failed after architecture change
Old test seeded `purchaseValue=1500` into `ad_stats_daily` and expected `roas=15`. After 2.3.5, ROAS sources from `store_entity_stats_daily.revenue` (not `purchaseValue`).
**Fix:** Added `store_entity_stats_daily` seeds for Campaign A, Adset 1, and Ad 1 in `beforeAll`. Assertions unchanged — math still holds.

---

## Query Strategy

### Per-tier join pattern (Campaign / Adset / Ad levels)

```
1. findMany(entities)                                  — entity records for this seller
2. adStatsDaily.groupBy([entityId])                    — ads-side raw: spend, impressions, linkClicks
   _sum: spend, impressions, linkClicks
3. storeMetrics.getStoreStatsMap(level, entityIds)     — store-side: contentViews, checkouts, purchases, revenue
4. entities.map(e =>
     computeMetrics(adMap[e.id] ?? zeroAdRaw(), storeMap[e.id] ?? zeroStoreRaw())
   )
5. Summary: computeMetrics(
     aggregateAdSummary(adMap),
     aggregateStoreSummary(storeMap)
   )
```

**Total queries per endpoint:** 3 (entities + ad stats + store stats). No N+1. No joins in SQL.

---

## Test Summary

| Suite | Before 2.3.5 | After 2.3.5 | Delta |
|-------|-------------|------------|-------|
| `ads-manager.e2e-spec.ts` | 16 (1 failing) | 16 (all pass) | Fixed test #15 |
| `ads-manager-store-join.e2e-spec.ts` | — | 13 (all pass) | +13 new |
| **Total E2E** | 257 attributed + pre-existing failures | **270 total, 265 passing** | +13 |

**Pre-existing failures (not introduced by 2.3.5):**
- `asset-registry.e2e-spec.ts` — 1 failure (hardcoded seed UUID missing from DB, pre-dates this branch)
- `products.e2e-spec.ts` — 4 failures (product codes MOUSE-001/DESKPAD-001/STAND-001 not in test DB, pre-dates this branch)
