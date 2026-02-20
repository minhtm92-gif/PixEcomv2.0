# PixEcom Seller Portal — UI Preview Checklist (Phase 0)

> Generated: 2026-02-19 | Status: **Analysis complete — awaiting "Start Preview Build"**
> Stack: Next.js 14.2 · React 18.3 · Tailwind 3.4 · No backend wiring

---

## 1. Decision: Stay on Current Stack

| Layer | Current (`apps/web`) | Metronic Concepts | Our Choice |
|-------|---------------------|-------------------|------------|
| Next.js | 14.2 | 16.1 | **14.2 (keep)** |
| React | 18.3 | 19.2 | **18.3 (keep)** |
| Tailwind | 3.4 | 4.1 | **3.4 (keep)** |
| UI base | (none) | shadcn/Radix/CVA | **Hand-write 15 simplified components** |

**Rationale**: Preview is style/UX validation only. Porting simplified Metronic components to TW3 is faster & safer than upgrading the monorepo.

---

## 2. Components to Build (from Metronic Reference)

| # | Component | Metronic Source | What We Take |
|---|-----------|----------------|-------------|
| 1 | `Button` | `button.tsx` (CVA, 9 variants) | Variants: primary, outline, ghost, mono, destructive. Sizes: sm, md, lg, icon |
| 2 | `Badge` | `badge.tsx` (CVA, 7 variants) | Variants: primary, success, warning, destructive, secondary, outline. Sizes: sm, md |
| 3 | `Card` | `card.tsx` (context-based) | Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription, CardToolbar |
| 4 | `Table` | `table.tsx` | Table, TableHeader, TableBody, TableRow, TableHead, TableCell — dense h-10 rows |
| 5 | `Input` | `input.tsx` (CVA) | Sizes: sm, md, lg. Dark bg, border-input, focus ring |
| 6 | `Select` | `select.tsx` (Radix) | Simplified native-based: SelectTrigger, SelectContent, SelectItem |
| 7 | `Sheet` | `sheet.tsx` (Radix Dialog) | Right-side drawer, 480px, overlay blur, close button, slide animation |
| 8 | `Tabs` | `tabs.tsx` (Radix) | Line variant for page tabs: TabsList, TabsTrigger, TabsContent |
| 9 | `Skeleton` | `skeleton.tsx` | `animate-pulse rounded-md bg-accent` |
| 10 | `Separator` | `separator.tsx` (Radix) | `h-px w-full bg-border` |
| 11 | `ScrollArea` | `scroll-area.tsx` (Radix) | Thin scrollbar for sidebar |
| 12 | `Avatar` | `avatar.tsx` (Radix) | Fallback initials, round, status indicator |
| 13 | `DropdownMenu` | `dropdown-menu.tsx` | User menu, row action menus |
| 14 | `Tooltip` | Native CSS | Simplified hover tooltip |
| 15 | `Popover` | `popover.tsx` | For date range filter on Orders page |

### Shared Components (custom)

| Component | Purpose |
|-----------|---------|
| `KpiCard` | Dashboard metric card: icon + value + label + delta% |
| `StatusBadge` | Pre-mapped status → color badge (ACTIVE=green, DRAFT=yellow, etc.) |
| `EmptyState` | Centered icon + title + subtitle + CTA button |
| `PageHeader` | Page title + subtitle + action buttons row |
| `FilterBar` | Inline filter row: search input + select filters + action button |

---

## 3. Layout Architecture

```
<html class="dark">
<body class="demo1 sidebar-fixed header-fixed">
  ┌─────────────────────────────────────────────────────┐
  │ Sidebar (280px / 80px collapsed)                    │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ SidebarHeader: Logo + collapse toggle (70px)    │ │
  │ ├─────────────────────────────────────────────────┤ │
  │ │ SidebarMenu: ScrollArea + nav items             │ │
  │ │   Dashboard                                      │ │
  │ │   ── ADS MANAGER ──                             │ │
  │ │   Campaigns                                      │ │
  │ │   ── COMMERCE ──                                │ │
  │ │   Sellpages                                      │ │
  │ │   Orders                                         │ │
  │ │   ── CONTENT ──                                 │ │
  │ │   Products                                       │ │
  │ │   Assets                                         │ │
  │ │   Creatives                                      │ │
  │ │   ── SETTINGS ──                                │ │
  │ │   Settings                                       │ │
  │ └─────────────────────────────────────────────────┘ │
  ├─────────────────────────────────────────────────────┤
  │ Wrapper                                             │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ Header (70px fixed): breadcrumb + search + user │ │
  │ ├─────────────────────────────────────────────────┤ │
  │ │ <main> Page content                             │ │
  │ ├─────────────────────────────────────────────────┤ │
  │ │ Footer: © PixEcom                               │ │
  │ └─────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────┘
</body>
</html>
```

**CSS Variables** (from Metronic demo1.css):
```css
--sidebar-width: 280px;
--sidebar-width-collapse: 80px;
--sidebar-default-width: 280px;
--header-height: 70px;
--sidebar-transition-duration: 0.3s;
```

---

## 4. Dark Theme Tokens (Tailwind 3 Config)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0c0c14` | Page background (bluer-black) |
| `card` | `#12121e` | Card/surface background |
| `card-foreground` | `#e8e8f0` | Card text (cool white) |
| `border` | `#1e1e2e` | All borders (soft) |
| `input` | `#1e1e2e` | Input borders (same as border) |
| `muted` | `#16162a` | Deep muted surfaces |
| `muted-foreground` | `#6b6b8a` | Secondary text (lavender-gray) |
| `foreground` | `#e8e8f0` | Primary text |
| `primary` | `#6366f1` | **Indigo — Pixelxlab signature** |
| `primary-foreground` | `#ffffff` | Text on primary |
| `secondary` | `#1e1e2e` | Secondary surfaces |
| `secondary-foreground` | `#a1a1b5` | Secondary text |
| `accent` | `#1a1a32` | Hover/active backgrounds |
| `accent-foreground` | `#e8e8f0` | Accent text |
| `destructive` | `#ef4444` | Error/delete |
| `destructive-foreground` | `#ffffff` | Text on destructive |
| `ring` | `#6366f1` | Focus rings (matches primary) |
| `success` | `#22c55e` | Active/positive states |
| `warning` | `#f59e0b` | Draft/caution states |

---

## 5. Page-by-Page Plan

### Page 1: `/login` (static)
- Full-screen dark page, vertically centered
- Card shell: PixEcom logo + "Sign in to your account"
- Fields: email input, password input
- Button: "Sign In" → navigates to `/dashboard` (no auth)
- **Components**: Card, Input, Button

### Page 2: `/dashboard`
- **Row 1**: 4 × KpiCard (Revenue $12,450 ↑12.5%, Spend $3,200 ↓3.2%, Orders 187 ↑8.1%, ROAS 3.89 ↑0.4)
- **Row 2**: Area chart placeholder (static SVG or empty card) + "Top Sellpages" mini-table (5 rows)
- **Row 3**: "Recent Orders" mini-table (5 rows)
- **Components**: Card, KpiCard, Table, Badge, Skeleton

### Page 3: `/products`
- **Header**: "Product Catalog" + subtitle "Browse platform products"
- **Filter bar**: search input + label filter dropdown
- **Grid**: 3-col responsive grid of product cards
- Each card: 16:9 thumbnail, name, `$59.99` price, `You Take: $25.00`, label badges
- **12 mock products**
- **Components**: Card, Badge, Input, Select, Skeleton

### Page 4: `/sellpages`
- **Header**: "Sellpages" + "12 total" + [+ New Sellpage] button
- **Filter bar**: search + status dropdown (All/DRAFT/PUBLISHED/ARCHIVED)
- **Dense table columns**: Slug, Product, Status, Domain, Created
- **Status badges**: green=PUBLISHED, yellow=DRAFT, gray=ARCHIVED
- **12 mock rows**
- **Components**: Table, Badge, Button, Input, Select, PageHeader

### Page 5: `/orders` ⭐ (most complex)
- **Header**: "Orders" + "12 found" + [Export] button
- **Filter bar**: search + status dropdown + date range display + export
- **Dense table columns**: Order#, Customer, Status, Total, Items, Date
- **Row click → Right Sheet drawer** (480px):
  - Order header: number + status badge + date
  - Separator
  - Customer info block: name, email, phone
  - Separator
  - Line items mini-table: product, variant, qty, price, total
  - Separator
  - Event timeline: vertical list of OrderEvents
- **Status badges**: green=DELIVERED, blue=CONFIRMED, yellow=PROCESSING, orange=SHIPPED, red=CANCELLED, gray=PENDING
- **12 mock rows**
- **Components**: Table, Badge, Sheet, Button, Input, Select, Separator, PageHeader

### Page 6: `/assets`
- **Header**: "Asset Registry" + "12 assets" + [Upload] button
- **Filter bar**: search + mediaType dropdown (All/VIDEO/IMAGE/TEXT)
- **Dense table columns**: Preview (40×40), Type, Source, Dimensions, Size, Date
- Preview column: rounded thumbnail for images, play icon overlay for video, text icon for text
- **12 mock rows**
- **Components**: Table, Badge, Button, Avatar, Input, Select

### Page 7: `/creatives`
- **Header**: "Creatives" + "10 bundles" + [+ New Creative] button
- **Dense table columns**: Name, Type, Status, Product, Slots Filled, Date
- **Row click → Right Sheet drawer** (520px):
  - Creative header: name + type badge + status badge
  - Separator
  - Slot grid (2 columns):
    - PRIMARY_VIDEO: asset preview or "Empty" placeholder
    - THUMBNAIL: asset preview or "Empty"
    - PRIMARY_TEXT: text preview or "Empty"
    - HEADLINE: text preview or "Empty"
    - DESCRIPTION: text preview or "Empty"
  - Separator
  - "Render Preview" section: compiled ad preview card
- **Status badges**: green=READY, yellow=DRAFT, gray=ARCHIVED
- **10 mock rows**
- **Components**: Table, Badge, Sheet, Card, Skeleton, Separator

### Page 8: `/ads-manager`
- **Header**: "Ads Manager" + "10 campaigns" + [+ New Campaign] button
- **KPI summary row**: 4 mini-cards (Total Spend, Avg ROAS, Total Purchases, Avg CPP)
- **Filter bar**: search + status dropdown (All/ACTIVE/PAUSED/ARCHIVED)
- **Dense table columns**: Campaign, Sellpage, Status, Budget, Spend, Impressions, Clicks, Purchases, ROAS, CPP
- Metric columns: **right-aligned, tabular-nums** (monospace numbers)
- **Tabs below table** (on row select): Overview | Adsets | Ads (placeholder content)
- **10 mock campaigns**
- **Components**: Table, Badge, Tabs, Card, KpiCard, Button, Input, Select

---

## 6. Mock Data Files

```
src/mock/
├── types.ts           ← TypeScript interfaces matching backend DTOs
├── dashboard.ts       ← KPI stats, top 5 sellpages, recent 5 orders
├── products.ts        ← 12 products (ProductCardDto shape)
├── sellpages.ts       ← 12 sellpages (SellpageDto shape)
├── orders.ts          ← 12 orders (Order + OrderItem[] + OrderEvent[])
├── assets.ts          ← 12 assets (Asset registry shape)
├── creatives.ts       ← 10 creatives (Creative + CreativeAsset[])
└── campaigns.ts       ← 10 campaigns (Campaign + AdStatsDaily shape)
```

All mock shapes match **exact backend response DTOs** documented in `FRONTEND-ARCHITECTURE-PLAN.md`.

---

## 7. File Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx                 ← Root: <html class="dark">, Inter font
│   ├── page.tsx                   ← Redirect to /dashboard
│   ├── globals.css                ← TW3 base + dark tokens + demo1 layout CSS
│   ├── login/
│   │   └── page.tsx
│   └── (portal)/                  ← Route group (sidebar+header shell)
│       ├── layout.tsx             ← Sidebar + Header + Footer wrapper
│       ├── dashboard/
│       │   └── page.tsx
│       ├── products/
│       │   └── page.tsx
│       ├── sellpages/
│       │   └── page.tsx
│       ├── orders/
│       │   └── page.tsx
│       ├── assets/
│       │   └── page.tsx
│       ├── creatives/
│       │   └── page.tsx
│       └── ads-manager/
│           └── page.tsx
├── components/
│   ├── ui/                        ← 15 simplified Metronic components
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   ├── tabs.tsx
│   │   ├── skeleton.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── avatar.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tooltip.tsx
│   │   └── popover.tsx
│   ├── layout/                    ← App shell components
│   │   ├── sidebar.tsx
│   │   ├── sidebar-menu.tsx
│   │   ├── header.tsx
│   │   └── footer.tsx
│   └── shared/                    ← Reusable page-level components
│       ├── kpi-card.tsx
│       ├── status-badge.tsx
│       ├── empty-state.tsx
│       ├── page-header.tsx
│       └── filter-bar.tsx
├── lib/
│   ├── utils.ts                   ← cn() function (clsx + tailwind-merge)
│   └── helpers.ts                 ← formatDate, formatCurrency, timeAgo, etc.
├── hooks/
│   ├── use-mobile.ts              ← Breakpoint detection (< 1024px)
│   └── use-scroll-position.ts     ← Header sticky behavior
└── mock/
    ├── types.ts
    ├── dashboard.ts
    ├── products.ts
    ├── sellpages.ts
    ├── orders.ts
    ├── assets.ts
    ├── creatives.ts
    └── campaigns.ts
```

---

## 8. Commit Plan

| # | Commit Message | Content | Pages |
|---|---------------|---------|-------|
| 1 | `feat(web): layout shell + dark theme + UI components + login` | globals.css, tailwind.config, all 15 UI components, shared components, layout (sidebar/header/footer), hooks, lib/utils, login page | `/login` |
| 2 | `feat(web): products catalog + sellpages table` | Products grid page, sellpages table page, mock data (products.ts, sellpages.ts, types.ts) | `/products`, `/sellpages` |
| 3 | `feat(web): orders table + detail drawer` | Orders table page with filter bar, right-side sheet drawer with order detail, mock data (orders.ts) | `/orders` |
| 4 | `feat(web): assets registry + creatives table + render preview` | Assets table page, creatives table with sheet drawer, mock data (assets.ts, creatives.ts) | `/assets`, `/creatives` |
| 5 | `feat(web): ads manager + dashboard KPI polish` | Ads manager campaign table, dashboard with KPI cards + charts + mini-tables, mock data (campaigns.ts, dashboard.ts) | `/ads-manager`, `/dashboard` |

**Each commit is pushed to GitHub immediately after completion.**

---

## 9. UI Rules Checklist

### Layout
- [ ] Sidebar: 280px dark background, collapsible to 80px, active item highlighted with primary color
- [ ] Header: 70px fixed top, breadcrumb left, search + user avatar right
- [ ] Footer: simple copyright bar
- [ ] Dark-only: `<html class="dark">` hardcoded, **no light/dark toggle**
- [ ] Font: Inter (Google Fonts), antialiased

### Tables
- [ ] Dense rows: `h-10` (40px), `text-[13px]`
- [ ] Header: `text-muted-foreground`, `font-normal`, `text-xs`, uppercase
- [ ] Row hover: `bg-muted/50` highlight
- [ ] Clickable rows: `cursor-pointer` where applicable
- [ ] Numeric columns: `text-right`, `tabular-nums` (monospace numbers)

### Badges
- [ ] Pill shape: `rounded-md`, small padding
- [ ] Semantic colors:
  - Green (`success`): ACTIVE, PUBLISHED, DELIVERED, READY, VERIFIED
  - Yellow (`warning`): DRAFT, PROCESSING, PENDING (domain)
  - Red (`destructive`): CANCELLED, REFUNDED, PAUSED, FAILED
  - Blue (`primary`): CONFIRMED
  - Orange (`warning`): SHIPPED
  - Gray (`secondary`): ARCHIVED, PENDING (order)

### Cards
- [ ] Border: `border border-border`, `rounded-xl`
- [ ] Background: `bg-card`
- [ ] Header: `border-b border-border`, 56px min-height
- [ ] Padding: `p-5` content, `px-5` header

### KPI Cards
- [ ] Icon (muted) + value (text-2xl font-bold) + label (text-sm muted) + delta% (green ↑ / red ↓)
- [ ] Card shell with border

### Filter Bars
- [ ] Inline horizontal: `flex items-center gap-2.5`
- [ ] Search: input with search icon
- [ ] Dropdowns: styled select
- [ ] Action button: primary variant, right-aligned

### Drawers (Sheet)
- [ ] Right-side slide, **480px width** (520px for creatives)
- [ ] Overlay: `bg-black/30 backdrop-blur-[4px]`
- [ ] Close button: X icon, top-right
- [ ] Slide animation: 300ms out, 400ms in

### States
- [ ] **Empty state**: centered layout with icon (48px, muted), title (text-lg), subtitle (text-sm muted), CTA button
- [ ] **Loading state**: skeleton placeholders matching content shape (cards, table rows, text blocks)
- [ ] **Hover state**: subtle bg change on interactive elements

### Typography
- [ ] Page title: `text-xl font-bold text-foreground`
- [ ] Page subtitle: `text-sm text-muted-foreground`
- [ ] Table text: `text-[13px]` body, `text-xs` headers
- [ ] Card title: `text-base font-semibold`

### Spacing
- [ ] Section gap: `gap-5 lg:gap-7.5` (20px / 30px)
- [ ] Card content padding: `p-5` (20px)
- [ ] Filter item gap: `gap-2.5` (10px)
- [ ] Page container: `container-fluid` with `px-4 lg:px-10`

### Color
- [ ] Primary actions: indigo `#6366f1`
- [ ] Positive metrics: green `#22c55e`
- [ ] Negative metrics: red `#ef4444`
- [ ] Neutral metrics: muted-foreground `#6b6b8a`
- [ ] Borders: `#1e1e2e` (subtle, low contrast)

---

## 10. Dependencies to Install

```bash
# New dependencies for apps/web
pnpm --filter @pixecom/web add clsx tailwind-merge class-variance-authority lucide-react
```

No Radix primitives needed — we'll build simplified versions for the preview.

---

## 11. What to Show Internal Sellers for Feedback

1. **Navigation flow**: Click through all 8 sidebar items — is the grouping intuitive?
2. **Dashboard KPIs**: Are these the right 4 metrics? Is the layout scannable?
3. **Campaign table**: Is the column set right? Is density comfortable?
4. **Order detail drawer**: Does slide-over feel natural? Is the info layout useful?
5. **Product catalog grid**: Is card layout clear? Is "You Take" estimate prominent enough?
6. **Sellpage table**: Is status-first scanning efficient?
7. **Creative slot preview**: Is the slot-based layout understandable?
8. **Overall dark theme**: Does it feel "premium"? Is contrast sufficient for long sessions?

---

## 12. Run Instructions (After Build)

```bash
cd D:\Pixel Team\NEW-PixEcom\pixecom-v2

# Install new dependencies
pnpm install

# Start frontend only
pnpm --filter @pixecom/web dev

# Open browser
# http://localhost:3000/login
```

---

*Phase 0 Analysis by Frontend Architecture Agent*
*Next step: Reply "Start Preview Build" → Commit 1 begins*
