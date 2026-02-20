# PIXECOM v2 — METRICS CONTRACT (Frozen)

> **Version:** 1.0
> **Date:** 2026-02-20
> **Author:** CTO
> **Status:** FROZEN — All services MUST conform. Changes require CTO approval.
> **Consumers:** AdsManagerReadService, AnalyticsOverviewService, StatsWorker, Frontend helpers

---

## 0. Purpose

This document is the **single source of truth** for all metric definitions, derivation formulas, and aggregation rules across PixEcom. Every service that computes or displays metrics MUST reference this contract. No ad-hoc metric logic is permitted in controllers, frontends, or workers.

---

## 1. Raw Metrics (Source: Meta Marketing API)

These metrics are ingested from Meta via the Stats Sync Worker and stored in `ad_stats_daily`.

| Metric | DB Column | Type | Source |
|--------|-----------|------|--------|
| Spend | `spend` | Decimal(10,2) | Meta `spend` |
| Impressions | `impressions` | Int | Meta `impressions` |
| Clicks | `link_clicks` | Int | Meta `inline_link_clicks` |
| CPM (raw) | `cpm` | Decimal(10,4) | Meta `cpm` (stored for reference, re-derived on read) |
| CTR (raw) | `ctr` | Decimal(8,4) | Meta `ctr` (stored for reference, re-derived on read) |
| CPC (raw) | `cpc` | Decimal(10,4) | Meta `cpc` (stored for reference, re-derived on read) |

> **Note:** `cpm`, `ctr`, `cpc` from Meta are stored for audit but NEVER used in aggregation.
> All ratios are re-derived from raw counts on read. See Section 3.

---

## 2. Store Funnel Metrics (Source: Pixel Events + Order Data)

These metrics come from two sources:
- **Pixel Events** (via UTM attribution): ContentView, Checkout
- **Orders Table**: Purchase count, Revenue

Stored in `ad_stats_daily` (joined from pixel events) and `orders` (revenue/purchase).

| Metric | DB Column | Type | Source |
|--------|-----------|------|--------|
| ContentView | `content_views` | Int | Meta pixel `fb_pixel_view_content` action |
| AddToCart | `add_to_cart` | Int | Meta pixel `fb_pixel_add_to_cart` action |
| Checkout | `checkout_initiated` | Int | Meta pixel `fb_pixel_initiate_checkout` action |
| Purchase | `purchases` | Int | Meta pixel `fb_pixel_purchase` action OR attributed orders count |
| Revenue | `purchase_value` | Decimal(10,2) | Meta pixel purchase value OR attributed order totals |

---

## 3. Derived Metrics — Formulas

All derived metrics MUST be computed using `safeDivide()`. Never divide directly. Never average pre-computed ratios — always aggregate raw counts first, then derive.

### 3.1 Ad Performance Metrics

| Metric | Formula | Unit |
|--------|---------|------|
| **CTR** | `safeDivide(clicks, impressions) * 100` | % |
| **CPC** | `safeDivide(spend, clicks)` | $ |
| **CPM** | `safeDivide(spend, impressions) * 1000` | $ |

> **CRITICAL:** `clicks` = `link_clicks` column (Meta `inline_link_clicks`).
> These are NOT the same as Meta's "clicks (all)" which includes page engagement.

### 3.2 Store Funnel Conversion Rates

| Metric | Formula | Meaning |
|--------|---------|---------|
| **CR1** | `safeDivide(checkout, contentView) * 100` | Checkout rate from content views |
| **CR2** | `safeDivide(purchase, checkout) * 100` | Purchase rate from checkouts |
| **CR** | `safeDivide(purchase, contentView) * 100` | End-to-end conversion rate |

> **CRITICAL:** CR does NOT use `linkClicks`. CR measures store funnel efficiency:
> visitor lands → views content → initiates checkout → purchases.
> Using linkClicks would conflate ad-click-through with on-store behavior.

### 3.3 Cost Metrics

| Metric | Formula | Unit |
|--------|---------|------|
| **Cost per ContentView** | `safeDivide(spend, contentView)` | $ |
| **Cost per Checkout** | `safeDivide(spend, checkout)` | $ |
| **Cost per Purchase** | `safeDivide(spend, purchase)` | $ |
| **ROAS** | `safeDivide(revenue, spend)` | ratio |

### 3.4 Convenience Aliases

| Alias | Resolves To |
|-------|-------------|
| **Conv.** | `purchase` (count) |
| **Results** | `purchase` (count) — same as Conv. |
| **Cost per Result** | `safeDivide(spend, purchase)` — same as Cost per Purchase |

---

## 4. `safeDivide` Specification

```typescript
/**
 * Division-safe helper. Returns 0 when denominator is 0 or falsy.
 * All metric derivation MUST use this function.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}
```

Location: `apps/api/src/shared/utils/metrics.util.ts`

---

## 5. Aggregation Rules

### 5.1 Multi-Day Aggregation

When aggregating across a date range (e.g., last 7 days):

```
SUM all raw counts first:
  totalSpend = SUM(spend)
  totalImpressions = SUM(impressions)
  totalClicks = SUM(link_clicks)
  totalContentViews = SUM(content_views)
  totalCheckouts = SUM(checkout_initiated)
  totalPurchases = SUM(purchases)
  totalRevenue = SUM(purchase_value)

THEN derive ratios from totals:
  CTR = safeDivide(totalClicks, totalImpressions) * 100
  CPC = safeDivide(totalSpend, totalClicks)
  CR  = safeDivide(totalPurchases, totalContentViews) * 100
  ROAS = safeDivide(totalRevenue, totalSpend)
  ... etc.
```

> **NEVER** average daily CTR/CPC/CR values. This produces mathematically incorrect results
> (Simpson's paradox). Always aggregate raw counts, then derive.

### 5.2 Multi-Entity Aggregation

When rolling up from Ad → Adset → Campaign level:

- Same rule: SUM raw counts across child entities, then derive ratios.
- Campaign-level CR = `safeDivide(SUM(purchases across all ads), SUM(contentViews across all ads))`

### 5.3 Summary Row

The summary/totals row at the bottom of the Ads Manager table follows the same aggregation rules. It is NOT the sum of the derived columns — it is derived from the sum of the raw columns.

---

## 6. Unattributed Bucket

When UTM parameters are missing (N/A), funnel events cannot be attributed to a specific campaign/adset/ad.

- These events go into an "Unattributed" pseudo-row.
- The Unattributed bucket is included in the summary row totals.
- It is displayed as a separate row in the Ads Manager table with campaign name = "Unattributed".
- It has funnel metrics (ContentView, Checkout, Purchase, Revenue) but NO ad metrics (Spend, Impressions, Clicks = 0).

---

## 7. Column Set per Ads Manager Row

Every row returned by `AdsManagerReadService` MUST include:

```
Identity:
  id, name, platform, status, deliveryStatus, budgetPerDay

Ad Metrics (from ad_stats_daily):
  spend, impressions, clicks, ctr, cpc, cpm

Store Funnel (from pixel + orders attribution):
  contentView, costPerContentView
  checkout, costPerCheckout
  cr1, cr2, cr

Revenue (from attributed orders):
  purchase (count), revenue, roas
```

---

## 8. Data Freshness

| Metric Source | Refresh Interval | Latency |
|---------------|-----------------|---------|
| Meta Ad Stats | 15 min (Stats Worker) | Up to 15 min |
| Meta Delivery Status | 5 min (Delivery Worker) | Up to 5 min |
| Store Funnel (pixel) | Real-time ingestion | < 1 min |
| Order Revenue | Real-time on order creation | < 1 min |

---

## 9. Precision & Rounding

| Context | Rule |
|---------|------|
| Storage (DB) | Full precision as defined in schema Decimal types |
| API Response | 2 decimal places for currency ($), 2 for percentages (%), 4 for ratios (ROAS) |
| Frontend Display | Format using `formatCurrency()` / `formatPercent()` helpers |

---

## 10. Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-02-20 | Initial freeze. CR formula corrected (was linkClicks, now contentView-based). |
