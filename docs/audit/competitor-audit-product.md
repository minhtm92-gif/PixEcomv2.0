# Competitor Audit: Product Pages + Ad Content
**Source:** Selles system screenshots (`Product-Product Page.jfif` + `Product-Ad Content.jfif`)
**Date:** 2026-02-20
**Auditor:** CTO Advisor + Product Owner

---

## 0. PAGE STRUCTURE

Products section có **2 tabs:**

```
┌─────────────────────────────────────────────────────┐
│  [Product Pages]  [Ad Content]     Product Label ▾  All ▾  │
│                                                     │
│  Tab 1: Product Pages — Product catalog cards       │
│  Tab 2: Ad Content — Media/Thumbnail/AdText assets  │
│          with performance metrics per version        │
└─────────────────────────────────────────────────────┘
```

---

## 1. SCREENSHOT ANALYSIS — PRODUCT PAGES TAB (`Product-Product Page.jfif`)

### A. Tab Navigation + Filters

| Element | Description |
|---------|------------|
| Tab 1 | **Product Pages** (active — black text) |
| Tab 2 | **Ad Content** (inactive — teal/green text) |
| Filter 1 | **Product Label** dropdown (top right) |
| Filter 2 | **All** dropdown (secondary filter, next to Product Label) |

### B. Product Card Layout

Products are displayed as a **grid of cards** (4 columns visible). Each card contains:

| Element | Description | Example |
|---------|------------|---------|
| **Product Image** | Hero image / video thumbnail | Full-width image at top of card |
| **USP Badges** | Product selling points overlaid on image | "5x Stretch Waistband", "Shape your legs", "Soft and Breathable" |
| **Product Name** | Product title | "EaseTactic - Flex Fit Zipper-Pocket Durable Pants" |
| **Version Info** | Asset version identifier | "v6.1: fall/winter theme, bổ suff d variants" |
| **Suggested Retail Price** | Platform-set price | "Suggested retail price: $32.99" |
| **Average Order Value (AOV)** | Actual average revenue per order | "Average order value (AOV): $60.89" |
| **You Take** | Seller's earnings per order | "You take: $34.22 / order" |
| **"Create a sellpage" button** | CTA to create a new sellpage for this product | Teal button, bottom of card |

### C. Product Cards Data from Screenshot

**Card 1:**
```
ModernEase - Ultra Comfort Ice Silk Flexible Casual Pants
v1.1: thêm 7-8xl
Suggested retail price: $36.69
Average order value (AOV): $70.39
You take: $39.86 / order
[Create a sellpage]
```

**Card 2:**
```
EaseTactic - Flex Fit Zipper-Pocket Durable Pants
v6.1: fall/winter theme, bổ suff d variants
Suggested retail price: $32.99
Average order value (AOV): $60.89
You take: $33.72 / order
[Create a sellpage]
```

**Card 3:**
```
EaseTactic - Flex Fit Zipper-Pocket Durable Pants
v3.3: merge hết image cùa page v3.0 + các ảnh vsp page v1.2
Suggested retail price: $32.99
Average order value (AOV): $60.89
You take: $34.22 / order
[Create a sellpage]
```

**Card 4:**
```
EaseTactic - Flex Fit Zipper-Pocket Durable Pants
v2.0 - fix 2 ảnh ghép mặt mèo, bổ đổng rải d 1 số ảnh
Suggested retail price: $32.99
Average order value (AOV): $60.89
You take: $34.22 / order
[Create a sellpage]
```

### D. Key Observations — Product Pages

1. **Product Pages are NOT products** — they are **product page versions**. Same product (EaseTactic) appears multiple times with different versions (v6.1, v3.3, v2.0). Each version has different image/content sets.

2. **Version descriptions are in Vietnamese** — indicating team-internal notes about what changed in each version ("thêm 7-8xl", "fall/winter theme", "merge hết image").

3. **AOV is a computed metric** — Average Order Value comes from actual order data, not configured. This requires: `SUM(orders.total) / COUNT(orders)` per product.

4. **"You take" is pre-computed** — Shows seller earnings per order based on PricingRule. This is `suggestedRetail × sellerTakePercent` or `sellerTakeFixed`.

5. **"Create a sellpage" button** — Direct CTA from product card to sellpage creation. Seller picks a product page version → creates a sellpage.

6. **Multiple versions of same product** — This implies that the platform creates multiple "page versions" for each product, each with different creative assets (images, USP badges, layout). Sellers pick which version to use for their sellpage.

---

## 2. SCREENSHOT ANALYSIS — AD CONTENT TAB (`Product-Ad Content.jfif`)

### A. Page Header

| Element | Description |
|---------|------------|
| Tab | **Ad Content** (active — teal/green, underlined) |
| Product Name | **AirFlexion** (large, teal text) |
| Product Code | **Product Code: AirFlexion** (subtitle) |
| CTA Button | **"Create New Facebook Ad"** (green button, top right) |
| Filters | Product Label ▾ | All ▾ (same as Product Pages tab) |

### B. THREE ASSET SECTIONS

The Ad Content page shows **3 distinct asset categories**, each with version management and performance metrics:

---

#### Section 1: MEDIA (Videos)

**Layout:** Horizontal scrollable row of video thumbnails

| Column | Description |
|--------|------------|
| **Version** ↕ | Version identifier (sortable) — e.g., v5.0, v1.2.1, v1.2, v7.2, v7.0, v15.2, v10.0, v10.2, v5.1, v3.0 |
| **Thumbnail** | Video preview frame with play button (▶) + action menu (⋮) |
| **Spent** ↓ | Total ad spend using this media version (sortable, default sort) |
| **ROAS** ↕ | Return on ad spend (sortable) |
| **Details** | Link to detailed media performance page |

**Data from Screenshot:**

| Version | Spent | ROAS | Details |
|---------|-------|------|---------|
| v5.0 | $259,165.06 | 1.96 | Details |
| v1.2.1 | $133,243.95 | 1.79 | Details |
| v1.2 | $27,337.19 | 2.12 | Details |
| v7.2 | $14,136.27 | 1.95 | Details |
| v7.0 | $13,395.57 | 1.76 | Details |
| v15.2 | $12,784.31 | 1.71 | Details |
| v10.0 | $10,669.91 | 1.74 | Details |
| v10.2 | $7,482.65 | 1.83 | Details |
| v5.1 | $6,861.03 | 1.68 | Details |
| v3.0 | $6,069.14 | 2.11 | Details |

**Key Insight:** Media versions have **massive spend** ($259K for v5.0). This is aggregated across ALL ad posts that use this video. Sellers use this to compare video performance directly.

---

#### Section 2: THUMBNAIL

**Layout:** Same horizontal row but for thumbnail images

| Column | Description |
|--------|------------|
| **Version** ↕ | e.g., b1.0 (Latest) |
| **Image** | Thumbnail preview + action menu (⋮) |
| **Spent** ↓ | Total spend using this thumbnail |
| **ROAS** ↕ | ROAS for ads using this thumbnail |
| **Details** | Link to detailed thumbnail performance |

**Data from Screenshot:**

| Version | Label | Spent | ROAS |
|---------|-------|-------|------|
| b1.0 | (Latest) | $565,803.40 | 1.87 |

**Key Insight:** Only 1 thumbnail version for this product. The "(Latest)" label indicates version lifecycle tracking.

---

#### Section 3: ADTEXT

**Layout:** Horizontal scrollable cards, each showing full ad text content

| Field | Description |
|-------|------------|
| **Version** ↕ | e.g., t1.0, t8.2, t3.2, t2.0, t1.2, t6.2, t8.0 |
| **Primary text** | Main ad copy (truncated with "...") |
| **Headline** | Ad headline |
| **Description** | Ad description text |
| **Spent** ↓ | Total spend using this ad text |
| **ROAS** ↕ | ROAS for ads using this ad text |
| **Details** | Link to detailed performance |

**Data from Screenshot:**

| Version | Primary Text (truncated) | Headline | Description | Spent | ROAS |
|---------|------------------------|----------|-------------|-------|------|
| t1.0 | "Redefine Smart Casual in Comfort – Experience AirFlexion and Stay ..." | "Best Pants for Men 50+ 🧑" | "All day comfort with an elevated l..." | $259,738.25 | 1.88 |
| t8.2 | "⚠️These Pull-On Smart Pants Fix Everything You Hate About Pants ..." | "🚨 HOLIDAY SALE! 350K Senior M..." | "Risk-free. 45-Day Guarantee" | $76,280.59 | 1.85 |
| t3.2 | "63 Years of Experience Perfected in One Pair of Smart Casual Pants fo..." | "Rewrite the Definition of Dad Pants" | "Most comfortable smart casual pa..." | $62,811.70 | 1.94 |
| t2.0 | "63 Years of Wisdom... in One Pair of Pants. Designed to bring senior ..." | "50+ Men's Favorite 🧑" | "The most comfortable smart casu..." | $61,678.19 | 1.84 |
| t1.2 | "🤩The comfiest pants that still keep you look sharp✅ Soft to the touc..." | "50+ Gentlemen Must-Have!" | "Available in 7 trendy colors and 21..." | $19,887.88 | 2.04 |
| t6.2 | "Countdown to sale season 🎅 thanks for the love!..." | "50+ Men's Favorite 🧑" | "Stock up before it's gone" | $14,881.64 | 1.83 |
| t8.0 | "YEAR..." | "Start..." | "#1 All..." | $14,8... | 1.98 |

**Key Insight:** Ad texts are the **most granular asset type**. Each version shows 3 text fields (Primary, Headline, Description) plus aggregated performance. This lets sellers see which copy performs best.

---

## 3. GAP ANALYSIS — PixEcom v2 vs Selles Product Section

### 3A. PRODUCT PAGES TAB

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| Product card grid layout | ✅ 4-column grid | ❌ Products endpoint returns list, no cards | Frontend + API shape |
| Product hero image | ✅ Full-width in card | ✅ AssetMedia with isCurrent flag | OK — needs API return |
| USP badges on image | ✅ Overlaid text badges | ❌ No USP/badge concept | **NEW: Product badges/USPs** |
| Product name | ✅ | ✅ Product.name | OK |
| **Version info per product page** | ✅ "v6.1: fall/winter theme" | ❌ No product page versioning | **MAJOR GAP** |
| Suggested retail price | ✅ | ✅ PricingRule.suggestedRetail | OK — needs API return |
| **AOV (Average Order Value)** | ✅ Computed from orders | ❌ Not computed | **MISSING: Aggregation** |
| **You take per order** | ✅ Computed from PricingRule | ✅ PricingRule exists, youTakeEstimate computed | OK — needs API return |
| **"Create a sellpage" button** | ✅ Per product card | ❌ No CTA, no flow | Frontend + routing |
| Product Label filter | ✅ Dropdown filter | ✅ ProductLabel model exists | OK — needs filter endpoint |
| **Multiple page versions per product** | ✅ Same product shown multiple times with different versions | ❌ No concept of "product page version" | **MAJOR GAP** |

### 3B. AD CONTENT TAB

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Three-section layout (Media/Thumbnail/AdText)** | ✅ Distinct sections | ❌ Assets returned as flat list | **NEW VIEW** |
| **Media versions with thumbnails** | ✅ Horizontal scroll, video previews | ✅ AssetMedia has version field | Schema OK — needs new endpoint |
| **Thumbnail versions** | ✅ With (Latest) label | ✅ AssetThumbnail has version | Schema OK — needs new endpoint |
| **AdText versions with full text preview** | ✅ Shows Primary/Headline/Description | ✅ AssetAdtext has these fields | Schema OK — needs new endpoint |
| **Spent per asset version** | ✅ Aggregated across all ads using this asset | ❌ No stats per asset | **CRITICAL: Asset-level stats aggregation** |
| **ROAS per asset version** | ✅ | ❌ No stats per asset | **CRITICAL** |
| **Sortable by Spent/ROAS/Version** | ✅ Sort arrows on columns | ❌ | **NEW** |
| **"Details" link per asset** | ✅ | ❌ No asset detail page | **NEW** |
| **Action menu (⋮) per media** | ✅ Per video/thumbnail | ❌ | Frontend |
| **"Create New Facebook Ad" button** | ✅ Top right | ❌ | Frontend + flow |
| **Version lifecycle label "(Latest)"** | ✅ On thumbnails | ❌ isCurrent flag exists but no "Latest" concept | Minor gap |

### 3C. FUNDAMENTAL CONCEPT GAPS

#### Gap 1: Product Page Versioning

**Selles concept:** A "Product Page" is a versioned snapshot of product content (images, USP badges, layout). The platform can create v1, v2, v3 of the same product with different creative approaches. Each version has its own hero image, USPs, and content.

**PixEcom v2:** A Product is a single entity. There's no concept of "product page versions." The closest is `AssetMedia.version` field, but that's per-asset, not per-product-page.

**Options:**
- **Option A:** Model product page versions as Sellpage templates (reuse Sellpage model with a `templateVersion` field)
- **Option B:** Create a new `ProductPageVersion` model that bundles a set of assets + configuration
- **Option C:** Keep the current model — Product + multiple Asset versions. The "product page version" is implicit from the combination of assets assigned.

**Recommendation:** Option C for MVP. The "version" displayed on product cards can be derived from the latest `AssetMedia.version`. Product page versioning is a platform-side concern, not seller-facing. Sellers just see products with their current creative.

#### Gap 2: Per-Asset Performance Metrics (Spent + ROAS)

**Selles shows:** For each video version (v5.0, v1.2.1, etc.), the total ad spend and ROAS across ALL ads that used that video.

**This requires:**
```
For a given AssetMedia (e.g., video v5.0):
  1. Find all AdPosts where assetMediaId = this asset
  2. Find all Ads linked to those AdPosts
  3. Sum AdStatsDaily metrics for those Ads
  4. Return aggregated Spent + ROAS
```

**PixEcom v2:** This query is possible with current schema (AdPost has assetMediaId, assetThumbnailId, assetAdtextId), but:
- No endpoint exists
- AdStatsDaily has no data (worker not implemented)
- The join path: Asset → AdPost → Ad → AdStatsDaily

#### Gap 3: AOV (Average Order Value) per Product

**Selles shows:** "$60.89" average order value on each product card.

**This requires:**
```
AOV = SUM(orders.total) / COUNT(orders) WHERE orders contain this product
Path: Product → OrderItem → Order → SUM(total) / COUNT(DISTINCT order.id)
```

**PixEcom v2:** OrderItem has productId reference. Query is possible but no endpoint computes AOV.

---

## 4. REQUIRED CHANGES FOR TECH LEAD

### 4.1 New API Endpoints

#### `GET /api/products/catalog` (Enhanced Product Pages — Tab 1)
**Purpose:** Product catalog with pricing + AOV metrics for seller view
**Auth:** JWT
**Params:**
```
labelSlug?: string (filter by product label, e.g., "bestseller")
search?: string (search product name)
page?: number (default 1)
perPage?: number (default 20, max 100)
```
**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "productCode": "EASETACTIC-001",
      "name": "EaseTactic - Flex Fit Zipper-Pocket Durable Pants",
      "slug": "easetactic-flex-fit",
      "heroImage": "https://cdn.example.com/hero.jpg",
      "uspBadges": ["5x Stretch Waistband", "Shape your legs", "Soft and Breathable"],
      "currentVersion": "v6.1",
      "versionNote": "fall/winter theme, bổ suff d variants",
      "suggestedRetailPrice": 32.99,
      "averageOrderValue": 60.89,
      "youTakePerOrder": 34.22,
      "currency": "USD",
      "labels": ["bestseller", "trending"],
      "status": "ACTIVE",
      "variantCount": 8,
      "hasActiveSellpage": true
    }
  ],
  "total": 24,
  "page": 1,
  "perPage": 20
}
```

**Business Logic:**
- `heroImage`: AssetMedia WHERE productId AND isCurrent=true AND mediaType=IMAGE, ORDER BY position ASC, LIMIT 1
- `uspBadges`: NEW field — either from Product.tags JSON or new dedicated field
- `currentVersion`: Latest AssetMedia.version for this product
- `versionNote`: NEW field — human-readable description of the version change
- `suggestedRetailPrice`: From active PricingRule
- `averageOrderValue`: `SUM(order_items.line_total) / COUNT(DISTINCT orders.id)` WHERE product matches AND order status IN (CONFIRMED, DELIVERED)
- `youTakePerOrder`: From PricingRule (sellerTakePercent × suggestedRetail or sellerTakeFixed)
- `hasActiveSellpage`: EXISTS(sellpage WHERE productId AND status=PUBLISHED AND sellerId)

---

#### `GET /api/products/:id/ad-content` (Ad Content — Tab 2)
**Purpose:** Per-product asset registry with performance metrics, grouped by asset type
**Auth:** JWT
**Params:**
```
productId: route param (UUID)
sortBy?: string (default "spent", options: spent, roas, version)
sortOrder?: string (default "desc")
```
**Response:**
```json
{
  "product": {
    "id": "uuid",
    "name": "AirFlexion",
    "productCode": "AirFlexion"
  },
  "media": [
    {
      "id": "uuid",
      "version": "v5.0",
      "url": "https://cdn.example.com/video.mp4",
      "thumbnailUrl": "https://cdn.example.com/video-thumb.jpg",
      "mediaType": "VIDEO",
      "durationSec": 30,
      "spent": 259165.06,
      "roas": 1.96,
      "isLatest": true
    }
  ],
  "thumbnails": [
    {
      "id": "uuid",
      "version": "b1.0",
      "url": "https://cdn.example.com/thumb.jpg",
      "spent": 565803.40,
      "roas": 1.87,
      "isLatest": true
    }
  ],
  "adTexts": [
    {
      "id": "uuid",
      "version": "t1.0",
      "primaryText": "Redefine Smart Casual in Comfort – Experience AirFlexion and Stay ...",
      "headline": "Best Pants for Men 50+ 🧑",
      "description": "All day comfort with an elevated l...",
      "spent": 259738.25,
      "roas": 1.88,
      "isLatest": false
    }
  ]
}
```

**Business Logic:**
```
⚠️ IMPORTANT: This endpoint does NOT filter by sellerId.
   It returns ALL assets + stats across ALL sellers/teams for this product.
   This is a shared data layer for the entire team.

For each asset type (Media, Thumbnail, AdText):
  1. Get all versions for this product (from AssetMedia/AssetThumbnail/AssetAdtext)
     WHERE productId = :productId (NO sellerId filter)
  2. For each version:
     a. Find ALL AdPosts (across all sellers) that reference this asset
     b. Find all Ads linked to those AdPosts
     c. Sum AdStatsDaily.spend for those Ads in date range
     d. Compute ROAS: SUM(purchaseValue) / SUM(spend)
  3. Mark latest version (isCurrent=true or highest version number)
  4. Sort by requested column
```

**Alternative approach using new Asset model:**
```
For each asset type:
  1. Get all Assets WHERE productId (via Creative → Product link)
  2. For each Asset:
     a. Find all CreativeAssets referencing this asset
     b. Get the Creatives
     c. Get CampaignCreatives → Campaigns → Adsets → Ads
     d. Sum AdStatsDaily metrics
```

**Note:** The legacy AssetMedia/AssetThumbnail/AssetAdtext system maps more directly to Selles' model. The new Asset system would also work but requires the Creative → Campaign → Ad → Stats join chain.

---

### 4.2 Schema Changes Required

#### Add USP Badges to Product
```prisma
// Option A: Use existing tags JSON field (already exists)
// Product.tags could store: ["5x Stretch Waistband", "Shape your legs", "Soft and Breathable"]

// Option B: Add dedicated field
model Product {
  // ... existing fields ...
  uspBadges Json @default("[]") @map("usp_badges") @db.JsonB
  // e.g., ["5x Stretch Waistband", "Shape your legs"]
}
```

**Recommendation:** Use existing `Product.tags` field. Differentiate badge types via tag format or a separate `descriptionBlocks` section.

#### Add Version Note to AssetMedia (or Product)
```prisma
// Option: Add to AssetMedia
model AssetMedia {
  // ... existing fields ...
  versionNote String? @map("version_note") @db.VarChar(500)
  // e.g., "fall/winter theme, bổ suff d variants"
}
```

#### No New Models Needed for MVP
The existing schema can serve both Product Pages and Ad Content tabs:
- Product Pages: `Product` + `PricingRule` + `AssetMedia` (for hero image + version)
- Ad Content: `AssetMedia` + `AssetThumbnail` + `AssetAdtext` + `AdPost` + `AdStatsDaily`

---

### 4.3 Stats Pipeline Dependency

For the Ad Content tab to show real Spent + ROAS per asset version, the following must be in place:

1. **AdStatsDaily populated** (worker fetching from Meta API) — prerequisite for any metric
2. **AdPost → Asset linkage** (already in schema: `AdPost.assetMediaId`, `AdPost.assetThumbnailId`, `AdPost.assetAdtextId`)
3. **Aggregation query:** Group AdStatsDaily by asset version via AdPost join

```sql
-- Example: Spent + ROAS per media version
-- ⚠️ NO sellerId filter — aggregates across ALL sellers/teams
SELECT
  am.id,
  am.version,
  am.url,
  SUM(s.spend) as total_spent,
  CASE WHEN SUM(s.spend) > 0
    THEN SUM(s.purchase_value) / SUM(s.spend)
    ELSE 0
  END as roas
FROM asset_media am
JOIN ad_posts ap ON ap.asset_media_id = am.id
JOIN ads a ON a.id = ap.ad_id
JOIN ad_stats_daily s ON s.entity_type = 'AD' AND s.entity_id = a.id
WHERE am.product_id = :productId
  AND s.stat_date BETWEEN :dateFrom AND :dateTo
GROUP BY am.id, am.version, am.url
ORDER BY total_spent DESC
```

---

## 5. PRIORITY & EFFORT ESTIMATION

### P0 — Core Product Catalog (Must have)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Enhanced product catalog endpoint (with AOV, youTake) | 2 days | Orders data, PricingRule |
| Product label filter on catalog | 0.5 day | ProductLabel exists |
| Hero image in product response | 0.5 day | AssetMedia query |
| "Create a sellpage" flow (link from product to sellpage creation) | 1 day | Existing sellpage service |

**Total P0: ~4 dev days**

### P1 — Ad Content Tab (Requires stats pipeline)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Ad Content endpoint (3 sections: Media/Thumbnail/AdText) | 3 days | AssetMedia/Thumbnail/Adtext queries |
| Per-asset Spent + ROAS aggregation | 3 days | **AdStatsDaily populated (BLOCKER)** |
| Sort by Spent/ROAS/Version | 1 day | Query builder |
| "Details" link per asset (asset detail page) | 2 days | Asset detail endpoint |
| "Create New Facebook Ad" button flow | 2 days | Ad creation endpoint |
| isLatest / "(Latest)" label logic | 0.5 day | isCurrent flag or version comparison |

**Total P1: ~11.5 dev days**

### P2 — Polish

| Item | Effort |
|------|--------|
| USP badges on product cards | 1 day (if new field) or Frontend only (if reuse tags) |
| Version note display | 0.5 day |
| Horizontal scroll for asset cards | Frontend only |
| Video play button overlay on thumbnails | Frontend only |
| Action menu (⋮) per asset | Frontend only |

---

## 6. OWNER NOTES

> **From Product Owner:**
>
> Product section trong Selles có 2 phần rất quan trọng:
>
> 1. **Product Pages tab** — Hiển thị catalog sản phẩm dưới dạng card. Điểm quan trọng nhất là **AOV (Average Order Value)** và **"You take"** hiển thị ngay trên card. Seller nhìn vào biết ngay sản phẩm nào đáng bán, sản phẩm nào lời nhiều. **"Create a sellpage"** button giúp seller tạo sellpage ngay từ product card — đây là conversion funnel: Browse products → Pick one → Create sellpage → Start selling.
>
> 2. **Ad Content tab** — Đây là **asset performance dashboard at product level**. Nó cho seller (và platform) biết:
>    - Video nào perform tốt nhất? (v5.0 chi $259K mà ROAS 1.96 — đang win)
>    - Ad text nào convert tốt nhất? (t1.0 vs t8.2 vs t3.2 — so sánh ROAS)
>    - Thumbnail nào tốt nhất? (chỉ có b1.0 — cần test thêm thumbnail mới)
>
> **Đây là data dùng để quyết định tạo creative mới.** Seller nhìn Ad Content → thấy v5.0 win → tạo creative bundle mới dùng v5.0 + thử ad text mới → launch ad.
>
> **PixEcom v2** hiện có endpoint Product list nhưng chỉ trả về basic info (name, price, variants). Không có AOV, không có "You take" per order, không có Ad Content tab, không có per-asset performance metrics.
>
> **Clarification (from PO):** Tab Ad Content hiển thị **toàn bộ các creative (video/image/text/thumb) đã chạy của cả team** — không chỉ của riêng seller đang xem. Mục đích chính là để seller (và team) review lại các creative cũ để **mix thêm giả thiết test mới**. Ví dụ: thấy video v5.0 win → kết hợp với ad text mới → tạo creative bundle mới để test.
>
> **Implication cho backend:** Endpoint `GET /api/products/:id/ad-content` **KHÔNG filter theo sellerId**. Nó phải trả về all assets + aggregated stats across ALL sellers/teams. Đây là shared data layer, khác với các endpoint khác đều filter by seller.
>
> **✅ DECISION (chốt bởi PO):** Data scope cho từng page:
> | Page | Scope | Lý do |
> |------|-------|-------|
> | **Product → Ad Content tab** | **Team-wide** (all sellers) | Assets do platform quản lý. Shared intelligence giúp seller pick winning creative |
> | **Sellpage → Creative Performance** | **Per-seller** | Campaign/sellpage là private data của seller |
> | **Ads Manager** | **Per-seller** | Campaign/budget/ROAS là private data |
> | **Homepage Dashboard** | **Per-seller** | Revenue/Cost/YouTake là financial data riêng |

---

## 7. ARCHITECTURE IMPLICATION

### Legacy Asset System is the Right Fit Here

The **Ad Content tab** maps directly to the **legacy** asset models:
- `AssetMedia` → Media section (videos)
- `AssetThumbnail` → Thumbnail section
- `AssetAdtext` → AdText section (with primaryText, headline, description)

The **new** Asset + Creative system is designed for creative bundles (combinations), not individual asset performance.

**Recommendation:** Keep the legacy asset models for the Ad Content tab. The new Creative system is for the Sellpage creative performance view. Both systems serve different purposes:

```
Legacy (AssetMedia/Thumbnail/Adtext):
  → Product-level asset management
  → Individual asset performance tracking
  → Platform content team's view

New (Asset + Creative + CreativeAsset):
  → Seller-level creative bundle management
  → Bundle performance (video + text + thumbnail combination)
  → Seller's view
```

**This validates keeping BOTH systems** rather than migrating legacy → new. They serve different analytical dimensions.

---

*Next: Ad Creation screenshots audit*
