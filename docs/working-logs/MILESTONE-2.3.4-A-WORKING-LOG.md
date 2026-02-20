# Milestone 2.3.4-A Working Log — Ads Manager Campaign Read Layer

**Branch:** `feature/2.3.4a-ads-manager-campaigns`
**Base:** `develop` @ `a0b7123`
**Commit:** `23f2786`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — 240 E2E tests pass (227 existing + 13 new)

---

## Scope

Campaign-level read layer for the Ads Manager dashboard. Aggregates `ad_stats_daily` rows across a date range and returns computed metrics per campaign.

### Endpoint

```
GET /api/ads-manager/campaigns
```

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFrom` | YYYY-MM-DD | today UTC | Start of stats range |
| `dateTo` | YYYY-MM-DD | today UTC | End of stats range |

---

## Response Shape

```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Summer Sale Campaign",
      "status": "ACTIVE",
      "deliveryStatus": "DELIVERING",
      "budgetPerDay": 50.00,
      "spend": 142.50,
      "impressions": 12500,
      "clicks": 380,
      "ctr": 3.04,
      "cpc": 0.375,
      "cpm": 11.40
    }
  ],
  "summary": {
    "spend": 142.50,
    "impressions": 12500,
    "clicks": 380,
    "ctr": 3.04,
    "cpc": 0.375,
    "cpm": 11.40
  }
}
```

---

## Aggregation Logic

Follows the METRICS-CONTRACT aggregation rules:

1. Fetch all `ad_stats_daily` rows for `entityType=CAMPAIGN`, `sellerId`, `statDate` in range
2. `GROUP BY entityId` — sum raw counts per campaign
3. Derive ratios from totals: `CTR = SUM(clicks) / SUM(impressions) * 100`
4. Summary row: same process across all campaigns (NOT sum of derived columns)

**NEVER average daily CTR/CPC values** — always aggregate raw counts first.

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/ads-manager/ads-manager.module.ts` | Module registration |
| `apps/api/src/ads-manager/ads-manager.controller.ts` | GET /ads-manager/campaigns |
| `apps/api/src/ads-manager/ads-manager-read.service.ts` | Aggregation + stats join |
| `apps/api/src/ads-manager/dto/campaigns-query.dto.ts` | dateFrom/dateTo params |
| `apps/api/test/ads-manager.e2e-spec.ts` | 13 E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `AdsManagerModule` |

---

## Key Design Decisions

- **Read-only:** No mutations. Separate module from campaigns CRUD module.
- **Seller isolation:** `sellerId` from JWT baked into every query — never from params
- **Stats join:** LEFT JOIN from campaigns → `ad_stats_daily` — campaigns with no stats rows return zero values (not null)
- **Ratio derivation:** All CTR/CPC/CPM computed after aggregation, never averaged
- **Summary row:** Computed from sum of raw counts across all returned campaigns

---

## E2E Test Coverage (13 tests)

| # | Test |
|---|------|
| 1 | 401 without JWT |
| 2 | Empty list with no stats |
| 3 | Returns correct spend/impressions/clicks |
| 4 | CTR correctly derived (not averaged) |
| 5 | CPC correctly derived |
| 6 | CPM correctly derived |
| 7 | Summary row matches manual calculation |
| 8 | Date range filter (dateFrom/dateTo) |
| 9 | Campaigns with no stats → zero values |
| 10 | Tenant isolation — seller B sees own data only |
| 11 | Multiple campaigns aggregated independently |
| 12 | Multi-day aggregation: raw sums before ratio |
| 13 | Summary row NOT sum of derived columns |

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 227 | **240** | +13 |
