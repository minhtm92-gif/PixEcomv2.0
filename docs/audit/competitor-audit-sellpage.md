# Competitor Audit: Sellpage List + Sellpage Detail
**Source:** Selles system screenshots (`Sellpage.jfif` + `Sellpage Detail.jfif`)
**Date:** 2026-02-20
**Auditor:** CTO Advisor + Product Owner

---

## 0. PAGE FLOW CLARIFICATION (from Product Owner)

```
Sidebar: "Sellpages" click
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  SELLPAGE LIST  (Sellpage.jfif)                     │
│                                                     │
│  Shows creative bundles as rows per sellpage         │
│  Each row = 1 creative bundle with metrics          │
│  Nested under each bundle = Facebook Post IDs        │
│                                                     │
│  Actions per row:                                   │
│    • "See all"      → navigates to SELLPAGE DETAIL  │
│    • "Create New Ad" → navigates to Ad Creation     │
│                        with that Post ID pre-filled  │
│                                                     │
│  Bottom: "Create New Facebook Ad" button             │
│  Pagination: "1 - 2 of 1011" (items per page)      │
└─────────────────────────────────────────────────────┘
   │ Click "See all"
   ▼
┌─────────────────────────────────────────────────────┐
│  SELLPAGE DETAIL  (Sellpage Detail.jfif)            │
│                                                     │
│  Header: Sellpage URL + external link               │
│  Date filter: Today/Yesterday/Week/Month + range    │
│  6 KPI cards (Revenue, Cost, YouTake, Hold, etc.)   │
│  Ad Source breakdown table (per platform)            │
│  Creative Performance table (same as list but with  │
│    more context: filters, sort, full detail)         │
└─────────────────────────────────────────────────────┘
```

> **Key UX insight from Owner:** The Sellpage List page IS the creative performance view. It's not a simple list of sellpages — it's a **creative-first** view where each sellpage shows its creative bundles with full metrics, and Facebook Post IDs expand underneath. "See all" goes to the full detail page. "Create New Ad" goes directly to ad creation with a specific Post ID pre-selected.

---

## 1. SCREENSHOT ANALYSIS — SELLPAGE LIST (`Sellpage.jfif`)

### What This Page Shows

This is the **primary Sellpage view** — what sellers see when they click "Sellpages" in the sidebar. It displays creative bundles with nested ad posts, NOT a simple sellpage list.

### A. Page Header

| Element | Value | Notes |
|---------|-------|-------|
| Title | **Sellpage Details** | Page-level title (note: Selles uses "Details" even for list) |
| Sellpage URL | `jetjeans.us` with external link icon (↗) | Clickable — opens sellpage in new tab |

### B. Table Structure — Creative Bundles with Nested Ad Posts

**Each row = 1 Creative Bundle:**

#### Row Type 1: Creative Bundle WITH Preview (Level 1 — parent row)
Shows full creative preview:
- **Thumbnail image** (product photo)
- **Ad text** (primary text, headline, description — truncated)
- **Version identifier** (e.g., "JettJeans3 - v65.1 - t23.2 - b65.1")
- **Aggregated metrics** across all ad posts using this creative
- **Actions:** "See all" | "Create New Ad"

#### Row Type 2: Individual Ad Post (Level 2 — nested child row)
Shows individual Facebook post:
- **Post name** (e.g., "JettJeans")
- **External Post ID** (e.g., `127816070405916_122258164376036299`) — the actual Facebook `{page_id}_{post_id}`
- **Individual metrics** for that post
- **Actions:** "See all" | "Create New Ad"

**Important:** The Post ID row is expandable/collapsible. When a seller clicks "Create New Ad" on a Post ID row, the ad creation page opens with that Post ID pre-filled — meaning they're creating a new ad using an EXISTING Facebook post (reusing the same creative).

### C. Metrics Columns (same for both bundle and post rows)

| Column | Description |
|--------|------------|
| Spent ↓ | Total spend (default sort) |
| ROAS ↕ | Return on ad spend (sortable) |
| CPM | Cost per 1000 impressions |
| CTR | Click-through rate |
| CPV | Cost Per View (spend / content views) |
| CR ⓘ | Conversion rate |
| CR1 ⓘ | Add to cart rate |
| CR2 ⓘ | Checkout completion rate |
| CPP | Cost Per Purchase |
| Purchases | Number of purchases |
| Ads | Number of ads (only on bundle row) |

### D. Example Data from Screenshot

**Creative Bundle 1 (with preview):**
```
JettJeans3 - v65.1 - t23.2 - b65.1
[Image] "68 years of wisdom has led to the creation of the perfect pair of jea..."
        🔥The New Generation of "Dad Jea..."
        2025 Upgraded - More Soft - Higher...
$298.26 | 1.54 | $27.78 | 3.20% | $0.90 | 1.81% | 5.44% | 33.33% | $49.71 | 6
  ├─ JettJeans 12781607...376036299  $144.47 | 0.31 | $30.43 | 3.67% | $0.85 | 0.59% | 3.55% | 16.67% | $144.47 | 1
  ├─ JettJeans 12781607...140036299  $114.02 | 3.23 | $25.25 | 2.68% | $1.02 | 3.57% | 8.04% | 44.44% | $28.51  | 4
  ├─ JettJeans 12781607...460036299  $32.41  | 1.40 | $27.75 | 3.00% | $0.90 | 2.78% | 8.33% | 33.33% | $32.41  | 1
  ├─ JettJeans 12781607...790036299  $7.36   | 0.00 | $24.21 | 4.28% | $0.57 | 0.00% | 0.00% | 0.00%  | $0.00   | 0
  └─ JettJeans 12781607...684036299  $0.00   | 0.00 | $0.00  | 0.00% | $0.00 | 0.00% | 0.00% | 0.00%  | $0.00   | 0
```

**Creative Bundle 2 (with preview):**
```
JettJeans3 - v40.2.1 - t27.0 - V_20250208063625
[Image] "My husband don't always care about the little things — but I do...."
        👆LAST DAY 70% OFF 🔥The New ...
        🌟 Over 98K customers satisfied!
$189.00 | 3.15 | $35.82 | 3.71% | $1.17 | 6.79% | 12.35% | 55.00% | $17.18 | 11
  ├─ JettJeans 12781607...262036299  $84.29  | 5.50 | $36.08 | 3.85% | $1.20 | 11.43% | 20.00% | 57.14% | $10.54  | 8
  ├─ JettJeans 12781607...874036299  $67.05  | 1.30 | $35.84 | 3.53% | $1.24 | 3.70%  | 9.26%  | 40.00% | $33.53  | 2
  ├─ JettJeans 12781607...302036299  $30.27  | 1.46 | $34.95 | 3.81% | $1.01 | 3.33%  | 3.33%  | 100%   | $30.27  | 1
  ├─ JettJeans 12781607...482036299  $7.39   | 0.00 | $36.23 | 3.43% | $0.92 | 0.00%  | 0.00%  | 0.00%  | $0.00   | 0
  └─ JettJeans 12781607...048036299  $0.00   | 0.00 | $0.00  | 0.00% | $0.00 | 0.00%  | 0.00%  | 0.00%  | $0.00   | 0
```

### E. Pagination

| Element | Value |
|---------|-------|
| Items per page | Dropdown: "2" (configurable — this controls creative bundles per page) |
| Current view | "1 - 2 of 1011" (1011 total creative bundles for this sellpage) |
| Navigation | < > arrows |

### F. Action Button (Bottom Left)

| Button | Style | Action |
|--------|-------|--------|
| **Create New Facebook Ad** | Green button, red dashed border (prominent CTA) | Opens ad creation flow for this sellpage |

---

## 1B. SCREENSHOT ANALYSIS — SELLPAGE DETAIL (`Sellpage Detail.jfif`)

### What This Page Shows

This is the **detail view** — reached by clicking "See all" on a creative bundle from the Sellpage List. Shows full analytics for a specific sellpage.

### A. Page Header

| Element | Value | Notes |
|---------|-------|-------|
| Title | **Sellpage Details** | Same title as list |
| Sellpage URL | `jetjeans.us` with external link icon (↗) | Clickable — opens sellpage in new tab |

---

### B. Date Filter (Same as Homepage)

| Element | Description |
|---------|------------|
| Quick filters | Today (active/blue), Yesterday, This Week, This Month |
| Timezone | (GMT-9) displayed |
| Date range picker | 26-01-2026 | 26-01-2026 with calendar icon |

---

### C. KPI Cards (6 cards — Same structure as Homepage but SCOPED to this sellpage)

| KPI | Value | Description |
|-----|-------|-------------|
| Revenue | $83.96 | Total revenue for this sellpage + "2 orders" subtitle |
| Cost | $39.49 | Total ad spend for this sellpage |
| You Take | $44.47 | Seller's net earnings for this sellpage |
| Hold | $13.65 | Amount held for this sellpage |
| Unhold | $0.00 | Released hold amount |
| Cash to Balance | $30.82 | Available to withdraw for this sellpage |

**Key Insight:** Same 6 KPIs as Homepage, but filtered to a single sellpage. This means the Dashboard API should be reusable with a `sellpageId` filter parameter.

---

### D. Ad Source Breakdown Table (Same structure as Homepage, scoped to sellpage)

| Ad Source | Spent | ROAS | CPM | CTR | Link Clicks | Content Views | Adds to Cart | Checkouts Initiated | Purchases | CR | CR1 | CR2 |
|-----------|-------|------|-----|-----|-------------|---------------|-------------|--------------------|-----------|----|-----|-----|
| n/a | n/a | n/a | n/a | n/a | n/a | 9 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% |
| Facebook | $66.40 | 1.26 | $25.42 | 2.14% | 56 | 66 | 9 | 4 | 2 | 3.03% | 6.06% | 50.00% |
| Pinterest | $0.00 | 0 | $0.00 | 0% | 0 | 0 | 0 | 0 | 0 | 0% | 0% | 0% |
| Google | n/a | n/a | n/a | n/a | n/a | 0 | 0 | 0 | 0 | 0% | 0% | 0% |
| Applovin | $0.00 | 0 | $0.00 | 0% | 0 | 0 | 0 | 0 | 0 | 0% | 0% | 0% |

---

### E. Facebook Ad Creative Performance (NEW SECTION — not on Homepage)

**Section Title:** "Facebook Ad Creative Performance"

**Filter Dropdowns (3 dropdowns):**

| Filter | Purpose |
|--------|---------|
| Media ▾ | Filter by video/image asset |
| Adtexts ▾ | Filter by ad text copy |
| Thumbnails ▾ | Filter by thumbnail image |

**Table Columns:**

| Column | Description |
|--------|------------|
| Ad Creatives/Ad Posts | Creative name + preview (thumbnail + ad text excerpt) |
| Spent ↓ | Total spend (sortable, default sort desc) |
| ROAS ↕ | Return on ad spend (sortable) |
| CPM | Cost per 1000 impressions |
| CTR | Click-through rate |
| CPV | **Cost Per View** (new metric not in PixEcom schema) |
| CR ⓘ | Conversion rate with info tooltip |
| CR1 ⓘ | Add to cart rate with info tooltip |
| CR2 ⓘ | Checkout completion rate with info tooltip |
| CPP | **Cost Per Purchase** (= spent / purchases) |
| Purchases | Number of purchases |
| Ads | Number of ads using this creative |
| Actions | "See all" + "Create New Ad" links |

**Table Structure — TWO LEVELS:**

#### Level 1: Creative Bundle (with preview)
Each creative bundle shows:
- **Thumbnail image** (product photo)
- **Ad text excerpt** (primary text, headline, description — truncated)
- **Version identifier** (e.g., "JettJeans3 - v65.1 - t23.2 - b65.1")
  - `v65.1` = video version
  - `t23.2` = text version
  - `b65.1` = thumbnail version
- **Aggregated metrics** for all ads using this creative

#### Level 2: Individual Ad Posts (nested under creative)
Each ad post shows:
- **Post name** (e.g., "JettJeans")
- **External Post ID** (e.g., "127816070405916_122258164376036299") — this is a Facebook post ID
- **Individual metrics** for that specific ad post
- **Actions:** "See all" | "Create New Ad"

**Example Creative Bundle:**

```
┌─────────────────────────────────────────────────────────────────┐
│ JettJeans3 - v65.1 - t23.2 - b65.1                             │
│ ┌──────┐  "68 years of wisdom has led to the                    │
│ │      │   creation of the perfect pair of jea..."              │
│ │ IMG  │  🔥The New Generation of "Dad Jea..."                  │
│ │      │  2025 Upgraded - More Soft - Higher...                 │
│ └──────┘                                                        │
│ $298.26 | 1.54 | $27.78 | 3.20% | $0.90 | 1.81% | 5.44% | ...│
├─────────────────────────────────────────────────────────────────┤
│   ↳ JettJeans 12781607...376036299  $144.47 | 0.31 | ...       │
│   ↳ JettJeans 12781607...140036299  $114.02 | 3.23 | ...       │
│   ↳ JettJeans 12781607...460036299  $32.41  | 1.40 | ...       │
│   ↳ JettJeans 12781607...790036299  $7.36   | 0.00 | ...       │
│   ↳ JettJeans 12781607...684036299  $0.00   | 0.00 | ...       │
└─────────────────────────────────────────────────────────────────┘
```

---

### F. Pagination (Bottom)

| Element | Value |
|---------|-------|
| Items per page | Dropdown: "2" (configurable) |
| Current view | "1 - 2 of 1011" |
| Navigation | < > arrows |

**"1011" = total creative bundles for this sellpage.** This implies a massive amount of creative testing.

---

### G. Action Button (Bottom Left)

| Button | Style | Action |
|--------|-------|--------|
| **Create New Facebook Ad** | Green button, prominent | Opens ad creation flow for this sellpage |

---

## 2. GAP ANALYSIS — PixEcom v2 vs Selles

### 2A. SELLPAGE LIST PAGE — FEATURE COMPARISON

This is the **primary view** when clicking "Sellpages" in sidebar. PixEcom v2 currently has a basic sellpage list but nothing resembling this creative-first performance view.

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Creative bundle rows with metrics | ✅ Each row = 1 creative bundle | ❌ Sellpage list returns basic metadata only | **ENTIRELY NEW VIEW** |
| Nested ad post rows (expandable) | ✅ Facebook Post IDs with individual metrics | ❌ AdPost exists in schema but no list endpoint | **NEW** |
| Creative preview (thumbnail + ad text) | ✅ Inline preview per bundle | ❌ | **NEW** |
| Version identifier (v/t/b format) | ✅ | ❌ No version display on Creative | **NEW** |
| Full metrics per bundle (Spent→Purchases) | ✅ 11 metric columns | ❌ No stats aggregation | **NEW** |
| Full metrics per ad post | ✅ Same 11 columns per post | ❌ No stats per ad post | **NEW** |
| "See all" → Sellpage Detail | ✅ Navigation link | ❌ No detail page | **NEW** |
| "Create New Ad" per post row | ✅ Opens ad creation with Post ID pre-filled | ❌ No ad creation flow | **NEW** |
| "Create New Facebook Ad" button (bottom) | ✅ Green CTA | ❌ | **NEW** |
| Pagination (items per page + total) | ✅ "1 - 2 of 1011" | ❌ | **NEW** |
| Sortable columns (Spent, ROAS) | ✅ | ❌ | **NEW** |
| CPV (Cost Per View) metric | ✅ | ❌ Not in schema | **NEW METRIC** |
| CPP (Cost Per Purchase) metric | ✅ | ✅ Schema has costPerPurchase | OK — needs computation |
| Ads count per creative | ✅ | ❌ | **NEW** |

### 2B. SELLPAGE DETAIL PAGE — FEATURE COMPARISON (reached via "See all")

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Page header with sellpage URL + external link | ✅ | ❌ No detail page endpoint | **MISSING** |
| Date filter (Today/Yesterday/Week/Month + range) | ✅ | ❌ No endpoint | **MISSING** |
| Timezone display (GMT-9) | ✅ | ❌ SellerSettings has timezone but unused | **MISSING** |
| 6 KPI cards scoped to sellpage | ✅ | ❌ Stub = 0 | **MISSING: Reuse dashboard summary with sellpageId** |
| Ad Source breakdown scoped to sellpage | ✅ | ❌ No endpoint | **MISSING: Reuse dashboard ad-sources with sellpageId** |
| **Facebook Ad Creative Performance** section | ✅ Full section with filters | ❌ **Nothing exists** | **ENTIRELY NEW FEATURE** |
| Filter by Media/Adtexts/Thumbnails (3 dropdowns) | ✅ | ❌ | **NEW** |
| Creative bundle aggregation | ✅ Group by creative, SUM metrics | ❌ | **NEW** |
| Nested ad post metrics | ✅ Per-post stats under each creative | ❌ | **NEW** |

### 2C. KEY UX FLOW: "Create New Ad" with Post ID

**Selles flow:**
```
Sellpage List → see ad post row "JettJeans 12781607...376036299"
  → click "Create New Ad"
  → Ad Creation page opens with:
     - Sellpage pre-selected
     - Facebook Post ID pre-filled (reuse existing post as creative)
     - Seller only needs to configure targeting + budget
```

**PixEcom v2:** This flow does not exist at all. The concept of "creating a new ad from an existing Facebook post" requires:
1. Ad creation endpoint with `existingPostId` parameter
2. `AdPost.postSource = EXISTING` (already in schema as `PostSource.EXISTING`)
3. Meta API call to reuse post: `POST /act_{ad_account}/ads` with `creative: { object_story_id: "{page_id}_{post_id}" }`

This is a **critical seller workflow** — it's how sellers scale winning creatives by launching more ads with the same post but different audiences.

### CREATIVE PERFORMANCE — DEEP ANALYSIS

This is the most complex and most important feature gap. Let me break it down:

#### What Selles Shows

**Level 1: Creative Bundle Performance**
A "creative bundle" = combination of (Media/Video + AdText + Thumbnail). In Selles' version system:
- `v65.1` = video version 65.1
- `t23.2` = text version 23.2
- `b65.1` = thumbnail version 65.1

Each unique combination is a "creative bundle" and shows aggregated metrics across ALL ads that use this bundle.

**Level 2: Individual Ad Post Performance**
Under each creative bundle, individual Facebook ad posts are listed with:
- The FB post ID (e.g., `127816070405916_122258164376036299`)
- Individual metrics for that specific ad post
- Actions to see details or create a new ad using this post

#### How This Maps to PixEcom v2 Schema

| Selles Concept | PixEcom v2 Model | Status |
|---------------|-----------------|--------|
| Creative Bundle | `Creative` + `CreativeAsset` | ✅ Schema exists |
| Video version (v65.1) | `Asset` (mediaType=VIDEO) | ✅ Schema exists |
| Text version (t23.2) | `Asset` (mediaType=TEXT) OR `AssetAdtext` | ⚠️ Dual system |
| Thumbnail version (b65.1) | `Asset` (mediaType=IMAGE, role=THUMBNAIL) | ✅ Schema exists |
| Ad Post | `AdPost` | ✅ Schema exists |
| Ad Post → Creative link | `Ad` → `AdPost`, `CampaignCreative` | ⚠️ Indirect |
| Creative metrics aggregation | Not implemented | ❌ **MISSING** |
| Per-ad-post metrics | `AdStatsRaw`/`AdStatsDaily` (entityType=AD) | ❌ No data yet |
| Ads count per creative | Count of `CampaignCreative` + `Ad` + `AdPost` | ❌ Not computed |

#### Missing Data Flow

```
Current PixEcom v2:
  Creative → CreativeAsset → Asset (structure only, no metrics)
  AdPost → Ad → Adset → Campaign (hierarchy only, no metrics)
  AdStatsRaw/Daily → entityType=AD, entityId=adId (no creative-level aggregation)

What Selles needs:
  Creative → [all AdPosts using this creative] → SUM(metrics per AdPost)

  This requires:
  1. Stats stored at Ad/AdPost level (entityType=AD in AdStatsDaily) ✅ Schema ready
  2. Mapping: Creative → CampaignCreative → Campaign → Adset → Ad → AdPost
  3. Aggregation: GROUP BY creative, SUM all metrics across related ads
```

---

### METRICS COMPARISON

| Metric | Selles | PixEcom v2 Schema | Status |
|--------|--------|-------------------|--------|
| Spent | ✅ | ✅ `spend` in AdStatsDaily | OK |
| ROAS | ✅ | ✅ `roas` in AdStatsDaily | OK |
| CPM | ✅ | ✅ `cpm` in AdStatsDaily | OK |
| CTR | ✅ | ✅ `ctr` in AdStatsDaily | OK |
| **CPV (Cost Per View)** | ✅ | ❌ **Not in schema** | **MISSING** |
| CR | ✅ | ❌ Not in AdStatsDaily | **MISSING** (only in SellpageStatsDaily) |
| CR1 | ✅ | ❌ Not in AdStatsDaily | **MISSING** (only in SellpageStatsDaily) |
| CR2 | ✅ | ❌ Not in AdStatsDaily | **MISSING** (only in SellpageStatsDaily) |
| CPP (Cost Per Purchase) | ✅ | ✅ `costPerPurchase` in AdStatsDaily | OK |
| Purchases | ✅ | ✅ `purchases` in AdStatsDaily | OK |
| Ads (count) | ✅ | ❌ Need to compute via joins | **MISSING** |
| Link Clicks | On homepage but NOT on creative table | ✅ `linkClicks` | OK |
| Content Views | On homepage but shown as CPV on creative table | ✅ `contentViews` | OK |

**Key Finding:** Creative performance table uses **CPV (Cost Per View)** instead of raw Content Views. This is `CPV = spend / contentViews`. Not in schema — needs to be computed.

**Key Finding:** CR/CR1/CR2 are on the creative performance table but NOT in `AdStatsDaily`. They only exist in `SellpageStatsDaily`. For creative-level CR, we need to either:
- Add these fields to `AdStatsDaily`
- Or compute on-the-fly from existing fields: `CR = purchases / contentViews`, `CR1 = addToCart / contentViews`, `CR2 = purchases / checkoutInitiated`

---

### VERSION IDENTIFIER SYSTEM

Selles uses a versioning system for creative bundles:
```
JettJeans3 - v65.1 - t23.2 - b65.1
             ^^^^^   ^^^^^   ^^^^^
             video   text    thumbnail (background)
```

**PixEcom v2 equivalent:**
- `AssetMedia.version` (e.g., "v1", "v2") — exists in legacy system
- `Asset` model has no explicit version field
- `Creative` model has no version display name

**Gap:** Need a human-readable version label for creative bundles. Could be:
- Auto-generated from asset versions: `{productCode} - v{mediaVersion} - t{textVersion} - b{thumbVersion}`
- Or a `displayName` field on Creative that follows this convention

---

## 3. REQUIRED CHANGES FOR TECH LEAD

### 3.1 New API Endpoints

#### `GET /api/sellpages/:id/creatives` (SELLPAGE LIST — Creative Performance View)
**Purpose:** Main sellpage view — creative bundles with nested ad posts and metrics
**Auth:** JWT (sellerId from token)
**Params:**
```
sellpageId: route param (UUID)
dateFrom: string (required)
dateTo: string (required)
sortBy?: string (default "spent", options: spent, roas, cpm, ctr, cpv, cr, cr1, cr2, cpp, purchases, ads)
sortOrder?: string (default "desc")
page?: number (default 1)
perPage?: number (default 20, max 100)
```
**Response:**
```json
{
  "sellpage": {
    "id": "uuid",
    "url": "jetjeans.us",
    "externalUrl": "https://jetjeans.us"
  },
  "items": [
    {
      "creativeId": "uuid",
      "displayName": "JettJeans3 - v65.1 - t23.2 - b65.1",
      "preview": {
        "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
        "primaryText": "68 years of wisdom has led to the creation...",
        "headline": "🔥The New Generation of \"Dad Jea...\"",
        "description": "2025 Upgraded - More Soft - Higher..."
      },
      "metrics": {
        "spent": 298.26,
        "roas": 1.54,
        "cpm": 27.78,
        "ctr": 3.20,
        "cpv": 0.90,
        "cr": 1.81,
        "cr1": 5.44,
        "cr2": 33.33,
        "cpp": 49.71,
        "purchases": 6
      },
      "adsCount": 5,
      "adPosts": [
        {
          "adPostId": "uuid",
          "adId": "uuid",
          "name": "JettJeans",
          "externalPostId": "127816070405916_122258164376036299",
          "metrics": {
            "spent": 144.47,
            "roas": 0.31,
            "cpm": 30.43,
            "ctr": 3.67,
            "cpv": 0.85,
            "cr": 0.59,
            "cr1": 3.55,
            "cr2": 16.67,
            "cpp": 144.47,
            "purchases": 1
          }
        }
      ]
    }
  ],
  "total": 1011,
  "page": 1,
  "perPage": 2
}
```
**Business Logic:**
```
1. Get all campaigns linked to this sellpage
2. Get all ads (via Campaign → Adset → Ad) and their ad posts
3. For each ad post, get AdStatsDaily metrics for the date range
4. Group ad posts by their creative (via AdPost.creativeId or Ad → CampaignCreative → Creative)
5. For each creative group:
   a. Build preview from creative assets (thumbnail, primary text, headline, description)
   b. SUM all metrics across ad posts
   c. Compute derived metrics (CPV, CR, CR1, CR2, CPP)
   d. Count total ads
   e. Return nested adPosts array with individual metrics
6. Sort by requested column
7. Paginate (at creative bundle level, not ad post level)
```

---

#### `GET /api/sellpages/:id/detail` (SELLPAGE DETAIL — Full Analytics)
**Purpose:** Full sellpage analytics page (reached via "See all")
**Auth:** JWT (sellerId from token)
**Params:** Route param `:id` (sellpage UUID)
**Response:**
```json
{
  "id": "uuid",
  "slug": "jetjeans",
  "url": "jetjeans.us",
  "externalUrl": "https://jetjeans.us",
  "status": "PUBLISHED",
  "sellpageType": "SINGLE",
  "productId": "uuid",
  "productName": "JettJeans",
  "thumbnail": "https://cdn.example.com/image.jpg"
}
```

**Note:** KPI cards and Ad Source table reuse Homepage endpoints with `sellpageId` filter:
- `GET /api/dashboard/summary?sellpageId=xxx&dateFrom=...&dateTo=...`
- `GET /api/dashboard/ad-sources?sellpageId=xxx&dateFrom=...&dateTo=...`
- Creative Performance table reuses: `GET /api/sellpages/:id/creatives?dateFrom=...&dateTo=...` (same as list but with additional filter dropdowns)

---

#### `GET /api/sellpages/:id/creative-performance`
**Purpose:** Facebook Ad Creative Performance table
**Auth:** JWT
**Params:**
```
sellpageId: route param (UUID)
dateFrom: string (required)
dateTo: string (required)
mediaId?: string (filter by specific media asset)
adtextId?: string (filter by specific ad text asset)
thumbnailId?: string (filter by specific thumbnail asset)
sortBy?: string (default "spent", options: spent, roas, cpm, ctr, cpv, cr, cr1, cr2, cpp, purchases, ads)
sortOrder?: string (default "desc")
page?: number (default 1)
perPage?: number (default 20, max 100)
```
**Response:**
```json
{
  "items": [
    {
      "creativeId": "uuid",
      "displayName": "JettJeans3 - v65.1 - t23.2 - b65.1",
      "preview": {
        "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
        "primaryText": "68 years of wisdom has led to the creation...",
        "headline": "🔥The New Generation of \"Dad Jea...\"",
        "description": "2025 Upgraded - More Soft - Higher..."
      },
      "metrics": {
        "spent": 298.26,
        "roas": 1.54,
        "cpm": 27.78,
        "ctr": 3.20,
        "cpv": 0.90,
        "cr": 1.81,
        "cr1": 5.44,
        "cr2": 33.33,
        "cpp": 49.71,
        "purchases": 6
      },
      "adsCount": 5,
      "adPosts": [
        {
          "adPostId": "uuid",
          "adId": "uuid",
          "name": "JettJeans",
          "externalPostId": "127816070405916_122258164376036299",
          "metrics": {
            "spent": 144.47,
            "roas": 0.31,
            "cpm": 30.43,
            "ctr": 3.67,
            "cpv": 0.85,
            "cr": 0.59,
            "cr1": 3.55,
            "cr2": 16.67,
            "cpp": 144.47,
            "purchases": 1
          }
        }
      ]
    }
  ],
  "total": 1011,
  "page": 1,
  "perPage": 2
}
```

**Business Logic:**
```
1. Get all campaigns linked to this sellpage
2. Get all ads under those campaigns (via Campaign → Adset → Ad)
3. Get all ad posts for those ads
4. For each ad post, get its AdStatsDaily metrics for the date range
5. Group ad posts by their creative (via Ad → CampaignCreative → Creative)
6. For each creative group:
   a. SUM all metrics across ad posts
   b. Compute derived metrics:
      - CPV = spent / contentViews
      - CR = purchases / contentViews × 100
      - CR1 = addToCart / contentViews × 100
      - CR2 = purchases / checkoutInitiated × 100
      - CPP = spent / purchases (handle division by zero)
   c. Count total ads
7. Sort by requested column
8. Paginate
```

---

#### `GET /api/sellpages/:id/creative-filters`
**Purpose:** Populate the Media/Adtexts/Thumbnails filter dropdowns
**Auth:** JWT
**Params:** Route param `:id` (sellpage UUID)
**Response:**
```json
{
  "media": [
    { "assetId": "uuid", "label": "v65.1", "url": "https://...", "mediaType": "VIDEO" },
    { "assetId": "uuid", "label": "v40.2.1", "url": "https://...", "mediaType": "VIDEO" }
  ],
  "adtexts": [
    { "assetId": "uuid", "label": "t23.2", "headline": "🔥The New Generation..." },
    { "assetId": "uuid", "label": "t27.0", "headline": "My husband don't always..." }
  ],
  "thumbnails": [
    { "assetId": "uuid", "label": "b65.1", "url": "https://..." },
    { "assetId": "uuid", "label": "b27.0", "url": "https://..." }
  ]
}
```

---

### 3.2 Schema Changes Required

#### Add CPV to AdStatsDaily (or compute on-the-fly)
**Option A: Compute on-the-fly (recommended)**
```
CPV = spend / contentViews
```
No schema change needed. Compute in the API response mapping.

**Option B: Store pre-computed**
```prisma
// Add to AdStatsDaily:
cpv Decimal @default(0) @db.Decimal(10, 4)  // cost per view = spend / contentViews
```

#### Add CR/CR1/CR2 computation at Ad level
Currently these only exist in `SellpageStatsDaily`. For creative performance, compute on-the-fly:
```
CR  = purchases / contentViews × 100
CR1 = addToCart / contentViews × 100
CR2 = purchases / checkoutInitiated × 100
```
All source fields already exist in `AdStatsDaily`. No schema change needed.

#### Add version display to Creative model
```prisma
// Add to Creative model:
displayVersion String? @map("display_version") @db.VarChar(100)
// e.g., "JettJeans3 - v65.1 - t23.2 - b65.1"
```
Or generate dynamically from linked assets' versions.

#### Ensure AdPost → Creative linkage is queryable
Current path: `AdPost → Ad → CampaignCreative → Creative`

This is a 3-hop join. For performance, consider adding a direct link:
```prisma
// Option: Add direct creativeId to AdPost
model AdPost {
  // ... existing fields ...
  creativeId String? @map("creative_id") @db.Uuid
  creative   Creative? @relation(fields: [creativeId], references: [id], onDelete: SetNull)
}
```
This denormalizes the relationship but makes the creative performance query much simpler and faster.

---

### 3.3 New Concepts Needed

#### Creative Bundle = Combination of Assets
A creative bundle is NOT just a `Creative` record — it's the specific combination of:
- 1 Video/Image (PRIMARY_VIDEO or PRIMARY_IMAGE role)
- 1 Ad Text (PRIMARY_TEXT + HEADLINE + DESCRIPTION roles)
- 1 Thumbnail (THUMBNAIL role)

The version identifier `v65.1 - t23.2 - b65.1` encodes which specific assets are used.

In PixEcom v2, this maps to:
```
Creative (id=xxx)
  → CreativeAsset (role=PRIMARY_VIDEO, assetId=video_xxx)  → Asset (version="v65.1")
  → CreativeAsset (role=PRIMARY_TEXT, assetId=text_xxx)    → Asset (version="t23.2")
  → CreativeAsset (role=THUMBNAIL, assetId=thumb_xxx)      → Asset (version="b65.1")
```

The `Creative.displayVersion` could be auto-generated:
```typescript
displayVersion = `${productName} - ${videoAsset.version} - ${textAsset.version} - ${thumbAsset.version}`
```

#### Ad Post = Individual Facebook Post
An `AdPost` represents a specific Facebook post created from a creative bundle. Multiple ad posts can use the same creative bundle (different campaigns, different audiences). The external post ID (`127816070405916_122258164376036299`) is the Facebook `{page_id}_{post_id}` format.

#### Creative Performance = Aggregated Metrics Across Ad Posts
The creative performance table shows how well each creative bundle performs ACROSS ALL ads that use it. This is the key BI feature — it tells sellers which creative (video + text + thumbnail combination) is winning.

---

### 3.4 Stats Pipeline Implications

For creative performance to work, the stats pipeline needs:

1. **Ad-level stats** (already in schema as `entityType=AD` in AdStatsDaily) — must be populated by worker
2. **AdPost-level stats** — currently NOT in schema. AdStatsDaily only goes down to Ad level. But Selles shows per-post metrics.

**Decision needed:**
- **Option A:** Store stats at Ad level only, attribute to creative via Ad → CampaignCreative → Creative. Simpler but loses post-level granularity.
- **Option B:** Store stats at AdPost level. Requires new `entityType=AD_POST` in StatsEntityType enum. More data but matches Selles' granularity.

**Recommendation:** Option B — add `AD_POST` to StatsEntityType. Each Facebook post has its own Insights data from Meta API, so we can fetch and store per-post.

```prisma
enum StatsEntityType {
  CAMPAIGN
  ADSET
  AD
  AD_POST    // NEW

  @@map("stats_entity_type")
}
```

---

## 4. PRIORITY & EFFORT ESTIMATION

### P0 — Core Sellpage Pages (Must have)

| Item | Effort | Dependencies |
|------|--------|-------------|
| **Sellpage List: Creative Performance endpoint** | 5 days | AdStatsDaily populated, Creative→AdPost linkage |
| Sellpage detail endpoint (header data) | 0.5 day | Existing sellpage service |
| Reuse dashboard KPIs with sellpageId filter | 0 days | Already spec'd in Homepage audit |
| Reuse dashboard ad-sources with sellpageId filter | 0 days | Already spec'd in Homepage audit |
| Creative filter dropdowns endpoint (detail page) | 1 day | Asset data available |
| Add `AD_POST` to StatsEntityType | 0.5 day | Migration |
| Add `creativeId` to AdPost (denormalization) | 0.5 day | Migration |
| CPV/CR/CR1/CR2 computation in response mapper | 1 day | AdStatsDaily fields |
| Nested ad posts with individual metrics | 2 days | Per-post stats in AdStatsDaily |

**Total P0: ~10.5 dev days**

### P1 — Full Feature Parity

| Item | Effort | Dependencies |
|------|--------|-------------|
| Creative displayVersion auto-generation | 1 day | Asset version field |
| Sortable columns (all 11 metrics) | 1 day | Query builder |
| Offset pagination with total count | 1 day | Count query |
| **"Create New Ad" with Post ID pre-fill flow** | 3 days | Ad creation endpoint + existingPostId param |
| **"Create New Facebook Ad" button flow** | 2 days | Ad creation endpoint (new creative) |
| Per-ad-post "See all" detail view | 2 days | Ad detail endpoint |
| Media/Adtext/Thumbnail filter dropdowns | 1 day | Filter endpoint |

**Total P1: ~11 dev days**

### P2 — Polish

| Item | Effort |
|------|--------|
| Tooltip info icons for CR/CR1/CR2 | Frontend only |
| Items per page dropdown | Frontend only |
| External link icon on sellpage URL | Frontend only |
| Ad text truncation with "..." | Frontend only |
| Creative preview inline (thumbnail + text) | Frontend only |

---

## 5. OWNER NOTES

> **From Product Owner:**
>
> **Clarification on page flow:**
> - Ảnh `Sellpage.jfif` là **Sellpage List** — hiển thị ngay khi bấm vào menu Sellpages. Có rất nhiều Sellpage, mỗi sellpage hiện creative bundles dạng row.
> - Phần ID xổ ra trong ảnh Sellpage chính là **Facebook Post ID**. Chỉ cần bấm vào nút "Create New Ad" bên cạnh là sẽ ra trang Create New Facebook Ad cho sellpage đó với Post ID đó.
> - "See all" → ra trang **Sellpage Detail** (ảnh `Sellpage Detail.jfif`).
>
> **Tại sao Sellpage List page quan trọng nhất:**
>
> 1. **Creative Performance là core view** — Đây KHÔNG phải trang list đơn giản. Đây là nơi seller đánh giá creative nào đang "win". Họ cần biết combo (video + text + thumbnail) nào đang cho ROAS cao nhất, CR tốt nhất, CPP thấp nhất.
>
> 2. **Ad Post granularity** — Seller cần drill down đến từng ad post (Facebook Post ID) cụ thể để biết post nào trong cùng 1 creative đang perform tốt/xấu (có thể do audience khác nhau, thời gian chạy khác nhau).
>
> 3. **"Create New Ad" per Post ID** — Đây là workflow quan trọng nhất: seller thấy 1 post đang perform tốt → bấm "Create New Ad" → tạo ad mới reuse cùng Facebook post đó nhưng với audience/budget khác → scale winning creative. **Đây là cách seller scale nhanh nhất.**
>
> 4. **Version system (v/t/b)** — Đây là cách seller identify creative bundles nhanh chóng. Khi họ có hàng trăm creative combinations, version identifier giúp họ communicate nhanh: "scale v65.1 - t23.2" hoặc "kill v40.2 - t27.0".
>
> 5. **Filter by Media/Adtext/Thumbnail** (trên Detail page) — Seller cần lọc để xem: "tất cả creatives dùng video v65.1 perform như nào?" hoặc "ad text t23.2 khi kết hợp với video nào thì tốt nhất?". Đây là A/B testing insight.
>
> **PixEcom v2 hiện hoàn toàn thiếu toàn bộ phần Creative Performance.** Schema có Creative + CreativeAsset nhưng chưa có aggregation, chưa có endpoint, chưa có metrics per creative. Sellpage list hiện chỉ trả về basic metadata (slug, status, type) với stub stats = 0. Đây là feature gap lớn nhất so với đối thủ.

---

## 6. ARCHITECTURE IMPLICATION

### Query Complexity Warning

The creative performance query is the most complex query in the system:

```sql
-- Simplified version of what the endpoint needs:
SELECT
  c.id as creative_id,
  c.display_version,
  SUM(s.spend) as total_spent,
  -- ... all other metric SUMs ...
  SUM(s.spend) / NULLIF(SUM(s.content_views), 0) as cpv,
  SUM(s.purchases)::float / NULLIF(SUM(s.content_views), 0) * 100 as cr,
  COUNT(DISTINCT ap.id) as ads_count
FROM creatives c
JOIN campaign_creatives cc ON cc.creative_id = c.id
JOIN campaigns camp ON camp.id = cc.campaign_id AND camp.sellpage_id = :sellpageId
JOIN adsets aset ON aset.campaign_id = camp.id
JOIN ads a ON a.adset_id = aset.id
JOIN ad_posts ap ON ap.ad_id = a.id
LEFT JOIN ad_stats_daily s ON s.entity_type = 'AD_POST' AND s.entity_id = ap.id
  AND s.stat_date BETWEEN :dateFrom AND :dateTo
WHERE c.seller_id = :sellerId
GROUP BY c.id
ORDER BY total_spent DESC
LIMIT :perPage OFFSET :offset
```

**This is a 6-table JOIN with GROUP BY.** At scale (1000+ creatives, 10K+ ad posts), this query needs:
- Proper indexes on all join columns
- Consider materialized view or pre-computed creative stats table
- May need to bypass Prisma and use raw SQL for performance

**Recommendation:** For MVP, use Prisma with proper includes. Monitor query time. If >200ms at 100 sellers, add a `CreativeStatsDaily` materialized table.

---

*Next: Product screenshots audit*
