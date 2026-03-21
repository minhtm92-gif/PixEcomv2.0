# TASK-D-PREVIEW-1: Admin Portal UI — 20 Pages with Static Mock Data

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-23                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `4749b51`                                     |
| **Build**   | GREEN (35 routes, 0 TS errors)                |

---

## Summary

Built the entire Admin Portal UI as a static preview — 20 pages across 6 sections, all powered by a single mock data file with no API calls. The admin portal lives under the `admin/(dashboard)` route group, reusing all existing design system components (PageShell, KpiCard, DataTable, StatusBadge).

Scope:
- `mock/admin.ts` — comprehensive static dataset
- `AdminSidebar` — updated nav (7 items, removed Assets)
- **Dashboard** — KPI overview + revenue chart + top sellers + recent orders
- **Sellers** — list (tabs + search) · detail (5 tabs) · new seller form
- **Orders** — list (tabs + search) · detail (summary + customer + seller + payment + timeline)
- **Products** — filterable table with status tabs + search
- **Stores & Domains** — filterable table
- **Analytics** — KPI row + revenue bar chart + 4-tab breakdown
- **Settings Hub** — card grid linking to 10 sub-pages
- **10 Settings Sub-pages** — General, Payments, Email, Fulfillment, Discounts, Users, Legal, SMS, Billing & Plans, Apps & Integrations

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/mock/admin.ts` | **Created** | Full mock dataset: 6 sellers, 8 orders, 5 stores, 8 products, 4 discounts, 3 admin users, dashboard KPIs, analytics data |
| `apps/web/src/components/AdminSidebar.tsx` | **Modified** | Replaced Assets nav item; added Stores (Globe), Analytics (BarChart3), Settings (Settings) |
| `apps/web/src/app/admin/(dashboard)/dashboard/page.tsx` | **Modified** | Rewrote with 6 KpiCards, CSS bar chart, top sellers + recent orders grid |
| `apps/web/src/app/admin/(dashboard)/sellers/page.tsx` | **Created** | Sellers list: status tabs (All/Active/Pending/Deactivated/Rejected), search, DataTable with ROAS color coding |
| `apps/web/src/app/admin/(dashboard)/sellers/[id]/page.tsx` | **Created** | Seller detail: 5-tab layout (Profile & Payment, FB Connections, Stores, Products, Orders) |
| `apps/web/src/app/admin/(dashboard)/sellers/new/page.tsx` | **Created** | New seller form (preview-only, submit disabled) |
| `apps/web/src/app/admin/(dashboard)/orders/page.tsx` | **Created** | Orders list: status tabs, search, DataTable with row-click to detail |
| `apps/web/src/app/admin/(dashboard)/orders/[id]/page.tsx` | **Created** | Order detail: summary, customer, seller, payment cards + timeline |
| `apps/web/src/app/admin/(dashboard)/products/page.tsx` | **Created** | Products list: status tabs (All/Active/Draft/Archived), search |
| `apps/web/src/app/admin/(dashboard)/stores/page.tsx` | **Created** | Stores list: status tabs, search, default badge |
| `apps/web/src/app/admin/(dashboard)/analytics/page.tsx` | **Created** | 4 KPIs + bar chart + tabbed table (Overview/By Seller/By Product/By Domain) |
| `apps/web/src/app/admin/(dashboard)/settings/page.tsx` | **Created** | Settings hub: 4 groups × card grid with chevron links |
| `apps/web/src/app/admin/(dashboard)/settings/general/page.tsx` | **Created** | Platform name, timezone, language, currency, maintenance toggle |
| `apps/web/src/app/admin/(dashboard)/settings/payments/page.tsx` | **Created** | Stripe + PayPal config with masked keys, platform fee |
| `apps/web/src/app/admin/(dashboard)/settings/email/page.tsx` | **Created** | SMTP provider config + 6 email template status list |
| `apps/web/src/app/admin/(dashboard)/settings/fulfillment/page.tsx` | **Created** | Carrier toggles, processing times, warehouse, auto-fulfillment switches |
| `apps/web/src/app/admin/(dashboard)/settings/discounts/page.tsx` | **Created** | Discount codes DataTable + 3-stat summary bar |
| `apps/web/src/app/admin/(dashboard)/settings/users/page.tsx` | **Created** | Admin users DataTable + role summary (SUPERADMIN/SUPPORT/FINANCE counts) |
| `apps/web/src/app/admin/(dashboard)/settings/legal/page.tsx` | **Created** | Legal documents list with Published/Draft status badges |
| `apps/web/src/app/admin/(dashboard)/settings/sms/page.tsx` | **Created** | SMS provider config (Twilio) + template toggles |
| `apps/web/src/app/admin/(dashboard)/settings/billing/page.tsx` | **Created** | 3-tier pricing cards + fee config + recent invoices |
| `apps/web/src/app/admin/(dashboard)/settings/apps/page.tsx` | **Created** | Integration cards (FB, GA4, Shopify, Klaviyo, Zapier, Slack) + webhook endpoint list |

---

## Mock Data Structure (`mock/admin.ts`)

```typescript
// Interfaces
MockSeller        // id, name, email, phone, status, paymentGateway, stores, products, orders, revenue, roas, createdAt
MockAdminOrder    // id, orderNumber, sellerName, sellerId, customer, product, total, status, createdAt
MockStore         // id, sellerId, sellerName, domain, status, productCount, isDefault, createdAt
MockAdminProduct  // id, sellerId, sellerName, name, sku, price, status, variants, orders, revenue, createdAt
MockDiscount      // id, code, type, value, uses, limit, status, expiresAt
MockAdminUser     // id, name, email, role, status, lastLogin, createdAt

// Exports
MOCK_SELLERS          (6 entries: 3 ACTIVE, 1 PENDING, 1 DEACTIVATED, 1 REJECTED)
MOCK_ADMIN_ORDERS     (8 entries: all 6 statuses covered)
MOCK_STORES           (5 entries across 4 sellers)
MOCK_ADMIN_PRODUCTS   (8 entries: 5 ACTIVE, 1 DRAFT, 1 ARCHIVED, 1 more)
MOCK_DISCOUNTS        (4 entries: ACTIVE/EXPIRED/DISABLED)
MOCK_ADMIN_USERS      (3 entries: SUPERADMIN, SUPPORT, FINANCE)
DASHBOARD_KPIS        (activeSellers, pendingApprovals, totalOrders, totalRevenue, avgRoas, revenueByDay[7], topSellers[3])
ANALYTICS_DATA        (byDate[7], bySeller[4], byProduct[5], byDomain[4])
```

---

## Decisions & Technical Notes

### No-API Rule (Strict)

All admin pages are static previews. No `useEffect`, no `apiGet`, no loading states for data. Data flows:

```
mock/admin.ts → direct import → const data = MOCK_X.filter(...)
```

This allows the admin portal to be reviewed and tested without a running backend, and avoids polluting real seller data during design review.

### Shared Design System Components

Every page reuses the same components as the seller portal:

| Component | Usage |
|-----------|-------|
| `PageShell` | Title + subtitle + icon + optional actions button |
| `KpiCard` | label / value / icon / sub / loading |
| `DataTable<T>` | columns / data / loading / emptyMessage / onRowClick / rowKey |
| `StatusBadge` | status string → auto color (ACTIVE=green, PENDING=amber, INACTIVE/DEACTIVATED/REJECTED=red, etc.) |

### AdminSidebar Nav

```typescript
// Before
[Dashboard, Sellers, Products, Orders, Assets]

// After
[Dashboard, Sellers, Orders, Products, Stores, Analytics, Settings]
```

Assets removed (not an admin concern at this stage). Order changed to match expected workflow: sellers → orders → products → stores → analytics → settings.

### Revenue Bar Chart (CSS-Only)

Same pattern as seller dashboard — no charting library. Height is a percentage of the max value:

```tsx
const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
<div style={{ height: `${Math.max(heightPct, 4)}%` }}
     className="w-full bg-amber-500/70 hover:bg-amber-500 rounded-t transition-colors" />
```

### Seller Detail — 5-Tab Layout

```
Tab 1: Profile & Payment
  └── Left: Store profile form (name, email, phone, status, created)
  └── Right: Payment gateway assignment (Stripe Account ID / PayPal Email)

Tab 2: FB Connections
  └── Static table: 3 entries (Ad Account, Page, Pixel) with externalId

Tab 3: Stores
  └── DataTable filtered by seller.id — domain, status, productCount, isDefault, created

Tab 4: Products
  └── DataTable filtered by seller.name — name, SKU, price, status, variants, created

Tab 5: Orders
  └── DataTable filtered by sellerId — orderNumber, customer, product, total, status, date
```

### Order Timeline — Status-Aware

The timeline function generates steps dynamically based on the current status:

```typescript
function getTimeline(status: OrderStatus) {
  if (status === 'CANCELLED') return [placed(done), cancelled(done)];
  if (status === 'REFUNDED') return [placed(done), confirmed(done), refunded(done)];
  // default path: placed → confirmed → shipped → delivered
}
```

### Settings Hub — Card Grid Layout

4 groups rendered as labelled sections, each with a 2-column card grid. Cards use `Link` (not `button`) for navigation, with hover states:

```
hover:border-amber-500/40 hover:bg-muted/20
```

Chevron icon transitions `text-muted-foreground/40 → text-amber-400` on hover.

### Preview-Only Buttons

All action buttons (Save Changes, Create Seller, Add Discount, Invite Admin, etc.) are visually styled but non-functional:

```tsx
<button className="... opacity-60 cursor-default">
  Save Changes (Preview)
</button>
```

The `(Preview)` suffix and `cursor-default` make it clear to reviewers these are not wired up.

### Toggle Switch Pattern (CSS-only)

Settings pages use a pure CSS toggle that shows state visually without being interactive:

```tsx
<div className={`w-10 h-5 rounded-full border ${enabled ? 'bg-amber-500/20 border-amber-500/40' : 'bg-muted border-border'}`}>
  <div className={`absolute top-0.5 w-4 h-4 rounded-full ${enabled ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-muted-foreground/50'}`} />
</div>
```

---

## Build Fixes During Development

The sellers pages (list + detail) were created by a background agent using slightly wrong field names from `MockSeller` and `MockAdminOrder`. Three fixes applied before final build:

| File | Wrong Field | Correct Field |
|------|-------------|---------------|
| `sellers/page.tsx:69` | `r.storesCount` | `r.stores` |
| `sellers/page.tsx:70` | `r.productsCount` | `r.products` |
| `sellers/page.tsx:71` | `r.ordersCount` | `r.orders` |
| `sellers/[id]/page.tsx:56` | `r.productsCount` (MockStore) | `r.productCount` |
| `sellers/[id]/page.tsx:72` | `r.customerName` (MockAdminOrder) | `r.customer` |
| `sellers/[id]/page.tsx:73` | `r.productName` (MockAdminOrder) | `r.product` |

---

## Build Results

```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (35/35)
             35 routes total, 0 errors
```

### New Admin Routes (21 total incl. login)
```
○ /admin                         2.36 kB   93.6 kB   (login page)
○ /admin/analytics               2.96 kB   93.1 kB
○ /admin/dashboard               2.75 kB   92.9 kB
○ /admin/orders                  3.05 kB   93.2 kB
ƒ /admin/orders/[id]             2.96 kB   93.1 kB
○ /admin/products                2.91 kB   93.1 kB
○ /admin/sellers                 3.48 kB   93.6 kB
ƒ /admin/sellers/[id]            4.53 kB   94.7 kB
○ /admin/sellers/new             1.83 kB   89.1 kB
○ /admin/settings                2.48 kB   99.2 kB
○ /admin/settings/apps           2.42 kB   89.7 kB
○ /admin/settings/billing        3.04 kB   90.3 kB
○ /admin/settings/discounts      2.72 kB   92.9 kB
○ /admin/settings/email          2.04 kB   89.3 kB
○ /admin/settings/fulfillment    2.25 kB   89.5 kB
○ /admin/settings/general        2.07 kB   89.3 kB
○ /admin/settings/legal          1.99 kB   89.3 kB
○ /admin/settings/payments       1.89 kB   89.2 kB
○ /admin/settings/sms            2.03 kB   89.3 kB
○ /admin/settings/users          2.27 kB   92.4 kB
○ /admin/stores                  2.83 kB   93.0 kB
```

---

## Manual Verification Checklist

### Mock Data
- [x] `MOCK_SELLERS` — 6 entries covering all 4 statuses
- [x] `MOCK_ADMIN_ORDERS` — 8 entries covering all 6 statuses
- [x] `MOCK_STORES` — 5 entries with `isDefault` and `sellerId` FK
- [x] `MOCK_ADMIN_PRODUCTS` — 8 entries, 3 statuses
- [x] `MOCK_DISCOUNTS` — 4 entries (ACTIVE/EXPIRED/DISABLED)
- [x] `MOCK_ADMIN_USERS` — 3 entries (SUPERADMIN/SUPPORT/FINANCE)
- [x] `DASHBOARD_KPIS.revenueByDay` — 7 entries (last 7 days)
- [x] `ANALYTICS_DATA` — byDate, bySeller, byProduct, byDomain populated

### AdminSidebar
- [x] 7 nav items: Dashboard, Sellers, Orders, Products, Stores, Analytics, Settings
- [x] Assets removed
- [x] Active item highlighted amber

### Dashboard
- [x] 6 KpiCards render: Active Sellers, Pending Approval, Total Orders, Total Revenue, Avg ROAS, Revenue Today
- [x] Bar chart renders 7 bars (one per day)
- [x] Bar heights proportional to revenue
- [x] Top Sellers card: 3 entries with ROAS
- [x] Recent Orders card: first 5 orders with StatusBadge

### Sellers List
- [x] 5 tabs (All/Active/Pending/Deactivated/Rejected) with counts
- [x] Search filters by name and email
- [x] DataTable: name+email, status, payment badge, stores, products, orders, revenue, ROAS (colored), created
- [x] ROAS ≥3 = green, 2–3 = yellow, <2 = red
- [x] Row click navigates to `/admin/sellers/[id]`
- [x] "+ Add Seller" button links to `/admin/sellers/new`

### Seller Detail
- [x] Profile tab: store name, email, phone, status, created
- [x] Profile tab: payment gateway dropdown + conditional account ID / PayPal email
- [x] FB Connections tab: 3 static entries
- [x] Stores tab: filtered by sellerId
- [x] Products tab: filtered by sellerName
- [x] Orders tab: filtered by sellerId
- [x] "Seller not found" shown for unknown IDs

### Orders
- [x] List: 7 status tabs with counts
- [x] Detail: 4 cards (summary, customer, seller, payment)
- [x] Timeline: correct steps per status (cancelled = 2 steps, refunded = 3, delivered = 4)

### Products
- [x] 4 status tabs (All/Active/Draft/Archived) with counts
- [x] Search filters by name, SKU, seller
- [x] 8 columns rendered correctly

### Stores
- [x] 4 status tabs (All/Active/Pending/Inactive)
- [x] Default badge shown on isDefault stores
- [x] Search by domain and seller

### Analytics
- [x] 4 KPIs computed from `byDate` totals
- [x] Bar chart renders
- [x] Overview tab: table with date/revenue/orders/spend/ROAS
- [x] By Seller tab: DataTable
- [x] By Product tab: DataTable with CR
- [x] By Domain tab: DataTable with CR

### Settings Hub
- [x] 4 section groups rendered
- [x] Each card links to correct sub-page
- [x] Hover state: amber chevron, border highlight

### Settings Sub-pages
- [x] General: form fields populated with defaults
- [x] Payments: Stripe + PayPal sections with masked keys
- [x] Email: SMTP config + 6 template rows
- [x] Fulfillment: carrier toggles, processing times, auto switches
- [x] Discounts: DataTable with 4 codes + 3-stat summary
- [x] Users: DataTable with 3 users + role counts
- [x] Legal: 6 documents with Published/Draft badges
- [x] SMS: Twilio config + 5 template toggles
- [x] Billing: 3 pricing cards + current plan highlight + 3 invoices
- [x] Apps: 6 integration cards + 3 webhook entries
