# Competitor Audit: Homepage / Dashboard
**Source:** Selles system screenshot (`Homepage.jfif`)
**Date:** 2026-02-20
**Auditor:** CTO Advisor + Product Owner

---

## 1. SCREENSHOT ANALYSIS — What Selles Has

### A. Sidebar Navigation
| Menu Item | Description |
|-----------|------------|
| Sellpages | Sellpage management |
| Products | Product catalog |
| Orders | Order management |
| **Finances** | Financial management (hold, unhold, payout) |
| Settings | Account settings |

### B. KPI Cards (Top Row — 6 cards)
| KPI | Example Value | Description |
|-----|--------------|-------------|
| Revenue | $23,044.13 | Total revenue + "437 orders" subtitle |
| Cost | $10,068.99 | Total ad spend across all platforms |
| You Take | $12,975.14 | Seller's net earnings |
| Hold | $3,665.02 | Amount held pending confirmation |
| Unhold | $0.00 | Amount released from hold |
| Cash to Balance | $9,310.12 | Actual amount available to withdraw |

### C. Date Filter (Top Right)
- Quick filters: **Today / Yesterday / This Week / This Month**
- Timezone display: **(GMT-9)**
- Custom date range picker with calendar icon

### D. Sellpage Filter (Top Left)
- Dropdown: **"Filter by sellpage"**
- Filters entire dashboard (KPIs + tables) by selected sellpage

### E. Ad Source Breakdown Table — FULL METRICS PER PLATFORM

**Columns:** Ad Source | Spent | ROAS | CPM | CTR | Link Clicks | Content Views | Adds to Cart | Checkouts Initiated | Purchases | CR | CR1 | CR2

**Rows (5 ad sources + organic):**

| Ad Source | Spent | ROAS | CPM | CTR | Link Clicks | Content Views | Adds to Cart | Checkouts Initiated | Purchases | CR | CR1 | CR2 |
|-----------|-------|------|-----|-----|-------------|---------------|-------------|--------------------|-----------|----|-----|-----|
| n/a (organic) | n/a | n/a | n/a | n/a | n/a | 381 | 57 | 41 | 35 | 9.19% | 10.76% | 85.37% |
| Facebook | $9,823.01 | 2.15 | $21.22 | 2.06% | 9525 | 8481 | 1326 | 789 | 402 | 4.74% | 9.30% | 50.95% |
| Pinterest | $0.00 | 0 | $0.00 | 0% | 0 | 0 | 0 | 0 | 0 | 0% | 0% | 0% |
| Google | n/a | n/a | n/a | n/a | n/a | 0 | 0 | 0 | 0 | 0% | 0% | 0% |
| Applovin | $0.00 | 0 | $0.00 | 0% | 0 | 0 | 0 | 0 | 0 | 0% | 0% | 0% |

**Key Observations:**
- `n/a` row = organic/direct traffic (no ad spend, but has conversion data)
- Each platform shows full funnel: Impressions → Clicks → Views → Cart → Checkout → Purchase
- CR = overall conversion rate (purchases / content views)
- CR1 = add to cart rate (adds to cart / content views)
- CR2 = checkout completion rate (purchases / checkouts initiated)
- Platforms with no data show `n/a` for rate metrics, `0` for count metrics

### F. Sellpage Performance Table (Bottom)

**Columns:** Page (thumbnail + URL) | Status | Type | Revenue | Orders | Ads Spent | Cash to Balance | Actions (⋮)

**Rows show individual sellpages with:**

| Page | Status | Type | Revenue | Orders | Ads Spent | Cash to Balance |
|------|--------|------|---------|--------|-----------|----------------|
| niraloom.com/zoeshape | Published | Multiple | $6,592.30 | 155 | $2,944.75 | $2,955.26 |
| jetjeans.us | Published | Single | $8,689.23 | 142 | $3,503.00 | $3,405.23 |
| puliam.com/easetactic | Published | Multiple | $6,795.10 | 125 | $3,007.49 | $2,514.93 |
| elibloom.com/soragrace | Published | Multiple | $579.22 | 7 | $250.37 | $249.57 |
| mellycharm.com/zenchic-bra23 | Published | Multiple | $353.30 | 7 | $117.40 | $170.90 |
| elibloom.com/stretchactive | Published | Multiple | $34.98 | 1 | $0.00 | $14.23 |

**Key Observations:**
- Thumbnail image for each sellpage
- Full URL displayed (custom domain + slug)
- Status badge (Published = green)
- Type: Single vs Multiple product sellpage
- Financial columns: Revenue, Orders count, Ads Spent, Cash to Balance
- Action menu (⋮) for each row

---

## 2. GAP ANALYSIS — PixEcom v2 vs Selles

### NAVIGATION GAPS

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Finances module | ✅ Full module | ❌ Not exists | **NEW MODULE NEEDED** |
| Ads Manager (sidebar) | Not visible on this page | ✅ Has route | OK (different nav) |

### KPI CARD GAPS

| KPI | Selles | PixEcom v2 | Gap |
|-----|--------|-----------|-----|
| Revenue (with order count) | ✅ Real-time aggregated | ❌ Stub = 0 | **MISSING: Aggregation from Orders** |
| Cost (total ad spend) | ✅ Real-time aggregated | ❌ Stub = 0 | **MISSING: Aggregation from AdStatsDaily** |
| You Take | ✅ Calculated per PricingRule | ❌ Stub = 0 | **MISSING: Business logic** |
| Hold | ✅ Calculated with holdPercent + holdDuration | ❌ No field exists | **MISSING: Schema + logic** |
| Unhold | ✅ Hold released after holdDurationDays | ❌ No concept | **MISSING: Schema + logic** |
| Cash to Balance | ✅ youTake - activeHold | ❌ No concept | **MISSING: Schema + logic** |

### DATE FILTER GAPS

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Quick date filters (Today/Yesterday/Week/Month) | ✅ | ❌ No dashboard endpoint | **MISSING: Dashboard API** |
| Timezone awareness | ✅ Shows GMT-9 | ❌ SellerSettings has timezone field but unused | **MISSING: Timezone-aware aggregation** |
| Custom date range | ✅ Calendar picker | ❌ No dashboard endpoint | **MISSING: Dashboard API** |
| Filter by sellpage | ✅ Dropdown filter | ❌ No dashboard endpoint | **MISSING: Dashboard API with sellpageId param** |

### AD SOURCE BREAKDOWN GAPS

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Multi-platform support | ✅ Facebook, Pinterest, Google, Applovin, organic | ❌ Facebook only (schema) | **MISSING: Multi-platform enum** |
| Organic traffic row (n/a) | ✅ Tracks non-ad conversions | ❌ No organic tracking | **MISSING: Organic funnel tracking** |
| Per-platform metrics table | ✅ Full funnel per source | ❌ SellpageStatsDaily has adSource but no endpoint | **MISSING: Dashboard ad-source endpoint** |
| CR (overall conversion rate) | ✅ purchases / content views | ❌ Not in schema | **MISSING: Add CR field or compute** |
| CR1 (add to cart rate) | ✅ adds to cart / content views | ✅ Schema has cr1 | OK — needs computation |
| CR2 (checkout completion) | ✅ purchases / checkouts initiated | ✅ Schema has cr2 | OK — needs computation |
| CR tooltip (ℹ️ icons) | ✅ Info tooltips on CR columns | ❌ Frontend only | Frontend task |

### SELLPAGE PERFORMANCE TABLE GAPS

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Sellpage thumbnail | ✅ Product image preview | ✅ Schema has seoOgImage | OK — needs API return |
| Full URL display | ✅ domain.com/slug | ✅ Service builds URL | OK |
| Status badge | ✅ Green "Published" | ✅ Has status field | OK |
| Type (Single/Multiple) | ✅ | ✅ Has sellpageType field | OK |
| Revenue per sellpage | ✅ Real aggregated | ❌ Stub = 0 | **MISSING: Revenue aggregation** |
| Orders per sellpage | ✅ Real count | ❌ Not computed | **MISSING: Order count per sellpage** |
| Ads Spent per sellpage | ✅ Real aggregated | ❌ Stub = 0 | **MISSING: Ad spend aggregation via campaign→sellpage link** |
| Cash to Balance per sellpage | ✅ Computed financial metric | ❌ No concept | **MISSING: Financial computation** |
| Action menu (⋮) | ✅ Per-row actions | ❌ Not designed | Frontend task |

### STATS PIPELINE GAPS (Root Cause)

| Pipeline Step | Selles (Implied) | PixEcom v2 | Gap |
|---------------|-----------------|-----------|-----|
| Fetch ad stats from platforms | ✅ Facebook, Pinterest, Google, Applovin | ❌ Worker is placeholder | **CRITICAL: No stats fetching** |
| Raw → Daily aggregation | ✅ Working | ❌ No worker logic | **CRITICAL: No aggregation** |
| Daily → Sellpage rollup | ✅ Working | ❌ No worker logic | **CRITICAL: No rollup** |
| Order → Revenue attribution | ✅ Per sellpage | ❌ sellpageId nullable, no aggregation | **CRITICAL: No revenue attribution** |
| Financial calculations | ✅ Hold/Unhold/CashToBalance | ❌ PricingRule exists but no computation | **CRITICAL: No financial engine** |
| Organic traffic tracking | ✅ n/a row with funnel data | ❌ No concept | **MISSING: Pixel/tracking-based funnel** |

---

## 3. REQUIRED CHANGES FOR TECH LEAD

### 3.1 New API Endpoints

#### `GET /api/dashboard/summary`
**Purpose:** KPI cards data
**Auth:** JWT (sellerId from token)
**Params:**
```
dateFrom: string (ISO date, required)
dateTo: string (ISO date, required)
sellpageId?: string (UUID, optional — filter by sellpage)
timezone?: string (e.g. "America/Los_Angeles", optional — default from SellerSettings)
```
**Response:**
```json
{
  "revenue": 23044.13,
  "orderCount": 437,
  "cost": 10068.99,
  "youTake": 12975.14,
  "hold": 3665.02,
  "unhold": 0.00,
  "cashToBalance": 9310.12,
  "currency": "USD"
}
```
**Business Logic:**
- `revenue` = SUM(orders.total) WHERE status IN (CONFIRMED, PROCESSING, SHIPPED, DELIVERED) AND sellerId AND dateRange
- `orderCount` = COUNT(orders) same filter
- `cost` = SUM(sellpage_stats_daily.ad_spend) WHERE sellerId AND dateRange
- `youTake` = For each order: apply PricingRule → revenue × sellerTakePercent (or sellerTakeFixed)
- `hold` = For each order within holdDurationDays: revenue × holdPercent
- `unhold` = For each order past holdDurationDays: previously held amount now released
- `cashToBalance` = youTake - activeHold (hold that hasn't been unholded yet)

---

#### `GET /api/dashboard/ad-sources`
**Purpose:** Ad source breakdown table
**Auth:** JWT
**Params:**
```
dateFrom: string (required)
dateTo: string (required)
sellpageId?: string (optional)
```
**Response:**
```json
{
  "sources": [
    {
      "adSource": "ORGANIC",
      "spent": null,
      "roas": null,
      "cpm": null,
      "ctr": null,
      "linkClicks": null,
      "contentViews": 381,
      "addToCart": 57,
      "checkoutInitiated": 41,
      "purchases": 35,
      "cr": 9.19,
      "cr1": 10.76,
      "cr2": 85.37
    },
    {
      "adSource": "FACEBOOK",
      "spent": 9823.01,
      "roas": 2.15,
      "cpm": 21.22,
      "ctr": 2.06,
      "linkClicks": 9525,
      "contentViews": 8481,
      "addToCart": 1326,
      "checkoutInitiated": 789,
      "purchases": 402,
      "cr": 4.74,
      "cr1": 9.30,
      "cr2": 50.95
    }
  ]
}
```
**Business Logic:**
- Group `sellpage_stats_daily` by `adSource` WHERE sellerId AND dateRange
- SUM all metric columns per group
- Compute rates: CR = purchases / contentViews × 100, CR1 = addToCart / contentViews × 100, CR2 = purchases / checkoutInitiated × 100
- For ORGANIC row: spent/roas/cpm/ctr/linkClicks = null (not applicable)

---

#### `GET /api/dashboard/sellpage-performance`
**Purpose:** Sellpage performance table (bottom section)
**Auth:** JWT
**Params:**
```
dateFrom: string (required)
dateTo: string (required)
limit?: number (default 20, max 100)
cursor?: string (optional, for pagination)
sortBy?: string (default "revenue", options: revenue, orders, adsSpent, cashToBalance)
sortOrder?: string (default "desc")
```
**Response:**
```json
{
  "items": [
    {
      "sellpageId": "uuid",
      "thumbnail": "https://cdn.example.com/image.jpg",
      "url": "niraloom.com/zoeshape",
      "slug": "zoeshape",
      "status": "PUBLISHED",
      "sellpageType": "MULTIPLE",
      "revenue": 6592.30,
      "orders": 155,
      "adsSpent": 2944.75,
      "cashToBalance": 2955.26
    }
  ],
  "nextCursor": "..."
}
```
**Business Logic:**
- Join sellpages with aggregated SellpageStatsDaily + Orders
- Revenue = SUM(orders.total) per sellpage
- Orders = COUNT(orders) per sellpage
- Ads Spent = SUM(sellpage_stats_daily.ad_spend) per sellpage across all ad sources
- Cash to Balance = youTake - activeHold per sellpage

---

### 3.2 Schema Changes Required

#### Add `adSource` Enum (replace free varchar)
```prisma
enum AdSource {
  FACEBOOK
  PINTEREST
  GOOGLE
  APPLOVIN
  TIKTOK
  ORGANIC
  OTHER

  @@map("ad_source")
}
```
Update `SellpageStatsDaily.adSource` from `String @db.VarChar(50)` → `AdSource`

#### Add `cr` Field to SellpageStatsDaily
```prisma
// Add to SellpageStatsDaily model:
cr  Decimal @default(0) @db.Decimal(8, 4)  // overall conversion rate: purchases / contentViews
```

#### Add Financial Tracking Models
```prisma
// Option A: Computed on-the-fly from Orders + PricingRules (simpler, recommended for MVP)
// No new model needed — compute in Dashboard service

// Option B: Materialized financial ledger (needed for Finances module later)
model SellerLedgerEntry {
  id            String   @id @default(uuid()) @db.Uuid
  sellerId      String   @map("seller_id") @db.Uuid
  orderId       String?  @map("order_id") @db.Uuid
  entryType     LedgerEntryType  // REVENUE, SELLER_TAKE, HOLD, UNHOLD, PAYOUT
  amount        Decimal  @db.Decimal(10, 2)
  currency      String   @default("USD") @db.VarChar(3)
  description   String?  @db.VarChar(500)
  effectiveAt   DateTime @map("effective_at") @db.Timestamptz
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  seller  Seller  @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  order   Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([sellerId, effectiveAt])
  @@index([sellerId, entryType])
  @@map("seller_ledger_entries")
}

enum LedgerEntryType {
  REVENUE
  SELLER_TAKE
  HOLD
  UNHOLD
  PAYOUT
  REFUND
  CHARGEBACK

  @@map("ledger_entry_type")
}
```

### 3.3 Stats Pipeline Must-Implement

#### Worker Job: Aggregate Ad Stats by Source
```
Input: sellerId, dateRange
Process:
  1. Read AdStatsRaw for date range
  2. Group by (entityType, entityId, date)
  3. Upsert into AdStatsDaily

  4. For each sellpage linked to campaigns:
     - SUM ad stats from campaigns → sellpage level
     - SUM order revenue → sellpage level
     - Compute CR, CR1, CR2, ROAS
     - Upsert into SellpageStatsDaily (one row per sellpage × adSource × date)
```

#### Worker Job: Compute Financial Metrics
```
Input: sellerId, dateRange
Process:
  For each order in date range:
    1. Get applicable PricingRule for order's product
    2. Calculate: youTake = revenue × sellerTakePercent
    3. Calculate: hold = revenue × holdPercent
    4. Check holdDurationDays: if order.createdAt + holdDuration < now() → unhold
    5. Insert/update SellerLedgerEntry records
```

### 3.4 Multi-Platform Ad Source Support

**Current state:** Only Facebook modeled (FbConnection, fb-connections module)
**Required:** At minimum track stats from 5 sources

**Approach for MVP:**
- Stats ingestion already supports `adSource` in SellpageStatsDaily
- Don't need full platform integrations — only need to TAG where traffic comes from
- UTM parameters on sellpage URLs: `?utm_source=facebook`, `?utm_source=pinterest`, etc.
- Organic = visits without UTM parameters
- For Facebook: full API integration (campaigns, stats fetch)
- For others (Pinterest, Google, Applovin): UTM-based tracking only for MVP

### 3.5 Organic Traffic Tracking

**Selles tracks organic/direct traffic with full funnel (Content Views → Cart → Checkout → Purchase)**

**Required implementation:**
- Sellpage frontend must fire tracking events (pixel/analytics):
  - `content_view` — page load
  - `add_to_cart` — button click
  - `checkout_initiated` — checkout form loaded
  - `purchase` — order completed
- Events tagged with `source` derived from UTM params or `ORGANIC` if no params
- Events stored and aggregated into SellpageStatsDaily with `adSource = ORGANIC`

**This implies a tracking/analytics service that doesn't exist yet — could be:**
- Custom pixel endpoint (`POST /api/track` on sellpage domain)
- Or Meta Pixel + server-side events (Facebook Conversions API)
- Or third-party (Google Analytics → BigQuery → sync)

---

## 4. PRIORITY & EFFORT ESTIMATION

### P0 — Blocks Dashboard (Must have)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Dashboard summary endpoint | 2 days | Orders aggregation, PricingRule computation |
| Dashboard ad-sources endpoint | 2 days | SellpageStatsDaily populated |
| Dashboard sellpage-performance endpoint | 2 days | SellpageStatsDaily + Orders join |
| Stats worker: AdStatsRaw → SellpageStatsDaily | 5 days | Worker implementation |
| Financial calculation logic (youTake, hold, unhold, cashToBalance) | 3 days | PricingRule engine |
| Date range + sellpage filter support | 1 day | Query parameter handling |

**Total P0: ~15 dev days**

### P1 — Full Feature Parity

| Item | Effort | Dependencies |
|------|--------|-------------|
| AdSource enum migration (varchar → enum) | 0.5 day | Migration |
| CR field addition to SellpageStatsDaily | 0.5 day | Migration |
| Timezone-aware aggregation | 2 days | SellerSettings timezone |
| Multi-platform UTM tracking | 3 days | Sellpage frontend pixel |
| Organic traffic funnel tracking | 5 days | Custom tracking pixel/endpoint |
| SellerLedgerEntry model + service | 3 days | Financial module foundation |
| Finances module (basic) | 5 days | Ledger entries |

**Total P1: ~19 dev days**

### P2 — Polish

| Item | Effort |
|------|--------|
| Sort by column on sellpage table | 1 day |
| Quick date filter presets (Today/Yesterday/Week/Month) | 0.5 day |
| Tooltip info icons for CR/CR1/CR2 | Frontend only |
| Sellpage thumbnail in API response | 0.5 day |
| Action menu (⋮) per sellpage row | Frontend only |

---

## 5. OWNER NOTES

> **From Product Owner:**
>
> Trên Homepage của Selles, điểm quan trọng nhất là họ hiển thị **đầy đủ thông số theo từng platform** (Facebook, Pinterest, Google, Applovin, Organic) và **theo từng sellpage**. Đây là 2 dimension quan trọng nhất cho seller:
>
> 1. **By Platform:** Seller cần biết platform nào đang mang lại ROI tốt nhất để allocate budget
> 2. **By Sellpage:** Seller cần biết sellpage nào đang perform tốt nhất để scale hoặc kill
>
> PixEcom v2 hiện **hoàn toàn thiếu cả 2 dimension này** ở dashboard level. Schema `SellpageStatsDaily` đã có `adSource` field — đó là nền tảng đúng — nhưng chưa có data, chưa có aggregation, chưa có endpoint.
>
> **Ưu tiên:** Phải có dashboard hoạt động với real data trước khi onboard seller. Dashboard = first impression. Nếu seller mở dashboard thấy toàn số 0, họ sẽ không tin tưởng hệ thống.

---

*Next: Sellpage screenshots audit*
