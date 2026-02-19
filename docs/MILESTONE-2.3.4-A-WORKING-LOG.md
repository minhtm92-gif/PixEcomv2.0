# Milestone 2.3.4-A Working Log — Ads Manager Campaign Read Layer

**Branch:** `feature/2.3.4a-ads-manager-campaigns`
**Base:** `develop` @ `a0b7123`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — All 240 E2E tests pass (227 existing + 13 new)

---

## Scope

Phase 2.3.4-A implements the **read-only campaign listing layer** of the Ads Manager:

- `GET /api/ads-manager/campaigns` — paginated campaign list with aggregated stats
- `POST /api/ads-manager/sync` — manual BullMQ stats-sync enqueue (re-implemented from 2.3.3 since this branch is off `develop`)

**Explicitly out of scope:** ad sets, ad-level stats, orders module, analytics dashboard (2.3.4-B and beyond).

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/ads-manager/ads-manager.service.ts` | Core service: 2-query campaign listing + stats aggregation |
| `apps/api/src/ads-manager/ads-manager.controller.ts` | REST controller: GET /campaigns + POST /sync |
| `apps/api/src/ads-manager/ads-manager.module.ts` | NestJS module registration |
| `apps/api/src/ads-manager/dto/list-campaigns.dto.ts` | Query DTO: 9 validated params |
| `apps/api/src/ads-manager/dto/sync-request.dto.ts` | Body DTO: optional date field |
| `apps/api/test/ads-manager-campaigns.e2e-spec.ts` | 13 E2E tests |
| `packages/database/prisma/migrations/20260219200000_ads_manager_234a/migration.sql` | Compound index on ad_stats_daily |
| `docs/MILESTONE-2.3.4-A-WORKING-LOG.md` | This file |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `AdsManagerModule` to imports |
| `packages/database/prisma/schema.prisma` | Added `@@index([entityId, statDate])` to `AdStatsDaily` |

---

## Architecture Decisions

### 2-Query Pattern (No N+1)

The service uses exactly two DB queries per request:

1. **`prisma.campaign.findMany`** — fetch paginated campaigns with nested sellpage + domain + adAccount selects. `take: limit + 1` for next-page detection.
2. **`prisma.adStatsDaily.groupBy`** — aggregate stats for all fetched campaign IDs in a single query (`entityId IN (...)` + date range filter). Returns `Map<campaignId, CampaignStats>`.

Client-side sort is applied after stats join (sorting on aggregated values in DB would require a subquery; at these volumes client-side is simpler and fast).

### Cursor Pagination

Uses `campaign.id` as the opaque cursor. The query adds `WHERE id < cursor` (createdAt desc order). Fetch `limit + 1` rows; if length > limit, the last ID is the `nextCursor`.

### Status Filter Logic

| Scenario | Result |
|----------|--------|
| No status param, no `includeArchived` | `ACTIVE` + `PAUSED` (default) |
| `?status=PAUSED` | `PAUSED` only |
| `?includeArchived=true` | `ACTIVE` + `PAUSED` + `ARCHIVED` |
| Any scenario | `DELETED` never returned |

### Sellpage URL

`https://{domain.hostname}/{slug}` if domain assigned, otherwise `<unassigned-domain>/{slug}`.

### BullMQ JobId Format

Colons are forbidden in BullMQ v5+ custom jobIds. Pattern: `sync__${sellerId}__${date}__${date}__${level}` (double-underscore separator). Idempotent — duplicate enqueue for same seller/date is de-duped.

---

## Migration

**Name:** `20260219200000_ads_manager_234a`

```sql
CREATE INDEX IF NOT EXISTS "ad_stats_daily_entity_id_stat_date_idx"
  ON "ad_stats_daily" ("entity_id", "stat_date");
```

**Why:** The existing indexes on `ad_stats_daily` were `(sellerId, statDate)` and the unique constraint `(sellerId, entityType, entityId, statDate)`. The aggregation query filters by `entityId IN (...)` + `statDate BETWEEN x AND y` without a `sellerId` predicate (stats are pre-scoped by campaign ownership). The new compound index supports this range aggregation efficiently.

**Applied via:** Direct `psql` injection (Prisma advisory lock workaround on the test container), registered manually in `_prisma_migrations`.

---

## Issues Encountered & Fixes

### Issue 1: `@Transform` sets `limit` to `NaN` when not provided

**Symptom:** `PrismaClientValidationError: Argument 'take' is missing` — Prisma rejected `take: NaN`.

**Root cause:** `@Transform(({ value }) => parseInt(value, 10))` runs even when the field is absent. `parseInt(undefined, 10)` returns `NaN`. Since `NaN ?? DEFAULT_LIMIT` evaluates to `NaN` (nullish coalescing doesn't catch `NaN`), the service passed `NaN` to Prisma's `take`.

**Fix:** Guard the transform: `value !== undefined ? parseInt(value, 10) : undefined`. This lets `??` fall back to `DEFAULT_LIMIT` correctly.

### Issue 2: `ProductStatus.PUBLISHED` does not exist

**Symptom:** TypeScript compile error in E2E test — `'PUBLISHED'` not assignable to `ProductStatus`.

**Root cause:** `ProductStatus` enum is `DRAFT | ACTIVE | ARCHIVED` (no `PUBLISHED`). `SellpageStatus` does have `PUBLISHED`.

**Fix:** Changed product seed to use `status: 'ACTIVE'`.

---

## E2E Test Coverage (13 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | 401 without JWT | Auth guard on GET /campaigns |
| 2 | Empty rows for seller with no campaigns | Zero-row response shape |
| 3 | Campaign rows with zero stats (no data for date) | Response shape: all fields present, stats zeroed |
| 4 | Date-range aggregation sums 2 stat days correctly | SUM across dates, ROAS derivation |
| 5 | Stats outside date range excluded | Date boundary precision |
| 6 | Filter by `status=PAUSED` | Status filter |
| 7 | Filter by `sellpageId` | Sellpage filter |
| 8 | Seller B cannot see Seller A campaigns | Tenant isolation |
| 9 | DELETED campaigns excluded by default | Status filter defaults |
| 10 | `sortBy=roas` returns highest ROAS row first | Client-side sort correctness |
| 11 | Cursor pagination: nextCursor + page 2 no overlap | Pagination correctness |
| 12 | POST /sync returns 202 with `queued=true` + jobIds | Sync endpoint + 3-level job enqueue |
| 13 | POST /sync without JWT returns 401 | Auth guard on POST /sync |

---

## Endpoint Reference

### GET /api/ads-manager/campaigns

```bash
# Default — today's stats, ACTIVE+PAUSED, sorted by spend desc
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/ads-manager/campaigns"

# Date range + sort by ROAS
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/ads-manager/campaigns?dateFrom=2026-02-01&dateTo=2026-02-19&sortBy=roas&sortDir=desc"

# Filter by sellpage + paginate
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/ads-manager/campaigns?sellpageId=<uuid>&limit=10"

# Second page
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/ads-manager/campaigns?limit=10&cursor=<campaign-id>"

# Include archived
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/ads-manager/campaigns?includeArchived=true"
```

**Response shape:**
```json
{
  "dateFrom": "2026-02-19",
  "dateTo": "2026-02-19",
  "rows": [
    {
      "id": "<uuid>",
      "name": "My Campaign",
      "status": "ACTIVE",
      "dailyBudget": 50.00,
      "budgetType": "DAILY",
      "sellpage": { "id": "<uuid>", "url": "https://yourdomain.com/my-slug" },
      "fbConnection": { "id": "<uuid>", "adAccountExternalId": "act_1234567890" },
      "stats": {
        "spend": 300.00,
        "impressions": 3000,
        "clicks": 130,
        "purchases": 15,
        "revenue": 1500.00,
        "roas": 5.0
      }
    }
  ],
  "nextCursor": null
}
```

### POST /api/ads-manager/sync

```bash
# Sync today
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:3001/api/ads-manager/sync" \
  -d '{}'

# Sync specific date
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:3001/api/ads-manager/sync" \
  -d '{"date": "2026-02-18"}'
```

**Response (202 Accepted):**
```json
{
  "queued": true,
  "date": "2026-02-19",
  "jobIds": [
    "sync__<sellerId>__2026-02-19__2026-02-19__CAMPAIGN",
    "sync__<sellerId>__2026-02-19__2026-02-19__ADSET",
    "sync__<sellerId>__2026-02-19__2026-02-19__AD"
  ]
}
```

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 227 | **240** | +13 |

All 9 existing test suites continued to pass unmodified.
