# PixEcom v2 — Platform Instruction & Architecture Guide

> **Version**: 2.4.2-alpha | **Last updated**: 2026-03-02
> **Role**: CTO Documentation | **Audience**: PO, Dev Team, Partners

---

## 1. Platform Overview

**PixEcom** is a multi-tenant SaaS e-commerce platform that enables sellers to:

- Build storefronts & product landing pages (sellpages)
- Run Facebook/Instagram ad campaigns directly from the dashboard
- Process payments (Stripe + PayPal)
- Track orders, analytics, and ad performance (ROAS, CR, CPA)
- Manage creatives, reviews, discounts, and shipping

The platform is operated by a **Superadmin** who manages sellers, products, payment gateways, and platform settings.

### Production URLs

| Service | URL |
|---------|-----|
| Seller Portal | `https://pixecom.pixelxlab.com` |
| Admin Dashboard | `https://pixecom.pixelxlab.com/admin` |
| API | `https://api.pixelxlab.com/api` |
| CDN (Media) | `https://cdn.pixelxlab.com` |

---

## 2. Tech Stack

```
Frontend     Next.js 14 (App Router) + React 18 + Tailwind CSS
Backend      NestJS 10 + TypeScript
Database     PostgreSQL 16 + Prisma ORM (28 models)
Auth         JWT (15min) + Refresh Token rotation (7-day httpOnly cookie)
Storage      Cloudflare R2 (S3-compatible) → cdn.pixelxlab.com
Payments     Stripe (Card) + PayPal (REST API)
Ads          Meta Marketing API v22.0 (Facebook/Instagram)
Email        SendGrid (@sendgrid/mail)
Hosting      VPS (Ubuntu) + PM2 + Nginx + Docker (Postgres + Redis)
```

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET / CDN                             │
│  Cloudflare DNS + Proxy → cdn.pixelxlab.com (R2 Storage)           │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │                                  │
    ┌──────────▼──────────┐            ┌──────────▼──────────┐
    │   NGINX (Reverse)   │            │   NGINX (Reverse)   │
    │ pixecom.pixelxlab   │            │ api.pixelxlab.com   │
    │      :443 → :3000   │            │      :443 → :3001   │
    └──────────┬──────────┘            └──────────┬──────────┘
               │                                  │
    ┌──────────▼──────────┐            ┌──────────▼──────────┐
    │   Next.js 14 (Web)  │◄──────────►│   NestJS 10 (API)   │
    │   PM2 — port 3000   │  REST API  │   PM2 — port 3001   │
    │                     │            │                     │
    │ • Seller Portal     │            │ • Auth Module       │
    │ • Admin Dashboard   │            │ • Seller Module     │
    │ • Public Storefront │            │ • Products Module   │
    │ • Checkout Pages    │            │ • Sellpages Module  │
    └─────────────────────┘            │ • Storefront Module │
                                       │ • Orders Module     │
                                       │ • Campaigns Module  │
                                       │ • Meta Module       │
                                       │ • Ads Manager       │
                                       │ • Creatives Module  │
                                       │ • Admin Module      │
                                       │ • Email Module      │
                                       │ • Webhooks Module   │
                                       │ • Media Module      │
                                       └──────────┬──────────┘
                                                  │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                   ┌──────────▼───┐     ┌──────────▼───┐     ┌────────▼────────┐
                   │ PostgreSQL 16│     │    Redis      │     │  External APIs  │
                   │ Docker :5432 │     │ Docker :6379  │     │                 │
                   │              │     │ (BullMQ queue │     │ • Meta Graph    │
                   │ 28 Models    │     │  future use)  │     │ • Stripe        │
                   │ 7 Migrations │     └───────────────┘     │ • PayPal        │
                   └──────────────┘                           │ • SendGrid      │
                                                              │ • Cloudflare R2 │
                                                              └─────────────────┘
```

---

## 4. User Roles & Portals

### 4.1 Seller Portal (`/orders`, `/sellpages`, `/campaigns`, ...)

Seller login → JWT with `sellerId` → full access to own data only.

| Page | Description |
|------|-------------|
| **Orders** | View/filter orders, export CSV, import tracking, update status |
| **Products** | Browse platform product catalog (read-only) |
| **Sellpages** | Create/edit landing pages, publish/archive, SEO overrides |
| **Campaigns** | Create Meta ad campaigns, set budget/targeting, launch |
| **Ads Manager** | View campaign performance (spend, ROAS, CR, CTR), bulk actions |
| **Creatives** | Upload/manage ad assets (video, image, text, thumbnail) |
| **Analytics** | Aggregated metrics dashboard (revenue, orders, traffic) |
| **Settings** | Profile, Meta connection, payment gateways, timezone |

### 4.2 Admin Dashboard (`/admin/...`)

Superadmin login → JWT with `isSuperadmin: true` → platform-wide access.

| Page | Description |
|------|-------------|
| **Dashboard** | KPIs (total sellers, revenue, orders), trends, pending approvals |
| **Sellers** | CRUD sellers, approve/reject, reset password, assign gateways |
| **Products** | Manage product catalog + variants + pricing rules |
| **Orders** | Global order view across all sellers |
| **Stores** | Create storefronts, manage custom domains |
| **Analytics** | Revenue breakdown, top sellers, conversion funnels |
| **Settings** | Payment gateways, discounts, platform config |

### 4.3 Public Storefront (`/:store/:slug`)

No authentication required. Customer-facing pages.

| Page | Description |
|------|-------------|
| **Store Home** | List all published sellpages of a store |
| **Sellpage** | Product detail, variants, reviews, "Buy Now" CTA |
| **Checkout** | Address form, shipping, discount, Stripe/PayPal payment |
| **Tracking** | Order status timeline (by order number + email) |

---

## 5. Core Flows

### 5.1 Seller Onboarding

```
Register (email + password)
    │
    ▼
Auto-create: User + Seller + SellerUser(OWNER) + SellerSettings
    │
    ▼
Redirect → /orders (empty state)
    │
    ▼
Settings → Connect Meta Account (OAuth2)
    │         → FB Ad Accounts, Pages, Pixels imported
    ▼
Browse Products → Create Sellpage → Publish
    │
    ▼
Create Campaign → Set Budget/Targeting → Launch to Meta
    │
    ▼
Monitor in Ads Manager (spend, ROAS, CR)
```

### 5.2 Storefront & Checkout Flow

```
Customer clicks Facebook Ad (with UTM params)
    │
    ▼
┌─ SELLPAGE ─────────────────────────────────────┐
│  Product info, images/video, variants, reviews  │
│  Select variant + quantity → "Buy Now"          │
└────────────────────┬────────────────────────────┘
                     ▼
┌─ CHECKOUT ─────────────────────────────────────┐
│  1. Shipping address (+ optional billing)       │
│  2. Shipping method (Standard / Express)        │
│  3. Discount code (optional)                    │
│  4. Payment: Stripe Card or PayPal              │
│  5. Order summary → "Place Order"               │
└────────────────────┬────────────────────────────┘
                     ▼
┌─ BACKEND ──────────────────────────────────────┐
│  Validate items + stock                         │
│  Calculate: subtotal + shipping - discount      │
│  Create Order (PENDING) + OrderItems + Event    │
│  Initiate payment:                              │
│    Stripe → PaymentIntent (clientSecret)        │
│    PayPal → Create Order (approvalUrl)          │
└────────────────────┬────────────────────────────┘
                     ▼
┌─ PAYMENT ──────────────────────────────────────┐
│  Stripe: CardElement → confirmCardPayment()     │
│  PayPal: Approve button → capture on return     │
└────────────────────┬────────────────────────────┘
                     ▼
┌─ CONFIRM ──────────────────────────────────────┐
│  POST /checkout/:orderId/confirm                │
│  Verify payment succeeded                       │
│  Atomic: UPDATE WHERE status='PENDING'          │
│  Decrement stock per variant                    │
│  Send order confirmation email (SendGrid)       │
│  Return orderNumber to customer                 │
└────────────────────┬────────────────────────────┘
                     ▼
┌─ WEBHOOK (redundant safety net) ───────────────┐
│  Stripe: payment_intent.succeeded               │
│  PayPal: PAYMENT.CAPTURE.COMPLETED              │
│  Idempotent: skip if already CONFIRMED          │
└─────────────────────────────────────────────────┘
```

### 5.3 Order Lifecycle

```
  PENDING ──────► CONFIRMED ──────► PROCESSING ──────► SHIPPED ──────► DELIVERED
     │                │                  │                  │
     ▼                ▼                  ▼                  ▼
  CANCELLED       CANCELLED          CANCELLED          REFUNDED
                                                           │
                                                    DELIVERED ──► REFUNDED

Events logged at every transition (OrderEvent audit trail)
Email sent on: CONFIRMED (order confirmation), SHIPPED (tracking notification)
Stock: decremented on CONFIRMED, restored on REFUNDED
```

### 5.4 Ad Campaign Launch Flow

```
Seller → Create Campaign
    │
    ├── Name, Budget (Daily/Lifetime), Date range
    ├── Select Sellpage (destination URL)
    ├── Select Ad Account (from Meta connection)
    │
    ▼
Add Adsets (targeting groups)
    │
    ├── Audience: Location, Age, Gender
    ├── Optimization: OFFSITE_CONVERSIONS (Purchase)
    ├── Billing: IMPRESSIONS
    ├── Attribution: Click-through 1-day
    │
    ▼
Add Ads (per adset)
    │
    ├── Creative: Video/Image + Text + Headline + Description
    ├── CTA: SHOP_NOW → destination URL with UTM params
    │
    ▼
Click "Launch" → POST /campaigns/:id/launch
    │
    ▼
┌─ META API SEQUENCE ────────────────────────────┐
│                                                 │
│  1. POST /act_{id}/campaigns                    │
│     → Create Campaign on Meta                   │
│     → Get externalCampaignId                    │
│                                                 │
│  2. POST /act_{id}/adsets (per adset)           │
│     → targeting, optimization, promoted_object  │
│     → Get externalAdsetId                       │
│                                                 │
│  3. Upload video (if VIDEO_AD)                  │
│     POST /act_{id}/advideos                     │
│     → Get video_id                              │
│                                                 │
│  4. POST /act_{id}/adcreatives (per ad)         │
│     → object_story_spec with page_id            │
│     → video_data or link_data                   │
│     → call_to_action: SHOP_NOW + UTM URL        │
│                                                 │
│  5. POST /act_{id}/ads (per ad)                 │
│     → Link adset + creative                     │
│     → Get externalAdId                          │
│                                                 │
│  All external IDs saved to local DB             │
│  Campaign status → ACTIVE                       │
└─────────────────────────────────────────────────┘
```

### 5.5 UTM Tracking & Attribution

```
Ad destination URL structure:
  https://store.com/product-slug
    ?utm_source=facebook
    &utm_medium=paid
    &utm_campaign={campaignId}     ← PixEcom UUID
    &utm_term={adsetId}            ← PixEcom UUID
    &utm_content={adId}            ← PixEcom UUID

Flow:
  1. Customer clicks ad → lands on sellpage with UTM params
  2. Frontend passes UTM to checkout API
  3. Order stores: utm_source, utm_medium, utm_campaign, utm_term, utm_content
  4. Stats pipeline groups by campaign/adset/ad → AdStatsDaily
  5. Ads Manager shows ROAS = revenue / spend per entity
```

### 5.6 Stats & Analytics Pipeline

```
┌── Data Sources ──┐     ┌── Aggregation ──┐     ┌── Display ──────────┐
│                   │     │                  │     │                     │
│ Meta Graph API    │────►│ AdStatsRaw       │────►│ Ads Manager         │
│ (impressions,     │     │ (per-day raw)    │     │ (Campaign/Adset/Ad) │
│  spend, clicks)   │     │                  │     │                     │
│                   │     │ AdStatsDaily     │     │ Metrics:            │
│ Checkout events   │────►│ (aggregated)     │────►│ • Spend, ROAS       │
│ (contentView,     │     │                  │     │ • CR1, CR2, CR      │
│  checkout,        │     │ SellpageStats    │     │ • CTR, CPC, CPM     │
│  purchase)        │     │ Daily            │     │ • CPA               │
└───────────────────┘     └──────────────────┘     └─────────────────────┘

Metrics Contract (FROZEN):
  CR  = purchase / contentView × 100
  CR1 = checkout / contentView × 100
  CR2 = purchase / checkout × 100
  ROAS = revenue / spend
  Rule: NEVER average ratios — SUM raw counts first, then derive
```

---

## 6. Data Model Overview (28 Prisma Models)

### Auth & Users
```
User ──────────► RefreshToken (1:N)
  │
  ▼
SellerUser ◄───► Seller (N:M via SellerUser)
                   │
                   ├──► SellerSettings (1:1)
                   ├──► SellerDomain (1:N)
                   ├──► PaymentGateway (PayPal FK + CreditCard FK)
                   │
                   └──► [All seller-scoped entities below]
```

### Products & Storefront
```
Product ──────► ProductVariant (1:N)
  │              (sku, priceOverride, stockQuantity)
  │
  ├──► ProductLabel (N:M via ProductProductLabel)
  ├──► PricingRule (1:N)
  ├──► Review (1:N)
  │
  ▼
Sellpage ─────► Seller (belongs to)
  │              (slug, sections, SEO, discounts, boostModules)
  │
  ├──► Order (1:N)
  ├──► Campaign (1:N)
  └──► Discount (1:N, scoped)
```

### Ads & Campaigns
```
FbConnection ──► Seller (belongs to)
  │              (AD_ACCOUNT / PAGE / PIXEL / CONVERSION)
  │              (accessTokenEnc = AES-256 encrypted)
  │
  ▼
Campaign ─────► Adset (1:N)
  │               │
  │               ▼
  │             Ad (1:N per adset)
  │               │
  │               ▼
  │             AdPost (1:1 per ad)
  │               (creativeConfig, pageId, media assets)
  │
  ├──► CampaignCreative (N:M with Creative)
  ├──► AdStatsDaily (1:N per entity)
  └──► externalCampaignId (Meta sync)

Creative ─────► CreativeAsset (1:N)
  │               │
  │               ▼
  │             Asset (media file)
  │               (url, mediaType, dimensions, duration)
  │
  └──► Types: VIDEO_AD, IMAGE_AD, TEXT_ONLY, UGC_BUNDLE
```

### Orders & Commerce
```
Order ────────► OrderItem (1:N)
  │               (productId, variantId, qty, unitPrice, lineTotal)
  │
  ├──► OrderEvent (1:N, audit trail)
  │      (CREATED → CONFIRMED → PROCESSING → SHIPPED → DELIVERED)
  │
  ├──► UTM fields (utm_source, utm_campaign, ...)
  ├──► Payment (paymentMethod, paymentId, paidAt)
  ├──► Shipping (trackingNumber, trackingUrl)
  └──► Addresses (shippingAddress, billingAddress as JSON)
```

### Admin
```
PaymentGateway ─ (stripe / paypal / airwallex / tazapay)
Discount ─────── (code, PERCENT/FIXED, usageLimit, sellpage-scoped)
PlatformSettings (singleton: platformName, SMTP, legal, billing)
```

---

## 7. External Integrations

### 7.1 Meta / Facebook

| Feature | Detail |
|---------|--------|
| **OAuth2** | Seller connects → FB login → callback stores encrypted token |
| **Graph API** | v22.0 — Campaign/Adset/Ad creation, status sync |
| **Token storage** | AES-256-GCM encrypted at rest in FbConnection.accessTokenEnc |
| **Scopes** | `ads_management`, `ads_read`, `pages_read_engagement` |
| **Rate limiting** | Retry on 5xx with backoff (1s, 2s, 4s) |
| **Error mapping** | Code 190 → 401 (token expired), Code 17 → 429 (rate limit) |

### 7.2 Stripe

| Feature | Detail |
|---------|--------|
| **PaymentIntent** | Created at checkout with amount in cents + order metadata |
| **CardElement** | Client-side card capture (PCI-compliant, no server exposure) |
| **Webhook** | `payment_intent.succeeded` + `charge.refunded` |
| **Verification** | HMAC-SHA256 webhook signature with STRIPE_WEBHOOK_SECRET |

### 7.3 PayPal

| Feature | Detail |
|---------|--------|
| **REST API** | Server-side order creation + capture |
| **Buttons** | Client-side PayPal smart buttons |
| **Webhook** | `PAYMENT.CAPTURE.COMPLETED` + `REFUNDED` + `REVERSED` |
| **Verification** | PayPal API webhook signature verification |

### 7.4 SendGrid

| Feature | Detail |
|---------|--------|
| **Order confirmation** | HTML template: items table, totals, address, "Track Order" CTA |
| **Shipping notification** | HTML template: tracking number, carrier link, items |
| **Pattern** | Fire-and-forget (`.catch()` never blocks order flow) |

### 7.5 Cloudflare R2

| Feature | Detail |
|---------|--------|
| **Upload** | Presigned PUT URLs for client-side direct upload |
| **CDN** | `https://cdn.pixelxlab.com/` for asset delivery |
| **SDK** | AWS S3 SDK with R2 endpoint |

---

## 8. Security

### Authentication
- **Access token**: JWT, 15-minute TTL, contains `{ sub, sellerId, role, isSuperadmin }`
- **Refresh token**: Hashed (HMAC-SHA256), 7-day TTL, httpOnly cookie, rotated on each refresh
- **Password**: bcrypt hash (cost=12)

### Tenant Isolation
- **sellerId** always extracted from JWT, **never** from request params
- All seller queries include `WHERE sellerId = $1`
- Admin endpoints require `isSuperadmin = true`

### Data Protection
- Meta tokens encrypted at rest (AES-256-GCM)
- Refresh tokens hashed (irreversible)
- Payment card data never touches server (Stripe Elements / PayPal buttons)
- CORS restricted to `pixecom.pixelxlab.com` (prod)

### Race Condition Prevention
- Atomic `updateMany WHERE status = 'PENDING'` prevents double-confirm between client + webhook
- Stock decrement in same transaction as order confirmation
- Discount usage increment in order creation transaction

---

## 9. API Modules Summary

| # | Module | Endpoints | Description |
|---|--------|-----------|-------------|
| 1 | **Auth** | 5 | Register, login, refresh, logout, me |
| 2 | **Seller** | 3 | Profile, settings, update |
| 3 | **Products** | 3 | Catalog browse (platform-level) |
| 4 | **Sellpages** | ~8 | CRUD, publish/archive, SEO |
| 5 | **Storefront** | 8 | Public: store, sellpage, checkout, tracking, reviews |
| 6 | **Webhooks** | 2 | Stripe + PayPal payment confirmation |
| 7 | **Campaigns** | 7 | CRUD, batch create, launch, pause, resume |
| 8 | **Ad-Units** | ~6 | Adset + Ad CRUD |
| 9 | **Ads Manager** | 6 | Stats read, sync, bulk status, bulk budget |
| 10 | **Meta** | 5 | OAuth, callback, connections CRUD |
| 11 | **Creatives** | 6 | Creative bundles, asset linking, validation |
| 12 | **Orders** | 6 | List, detail, update, export CSV, import tracking |
| 13 | **Admin** | ~30 | Dashboard, sellers, products, orders, stores, analytics, settings |
| 14 | **Email** | — | SendGrid (internal service, no public endpoints) |
| 15 | **Media** | 2 | Presigned upload URL, CDN URL generation |
| 16 | **Domains** | ~4 | Custom domain verification (TXT/A record) |
| 17 | **Health** | 1 | `GET /api/health` → `{ status: "ok" }` |

**Total**: ~22 modules, ~30 controllers, ~150+ endpoints

---

## 10. Deployment

### Infrastructure
```
VPS (Ubuntu) — 143.198.24.81
├── Docker
│   ├── PostgreSQL 16  (localhost:5432)
│   └── Redis          (localhost:6379)
├── PM2
│   ├── pixecom-api    (port 3001, NestJS)
│   └── pixecom-web    (port 3000, Next.js)
├── Nginx
│   ├── api.pixelxlab.com  → :3001
│   └── pixecom.pixelxlab.com → :3000
└── Cloudflare (DNS + Proxy + R2 Storage)
```

### PM2 Commands
```bash
pm2 list                    # Status of all processes
pm2 logs pixecom-api        # API logs
pm2 logs pixecom-web        # Web logs
pm2 restart all             # Restart both
pm2 restart pixecom-api     # Restart API only
```

### Deploy Workflow
```bash
# 1. Pull code
cd /opt/pixecom-v2 && git pull

# 2. Install deps
pnpm install

# 3. Run migrations (if schema changed)
cd packages/database && npx prisma migrate deploy

# 4. Build
cd apps/api && pnpm build        # tsc
cd apps/web && pnpm build        # next build

# 5. Restart
pm2 restart all
```

---

## 11. Key Conventions

### Naming
- **Database**: PascalCase models, camelCase fields
- **API routes**: kebab-case (`/ads-manager/bulk-status`)
- **Components**: PascalCase (`PageShell.tsx`, `DataTable.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAdminApi`)

### Patterns
- **Prisma JSON**: Cast `as unknown[]` or `as Record<string, unknown>`
- **Decimal → number**: `Number(prismaDecimal)` for computations
- **Cursor pagination**: Base64-encoded `createdAt|id` for keyset
- **Seller scoping**: Always from JWT `CurrentUser` decorator, never URL params
- **Idempotent ops**: `WHERE status = 'PENDING'` atomic checks
- **Fire-and-forget email**: `.catch()` wrapper, never blocks response

### Responsive Design
- **Breakpoint**: `md:` (768px) — mobile ↔ desktop
- **Mobile nav**: Hamburger → MobileDrawer (slide-from-left)
- **Tables**: `overflow-x-auto` + `min-w-[600px] md:min-w-0` for horizontal scroll on mobile
- **Layout**: `flex-1 min-w-0` on `<main>` to contain table overflow

---

*Document generated by CTO — PixEcom v2*
