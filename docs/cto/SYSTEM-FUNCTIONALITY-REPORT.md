# PixEcom v2 — System Functionality Report

> **Version**: 1.0
> **Date**: 2026-02-23
> **Author**: CTO Agent
> **Purpose**: Comprehensive system overview for CMO Agent review
> **Branch**: `feature/2.4.2-alpha-ads-seed-v1`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Module-by-Module Feature List](#3-module-by-module-feature-list)
4. [Key User Flows](#4-key-user-flows)
5. [Data Model Summary](#5-data-model-summary)
6. [Current Status](#6-current-status)
7. [Roadmap](#7-roadmap)

---

## 1. System Overview

### What is PixEcom?

PixEcom v2 is a **multi-tenant SaaS e-commerce platform** that enables sellers to:
- Sell products through individually branded **sellpages** (landing pages)
- Run **Facebook/Meta advertising campaigns** directly from the platform
- Track **ad performance metrics** (ROAS, CR, spend, revenue) in a unified dashboard
- Manage **orders, creatives, and assets** from a single portal

The platform is operated by a **Superadmin** who manages sellers, products, payment gateways, and domains. A **Content team** handles product catalog and sellpage creation.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                     │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Admin    │  │  Seller      │  │  Storefront            │ │
│  │  Portal   │  │  Portal      │  │  (Customer-facing)     │ │
│  │  /admin/* │  │  /*          │  │  /[store]/[slug]       │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND (NestJS 10)                        │
│                                                              │
│  Auth (JWT) │ Products │ Orders │ Campaigns │ Ads Manager    │
│  Sellpages  │ Creatives │ Assets │ Meta API  │ FB Connect    │
│  Domains    │ Settings  │ Health │ Strategies                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    DATA LAYER                                │
│                                                              │
│  PostgreSQL 16  │  Prisma ORM  │  28 Models  │  18 Enums    │
│  Cloudflare R2 (CDN: cdn.pixelxlab.com)                      │
└──────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    WORKER (BullMQ)                            │
│                                                              │
│  Stats Sync (Meta API → AdStatsRaw → AdStatsDaily)           │
│  Scheduled: every 15 minutes                                 │
└──────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, Zustand |
| Backend | NestJS 10, TypeScript, class-validator |
| Database | PostgreSQL 16 + Prisma ORM |
| Worker | BullMQ (Redis-backed job queue) |
| CDN / Storage | Cloudflare R2 (cdn.pixelxlab.com) |
| Auth | JWT (15min) + Refresh Token rotation (7-day httpOnly cookie) |
| Ads Integration | Meta Marketing API v21.0 (OAuth + encrypted tokens) |
| Deploy (Preview) | Cloudflare Pages (pixecom-preview.pages.dev) |

### Tenant Isolation

All seller data is scoped by `sellerId` extracted from the JWT token. The sellerId is **never** accepted from URL params or request body — always from the authenticated token. This prevents sellers from accessing each other's data.

---

## 2. User Roles & Permissions

### Role Definitions

| Role | Portal | Description |
|------|--------|-------------|
| **Admin** (Superadmin) | `/admin/*` | Platform operator. Full access to all sellers, orders, products, settings, domains. Creates sellers and Content users. Manages payment gateways. |
| **Seller** | `/*` (portal) | Merchant. Manages own orders, sellpages, campaigns, creatives, ads, settings. Cannot see other sellers' data. |
| **Content** (NEW) | `/admin/*` (restricted) | Content team member. Access only to Products, Sellpages, Creatives. Creates sellpages generically; Admin assigns to seller. Can self-publish. |

### Role Permissions Matrix

| Module | Admin | Seller | Content |
|--------|:-----:|:------:|:-------:|
| **Dashboard** (Admin KPIs) | Full | - | - |
| **Dashboard** (Seller KPIs) | - | Full | - |
| **Sellers Management** | Full CRUD | - | - |
| **Products** (catalog) | Full CRUD | Read only | Full CRUD |
| **Orders** (cross-seller) | Full + Export | - | - |
| **Orders** (own seller) | - | Full + Export + Import | - |
| **Sellpages** | View all | Own CRUD + Publish | Create + Edit + Publish |
| **Campaigns** | - | Full CRUD + Launch/Pause | - |
| **Ads Manager** | - | Full (view + inline actions + bulk) | - |
| **Creatives** | - | Full CRUD | Full CRUD |
| **Assets** | - | Upload + View own | Upload + View |
| **Analytics** (platform) | Full | - | - |
| **Analytics** (seller) | - | Own data | - |
| **Settings** (platform) | Full 12 sections | - | - |
| **Settings** (seller store) | - | Own settings | - |
| **Stores / Domains** | Full CRUD + DNS verify | View own domains | - |
| **FB Connections** | - | Full CRUD + OAuth | - |
| **User Management** | Create/Edit admin + content users | - | - |
| **Payment Gateways** | Full CRUD + assign to seller | View assigned (read-only) | - |
| **Discounts** | Full CRUD | View assigned | - |

### Authentication

- **Login endpoints**: Separate for Admin (`POST /auth/admin-login`) and Seller (`POST /auth/login`)
- **Admin accounts** cannot login via seller portal and vice versa
- **Content users** share the Admin portal with restricted navigation
- **JWT payload**: `{ userId, sellerId, role, isSuperadmin }`
- **Token flow**: Login → JWT (15min) + Refresh Token (7-day httpOnly cookie) → Auto-refresh on expiry

---

## 3. Module-by-Module Feature List

### 3.1 Authentication Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Seller registration (email + password) | Done | `POST /auth/register` |
| Seller login | Done | `POST /auth/login` |
| Admin login (separate) | Done | `POST /auth/admin-login` |
| JWT + Refresh token rotation | Done | `POST /auth/refresh` |
| Logout (revoke refresh token) | Done | `POST /auth/logout` |
| Get current user context | Done | `GET /auth/me` |
| Google SSO | Planned | `POST /auth/google` (stub) |
| Refresh race condition fix | Done | Client-side dedup |

---

### 3.2 Products Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| List products (paginated, search, filter by label) | Done | `GET /products` |
| Product detail (with variants) | Done | `GET /products/:id` |
| Product variants list | Done | `GET /products/:id/variants` |
| Product assets (media, thumbnails, ad texts) | Done | `GET /products/:productId/assets/*` |
| Create product (admin) | Preview | UI only, API planned for Phase D |
| Edit product (admin) | Preview | UI only, API planned for Phase D |
| Cross-product variant matrix (Size x Color) | Preview | UI only (Raven pattern) |
| Per-variant pricing (price, compare, cost, fulfillment, SKU) | Preview | UI only |
| Product labels/tags | Done | DB model exists, used in filters |

**Data model**: `Product` → `ProductVariant[]` → `ProductLabel[]` (many-to-many)

**Pricing**: Products have `basePrice`, `compareAtPrice`, `costPrice`. Variants can override with `priceOverride`. A separate `PricingRule` model defines `suggestedRetail`, `sellerTakePercent`, and `holdPercent` for revenue sharing.

---

### 3.3 Orders Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| List orders (paginated, filters: status, source, date) | Done | `GET /orders` |
| Order detail (items, events, shipping, payment, UTM) | Done | `GET /orders/:id` |
| Search (order#, email, name, phone, tracking#) | Done | via query params |
| Manual status change (with transition validation) | Done | `PATCH /orders/:id/status` |
| Valid transitions check | Done | `GET /orders/:id/transitions` |
| Bulk status update | Done | `PATCH /orders/bulk-status` |
| CSV export (with filters) | Done | `GET /orders/export` |
| CSV import tracking | Done | `POST /orders/import-tracking` |
| Source attribution (facebook, tiktok, google, etc.) | Done | `source` field + UTM fields |
| OrderEvent logging (status changes, notes) | Done | Auto-creates on status change |

**Status transitions**:
```
PENDING → CONFIRMED, CANCELLED
CONFIRMED → PROCESSING, CANCELLED
PROCESSING → SHIPPED, CANCELLED
SHIPPED → DELIVERED, REFUNDED
DELIVERED → REFUNDED
CANCELLED → (terminal)
REFUNDED → (terminal)
```

---

### 3.4 Sellpages Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Create sellpage (select product, slug, title override) | Done | `POST /sellpages` |
| List sellpages (paginated, status filter, search) | Done | `GET /sellpages` |
| Sellpage detail | Done | `GET /sellpages/:id` |
| Edit sellpage (slug, title, description, domain) | Done | `PATCH /sellpages/:id` |
| Publish / Unpublish | Done | `POST /sellpages/:id/publish|unpublish` |
| Custom domain assignment | Done | `customDomain` field in PATCH |
| Domain availability check | Done | `GET /sellpages/check-domain` |
| DNS verification (mock) | Done | `POST /sellpages/:id/verify-domain` |
| Pixel assignment (metadata) | Done | via `headerConfig` JSON |
| Linked Ads (Campaign→Adset→Ad chain with metrics) | Done | `GET /sellpages/:id/linked-ads` |
| Boost modules (Bundle Discount, Extra Off, Upsell) | Preview | JSON config in `boostModules` |
| Discount rules | Preview | JSON config in `discountRules` |
| Storefront renderer (customer-facing page) | Preview | Static UI only |

**Sellpage types**: `SINGLE` (one product), `MULTIPLE` (future: multi-product store)

**Sellpage JSON configs**:
- `sections`: Page content blocks (rich text, images)
- `headerConfig`: Header settings (logo, pixel ID)
- `footerConfig`: Footer settings (links, policies)
- `boostModules`: Sales boost modules (bundle discounts, upsells)
- `discountRules`: Discount configuration

---

### 3.5 Campaigns Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Create campaign (sellpage + ad account + budget) | Done | `POST /campaigns` |
| List campaigns (filter by status, sellpage) | Done | `GET /campaigns` |
| Campaign detail | Done | `GET /campaigns/:id` |
| Edit campaign (name, budget, dates) | Done | `PATCH /campaigns/:id` |
| Launch to Meta (push to Facebook API) | Done | `POST /campaigns/:id/launch` |
| Pause campaign (sync with Meta) | Done | `PATCH /campaigns/:id/pause` |
| Resume campaign (sync with Meta) | Done | `PATCH /campaigns/:id/resume` |
| Budget update (inline, sync with Meta) | Done | `PATCH /campaigns/:id/budget` |
| Adset CRUD (within campaign) | Done | `POST|GET /campaigns/:campaignId/adsets` |
| Ad CRUD (within adset) | Done | `POST|GET /adsets/:adsetId/ads` |
| AdPost linking (Ad → Facebook Page + Post) | Done | `POST /ads/:adId/ad-post` |
| Inline pause/resume for adsets | Done | `PATCH /adsets/:id/pause|resume` |
| Inline pause/resume for ads | Done | `PATCH /ads/:id/pause|resume` |

**Campaign hierarchy**: `Campaign` → `Adset[]` → `Ad[]` → `AdPost` (links to FB Page + Post)

**Meta API integration**:
- OAuth flow for Facebook account connection
- Token encryption (AES-256-GCM) for secure storage
- Rate limiting (200 calls/hour/ad-account)
- Auto-retry with exponential backoff for 500/503

---

### 3.6 Ads Manager Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| 3-tier drill-down (Campaigns → Adsets → Ads) | Done | `GET /ads-manager/campaigns|adsets|ads` |
| Date range filters (today, 7d, 30d, custom) | Done | via query params |
| Status filter | Done | via query params |
| Metrics columns (spend, impressions, clicks, purchases, revenue, ROAS, CR, CPC, CPM, CTR) | Done | Computed from stats |
| Bulk pause/resume | Done | `PATCH /ads-manager/bulk-status` |
| Bulk budget update | Done | `PATCH /ads-manager/bulk-budget` |
| Manual sync from Meta | Done | `POST /ads-manager/sync` |
| Multi-select with floating action bar | Done | Frontend UI |
| Inline toggle (pause/resume per row) | Done | Frontend + API |
| Inline budget edit | Done | Frontend + API |
| Sync cooldown (60s per seller) | Done | Server-side rate limit |

**Metrics Contract (FROZEN)**:
| Metric | Formula |
|--------|---------|
| CR | purchase / contentView * 100 |
| CR1 | checkout / contentView * 100 |
| CR2 | purchase / checkout * 100 |
| ROAS | revenue / spend |
| CPC | spend / clicks |
| CPM | spend / impressions * 1000 |
| CTR | clicks / impressions * 100 |

All division uses `safeDivide()` (returns 0 on divide-by-zero). Ratios are NEVER averaged — raw counts are summed first, then ratios derived.

---

### 3.7 Creatives Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Create creative (name, type, product) | Done | `POST /creatives` |
| List creatives (filter by status, type) | Done | `GET /creatives` |
| Creative detail (with asset slots) | Done | `GET /creatives/:id` |
| Edit creative | Done | `PATCH /creatives/:id` |
| Assign asset to slot (6 roles) | Done | `POST /creatives/:id/assets` |
| Remove asset from slot | Done | `DELETE /creatives/:id/assets/:role` |
| Validate (DRAFT → READY) | Done | `POST /creatives/:id/validate` |
| Render payload (for ad delivery) | Done | `GET /creatives/:id/render` |

**Creative types**: `VIDEO_AD`, `IMAGE_AD`, `TEXT_ONLY`, `UGC_BUNDLE`

**Asset slot roles**: `PRIMARY_VIDEO`, `THUMBNAIL`, `PRIMARY_TEXT`, `HEADLINE`, `DESCRIPTION`, `EXTRA`

---

### 3.8 Assets Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Request signed upload URL (R2) | Done | `POST /assets/signed-upload` |
| Register uploaded asset | Done | `POST /assets` |
| List assets (seller-scoped) | Done | `GET /assets` |
| Asset detail | Done | `GET /assets/:id` |
| Ingest from internal pipeline | Done | `POST /assets/ingest` (API key) |
| Product-level assets (media, thumbnails, adtext) | Done | `GET /products/:productId/assets/*` |

**Asset sources**: `PIXCON` (platform), `USER_UPLOAD`, `PARTNER_API`, `MIGRATION`, `SYSTEM`

**Media types**: `VIDEO`, `IMAGE`, `TEXT`

**Upload flow**: Client → GET signed URL → PUT to R2 → POST /assets to register

---

### 3.9 Facebook Connections Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Create connection (AD_ACCOUNT, PAGE, PIXEL, CONVERSION) | Done | `POST /fb/connections` |
| List connections (filter by type) | Done | `GET /fb/connections` |
| Connection detail | Done | `GET /fb/connections/:id` |
| Edit connection (name, isPrimary, isActive) | Done | `PATCH /fb/connections/:id` |
| Delete connection (soft-disable) | Done | `DELETE /fb/connections/:id` |
| Meta OAuth connect flow | Done | `GET /meta/auth-url` + callback |

**Connection types**: `AD_ACCOUNT`, `PAGE`, `PIXEL`, `CONVERSION`

**Hierarchy**: `AD_ACCOUNT` → `PIXEL` (child), `PAGE` (standalone)

---

### 3.10 Seller Settings Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| View seller profile (name, slug, logo) | Done | `GET /sellers/me` |
| Edit seller profile | Done | `PATCH /sellers/me` |
| View settings (brand, currency, timezone, etc.) | Done | `GET /sellers/me/settings` |
| Edit settings | Done | `PATCH /sellers/me/settings` |
| Meta Pixel ID config | Done | in settings |
| Google Analytics ID config | Done | in settings |

---

### 3.11 Domains Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Register domain | Done | `POST /domains` |
| List domains | Done | `GET /domains` |
| Edit domain (isPrimary) | Done | `PATCH /domains/:id` |
| Delete domain | Done | `DELETE /domains/:id` |
| Verify domain (stub) | Done | `POST /domains/:id/verify` |

**Verification methods**: `TXT` record, `A_RECORD`

**Domain status**: `PENDING` → `VERIFIED` / `FAILED`

---

### 3.12 Ad Strategies Module

| Feature | Status | Endpoints |
|---------|--------|-----------|
| Create strategy template | Done | `POST /fb/ad-strategies` |
| List strategies | Done | `GET /fb/ad-strategies` |
| Strategy detail | Done | `GET /fb/ad-strategies/:id` |
| Edit strategy | Done | `PATCH /fb/ad-strategies/:id` |
| Delete (soft-disable) | Done | `DELETE /fb/ad-strategies/:id` |

Strategies are reusable templates for campaign targeting and budget configuration.

---

### 3.13 Analytics Module (Seller)

| Feature | Status | Endpoints |
|---------|--------|-----------|
| KPI cards (revenue, ad spend, ROAS, hold, cash-to-balance) | Done | Frontend computed from stats |
| Top campaigns table | Done | Frontend |
| Sellpages performance | Done | Frontend |
| Date presets (today, 7d, 30d) | Done | Frontend |
| Stats aggregation pipeline | Done | Worker: AdStatsRaw → AdStatsDaily → SellpageStatsDaily |

---

### 3.14 Admin Portal Modules

#### 3.14.1 Admin Dashboard
| Feature | Status |
|---------|--------|
| KPI cards (active sellers, pending approvals, total orders, revenue, ROAS) | Preview |
| 7-day revenue chart | Preview |
| Recent orders table | Preview |

#### 3.14.2 Sellers Management (Admin)
| Feature | Status |
|---------|--------|
| Sellers list with status tabs (All/Active/Pending/Deactivated/Rejected) | Preview |
| Create seller (invite-only) | Preview |
| Seller detail (Profile, Payment, FB Connections, Sellpages tabs) | Preview |
| Payment gateway assignment per seller | Preview |

#### 3.14.3 Orders Management (Admin, cross-seller)
| Feature | Status |
|---------|--------|
| Cross-seller orders table with status tabs | Preview |
| Search by order#, customer, seller, product | Preview |
| Export CSV button | Preview |
| Import tracking button | Preview |
| Manual status change | Preview |

#### 3.14.4 Products Management (Admin)
| Feature | Status |
|---------|--------|
| Cross-seller products list with status tabs | Preview |
| Create product form (Title, Email, Images, Variants matrix) | Preview |
| Product detail (Overview, Variants, Sellpages, Reviews, Stats tabs) | Preview |
| "Maker" column (product creator, not necessarily seller) | Preview |
| ROAS column | Preview |

#### 3.14.5 Stores / Domains Management (Admin)
| Feature | Status |
|---------|--------|
| Stores list with status tabs | Preview |
| Create store form (top-level domain, assign to seller) | Preview |
| Store detail (Domain Info, Seller, Products, Sellpages tabs) | Preview |
| DNS verification instructions | Preview |

#### 3.14.6 Platform Analytics (Admin)
| Feature | Status |
|---------|--------|
| 6 KPI cards (Revenue, Orders, Ads Spend, Product Cost, Payment Fee, Profit) | Preview |
| Tabs: Overview, By Seller, By Product, By Domain | Preview |
| 7-day revenue chart | Preview |

#### 3.14.7 Platform Settings (Admin) — 12 Sections
| Section | Status | Description |
|---------|--------|-------------|
| General | Preview | User info + Merchant info |
| Payments | Preview | Payment gateway list + Add + Assign to sellers |
| Email | Preview | Email templates (placeholder) |
| SMS | Preview | SMS templates (placeholder) |
| Legal | Preview | Legal pages for sellpages (placeholder) |
| Billing | Preview | Billing & invoices (placeholder) |
| Users | Preview | Admin + Content user management |
| Apps | Preview | Integrations (placeholder) |
| Fulfillment | Deferred | Tracking providers (needs further discussion) |
| Discounts | Preview | Discount codes CRUD + Sellpage assignment |
| Sellers | Preview | Redirect to /admin/sellers |
| Storefront | Preview | Redirect to /admin/stores |

---

### 3.15 Storefront (Customer-Facing Pages)

| Page | Status | Description |
|------|--------|-------------|
| Store Homepage | Preview | Product categories grid (Clearance, New Arrivals, Bestsellers) |
| Product Sellpage | Preview | Full landing page: promo bar, image gallery, pricing, variants, boost modules, social proof, reviews, description, shipping info |
| Checkout | Preview | 2-column layout: Order Summary (left) + Payment Form (right). Card (Stripe) + PayPal. Discount tick-select (no code input). Trust badges. |
| Order Tracking | Preview | Email + Order number search form |
| Policy Pages | Preview | Terms, Privacy, Returns, Shipping |
| Cart Slide-Out | Preview | Product info, qty edit, upsell banner, subtotal, PayPal express, Checkout button |
| Hamburger Menu | Preview | Nav links + policy page links |

**Sellpage Boost Modules** (3 types):
1. **Bundle Discount** (purple): Buy X items → Save Y%
2. **Extra Off** (amber): Additional percentage discount
3. **Upsell Next Item** (green): Extra Y% off for adding another item to cart

**Checkout features**:
- Available discounts as tick-select checkboxes (no coupon code input)
- Multiple discounts can be selected simultaneously
- Payment methods: Card (Stripe) + PayPal only (no COD)
- Urgency timer + savings banner

---

### 3.16 Stats Worker

| Feature | Status |
|---------|--------|
| Meta API insights fetch (campaign/adset/ad levels) | Done |
| Field mapping (Meta → DB) | Done |
| AdStatsRaw insertion | Done |
| AdStatsDaily aggregation (upsert) | Done |
| SellpageStatsDaily aggregation | Done |
| 15-minute scheduled sync | Done |
| Late conversion catch-up (last 3 days) | Done |
| safeDivide() for all derived metrics | Done |

---

## 4. Key User Flows

### 4.1 Admin Flows

#### Flow A1: Onboard New Seller
```
Admin login (/admin) → Sellers → "Add Seller" → Fill form (name, email, password)
→ System creates User + Seller + SellerSettings + SellerUser(OWNER)
→ Admin assigns Payment Gateway (Settings > Payments)
→ Admin creates Store/Domain (Stores > "Add Store") + DNS verification
→ Seller receives credentials → Seller logs in at /login
```

#### Flow A2: Manage Orders (Cross-Seller)
```
Admin login → Orders → View all sellers' orders
→ Filter by status/seller/date → Click order → View detail
→ Change status (with transition validation)
→ OR: Export CSV → Import tracking CSV
```

#### Flow A3: Create Product (Admin or Content)
```
Admin/Content login → Products → "Add Product"
→ Fill: Title, Email, Images (drag-drop), Variants (cross-product matrix)
→ Set per-variant: Price, Compared Price, Cost, Fulfillment Cost, SKU
→ "Create Product" → Product created with DRAFT status
→ Activate → ACTIVE (visible to sellers)
```

#### Flow A4: Platform Analytics
```
Admin login → Analytics → View 6 KPIs
→ Revenue, Orders, Ads Spend, Product Cost, Payment Fee, Profit
→ Switch tabs: Overview / By Seller / By Product / By Domain
→ Date range selection
```

---

### 4.2 Seller Flows

#### Flow S1: Complete Ad Campaign Setup
```
Seller login (/login) → Settings → Connect Facebook (OAuth)
→ FB connections created (AD_ACCOUNT, PAGE, PIXEL)
→ Products → Browse catalog → Note product to sell
→ Sellpages → "New Sellpage" → Select product + Set slug
→ Publish sellpage
→ Campaigns → "New Campaign" → Select sellpage + AD_ACCOUNT + Budget
→ Add Adset (targeting) → Add Ad → Link AdPost (select Page + Post ID)
→ Launch Campaign → Meta API pushes to Facebook
→ Ads Manager → Monitor performance (ROAS, spend, clicks, conversions)
→ Inline actions: pause/resume/budget edit per row
→ Bulk actions: multi-select + batch pause/resume
```

#### Flow S2: Order Fulfillment
```
Seller login → Orders → Filter "PENDING"
→ Click order → Review items + shipping address
→ "Confirm" → Status: CONFIRMED
→ "Process" → Status: PROCESSING (pick & pack)
→ "Ship" → Status: SHIPPED (add tracking number via note)
→ OR: Bulk import tracking CSV
→ "Mark Delivered" → Status: DELIVERED
→ Monitor via Orders list + source attribution badges
```

#### Flow S3: Creative Management
```
Seller login → Creatives → "New Creative" → Select type + product
→ Upload assets: video → R2 signed URL → register
→ Assign to slots: PRIMARY_VIDEO, THUMBNAIL, PRIMARY_TEXT, HEADLINE
→ "Validate" → Status: DRAFT → READY
→ Use in Campaign → AdPost → Facebook Ad
```

#### Flow S4: Analyze Performance
```
Seller login → Ads Manager → 3-tier drill-down
→ Campaigns (ROAS overview) → Click campaign → Adsets → Click adset → Ads
→ Date range: today / 7d / 30d
→ Metrics: spend, impressions, clicks, contentView, checkout, purchase, revenue
→ Derived: ROAS, CR, CR1, CR2, CPC, CPM, CTR
→ "Sync from Meta" → Pull latest data
→ Analytics page → KPI cards + Top campaigns + Sellpage performance
```

---

### 4.3 Content Team Flows

#### Flow C1: Product + Sellpage Creation
```
Content login (/admin, restricted menu) → Products → "Add Product"
→ Fill product details (title, images, variants, pricing)
→ "Create Product"
→ Sellpages → "New Sellpage" → Select product + Set slug
→ Configure: title override, description, boost modules
→ "Publish" → Sellpage live (Content can self-publish)
→ Admin assigns sellpage to specific seller (later step)
```

#### Flow C2: Creative Bundle Creation
```
Content login → Creatives → "New Creative"
→ Select type (VIDEO_AD / IMAGE_AD) + Select product
→ Upload assets (video, thumbnail, ad copy text)
→ Assign to 6 role slots
→ "Validate" → READY for seller campaigns
```

---

### 4.4 Customer Flows

#### Flow CU1: Browse & Purchase
```
Customer visits store domain (e.g., bestbra.com)
→ Store homepage → Product categories → Click product
→ Sellpage: View images, select variant (color/size), see price + compare
→ See boost modules (bundle discount, extra off, upsell)
→ "Add to Cart" → Cart slide-out panel
→ "Checkout" → Checkout page
→ Left: Order summary (product, qty, savings, discounts)
→ Right: Contact info + Shipping + Payment (Card or PayPal)
→ Select available discounts (tick checkboxes, no code needed)
→ "Pay $X now" → Order created → Confirmation
```

#### Flow CU2: Track Order
```
Customer visits /[store]/trackings/search
→ Enter email + order number
→ "Track" → View order status + tracking info
```

---

## 5. Data Model Summary

### Entity Relationship Overview

```
User (auth)
  └── SellerUser (role: OWNER/ADMIN/EDITOR/VIEWER)
        └── Seller (tenant)
              ├── SellerSettings (1:1)
              ├── SellerDomain[] (custom domains)
              ├── Sellpage[] → Product (1:1 per sellpage)
              │     ├── Campaign[]
              │     │     ├── Adset[]
              │     │     │     └── Ad[]
              │     │     │           └── AdPost (FB Page + Post link)
              │     │     └── CampaignCreative[]
              │     ├── Order[]
              │     └── SellpageStatsDaily[]
              ├── FbConnection[] (AD_ACCOUNT, PAGE, PIXEL, CONVERSION)
              ├── Creative[]
              │     └── CreativeAsset[] (6 role slots)
              ├── Asset[] (R2-stored media)
              ├── Order[]
              │     ├── OrderItem[]
              │     └── OrderEvent[]
              ├── AdStrategy[]
              └── AdStatsRaw[] / AdStatsDaily[]

Product (platform-level, not seller-scoped)
  ├── ProductVariant[]
  ├── ProductLabel[] (many-to-many)
  ├── AssetMedia[] / AssetThumbnail[] / AssetAdtext[]
  ├── PricingRule[]
  └── Sellpage[] (seller creates sellpage for product)
```

### Key Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| User → SellerUser → Seller | Many-to-Many (via join) | One user can belong to multiple sellers |
| Seller → Sellpage → Product | Many:1 per sellpage | Seller creates sellpage for a platform product |
| Sellpage → Campaign → Adset → Ad | 1:N chain | Ad hierarchy under sellpage |
| Ad → AdPost → FbConnection (PAGE) | 1:1 per ad | Links ad to Facebook post |
| Creative → CreativeAsset → Asset | 1:N (6 slots) | Bundle of media assets for ad creation |
| Order → OrderItem → Product/Variant | 1:N | Order contains multiple items |
| Product → PricingRule | 1:N | Revenue sharing rules (seller take %, hold %) |

### Stats Pipeline

```
Meta API (every 15min)
  → AdStatsRaw (raw fetch, per-entity per-date)
  → AdStatsDaily (aggregated, unique per entity+date)
  → SellpageStatsDaily (rolled up per sellpage+date)
```

Stats are stored in **DB field names** (linkClicks, contentViews, purchases, purchaseValue) but **API responses** use **Metrics Contract names** (clicks, contentView, purchase, revenue).

---

## 6. Current Status

### Phase Completion

| Phase | Description | Status |
|-------|------------|--------|
| **A** | Bug Fix + Stabilize (5 bugs, Error Boundary, Admin login) | Done |
| **B** | Seller Can Operate (Settings, Orders full, Sellpage CRUD, Creatives) | Done |
| **C** | Seller Can Create Ads (Meta API, Campaigns, Adsets/Ads, Stats worker, Assets, OAuth) | Done |
| **C-FIX** | Post-regression fixes (13 bugs across frontend + backend) | Done |
| **C2** | Seller Polish (11 items: seed, ads inline, sellpage enhance, orders status) | Done |
| **C2-FIX** | Post-C2 regression fixes (3 frontend bugs) | Done |
| **D-PREVIEW** | UI Preview (46 routes, 69 static pages, deployed to Cloudflare Pages) | Done |
| **D-PREVIEW-4** | PO Feedback Fixes (19 items + Content role) | Pending CMO review |
| **D** | Admin Portal — Real Implementation | Planned |
| **E** | Sellpage Renderer + Checkout + Payment (Stripe, PayPal) | Planned |
| **F** | Production Ready (DB migration, monitoring, CI/CD) | Planned |

### API Inventory

- **20 controllers** with **100+ endpoints**
- All seller endpoints use JWT auth with tenant isolation
- Public endpoints: health check, auth (login/register/refresh/logout), Meta OAuth callback

### Frontend Inventory

- **44 routes** across 4 sections:
  - Portal (Seller): 13 routes (real API)
  - Admin: 21 routes (mock data, pending real API)
  - Storefront: 5 routes (preview/mock)
  - Public/Auth: 5 routes

### Database

- **28 models** (+ 3 join tables)
- **18 enums**
- **7 migrations** applied
- **22 tenant-scoped models** (contain sellerId)
- **4 platform models** (Product, ProductLabel, ProductVariant, PricingRule)

### Deployment

| Environment | URL | Status |
|------------|-----|--------|
| Preview | pixecom-preview.pages.dev | Active |
| Preview (custom) | preview1.pixelxlab.com | DNS pending |
| Staging | staging.pixelxlab.com | Needs redeploy |
| Production | TBD | Planned (Phase F) |

---

## 7. Roadmap

### Phase D: Admin Portal — Real Implementation
- Backend API endpoints for all admin modules (SuperadminGuard protected)
- New DB models: PaymentGateway, Discount (if not using existing JSON)
- Wire admin frontend pages from mock → real API calls
- Content role implementation (restricted admin access)

### Phase E: Sellpage Renderer + Checkout + Payment
- Server-side rendering of sellpages from DB config (sections, boostModules, etc.)
- Customer-facing cart + checkout flow
- Stripe integration (card payments)
- PayPal integration
- Discount application logic (tick-select, no codes)
- Order creation from checkout

### Phase F: Production Ready
- PostgreSQL migration (Neon production)
- Redis migration (Upstash production)
- Sentry error tracking
- Uptime monitoring
- CI/CD pipeline (GitHub Actions)
- Staging → Production promotion flow
- SSL certificates + CDN configuration

### Key Milestones

```
Current:    D-PREVIEW done, System Report → CMO review
Next:       D-PREVIEW-4 (19 items + Content role) → CMO feedback integration
Then:       Phase D (Admin real API) → Phase E (Storefront + Payments) → Phase F (Deploy)
```

---

## Appendix: API Endpoints Reference

### Auth (`/api/auth`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/register` | Public | Create user + seller |
| POST | `/login` | Public | Seller login |
| POST | `/admin-login` | Public | Admin login |
| POST | `/refresh` | Public | Refresh JWT |
| POST | `/logout` | Public | Revoke refresh token |
| GET | `/me` | JWT | Get current user |

### Products (`/api/products`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/` | JWT | List products (paginated) |
| GET | `/:id` | JWT | Product detail |
| GET | `/:id/variants` | JWT | Product variants |

### Product Assets (`/api/products/:productId/assets`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/media` | JWT | Media assets |
| GET | `/thumbnails` | JWT | Thumbnails |
| GET | `/adtexts` | JWT | Ad text assets |

### Orders (`/api/orders`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/` | JWT | List orders |
| GET | `/:id` | JWT | Order detail |
| GET | `/export` | JWT | CSV export |
| POST | `/import-tracking` | JWT | CSV import tracking |
| PATCH | `/bulk-status` | JWT | Bulk status update |
| GET | `/:id/transitions` | JWT | Valid status transitions |
| PATCH | `/:id/status` | JWT | Manual status change |

### Sellpages (`/api/sellpages`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | JWT | Create sellpage |
| GET | `/` | JWT | List sellpages |
| GET | `/check-domain` | JWT | Check domain availability |
| GET | `/:id` | JWT | Sellpage detail |
| GET | `/:id/linked-ads` | JWT | Linked ads with metrics |
| GET | `/:id/pixel` | JWT | Pixel assignment |
| PATCH | `/:id` | JWT | Update sellpage |
| POST | `/:id/publish` | JWT | Publish |
| POST | `/:id/unpublish` | JWT | Unpublish |
| POST | `/:id/verify-domain` | JWT | DNS verify (mock) |

### Campaigns (`/api/campaigns`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | JWT | Create campaign |
| GET | `/` | JWT | List campaigns |
| GET | `/:id` | JWT | Campaign detail |
| PATCH | `/:id` | JWT | Update campaign |
| POST | `/:id/launch` | JWT | Launch to Meta |
| PATCH | `/:id/pause` | JWT | Pause |
| PATCH | `/:id/resume` | JWT | Resume |
| PATCH | `/:id/budget` | JWT | Update budget |

### Adsets & Ads
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/campaigns/:cid/adsets` | JWT | Create adset |
| GET | `/campaigns/:cid/adsets` | JWT | List adsets |
| GET | `/adsets/:id` | JWT | Adset detail |
| PATCH | `/adsets/:id` | JWT | Update adset |
| PATCH | `/adsets/:id/pause` | JWT | Pause adset |
| PATCH | `/adsets/:id/resume` | JWT | Resume adset |
| POST | `/adsets/:asid/ads` | JWT | Create ad |
| GET | `/adsets/:asid/ads` | JWT | List ads |
| GET | `/ads/:id` | JWT | Ad detail |
| PATCH | `/ads/:id` | JWT | Update ad |
| PATCH | `/ads/:id/pause` | JWT | Pause ad |
| PATCH | `/ads/:id/resume` | JWT | Resume ad |
| POST | `/ads/:adId/ad-post` | JWT | Link AdPost |

### Ads Manager (`/api/ads-manager`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/campaigns` | JWT | Campaigns with metrics |
| GET | `/adsets` | JWT | Adsets with metrics |
| GET | `/ads` | JWT | Ads with metrics |
| GET | `/filters` | JWT | Filter options |
| PATCH | `/bulk-status` | JWT | Bulk pause/resume |
| PATCH | `/bulk-budget` | JWT | Bulk budget |
| POST | `/sync` | JWT | Sync from Meta |

### Creatives (`/api/creatives`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | JWT | Create creative |
| GET | `/` | JWT | List creatives |
| GET | `/:id` | JWT | Creative detail |
| PATCH | `/:id` | JWT | Update creative |
| POST | `/:id/assets` | JWT | Assign asset to slot |
| DELETE | `/:id/assets/:role` | JWT | Remove from slot |
| POST | `/:id/validate` | JWT | Validate (DRAFT→READY) |
| GET | `/:id/render` | JWT | Render payload |

### Assets (`/api/assets`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/signed-upload` | JWT | Get R2 upload URL |
| POST | `/` | JWT | Register asset |
| GET | `/` | JWT | List assets |
| GET | `/:id` | JWT | Asset detail |
| POST | `/ingest` | API Key | Internal ingest |

### FB Connections (`/api/fb/connections`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | JWT | Create connection |
| GET | `/` | JWT | List connections |
| GET | `/:id` | JWT | Connection detail |
| PATCH | `/:id` | JWT | Update connection |
| DELETE | `/:id` | JWT | Delete (soft) |

### Ad Strategies (`/api/fb/ad-strategies`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | JWT | Create strategy |
| GET | `/` | JWT | List strategies |
| GET | `/:id` | JWT | Strategy detail |
| PATCH | `/:id` | JWT | Update strategy |
| DELETE | `/:id` | JWT | Delete (soft) |

### Seller Profile & Settings
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/sellers/me` | JWT | Seller profile |
| PATCH | `/sellers/me` | JWT | Update profile |
| GET | `/sellers/me/settings` | JWT | Seller settings |
| PATCH | `/sellers/me/settings` | JWT | Update settings |

### Domains (`/api/domains`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | JWT | Register domain |
| GET | `/` | JWT | List domains |
| PATCH | `/:id` | JWT | Update domain |
| DELETE | `/:id` | JWT | Delete domain |
| POST | `/:id/verify` | JWT | Verify DNS |

### Meta OAuth (`/api/meta`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/auth-url` | JWT | Get OAuth URL |
| GET | `/callback` | Public | OAuth callback |

### Health (`/api/health`)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/` | Public | Health check |
