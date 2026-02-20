# Alpha Staging Seed Data — PixEcom v2

**Milestone:** 2.4.0
**Branch:** `feature/2.4.0-alpha-seed-data`
**Files:** `packages/database/prisma/seed.staging.ts` + `seed.staging.reset.ts`

---

## Overview

Self-contained, realistic dataset for frontend integration testing on the staging environment.
All records use fixed UUIDs with the `5eed` UUID prefix — safe to re-run (idempotent) and safely reset without touching any other data.

---

## Dataset Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Seller | 1 | `alpha-test-store` |
| Sellpages | 3 | 2 PUBLISHED (mouse, stand), 1 DRAFT (deskpad) |
| Orders | 100 | 30-day spread, mixed statuses |
| Campaigns | 10 | Mix of ACTIVE, PAUSED, ARCHIVED |
| Adsets | 30 | 3 per campaign |
| Ads | 60 | 2 per adset |
| AdStatsDaily | ~1,600–2,000 | 14–30 days per entity (campaign/adset/ad) |
| SellpageStatsDaily | 180 | 30 days × 2 sellpages × 3 ad sources |

---

## Commands

### Prerequisites

1. Main seed must be run first (platform products MOUSE-001, STAND-001, DESKPAD-001):
   ```bash
   pnpm --filter @pixecom/database db:seed
   ```

2. Set staging guard (either variable):
   ```bash
   export APP_ENV=staging
   # or
   export NODE_ENV=staging
   ```

### Run Seed

```bash
# From workspace root:
pnpm seed:staging

# Or from database package directly:
pnpm --filter @pixecom/database seed:staging
```

### Reset Seed

Deletes **only** seeded records (identified by fixed UUID prefix). Platform products and other sellers are preserved.

```bash
# From workspace root:
pnpm seed:staging:reset

# Or:
pnpm --filter @pixecom/database seed:staging:reset
```

### Re-seed (full cycle)

```bash
pnpm seed:staging:reset && pnpm seed:staging
```

---

## Login Credentials

| Field | Value |
|-------|-------|
| Email | `alpha-seller@pixecom.io` |
| Password | `AlphaSeed2026!` |
| Seller ID | `00000000-5eed-0001-0002-000000000001` |

---

## Staging Guard

The scripts refuse to run unless one of these environment variables is set:

```
NODE_ENV=staging
APP_ENV=staging
```

If neither is set, you'll see:
```
❌ STAGING GUARD: This seed only runs in staging environment.
   Current: NODE_ENV="development", APP_ENV="undefined"
   Set NODE_ENV=staging or APP_ENV=staging before running.
```

---

## Fixed UUID Scheme

All seeded UUIDs follow the pattern `00000000-5eed-<layer>-<type>-<index>`:

| Layer | Type | Example |
|-------|------|---------|
| `0001` | Seller/User | `00000000-5eed-0001-0001-000000000001` (User) |
| `0002` | Sellpages | `00000000-5eed-0002-0001-000000000001` (SP1) |
| `0003` | Orders | `00000000-5eed-0003-0001-000000000001` (ORD1) |
| `0004` | Ads layer | `00000000-5eed-0004-0002-000000000001` (CMP1) |

---

## Order Status Distribution (approximate)

| Status | % | Expected Count |
|--------|---|----------------|
| DELIVERED | ~33% | ~33 |
| PENDING | ~11% | ~11 |
| CONFIRMED | ~11% | ~11 |
| PROCESSING | ~11% | ~11 |
| SHIPPED | ~11% | ~11 |
| CANCELLED | ~11% | ~11 |
| REFUNDED | ~11% | ~11 |

---

## Sellpage Data

| ID | Slug | Status | Product |
|----|------|--------|---------|
| SP1 | `staging-mouse-deal` | PUBLISHED | MOUSE-001 |
| SP2 | `staging-stand-offer` | PUBLISHED | STAND-001 |
| SP3 | `staging-deskpad-promo` | DRAFT | DESKPAD-001 |

---

## Campaign Structure

| Campaign | Sellpage | Budget | Status | Adsets | Ads |
|----------|----------|--------|--------|--------|-----|
| Mouse Flash Sale — Q1 | SP1 | $50/day | ACTIVE | 3 | 6 |
| Mouse Retargeting | SP1 | $30/day | ACTIVE | 3 | 6 |
| Mouse Lookalike — 1% | SP1 | $40/day | PAUSED | 3 | 6 |
| Stand Awareness | SP2 | $35/day | ACTIVE | 3 | 6 |
| Stand Conversions | SP2 | $60/day | ACTIVE | 3 | 6 |
| Stand Interest — Office | SP2 | $25/day | PAUSED | 3 | 6 |
| Mouse Brand — Video | SP1 | $45/day | ACTIVE | 3 | 6 |
| Mouse Broad Audience | SP1 | $20/day | ARCHIVED | 3 | 6 |
| Stand Broad Audience | SP2 | $20/day | ACTIVE | 3 | 6 |
| Cross-Sell Bundle Campaign | SP1 | $55/day | PAUSED | 3 | 6 |

---

## Ad Stats Coverage

| Entity Type | Days of History |
|-------------|----------------|
| CAMPAIGN | 10–30 (varies by campaign start date) |
| ADSET | min(campaign_days, 21) |
| AD | min(adset_days, 14) |

---

## Sellpage Stats Coverage

- 30 days of history per sellpage (SP1 + SP2 only — SP3 is DRAFT)
- 3 ad sources per day: `facebook`, `instagram`, `organic`
- `organic` ad source always has `adSpend = 0`
- Total: 30 × 2 × 3 = **180 rows**

---

## SQL Verification Queries

Run these after seeding to verify the data:

```sql
-- 1. Seller exists
SELECT id, name, slug, is_active
FROM sellers
WHERE id = '00000000-5eed-0001-0002-000000000001';

-- 2. Order count + status breakdown
SELECT status, COUNT(*) as count
FROM orders
WHERE seller_id = '00000000-5eed-0001-0002-000000000001'
GROUP BY status
ORDER BY count DESC;

-- 3. Orders spread across 30 days
SELECT DATE(created_at) as day, COUNT(*) as orders
FROM orders
WHERE seller_id = '00000000-5eed-0001-0002-000000000001'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- 4. Campaign / adset / ad counts
SELECT
  (SELECT COUNT(*) FROM campaigns WHERE seller_id = '00000000-5eed-0001-0002-000000000001') AS campaigns,
  (SELECT COUNT(*) FROM adsets   WHERE seller_id = '00000000-5eed-0001-0002-000000000001') AS adsets,
  (SELECT COUNT(*) FROM ads      WHERE seller_id = '00000000-5eed-0001-0002-000000000001') AS ads;

-- 5. Ad stats row count by entity type
SELECT entity_type, COUNT(*) as rows
FROM ad_stats_daily
WHERE seller_id = '00000000-5eed-0001-0002-000000000001'
GROUP BY entity_type;

-- 6. Sellpage stats row count
SELECT sellpage_id, ad_source, COUNT(*) as days
FROM sellpage_stats_daily
WHERE seller_id = '00000000-5eed-0001-0002-000000000001'
GROUP BY sellpage_id, ad_source
ORDER BY sellpage_id, ad_source;

-- 7. Revenue KPI: last 7 days total from SP1
SELECT
  SUM(revenue) AS total_revenue,
  SUM(orders_count) AS total_orders,
  SUM(ad_spend) AS total_spend,
  ROUND(SUM(revenue) / NULLIF(SUM(ad_spend), 0), 2) AS blended_roas
FROM sellpage_stats_daily
WHERE seller_id = '00000000-5eed-0001-0002-000000000001'
  AND sellpage_id = '00000000-5eed-0002-0001-000000000001'
  AND stat_date >= NOW() - INTERVAL '7 days';

-- 8. Top campaign by ROAS (last 14 days)
SELECT
  entity_id,
  ROUND(AVG(roas), 2) AS avg_roas,
  SUM(spend) AS total_spend,
  SUM(purchases) AS total_purchases
FROM ad_stats_daily
WHERE seller_id = '00000000-5eed-0001-0002-000000000001'
  AND entity_type = 'CAMPAIGN'
  AND stat_date >= NOW() - INTERVAL '14 days'
GROUP BY entity_id
ORDER BY avg_roas DESC;

-- 9. Reset verification (should all be 0 after reset)
SELECT
  (SELECT COUNT(*) FROM sellers    WHERE id = '00000000-5eed-0001-0002-000000000001') AS seller,
  (SELECT COUNT(*) FROM orders     WHERE seller_id = '00000000-5eed-0001-0002-000000000001') AS orders,
  (SELECT COUNT(*) FROM campaigns  WHERE seller_id = '00000000-5eed-0001-0002-000000000001') AS campaigns,
  (SELECT COUNT(*) FROM ad_stats_daily WHERE seller_id = '00000000-5eed-0001-0002-000000000001') AS stats;
```

---

## Idempotency

All records use `upsert` with fixed UUIDs — the seed can be re-run without errors.
Re-running is safe: existing records are untouched (all `update: {}` blocks are no-ops).

If you want fresh data with new timestamps/random values:
```bash
pnpm seed:staging:reset && pnpm seed:staging
```

---

## Files Changed

| File | Change |
|------|--------|
| `packages/database/prisma/seed.staging.ts` | NEW — full staging dataset |
| `packages/database/prisma/seed.staging.reset.ts` | NEW — reset script |
| `packages/database/package.json` | Added `seed:staging` + `seed:staging:reset` scripts |
| `package.json` (root) | Added workspace shortcuts |
| `.env.example` | Added `APP_ENV` staging guard documentation |
