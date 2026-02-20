# Milestone 2.4.0 — Alpha Staging Seed Data System

**Branch:** `feature/2.4.0-alpha-seed-data`
**Base:** `develop` @ `0def8ab`
**Date:** 2026-02-21
**Status:** ✅ Complete

---

## Scope

Staging-only seed data system for frontend integration testing. No schema changes, no API changes — pure data tooling.

| Deliverable | Description |
|-------------|-------------|
| `seed.staging.ts` | Idempotent seed: 1 seller, 3 sellpages, 100 orders, 10 campaigns/30 adsets/60 ads, 1,600–2,000 ad stats rows, 180 sellpage stats rows |
| `seed.staging.reset.ts` | Idempotent reset: deletes ONLY seeded records by fixed UUID prefix, in correct FK order |
| Scripts | `pnpm seed:staging` + `pnpm seed:staging:reset` (root + package level) |
| Guard | Refuses to run unless `NODE_ENV=staging` or `APP_ENV=staging` |
| Docs | `docs/ALPHA-SEED-DATA.md` with commands, SQL verification queries, credential table |

---

## Design Decisions

### 1. Staging Guard (not migration-based tagging)
Used env variable check (`NODE_ENV` or `APP_ENV`) rather than a DB `seed_tag` column to keep the schema clean. All records are identified by their fixed UUID prefix (`5eed`) instead.

### 2. Fixed UUID Scheme (`5eed` prefix)
All seed records use deterministic UUIDs with a recognizable hex prefix: `00000000-5eed-<layer>-<type>-<index>`. This makes it trivial to:
- Identify seeded records in any query
- Build an exact deletion list without a DB lookup
- Guarantee idempotency across re-runs

### 3. Reset by UUID Array (not `seller_id` cascade)
The reset script deletes by explicit UUID arrays (not `WHERE sellerId = SEED_SELLER_ID`) for safety — prevents accidental cascade of data that doesn't belong to the seed (e.g., if someone added real data to the staging seller by mistake).

Exception: `AdStatsDaily`, `SellpageStatsDaily`, and `AdStatsRaw` are deleted by `sellerId` because they don't have seeded UUIDs (stats rows use natural compound keys, not fixed IDs).

### 4. Platform Products Prerequisite
The staging seed reuses platform products (MOUSE-001, STAND-001, DESKPAD-001) from the main seed. This avoids duplicating product data and tests a realistic setup where the seller browses the platform catalog.

### 5. Over-provisioned Deletion Arrays
OrderItem and OrderEvent ID arrays are over-provisioned (250 items, 500 events) since the exact count varies with random multi-item order generation. `deleteMany` with non-existent IDs is a no-op — no error.

---

## Dataset Details

### Orders (100)
- 30-day spread: random day in `[0, 29]` days ago
- Status weights: DELIVERED × 3, others × 1 each (7 options)
- ~30% orders have 2 line items
- ~20% order items have quantity = 2
- ~30% get free shipping, 15% get a $5 discount
- Payment: 70% card, 30% PayPal
- All customer emails from pool of 12 real-looking entries

### Campaigns (10) → Adsets (30) → Ads (60)
- 10 campaigns: 5 for SP1 (Mouse), 5 for SP2 (Stand), spanning 10–30 days
- 3 adsets per campaign with distinct optimization goals
- 2 ads per adset
- Status propagates: archived campaigns → archived adsets/ads; 3rd adset always PAUSED

### Ad Stats Daily
- Campaigns: full history = `campaign.days` (10–30)
- Adsets: `min(campaign_days, 21)`
- Ads: `min(adset_days, 14)`
- ±25% jitter on all metrics for realistic variance
- Metrics chain: impressions → linkClicks → contentViews → checkoutInitiated → purchases → purchaseValue
- Derived: ctr, cpc, cpm, costPerPurchase, roas

### Sellpage Stats Daily (180 rows)
- 30 days × 2 published sellpages × 3 ad sources (facebook, instagram, organic)
- Source weights: facebook 55%, instagram 30%, organic 15%
- Organic always has `adSpend = 0`
- cr1 = contentViews / linkClicks, cr2 = checkout / contentViews, cr3 = purchases / checkout

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `packages/database/prisma/seed.staging.ts` | Full staging dataset seed script |
| `packages/database/prisma/seed.staging.reset.ts` | Idempotent reset script |
| `docs/ALPHA-SEED-DATA.md` | Documentation + SQL verification queries |

### Modified Files

| File | Change |
|------|--------|
| `packages/database/package.json` | Added `seed:staging` and `seed:staging:reset` scripts |
| `package.json` (root) | Added workspace-level `seed:staging` and `seed:staging:reset` shortcuts |
| `.env.example` | Added `APP_ENV=staging` guard documentation |

---

## Key Constraints Upheld

- No Prisma schema changes (no migrations)
- No API changes
- Staging guard refuses to run in development/production
- Reset deletes ONLY seeded records — platform products and other sellers untouched
- Fully idempotent — safe to re-run multiple times
- No secrets in seed (no real tokens, no real API keys)
- bcrypt hash is pre-computed (no bcrypt dep in seed runtime)
