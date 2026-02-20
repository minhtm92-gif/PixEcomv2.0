# Competitor Audit: Facebook Real-time Ads Manager
**Source:** Selles system screenshot (`Facebook Real-time Ads Manager.jfif`)
**Date:** 2026-02-20
**Auditor:** CTO Advisor + Product Owner

---

## 0. PAGE OVERVIEW

Đây là **core operational dashboard** — nơi seller quản lý và monitor toàn bộ chiến dịch quảng cáo Facebook đang chạy. Tương tự Facebook Ads Manager nhưng được customized cho workflow của platform.

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back   f Facebook Real-time Ads Manager          ×Close │
│                                                             │
│  [Today] [Yesterday] [This Week] [This Month]  (GMT-9) 📅  │
│                                                             │
│  ┌─ Filter ─────────────────────────────────────────────┐   │
│  │ Media ≡ | Adtext ≡ | Thumbnail ≡ | Sellpage ≡ |     │   │
│  │ Ad Post ≡ | Ad Account ≡                             │   │
│  │ Campaign ≡ | Campaign Status ≡ | Campaign Delivery ≡ │   │
│  │ Ad Sets ≡ | Ad Sets Status ≡ | Ad Sets Delivery ≡   │   │
│  │ Ads ≡ | Ads Status ≡ | Ads Delivery ≡               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  📁 Campaigns | 📊 Ad Sets | 📊 Ads   [Normal View]       │
│                                                             │
│  [Bulk Update ▾]                                           │
│                                                             │
│  ┌─ Data Table ─────────────────────────────────────────┐   │
│  │ □ AI Ad | Campaign & | Delivery | Start | Budget |   │   │
│  │   Asst  | Status     | Status   | Date  |        |   │   │
│  │ Spent | ROAS | Results | CostPerResult | CPM | CTR  │   │
│  │ Link Clicks | CPC | Content Views | CPV | Adds to  │   │
│  │ Cart | Cost per Add to Cart | Checkouts Initiated | │   │
│  │ Cost per Checkout Initiated | Purchases | Cost per  │   │
│  │ Purchase | Purchase conversion value | CR | CR1 | CR2│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Summary row: 13 Campaigns | $75.08 | 1.12 ROAS | ...      │
│                                                             │
│  🟢 "Update Complete - 2 campaigns activated" (top right)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. SCREENSHOT ANALYSIS — DETAILED BREAKDOWN

### 1A. Page Header

| Element | Description |
|---------|------------|
| **Back button** | "← Back" — returns to previous page |
| **Title** | "f Facebook Real-time Ads Manager" (with Facebook icon) |
| **Close button** | × (top right) |
| **Status notification** | "Update Complete — 2 campaigns activated." (green, top right) |

### 1B. Date Filters (Quick + Custom)

| Element | Type | Value |
|---------|------|-------|
| Today | Tab (active — blue text) | Quick filter |
| Yesterday | Tab | Quick filter |
| This Week | Tab | Quick filter |
| This Month | Tab | Quick filter |
| Timezone | Display | (GMT-9) |
| Custom date range | Date picker | `26-01-2026 | 26-01-202...` |

### 1C. Filter Panel (12 Filters!)

Selles provides **12 multi-select filter dropdowns**:

| Filter | Category | Notes |
|--------|----------|-------|
| **Media** ≡ | Creative | Filter by video/image version |
| **Adtext** ≡ | Creative | Filter by ad text version |
| **Thumbnail** ≡ | Creative | Filter by thumbnail version |
| **Sellpage** ≡ | Context | Filter by sellpage (highlighted with blue border — actively used) |
| **Ad Post** ≡ | Creative | Filter by specific Facebook post |
| **Ad Account** ≡ | Account | Filter by FB ad account |
| **Campaign** ≡ | Hierarchy | Filter by campaign name |
| **Campaign Status** ≡ | Status | Active/Paused/etc. |
| **Campaign Delivery** ≡ | Delivery | Delivery status |
| **Ad Sets** ≡ | Hierarchy | Filter by adset |
| **Ad Sets Status** ≡ | Status | |
| **Ad Sets Delivery** ≡ | Delivery | |
| **Ads** ≡ | Hierarchy | Filter by ad |
| **Ads Status** ≡ | Status | |
| **Ads Delivery** ≡ | Delivery | |
| **× Clear Filter** | Action | Clear all filters |

**Key Insight:** The filter system lets sellers slice data by ANY dimension:
- By creative (which video, text, thumbnail)
- By context (which sellpage, which ad account)
- By hierarchy level (campaign → adset → ad)
- By status (active, paused) and delivery status

### 1D. View Tabs

| Tab | Icon | Description |
|-----|------|------------|
| **Campaigns** | 📁 | Campaign-level view (active in screenshot) |
| **Ad Sets** | 📊 | Adset-level breakdown |
| **Ads** | 📊 | Individual ad-level breakdown |
| **Normal View** | 📋 | Toggle button (right side) — implies alternate view exists |

### 1E. Bulk Actions

| Element | Description |
|---------|------------|
| **Bulk Update ▾** | Green dropdown button — allows batch status changes |

### 1F. Data Table — Column Definitions

The table has **25+ columns**. Grouped by category:

#### Identity & Status Columns

| Column | Description | Data Type |
|--------|------------|-----------|
| ☐ (checkbox) | Multi-select for bulk actions | Boolean |
| **AI Ad Assistant** | Toggle switch (on/off) — enables AI optimization | Boolean toggle |
| **Campaign & Status** | Campaign name (truncated) + status indicator (green ● / red ●) | String + enum |
| **Delivery Status** | Active / Inactive badge | Enum (green/red) |
| **Start Date** | Campaign start date | Date (DD.MM.YY format) |
| **Budget** | Budget amount + type | "$120 Daily", "$500 Daily", "$354 Daily" |

#### Performance Metrics Columns

| Column | Description | Formula / Source |
|--------|------------|-----------------|
| **Spent** | Total spend | Direct from Meta |
| **ROAS** | Return on Ad Spend | purchase_value / spend |
| **Results** | Number of conversions/results | Direct from Meta (optimization event) |
| **Cost per Result** | Average cost per result | spend / results |
| **CPM** | Cost per 1000 impressions | (spend / impressions) × 1000 |
| **CTR** | Click-through rate | (clicks / impressions) × 100 |
| **Link Clicks** | Number of link clicks | Direct from Meta |
| **CPC** | Cost per click | spend / link_clicks |
| **Content Views** | Landing page views / content views | Direct from Meta |
| **CPV** | Cost per view | spend / content_views |
| **Adds to Cart** | Add-to-cart events | Direct from Meta pixel |
| **Cost per Add to Cart** | | spend / adds_to_cart |
| **Checkouts Initiated** | Checkout started events | Direct from Meta pixel |
| **Cost per Checkout Initiated** | | spend / checkouts_initiated |
| **Purchases** | Purchase events | Direct from Meta pixel |
| **Cost per Purchase** | | spend / purchases |
| **Purchase conversion value** | Total revenue from purchases | Direct from Meta |
| **CR** | Conversion Rate (general) | purchases / link_clicks × 100 |
| **CR1** | Conversion Rate 1 | Likely: adds_to_cart / content_views × 100 |
| **CR2** | Conversion Rate 2 | Likely: purchases / adds_to_cart × 100 |

### 1G. Data Table — Campaign Rows

| Row | Campaign | Status | Start | Budget | Spent | ROAS | Results | CPM | CTR | Link Clicks | CPC | Content Views | CPV | Adds to Cart | Checkouts | Purchases | CR | CR1 | CR2 |
|-----|----------|--------|-------|--------|-------|------|---------|-----|-----|------------|-----|---------------|-----|-------------|-----------|-----------|-----|-----|-----|
| 1 | 1... | ● Active | 26.01.26 | $120 Daily | $0.00 | 0.00 | 0 | $0.00 | 0.00% | 0 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0.00% | 0.00% | 0.00% |
| 2 | 1... (AI ON) | ● Active | 12.01.26 | $354 Daily | $2.35 | 0.00 | 0 | $18.80 | 4.00% | 5 | $0.47 | 5 | $0.47 | 0 | $0.00 | 0 | $0.00 | 0.00% | 0.00% | 0.00% |
| 3 | 1... | ● Active | 20.01.26 | $500 Daily | $5.38 | 0.00 | 0 | $26.90 | 3.00% | 6 | $0.90 | 9 | $0.60 | 3 | $1.79 | 1 | $5.38 | 0.00% | 0.00% | 11.11% |
| 4 | 1... | ● Active | 21.01.26 | $120 Daily | $2.75 | 0.00 | 0 | $38.19 | 1.39% | 1 | $2.75 | 2 | $1.38 | 1 | $2.75 | 0 | $0.00 | 0.00% | 0.00% | 0.00% |
| 5 | 1... | ● Active | 24.01.26 | $500 Daily | $9.86 | 4.26 | 1 | $9.86 | 2.16% | 7 | $1.41 | 10 | $0.99 | 2 | $4.93 | 2 | $4.93 | 1 | $9.86 | $41.98 | 10.00% | 20.00% | 50.00% |
| 6 | 2... | ● Active | 13.01.26 | $500 Daily | $20.58 | 0.00 | 0 | $25.76 | 1.75% | 14 | $1.47 | 18 | $1.14 | 2 | $10.29 | 1 | $20.58 | 0 | $0.00 | 0.00% | 5.56% | 0.00% |
| 7 | 2... | ● Inactive | 05.09.25 | $120 Daily | $0.00 | 0.00 | 0 | $0.00 | 0.00% | 0 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0.00% | 0.00% | 0.00% |
| 8 | 2... | ● Active | 26.01.26 | $120 Daily | $0.00 | 0.00 | 0 | $0.00 | 0.00% | 0 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0.00% | 0.00% | 0.00% |
| 9 | 4... | ● Inactive | 30.12.25 | $120 Daily | $0.00 | 0.00 | 0 | $0.00 | 0.00% | 0 | $0.00 | 1 | $0.00 | 0 | $0.00 | 0 | $0.00 | 0.00% | 0.00% | 0.00% |

### 1H. Summary Row

| Element | Value |
|---------|-------|
| Total Campaigns | 13 Campaigns |
| Total Spent | $75.08 |
| Avg ROAS | 1.12 |
| Total Results | 2 |
| Avg CPM | $37.54 |
| Avg CTR | 2.04% |
| Total Link Clicks | 60 |
| Avg CPC | $1.25 |
| Total Content Views | 73 |
| Avg CPV | $1.03 |
| Total Adds to Cart | 11 |
| Avg Cost per Add to Cart | $6.83 |
| Total Checkouts Initiated | 5 |
| Avg Cost per Checkout Initiated | $15.02 |
| Total Purchases | 2 |
| Avg Cost per Purchase | $37.54 |
| Total Purchase Value | $83.96 |
| Overall CR | 2.74% |
| Overall CR1 | 6.85% |
| Overall CR2 | 40.00% |

### 1I. Notable UI Elements

1. **"AI Ad Assistant" toggle** — Per-campaign AI optimization toggle. Row 2 has it ON (blue toggle). This is likely a premium feature or Meta's Advantage Campaign Budget feature.

2. **Status indicators:** Green dot (●) = Active, Red dot (●) = Inactive. Status badge text: "Active" (green) or "Inactive" (gray).

3. **"Normal View" button** — Implies there's an alternate view (possibly "Compact View" or "Chart View").

4. **Real-time notification:** "Update Complete — 2 campaigns activated" — indicates the system pushes status changes to Meta and confirms completion.

5. **Budget display:** "$120 Daily" — amount + budget type combined.

---

## 2. FUNNEL METRICS ANALYSIS

The column set reveals the **full eCommerce conversion funnel** being tracked:

```
Impressions (implicit via CPM)
    ↓
Link Clicks (CTR%)
    ↓
Content Views (landing page views)
    ↓
Adds to Cart (CR1 = adds_to_cart / content_views)
    ↓
Checkouts Initiated
    ↓
Purchases (CR2 = purchases / adds_to_cart)
    ↓
Purchase Value (ROAS = purchase_value / spend)

Overall: CR = purchases / link_clicks
```

**Derived Metrics Computation:**
```
CPM = (spend / impressions) × 1000
CTR = (link_clicks / impressions) × 100
CPC = spend / link_clicks
CPV = spend / content_views
Cost per Add to Cart = spend / adds_to_cart
Cost per Checkout = spend / checkouts_initiated
Cost per Purchase = spend / purchases
ROAS = purchase_value / spend
CR = (purchases / link_clicks) × 100
CR1 = (adds_to_cart / content_views) × 100    (or similar stage conversion)
CR2 = (purchases / adds_to_cart) × 100        (or similar stage conversion)
```

---

## 3. GAP ANALYSIS — PixEcom v2 vs Selles Ads Manager

### 3A. Page Infrastructure

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Dedicated Ads Manager page** | ✅ Full page with table | ❌ No ads manager page | **CRITICAL: Entire page missing** |
| **Real-time data sync** | ✅ "Update Complete" notifications | ❌ No Meta sync | **CRITICAL: No Meta API sync** |
| **Campaign/Adset/Ads tabs** | ✅ 3 hierarchy views | ❌ | **NEW: 3-level drill-down** |
| **Normal/Alternate view toggle** | ✅ | ❌ | P2 (nice to have) |

### 3B. Date Filtering

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Quick date filters** | ✅ Today/Yesterday/This Week/This Month | ❌ | **NEW** |
| **Custom date range picker** | ✅ Calendar picker | ❌ | **NEW** |
| **Timezone display** | ✅ (GMT-9) | ❌ | **NEW** |
| **Timezone-aware stats** | ✅ | ❌ AdStatsDaily has no timezone | **Schema: timezone field** |

### 3C. Multi-Dimensional Filters (12 filters)

| Filter | Selles | PixEcom v2 | Gap |
|--------|--------|-----------|-----|
| **Media version** | ✅ | ❌ | Requires: AdPost → AssetMedia join |
| **Adtext version** | ✅ | ❌ | Requires: AdPost → AssetAdtext join |
| **Thumbnail version** | ✅ | ❌ | Requires: AdPost → AssetThumbnail join |
| **Sellpage** | ✅ (highlighted — primary filter) | ❌ | Requires: Campaign.sellpageId |
| **Ad Post** | ✅ | ❌ | Requires: Ad → AdPost join |
| **Ad Account** | ✅ | ❌ | Requires: Campaign.adAccountId |
| **Campaign / Status / Delivery** | ✅ | ✅ Campaign model exists with status | Schema OK — needs query |
| **Ad Sets / Status / Delivery** | ✅ | ✅ Adset model exists with status | Schema OK — needs query |
| **Ads / Status / Delivery** | ✅ | ✅ Ad model exists with status | Schema OK — needs query |
| **Clear all filters** | ✅ | ❌ | Frontend |

### 3D. Data Table Columns (25+ metrics)

| Metric | Selles | PixEcom v2 (AdStatsDaily) | Gap |
|--------|--------|--------------------------|-----|
| **Spent** (spend) | ✅ | ✅ `spend` field | OK |
| **ROAS** | ✅ | ✅ Computable: purchaseValue/spend | OK (computed) |
| **Results** | ✅ | ❌ No generic "results" field | **NEW: Map to optimization event** |
| **Cost per Result** | ✅ | ❌ | Computed from results |
| **CPM** | ✅ | ✅ `cpm` field exists | OK |
| **CTR** | ✅ | ❌ No CTR field | **Computed: needs impressions + clicks** |
| **Link Clicks** | ✅ | ✅ `clicks` field | OK (rename to linkClicks?) |
| **CPC** | ✅ | ✅ `cpc` field exists | OK |
| **Content Views** | ✅ | ❌ No content views field | **NEW field on AdStatsDaily** |
| **CPV (Cost per View)** | ✅ | ❌ | **Computed: spend/contentViews** |
| **Adds to Cart** | ✅ | ❌ No adds_to_cart field | **NEW field on AdStatsDaily** |
| **Cost per Add to Cart** | ✅ | ❌ | Computed |
| **Checkouts Initiated** | ✅ | ❌ No checkouts field | **NEW field on AdStatsDaily** |
| **Cost per Checkout Initiated** | ✅ | ❌ | Computed |
| **Purchases** | ✅ | ✅ `purchases` field | OK |
| **Cost per Purchase** | ✅ | ❌ | Computed: spend/purchases |
| **Purchase conversion value** | ✅ | ✅ `purchaseValue` field | OK |
| **CR** | ✅ | ❌ | **Computed: purchases/linkClicks** |
| **CR1** | ✅ | ❌ | **Computed: addsToCart/contentViews** |
| **CR2** | ✅ | ❌ | **Computed: purchases/addsToCart** |

**AdStatsDaily Current Fields (from schema):**
```prisma
model AdStatsDaily {
  spend          Decimal
  impressions    Int
  clicks         Int
  purchases      Int
  purchaseValue  Decimal
  cpc            Decimal
  cpm            Decimal
  ctr            Decimal
  videoViews     Int        // different from Content Views
  leadCount      Int
  // MISSING: contentViews, addsToCart, checkoutsInitiated, costPerResult
}
```

### 3E. Bulk Actions & AI Features

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Bulk Update dropdown** | ✅ Batch status changes | ❌ | **NEW: Batch campaign/adset/ad updates** |
| **AI Ad Assistant toggle** | ✅ Per-campaign toggle | ❌ | **P3: AI optimization feature** |
| **Multi-select (checkboxes)** | ✅ | ❌ | Frontend |
| **Delivery Status sync** | ✅ Shows delivery status from Meta | ❌ deliveryStatus fields exist but unpopulated | **Requires: Meta API polling** |
| **Real-time status updates** | ✅ "Update Complete" toast | ❌ | **Requires: WebSocket or SSE** |

### 3F. Summary Row

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Summary/total row** | ✅ Aggregated across all visible campaigns | ❌ | **NEW: Aggregation query** |
| **Campaign count** | ✅ "13 Campaigns" | ❌ | COUNT query |
| **Totals (Spent, Clicks, Purchases)** | ✅ SUM | ❌ | SUM query |
| **Averages (ROAS, CPM, CTR, CPC)** | ✅ Weighted avg | ❌ | Weighted avg computation |

---

## 4. REQUIRED CHANGES FOR TECH LEAD

### 4.1 Schema Changes

#### 4.1.1 Extend AdStatsDaily with Missing Funnel Metrics

```prisma
model AdStatsDaily {
  // ... existing fields ...

  // ADD these funnel metrics:
  contentViews        Int       @default(0) @map("content_views")
  addsToCart           Int       @default(0) @map("adds_to_cart")
  checkoutsInitiated   Int       @default(0) @map("checkouts_initiated")
  costPerResult        Decimal   @default(0) @map("cost_per_result") @db.Decimal(12, 4)

  // NOTE: These fields map to Meta Insights API fields:
  // contentViews → actions[action_type=landing_page_view].value
  // addsToCart → actions[action_type=add_to_cart].value
  // checkoutsInitiated → actions[action_type=initiate_checkout].value
}
```

**Migration:**
```sql
ALTER TABLE ad_stats_daily
  ADD COLUMN content_views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN adds_to_cart INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN checkouts_initiated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN cost_per_result DECIMAL(12,4) NOT NULL DEFAULT 0;
```

#### 4.1.2 Add Timezone to Seller

```prisma
model Seller {
  // ... existing fields ...
  timezone String @default("America/Los_Angeles") @db.VarChar(50)
}
```

---

### 4.2 New API Endpoints

---

#### `GET /api/ads-manager/campaigns` (Campaign List — Tab 1)
**Purpose:** List all campaigns with stats and filter support
**Auth:** JWT (seller-scoped)
**Params:**
```
// Date
dateFrom: date (required)
dateTo: date (required)
datePreset?: "today" | "yesterday" | "this_week" | "this_month"

// Filters (all optional, multi-select via comma-separated)
sellpageIds?: string (comma-separated UUIDs)
adAccountIds?: string
campaignIds?: string
campaignStatus?: string ("ACTIVE,PAUSED")
campaignDelivery?: string
adsetIds?: string
adsetStatus?: string
adsetDelivery?: string
adIds?: string
adStatus?: string
adDelivery?: string
mediaVersions?: string (filter by AssetMedia.version via AdPost)
adtextVersions?: string
thumbnailVersions?: string
adPostIds?: string

// Pagination
page?: number (default 1)
perPage?: number (default 25, max 100)

// Sort
sortBy?: string (default "spent")
sortOrder?: "asc" | "desc"
```

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "externalCampaignId": "meta_123",
      "name": "JettJeans3-CBO-2026-01-26-001",
      "status": "ACTIVE",
      "deliveryStatus": "Active",
      "startDate": "2026-01-26",
      "budget": 120.00,
      "budgetType": "DAILY",
      "aiAssistant": false,
      "sellpage": { "id": "uuid", "domain": "jetjeans.us" },
      "adAccount": { "id": "uuid", "name": "JettJeans Ad Account" },
      "stats": {
        "spend": 9.86,
        "roas": 4.26,
        "results": 1,
        "costPerResult": 9.86,
        "cpm": 9.86,
        "ctr": 2.16,
        "linkClicks": 7,
        "cpc": 1.41,
        "contentViews": 10,
        "cpv": 0.99,
        "addsToCart": 2,
        "costPerAddToCart": 4.93,
        "checkoutsInitiated": 2,
        "costPerCheckout": 4.93,
        "purchases": 1,
        "costPerPurchase": 9.86,
        "purchaseValue": 41.98,
        "cr": 10.00,
        "cr1": 20.00,
        "cr2": 50.00
      }
    }
  ],
  "summary": {
    "totalCampaigns": 13,
    "spend": 75.08,
    "roas": 1.12,
    "results": 2,
    "cpm": 37.54,
    "ctr": 2.04,
    "linkClicks": 60,
    "cpc": 1.25,
    "contentViews": 73,
    "cpv": 1.03,
    "addsToCart": 11,
    "costPerAddToCart": 6.83,
    "checkoutsInitiated": 5,
    "costPerCheckout": 15.02,
    "purchases": 2,
    "costPerPurchase": 37.54,
    "purchaseValue": 83.96,
    "cr": 2.74,
    "cr1": 6.85,
    "cr2": 40.00
  },
  "total": 13,
  "page": 1,
  "perPage": 25
}
```

**Business Logic:**
```
1. Get all Campaigns WHERE sellerId (from JWT)
2. Apply filters (sellpage, status, delivery, etc.)
3. For creative-level filters (media/adtext/thumbnail):
   Campaign → Adset → Ad → AdPost → AssetMedia/Adtext/Thumbnail
4. For each campaign:
   a. Sum AdStatsDaily WHERE entityType = 'CAMPAIGN' AND entityId = campaignId
      AND statDate BETWEEN dateFrom AND dateTo
   b. Compute derived metrics (ROAS, CR, CR1, CR2, etc.)
5. Compute summary row (SUM/AVG across all filtered campaigns)
6. Sort + paginate
```

**Effort:** 5 days (complex filters + stats aggregation + derived metrics)

---

#### `GET /api/ads-manager/adsets` (Adset List — Tab 2)
**Purpose:** Same as campaigns but at adset level
**Auth:** JWT
**Response:** Same shape but with adset-level data + parent campaign info

**Effort:** 2 days (reuses campaign endpoint pattern)

---

#### `GET /api/ads-manager/ads` (Ad List — Tab 3)
**Purpose:** Individual ad performance with creative details
**Auth:** JWT
**Response:** Same shape but with ad-level data + creative preview info

**Effort:** 2 days

---

#### `PATCH /api/ads-manager/bulk-update` (Bulk Status Update)
**Purpose:** Batch update campaign/adset/ad status
**Auth:** JWT
**Body:**
```json
{
  "entityType": "CAMPAIGN",
  "entityIds": ["uuid1", "uuid2"],
  "updates": {
    "status": "PAUSED"
  }
}
```
**Business Logic:**
1. Validate all entities belong to seller
2. Update status in DB
3. Push status change to Meta API (async via BullMQ)
4. Return updated entities

**Effort:** 3 days (includes Meta API push + async confirmation)

---

#### `PATCH /api/ads-manager/campaigns/:id/ai-assistant` (AI Assistant Toggle)
**Purpose:** Enable/disable AI optimization per campaign
**Auth:** JWT
**Body:**
```json
{
  "enabled": true
}
```
**Note:** This likely maps to Meta's Advantage Campaign Budget or CBO settings. Needs Meta API call.

**Effort:** 1 day

---

#### `GET /api/ads-manager/filter-options` (Dynamic Filter Options)
**Purpose:** Get available values for all filter dropdowns
**Auth:** JWT
**Params:**
```
sellpageId?: string (to scope other filters)
```
**Response:**
```json
{
  "sellpages": [{ "id": "uuid", "domain": "jetjeans.us" }],
  "adAccounts": [{ "id": "uuid", "name": "Account 1" }],
  "campaigns": [{ "id": "uuid", "name": "Campaign 1" }],
  "adsets": [...],
  "statuses": ["ACTIVE", "PAUSED", "INACTIVE"],
  "deliveryStatuses": ["Active", "Inactive", "Learning", "Limited"],
  "mediaVersions": ["v5.0", "v1.2.1", ...],
  "adtextVersions": ["t1.0", "t8.2", ...],
  "thumbnailVersions": ["b1.0", ...]
}
```

**Effort:** 2 days (many joins required for creative version lists)

---

### 4.3 Stats Sync Service (CRITICAL DEPENDENCY)

The Ads Manager page requires **real-time** or **near-real-time** stats from Meta. This is the #1 blocker.

#### Required: Meta Insights Sync Worker

```
apps/worker/src/
  jobs/
    sync-ad-stats.job.ts     # Fetch insights from Meta API
    sync-campaign-status.job.ts  # Sync delivery status
    sync-ad-status.job.ts
```

**Sync Strategy:**
```
1. Every 15 minutes: Pull insights for all ACTIVE campaigns
   - Meta API: GET /{campaign_id}/insights?fields=spend,impressions,...
   - For each Campaign/Adset/Ad level
   - Upsert into AdStatsDaily

2. Every 5 minutes: Pull delivery status for ACTIVE entities
   - Meta API: GET /{campaign_id}?fields=effective_status
   - Update Campaign.deliveryStatus, Adset.deliveryStatus, Ad.deliveryStatus

3. On-demand: "Refresh" button triggers immediate sync
   - Via BullMQ priority queue
```

**Meta Insights API Fields to Fetch:**
```
spend, impressions, clicks, cpc, cpm, ctr,
actions (for purchases, add_to_cart, initiate_checkout, landing_page_view),
action_values (for purchase ROAS value),
cost_per_action_type,
video_views (for video metrics)
```

**Effort:** 8 days (includes Meta API client, rate limiting, error handling, upsert logic)

---

### 4.4 Real-time Updates (WebSocket/SSE)

For the "Update Complete — 2 campaigns activated" notification:

**Option A: Server-Sent Events (SSE)** — Simpler
```
GET /api/ads-manager/events (SSE stream)
→ Emits: { type: "campaign_status_change", data: { campaignId, newStatus } }
→ Emits: { type: "stats_updated", data: { timestamp } }
→ Emits: { type: "bulk_update_complete", data: { count, action } }
```

**Option B: WebSocket** — More flexible but heavier

**Recommendation:** SSE for MVP. WebSocket if need two-way communication later.

**Effort:** 2 days (SSE implementation + BullMQ event listener)

---

## 5. PRIORITY & EFFORT ESTIMATION

### P0 — Stats Sync (BLOCKER for everything)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Extend AdStatsDaily schema (add funnel metrics) | 0.5 day | Migration |
| Meta Insights sync worker (campaign/adset/ad levels) | 5 days | Meta API client (from Ad Creation audit) |
| Delivery status sync worker | 2 days | Meta API client |
| Seller timezone handling | 0.5 day | Schema migration |

**Total P0: ~8 dev days**

### P1 — Campaign List (Core View)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Campaign list endpoint with stats | 5 days | AdStatsDaily populated |
| Summary row aggregation | 1 day | Campaign list |
| Multi-dimensional filter system | 3 days | Campaign + creative joins |
| Filter options endpoint | 2 days | Schema queries |
| Date preset handling | 0.5 day | Utility |

**Total P1: ~11.5 dev days**

### P2 — Adset & Ad Views

| Item | Effort | Dependencies |
|------|--------|-------------|
| Adset list endpoint | 2 days | Reuses campaign pattern |
| Ad list endpoint | 2 days | Reuses campaign pattern |
| Drill-down navigation (Campaign → Adsets → Ads) | 1 day | All 3 endpoints |

**Total P2: ~5 dev days**

### P3 — Actions & Real-time

| Item | Effort | Dependencies |
|------|--------|-------------|
| Bulk status update endpoint + Meta push | 3 days | Meta API client |
| AI Assistant toggle | 1 day | Meta API |
| SSE real-time events | 2 days | BullMQ |
| "Update Complete" notification system | 1 day | SSE |

**Total P3: ~7 dev days**

### P4 — Frontend

| Item | Effort |
|------|--------|
| Ads Manager page layout + tabs | 2 days |
| Data table with 25+ columns (virtualized) | 3 days |
| Filter panel with 12 dropdowns | 2 days |
| Date picker + quick filters | 1 day |
| Bulk update UI | 1 day |
| Summary row | 0.5 day |
| Real-time notification toast | 0.5 day |

**Total P4: ~10 dev days (frontend)**

---

### TOTAL EFFORT SUMMARY

| Priority | Backend | Frontend | Total |
|----------|---------|----------|-------|
| P0 (Stats Sync) | 8d | — | 8d |
| P1 (Campaign List) | 11.5d | — | 11.5d |
| P2 (Adset/Ad Views) | 5d | — | 5d |
| P3 (Actions/RT) | 7d | — | 7d |
| P4 (Frontend) | — | 10d | 10d |
| **TOTAL** | **31.5d** | **10d** | **41.5d** |

---

## 6. OWNER NOTES

> **From Product Owner:**
>
> Ads Manager là **command center** của seller. Đây là nơi seller spend 80% thời gian. Nó cần:
>
> 1. **Real-time** — Data phải cập nhật liên tục, không phải stale data từ hôm qua
> 2. **Filterable** — Seller cần slice data theo mọi chiều: sellpage, media version, ad text version... Ví dụ: "Show me all campaigns using video v5.0 on jetjeans.us" → so sánh performance
> 3. **Full funnel metrics** — Không chỉ Spent + ROAS. Seller cần thấy TOÀN BỘ funnel: Impressions → Clicks → Content Views → Add to Cart → Checkout → Purchase. Mỗi bước đều có cost metrics.
> 4. **CR1, CR2** — Đây là conversion rate giữa các bước trong funnel. Seller dùng để diagnose vấn đề: CR1 thấp = landing page kém, CR2 thấp = checkout flow kém.
> 5. **Bulk actions** — Seller quản lý 10-50+ campaigns. Cần batch pause/activate. Không thể 1 campaign 1 lần.
> 6. **Summary row** — Tổng hợp tất cả campaigns đang hiển thị. Seller cần nhìn overview nhanh.
>
> **PixEcom v2 hiện tại:** Ads Manager page hoàn toàn CHƯA CÓ. Schema Campaign/Adset/Ad tồn tại nhưng không có data, không có endpoint, không có Meta sync. Đây là gap lớn thứ 2 sau Ad Creation.
>
> **Priority:** Stats Sync (P0) phải làm trước — nó là dependency chung cho cả Ads Manager, Homepage dashboard, Sellpage stats, và Ad Content tab.

---

## 7. ARCHITECTURE WARNINGS

### 7.1 Stats Query Performance

The Ads Manager query is the **most expensive query** in the entire system:
- 13+ campaigns × 25+ computed metrics × date range filtering
- With creative-level filters: requires 6-table JOINs (Campaign → Adset → Ad → AdPost → Asset*)
- Summary row requires full scan before pagination

**Recommendations:**
1. **Materialized view** for campaign-level daily stats (pre-join Campaign + AdStatsDaily)
2. **Redis cache** for summary row (invalidate on stats sync)
3. **Pagination BEFORE stats computation** — don't compute stats for all 1000+ campaigns
4. **Column-level lazy loading** — only compute expensive metrics (CR1, CR2) if columns are visible

### 7.2 Meta API Rate Limits for Stats Sync

Syncing stats for 100 sellers × 10 campaigns × 3 levels (campaign/adset/ad) = 3,000 API calls every 15 minutes.

**Solution:**
- Batch insights API: `GET /{ad_account_id}/insights?filtering=[{"field":"campaign.id","operator":"IN","value":[...]}]`
- One API call per ad_account, not per campaign
- Rate limit queue per ad_account_id

### 7.3 WebSocket/SSE Scaling

With 100+ concurrent sellers watching their Ads Manager:
- SSE connections are long-lived HTTP connections
- Need proper connection management + heartbeat
- Consider Redis Pub/Sub for multi-instance support

### 7.4 Timezone Handling

Stats dates must be timezone-aware:
- Meta returns stats in the ad account's timezone
- Seller may be in a different timezone (GMT-9 in screenshot)
- "Today" means different dates for different sellers
- AdStatsDaily.statDate must align with the correct timezone

---

## 8. CURRENT STATE AUDIT — PixEcom v2 Ads Manager (`/ads-manager`)

> **Source:** `apps/web/src/app/(portal)/ads-manager/page.tsx` + `apps/web/src/mock/campaigns.ts`
> **Preview URL:** `https://preview1.pixelxlab.com/ads-manager`
> **Reviewed:** 2026-02-20

### 8.1 What PixEcom Currently Has

```
┌─────────────────────────────────────────────────────────────┐
│  Ads Manager                                                │
│  Campaign performance & management         [+ New Campaign] │
│                                                             │
│  ┌──────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐          │
│  │$7.7K │ │ 486K     │ │ 16.3K     │ │ 658      │          │
│  │Spent │ │Impress.  │ │Clicks     │ │Conv.     │          │
│  └──────┘ └──────────┘ └───────────┘ └──────────┘          │
│                                                             │
│  [10 Campaigns] [4 Active]                                  │
│                                                             │
│  [🔍 Search campaigns...] [All Status ▾] [All Platforms ▾] │
│                                                             │
│  ┌─ Table ──────────────────────────────────────────────┐   │
│  │ Campaign | Platform | Status | Budget | Spent |      │   │
│  │ Impressions | Clicks | CTR | CPC | Conv. | ROAS     │   │
│  │                                                      │   │
│  │ ... 10 rows mock data ...                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Showing 10 of 10 campaigns                                 │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Feature-by-Feature Gap Comparison

#### A. DATA SOURCE

| Aspect | PixEcom (Current) | Selles | Gap |
|--------|-------------------|--------|-----|
| Data source | ❌ Mock data (`mockCampaigns` array, 10 records) | ✅ Real Meta API data | **CRITICAL: 100% mock** |
| API integration | ❌ None — `import { mockCampaigns } from '@/mock/campaigns'` | ✅ Real-time Meta sync | No backend endpoint |
| Data freshness | ❌ Static — never updates | ✅ Sync every 15 min + on-demand refresh | No sync worker |

#### B. DATE FILTERING (PO nhấn mạnh: "có thể lọc theo ngày, lọc nhanh today/yesterday/this week/this month")

| Feature | PixEcom | Selles | Gap |
|---------|---------|--------|-----|
| Quick date filters | ❌ **KHÔNG CÓ** | ✅ Today / Yesterday / This Week / This Month | **THIẾU HOÀN TOÀN** |
| Custom date range | ❌ **KHÔNG CÓ** | ✅ Calendar date picker | **THIẾU** |
| Timezone display | ❌ | ✅ (GMT-9) | **THIẾU** |

#### C. FILTER SYSTEM (PO nhấn mạnh: "đủ rất nhiều Filter")

| Filter | PixEcom | Selles | Gap |
|--------|---------|--------|-----|
| Search by name | ✅ Text search (name + objective) | ✅ | OK |
| Status filter | ✅ 5 statuses (Active/Paused/Draft/Completed/Error) | ✅ Campaign Status + Delivery Status | Partial — thiếu Delivery Status |
| Platform filter | ✅ Facebook/TikTok/Google | ❌ Selles chỉ Facebook | OK (PixEcom có thêm) |
| **Media version** | ❌ | ✅ | **THIẾU** |
| **Adtext version** | ❌ | ✅ | **THIẾU** |
| **Thumbnail version** | ❌ | ✅ | **THIẾU** |
| **Sellpage** | ❌ | ✅ (primary filter — highlighted) | **THIẾU** |
| **Ad Post** | ❌ | ✅ | **THIẾU** |
| **Ad Account** | ❌ | ✅ | **THIẾU** |
| **Campaign** | ❌ | ✅ Multi-select dropdown | **THIẾU** |
| **Campaign Delivery** | ❌ | ✅ | **THIẾU** |
| **Ad Sets / Status / Delivery** | ❌ | ✅ (3 filters) | **THIẾU** |
| **Ads / Status / Delivery** | ❌ | ✅ (3 filters) | **THIẾU** |
| **Clear all filters** | ✅ (only shows when no results) | ✅ (always visible × button) | Partial |
| **TỔNG:** | **3 filters** | **15 filters** | **Thiếu 12 filters** |

#### D. VIEW TABS (Campaign → Adset → Ads drill-down)

| Feature | PixEcom | Selles | Gap |
|---------|---------|--------|-----|
| Campaigns tab | ✅ (only view) | ✅ | OK |
| Ad Sets tab | ❌ | ✅ | **THIẾU** |
| Ads tab | ❌ | ✅ | **THIẾU** |
| Drill-down navigation | ❌ | ✅ Click campaign → see adsets → click adset → see ads | **THIẾU** |
| Normal/Alternate view toggle | ❌ | ✅ | P3 |

#### E. DATA TABLE COLUMNS (PO nhấn mạnh: "hiển thị rất nhiều chỉ số cần thiết")

| Column | PixEcom | Selles | Gap |
|--------|---------|--------|-----|
| Campaign name | ✅ | ✅ | OK |
| Status | ✅ (badge) | ✅ (dot + badge) | OK |
| Platform | ✅ (badge) | N/A (only Facebook) | OK |
| Start Date | ❌ | ✅ | **THIẾU** |
| Budget/Day | ✅ | ✅ "$120 Daily" | OK |
| Delivery Status | ❌ | ✅ Active/Inactive badge | **THIẾU** |
| AI Ad Assistant | ❌ | ✅ Toggle switch | **THIẾU** |
| Spent | ✅ | ✅ | OK |
| ROAS | ✅ | ✅ | OK |
| Impressions | ✅ | ✅ (via CPM) | OK |
| Clicks (Link Clicks) | ✅ | ✅ | OK |
| CTR | ✅ | ✅ | OK |
| CPC | ✅ | ✅ | OK |
| Conversions | ✅ (generic) | ✅ "Results" | OK (rename) |
| **CPM** | ❌ | ✅ | **THIẾU** |
| **Results** | ❌ | ✅ | **THIẾU** |
| **Cost per Result** | ❌ | ✅ | **THIẾU** |
| **Content Views** | ❌ | ✅ | **THIẾU** |
| **CPV (Cost per View)** | ❌ | ✅ | **THIẾU** |
| **Adds to Cart** | ❌ | ✅ | **THIẾU** |
| **Cost per Add to Cart** | ❌ | ✅ | **THIẾU** |
| **Checkouts Initiated** | ❌ | ✅ | **THIẾU** |
| **Cost per Checkout** | ❌ | ✅ | **THIẾU** |
| **Purchases** | ❌ | ✅ | **THIẾU** |
| **Cost per Purchase** | ❌ | ✅ | **THIẾU** |
| **Purchase Conversion Value** | ❌ | ✅ | **THIẾU** |
| **CR** | ❌ | ✅ | **THIẾU** |
| **CR1** | ❌ | ✅ | **THIẾU** |
| **CR2** | ❌ | ✅ | **THIẾU** |
| **TỔNG:** | **11 columns** | **25+ columns** | **Thiếu 14+ cột metrics** |

#### F. SUMMARY ROW (PO nhắc: "Ở cuối còn có row tổng số nữa kìa")

| Feature | PixEcom | Selles | Gap |
|---------|---------|--------|-----|
| Summary row ở cuối bảng | ❌ **KHÔNG CÓ** | ✅ Row cuối: "13 Campaigns \| $75.08 \| 1.12 ROAS \| ..." | **THIẾU** |
| Total count | ✅ "Showing X of Y campaigns" (text ngoài bảng) | ✅ "13 Campaigns" (trong summary row) | Partial — cần move vào row |
| Sum metrics (Spent, Clicks, Purchases...) | ❌ | ✅ SUM across all visible campaigns | **THIẾU** |
| Avg metrics (ROAS, CPM, CTR, CPC...) | ❌ | ✅ Weighted average | **THIẾU** |
| KPI cards ở trên | ✅ 4 cards (Spent, Impressions, Clicks, Conversions) | ❌ Selles không có KPI cards riêng | PixEcom có thêm (keep) |

> **⚠️ PO NOTE:** Summary row rất quan trọng — seller cần nhìn nhanh tổng hợp tất cả campaigns đang filter mà không cần scroll. Hiện tại PixEcom chỉ có KPI cards ở trên (tính từ ALL campaigns, không responsive theo filter) và text count ở dưới. **Cần thêm summary row trong bảng giống Selles.**

#### G. BULK UPDATE (PO nhắc: "còn có cả bulk update")

| Feature | PixEcom | Selles | Gap |
|---------|---------|--------|-----|
| Checkbox multi-select | ❌ **KHÔNG CÓ** | ✅ Checkbox mỗi row | **THIẾU** |
| "Bulk Update" dropdown | ❌ **KHÔNG CÓ** | ✅ Green dropdown button | **THIẾU** |
| Batch pause/activate | ❌ | ✅ Batch status changes | **THIẾU** |
| Status push to Meta API | ❌ | ✅ Real-time push + confirmation | **THIẾU** |
| "Update Complete" notification | ❌ | ✅ "Update Complete — 2 campaigns activated" | **THIẾU** |

> **⚠️ PO NOTE:** Seller quản lý 10-50+ campaigns. Nếu phải pause/activate từng campaign 1 lần là rất tốn thời gian. Bulk update là **must-have cho production**.

#### H. REAL-TIME & NOTIFICATIONS

| Feature | PixEcom | Selles | Gap |
|---------|---------|--------|-----|
| Real-time status notification | ❌ | ✅ "Update Complete" toast (green, top right) | **THIẾU** |
| Auto-refresh stats | ❌ | ✅ Stats sync + refresh indicator | **THIẾU** |
| SSE/WebSocket | ❌ | ✅ (implied by real-time toast) | **THIẾU** |

### 8.3 Mock Data Quality Issues

CampaignDto hiện tại thiếu rất nhiều fields so với spec cần thiết:

```typescript
// CURRENT CampaignDto (mock/types.ts) — 17 fields
interface CampaignDto {
  id, name, status, platform, objective,
  dailyBudget, totalSpent, impressions, clicks, conversions,
  ctr, cpc, roas, currency, startDate, endDate,
  createdAt, updatedAt
}

// NEEDED CampaignDto (from Selles audit) — 35+ fields
interface CampaignDto {
  // Identity
  id, externalCampaignId, name, status, deliveryStatus,
  startDate, budget, budgetType,
  aiAssistant,          // ← NEW: AI toggle
  sellpage,             // ← NEW: { id, domain }
  adAccount,            // ← NEW: { id, name }

  // Stats (full funnel)
  stats: {
    spend, roas, results, costPerResult,
    cpm, ctr, linkClicks, cpc,
    contentViews, cpv,                    // ← NEW
    addsToCart, costPerAddToCart,          // ← NEW
    checkoutsInitiated, costPerCheckout,  // ← NEW
    purchases, costPerPurchase,           // ← NEW
    purchaseValue,                        // ← NEW
    cr, cr1, cr2                          // ← NEW
  }
}
```

### 8.4 ✅ GAP SCORE CARD

| Category | PixEcom Score | Selles Score | Verdict |
|----------|:------------:|:------------:|---------|
| Data source | 0/10 (mock) | 10/10 (real) | 🔴 **CRITICAL** |
| Date filtering | 0/10 | 9/10 | 🔴 **CRITICAL** |
| Filter system | 2/10 (3 filters) | 9/10 (15 filters) | 🔴 **CRITICAL** |
| Table columns | 4/10 (11 cols) | 9/10 (25+ cols) | 🔴 **CRITICAL** |
| View tabs (drill-down) | 1/10 (1 level) | 8/10 (3 levels) | 🟡 **P1** |
| Summary row | 1/10 (text only) | 8/10 (full row) | 🟡 **P1** |
| Bulk update | 0/10 | 8/10 | 🟡 **P1** |
| Real-time updates | 0/10 | 7/10 | 🟡 **P2** |
| **OVERALL** | **1/10** | **8.5/10** | 🔴 **Chênh lệch rất lớn** |

> **Kết luận:** Trang Ads Manager hiện tại của PixEcom v2 chỉ là **UI shell với mock data** — hoàn toàn chưa sẵn sàng cho production. So với Selles, thiếu: 12 filters, 14+ metric columns, summary row, bulk update, date filtering, 3-level drill-down, và quan trọng nhất là **không có real data** (100% mock).

---

## 9. CROSS-REFERENCE WITH OTHER AUDITS

| Audit | Shared Dependency |
|-------|------------------|
| Homepage (`competitor-audit-homepage.md`) | Stats pipeline (AdStatsDaily) for KPI cards |
| Sellpage (`competitor-audit-sellpage.md`) | Stats pipeline for creative performance |
| Product (`competitor-audit-product.md`) | Stats pipeline for per-asset Spent + ROAS |
| Ad Creation (`competitor-audit-ad-creation.md`) | Meta API client (shared with stats sync) |
| **Ads Manager (this)** | All of the above + real-time sync + bulk actions |

**The stats pipeline (Meta Insights → AdStatsDaily) is the SINGLE MOST CRITICAL dependency across ALL features.**

---

## 10. IMPLEMENTATION ROADMAP — RECOMMENDED ORDER

> Dựa trên gap analysis Section 8, đây là thứ tự build khuyến nghị cho Tech Lead:

### Phase 1: Foundation (Week 1-2) — P0 Blockers
```
1. Extend AdStatsDaily schema (add funnel metrics)    → 0.5 day
2. Add Seller.timezone                                → 0.5 day
3. Meta API client + rate limiting                    → 3 days
4. Stats sync worker (insights every 15 min)          → 5 days
5. Delivery status sync (every 5 min)                 → 2 days
```
**Output:** Real data flowing into AdStatsDaily

### Phase 2: Core API (Week 3-4) — P1
```
6. Campaign list endpoint (with 25+ metrics)          → 5 days
7. Summary row aggregation                            → 1 day
8. Multi-dimensional filter system (15 filters)       → 3 days
9. Filter options endpoint (dynamic dropdowns)        → 2 days
10. Date preset handling (today/yesterday/week/month) → 0.5 day
```
**Output:** Campaign tab fully functional with real data

### Phase 3: Drill-down + Actions (Week 5) — P1
```
11. Adset list endpoint                               → 2 days
12. Ad list endpoint                                  → 2 days
13. Bulk status update + Meta push                    → 3 days
14. Checkbox multi-select UI                          → 0.5 day
```
**Output:** 3-level drill-down + bulk update working

### Phase 4: Frontend Upgrade (Week 5-6) — P1
```
15. Rebuild table with 25+ columns (virtualized)     → 3 days
16. Date picker + quick filters UI                    → 1 day
17. Filter panel (15 dropdowns)                       → 2 days
18. Summary row UI                                    → 0.5 day
19. Tabs (Campaigns/AdSets/Ads)                       → 1 day
20. Bulk update dropdown UI                           → 1 day
21. Replace mock data → real API calls                → 1 day
```
**Output:** Frontend matching Selles quality

### Phase 5: Polish (Week 7) — P2
```
22. SSE real-time events                              → 2 days
23. "Update Complete" notification toast              → 0.5 day
24. AI Ad Assistant toggle (Meta CBO)                 → 1 day
```
**Output:** Real-time experience

---

*End of Ads Manager audit — updated with current state analysis (2026-02-20)*
