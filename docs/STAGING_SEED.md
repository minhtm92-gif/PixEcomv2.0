# Staging Seed Runbook — PixEcom v2

**Milestone:** 2.4.1 | **seed_tag:** `alpha_seed_v2`
**Scripts:** `packages/database/prisma/seed.alpha*.ts`

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `APP_ENV=staging pnpm seed:alpha` | Create / update all alpha_seed_v2 data |
| `APP_ENV=staging pnpm seed:alpha:reset` | Delete ONLY alpha_seed_v2 data |
| `pnpm seed:alpha:verify` | Print counts + math checks (no guard needed) |
| `APP_ENV=staging pnpm seed:alpha:reset && APP_ENV=staging pnpm seed:alpha` | Full re-seed cycle |

---

## Login Credentials

| Seller | Email | Password | Seller ID |
|--------|-------|----------|-----------|
| Alpha Store One | `alpha1@pixecom.io` | `Alpha1Pass2026!` | `00000000-A100-0001-0002-000000000001` |
| Alpha Store Two | `alpha2@pixecom.io` | `Alpha2Pass2026!` | `00000000-A200-0001-0002-000000000001` |

---

## Dataset Per Seller

| Entity | Count | Notes |
|--------|-------|-------|
| Domain | 1 | `VERIFIED`, `isPrimary=true` — enables published sellpage URLs |
| Sellpages | 4 | 2 `PUBLISHED` (linked to domain), 2 `DRAFT` |
| Products | 3 | Platform products reused: MOUSE-001, STAND-001, DESKPAD-001 |
| Orders | 120 | Spread across last 30 days |
| Order Items | ~350–450 | 1–4 items per order, qty 1–3 |
| Order Events | ~300–500 | Full timeline per status |

### Order Status Distribution (per seller)

| Status | Target % | ~Count |
|--------|----------|--------|
| DELIVERED | 60% | ~72 |
| SHIPPED | 20% | ~24 |
| CONFIRMED | 10% | ~12 |
| CANCELLED | 5% | ~6 |
| REFUNDED | 5% | ~6 |
| **Total** | 100% | **120** |

---

## What Populates Each UI Section

| UI Section | Seed Data |
|-----------|-----------|
| Customer name / email / phone | Deterministic synthetic names + fake emails |
| Shipping address | Fake Vietnamese cities (Ho Chi Minh City, Ha Noi, Da Nang, etc.) |
| Order totals | `subtotal = Σ(items)`, `total = subtotal + shipping + tax - discount` |
| Tax | 5–8% by city (deterministic) |
| Discount | ~30% of orders get 5–20% loyalty discount |
| Shipping cost | $3.99–$9.99 (5 tiers, deterministic) |
| Sellpage link | Published sellpages for 80% of orders; draft for 20% |
| Sellpage URL | `https://alpha1-staging.pixelxlab.com/{slug}` (full URL, not `<unassigned-domain>`) |
| Tracking number | Set for `SHIPPED` + `DELIVERED` orders |
| Tracking URL | `https://tracking.pixelxlab.com/track/{number}` |
| Carrier | GHTK, J&T Express, GHN, etc. (in `OrderEvent.metadata`) |
| Timeline | CREATED → CONFIRMED → SHIPPED → DELIVERED (status-appropriate events) |
| Refund event | `REFUNDED` event with `refundAmount` + `refundedAt` in metadata |
| Payment | 70% card, 30% PayPal (`paymentId` + `paidAt` set) |

---

## Prerequisites

1. **Main platform seed must be run first** (products/variants needed):
   ```bash
   pnpm --filter @pixecom/database db:seed
   ```

2. **Staging environment variable set:**
   ```bash
   export APP_ENV=staging
   # or per-command: APP_ENV=staging pnpm seed:alpha
   ```

---

## Step-by-Step Runbook

### First-time setup

```bash
# 1. Ensure platform seed is present
pnpm --filter @pixecom/database db:seed

# 2. Run alpha seed
APP_ENV=staging pnpm seed:alpha

# 3. Verify
pnpm seed:alpha:verify
```

### Re-seed (fresh data)

```bash
APP_ENV=staging pnpm seed:alpha:reset
APP_ENV=staging pnpm seed:alpha
pnpm seed:alpha:verify
```

### Reset only (clean slate)

```bash
APP_ENV=staging pnpm seed:alpha:reset
```

---

## Expected Verify Output

```
🔍 Alpha Seed v2 Verify

  ┌─ Alpha Store One (alpha1@pixecom.io)
  │  Seller ID: 00000000-A100-0001-0002-000000000001
  │  ✅ Domains               1 (expected 1)
  │  ✅ Domains VERIFIED       1 (expected 1)
  │  ✅ Sellpages total        4 (expected 4)
  │  ✅ Sellpages PUBLISHED    2 (expected 2)
  │  ✅ Sellpages DRAFT        2 (expected 2)
  │  ✅ Orders total           120 (expected 120)
  │  ✅   DELIVERED            72
  │  ✅   SHIPPED              24
  │  ✅   CONFIRMED            12
  │  ✅   CANCELLED            6
  │  ✅   REFUNDED             6
  │  ✅ Order Items            ~390
  │  ✅ Order Events           ~390
  │     Domain: alpha1-staging.pixelxlab.com [VERIFIED, PRIMARY]
  │  ✅ Sample order subtotal math: items=xx.xx, stored=xx.xx
  │  ✅ Sample order total math:    calc=xx.xx, stored=xx.xx
  │     Events on sample order: CREATED → CONFIRMED → SHIPPED → DELIVERED
  └─ Alpha Store One OK

  ┌─ Alpha Store Two (alpha2@pixecom.io)
  │  ... (same structure)
  └─ Alpha Store Two OK

────────────────────────────────────────────────────────────
  ✅ All checks passed — alpha_seed_v2 data is complete.
```

---

## UUID Scheme

All seeded UUIDs use a recognisable prefix — easy to spot in any query or log:

```
00000000-A100-<layer>-<type>-<index 12 digits>   ← Seller 1
00000000-A200-<layer>-<type>-<index 12 digits>   ← Seller 2
```

| Layer | Meaning |
|-------|---------|
| `0001` | User / Seller |
| `0002` | Domain |
| `0003` | Sellpage |
| `0004` | Order |
| `0005` | OrderItem |
| `0006` | OrderEvent |

---

## Idempotency

- Re-running `pnpm seed:alpha` is **safe** — all upserts use fixed UUIDs
- `update: {}` on most records means existing data is not overwritten
- `update: { passwordHash }` on User ensures the password is always correct

---

## Staging Guard

Both `seed:alpha` and `seed:alpha:reset` refuse to run unless:
```
APP_ENV=staging  OR  NODE_ENV=staging
```

`seed:alpha:verify` has no guard (read-only, safe anywhere).

---

## Rollback

```bash
# Full rollback — removes only alpha_seed_v2 data
APP_ENV=staging pnpm seed:alpha:reset

# Verification — should all show 0 counts
pnpm seed:alpha:verify
```

Platform products (MOUSE-001, STAND-001, DESKPAD-001) and all other sellers are **never touched** by reset.

---

## SQL Spot-Check Queries

```sql
-- Count orders per status for alpha1
SELECT status, COUNT(*) as cnt
FROM orders
WHERE seller_id = '00000000-A100-0001-0002-000000000001'
GROUP BY status ORDER BY cnt DESC;

-- Verify total math on all alpha1 orders
SELECT COUNT(*) as math_errors
FROM orders o
WHERE o.seller_id = '00000000-A100-0001-0002-000000000001'
  AND ABS(
    (SELECT COALESCE(SUM(line_total), 0) FROM order_items WHERE order_id = o.id)
    + o.shipping_cost + o.tax_amount - o.discount_amount
    - o.total
  ) > 0.02;

-- Check all published sellpages have VERIFIED domains
SELECT sp.slug, sp.status, sd.hostname, sd.status as domain_status
FROM sellpages sp
LEFT JOIN seller_domains sd ON sp.domain_id = sd.id
WHERE sp.seller_id IN (
  '00000000-A100-0001-0002-000000000001',
  '00000000-A200-0001-0002-000000000001'
)
ORDER BY sp.status, sp.slug;

-- Order timeline check for a specific order
SELECT event_type, description, created_at
FROM order_events
WHERE order_id = '00000000-A100-0004-0001-000000000001'
ORDER BY created_at;

-- Post-reset verification (should all return 0)
SELECT
  (SELECT COUNT(*) FROM sellers WHERE id IN (
    '00000000-A100-0001-0002-000000000001',
    '00000000-A200-0001-0002-000000000001')) AS sellers,
  (SELECT COUNT(*) FROM orders WHERE seller_id IN (
    '00000000-A100-0001-0002-000000000001',
    '00000000-A200-0001-0002-000000000001')) AS orders;
```

---

## Files

| File | Purpose |
|------|---------|
| `packages/database/prisma/seed.alpha.ts` | Main seed script |
| `packages/database/prisma/seed.alpha.reset.ts` | Reset script |
| `packages/database/prisma/seed.alpha.verify.ts` | Verification script |
| `docs/STAGING_SEED.md` | This runbook |
