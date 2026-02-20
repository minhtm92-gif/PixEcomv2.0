# PixEcom Seller Portal — Frontend Preview v1

> **Branch:** `feature/2.3.4d-orders-read-layer`
> **Stack:** Next.js 14.2 · React 18.3 · Tailwind 3.4 · TypeScript 5.4
> **Theme:** Dark-only (Pixelxlab tokens) · Metronic v9.4.2 layout patterns
> **Build date:** Feb 2025 · 5 commits · 59 files · +5,553 lines

---

## 1. Commit Log

| # | SHA | Files | +Lines | Scope |
|---|-----|-------|--------|-------|
| 1 | `d798283` | 41 | 2,140 | Layout shell + dark theme + UI components + login |
| 2 | `f576a23` | 7 | 1,033 | Products catalog grid + Sellpages table |
| 3 | `6249ce2` | 3 | 723 | Orders table + detail drawer |
| 4 | `5d6d185` | 4 | 906 | Assets registry + Creatives + preview drawer |
| 5 | `dd7fa9c` | 4 | 751 | Ads Manager campaigns + Dashboard KPI polish |

---

## 2. Route Map & Bundle Sizes

| Route | Page Size | First Load JS | Description |
|-------|-----------|---------------|-------------|
| `/login` | 2.15 kB | 97.7 kB | Card form · email/password · navigates to /dashboard |
| `/dashboard` | 5.77 kB | 101 kB | 4 KPI cards · CSS bar chart · top sellpages · recent orders |
| `/products` | 3.13 kB | 102 kB | Filterable card grid · status/label filters · pricing display |
| `/sellpages` | 4.69 kB | 104 kB | Dense table · URL copy · revenue stats · type badges |
| `/orders` | 6.32 kB | 105 kB | Table + Sheet drawer · timeline · totals · shipping |
| `/assets` | 4.36 kB | 103 kB | Grid/list toggle · type filter · dimension overlay · tags |
| `/creatives` | 5.36 kB | 104 kB | Card grid + Sheet drawer · ad copy preview · metadata |
| `/ads-manager` | 4.33 kB | 103 kB | 11-column campaign table · ROAS coloring · platform badges |
| `/settings` | 0.14 kB | 87.4 kB | Skeleton placeholder (future) |

Shared JS across all routes: **87.3 kB** (Inter font, layout shell, UI primitives).

---

## 3. Design System

### 3.1 Dark Theme Tokens (CSS Custom Properties)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0c0c14` | Page background |
| `--card` | `#12121e` | Card / sidebar / drawer surfaces |
| `--foreground` | `#e4e4e9` | Primary text |
| `--primary` | `#6366f1` | Indigo accent — buttons, active states, links |
| `--primary-foreground` | `#ffffff` | Text on primary bg |
| `--muted` | `#16162a` | Subtle backgrounds, hover states |
| `--muted-foreground` | `#6b6b8a` | Secondary text, labels |
| `--border` | `#1e1e2e` | All borders, separators, dividers |
| `--input` | `#1a1a2e` | Input/select backgrounds |
| `--ring` | `#6366f1` | Focus rings |
| `--success` | `#22c55e` | Green for positive states |
| `--warning` | `#f59e0b` | Amber for warnings/drafts |
| `--destructive` | `#ef4444` | Red for errors/cancellations |
| `--radius` | `0.5rem` | Base border-radius |

### 3.2 Typography

- **Font family:** Inter (Google Fonts)
- **Custom sizes:** `text-2xs` (0.6875rem), `text-2sm` (0.8125rem)
- **Tabular nums:** All monetary/metric values use `tabular-nums` for alignment

### 3.3 Layout (Metronic demo1 pattern)

```
┌──────────────────────────────────────────────────────┐
│ Header (70px fixed)                     [🔍] [🔔] [👤] │
├───────────┬──────────────────────────────────────────┤
│           │                                          │
│ Sidebar   │  Main Content (scrollable)               │
│ (280px)   │                                          │
│ fixed     │  ┌─ PageHeader ────────────────────┐     │
│ collaps.  │  │ Title          [Action Button]  │     │
│           │  └─────────────────────────────────┘     │
│ ┌───────┐ │  ┌─ Filter Bar ───────────────────┐     │
│ │ Logo  │ │  │ 🔍 Search  [Status ▾] [Type ▾] │     │
│ │  "P"  │ │  └─────────────────────────────────┘     │
│ │       │ │  ┌─ Content ──────────────────────┐     │
│ │ Menu  │ │  │ Grid / Table / Cards            │     │
│ │ items │ │  │                                 │     │
│ │       │ │  └─────────────────────────────────┘     │
│ │       │ │                                          │
│ │ v0.1  │ │  ┌─ Footer ──────────────────────┐     │
│ └───────┘ │  │ © PixEcom by Pixelxlab          │     │
│           │  └─────────────────────────────────┘     │
└───────────┴──────────────────────────────────────────┘
```

---

## 4. Component Inventory

### 4.1 UI Primitives (`src/components/ui/`)

| Component | Variants | Notes |
|-----------|----------|-------|
| `Button` | primary, mono, destructive, secondary, outline, ghost, dim, link · sizes: lg, md, sm, icon | CVA-based |
| `Badge` | primary, secondary, success, warning, destructive, outline, info · sizes: md, sm | Transparent bg with colored text |
| `Card` | Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription, CardToolbar | `rounded-xl border bg-card` |
| `Table` | Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell | Dense: `text-[13px]`, `h-10` rows |
| `Input` | Standard text input | `h-8`, dark bg, focus ring |
| `Select` | Supports `options` prop OR `children` pattern | Native `<select>` + ChevronDown overlay |
| `Sheet` | Sheet, SheetHeader, SheetBody, SheetTitle, SheetDescription | Right-side drawer, 480px, ESC close, scroll lock |
| `Tabs` | Tabs, TabsList, TabsTrigger, TabsContent | Context-based, line variant |
| `Skeleton` | Pulse animation | `animate-pulse bg-accent` |
| `Separator` | Horizontal / Vertical | `h-px bg-border` |
| `Avatar` | Image + fallback initials · sizes: sm, md, lg | `rounded-full` |

### 4.2 Shared Components (`src/components/shared/`)

| Component | Props | Usage |
|-----------|-------|-------|
| `PageHeader` | `title`, `subtitle`, `action`, `children` | Every page header |
| `StatusBadge` | `status` string → auto variant mapping | Maps 20+ statuses to badge colors |
| `KpiCard` | `title`, `value`, `change`, `icon` | Dashboard KPI row |
| `EmptyState` | `icon`, `title`, `description`, `action` | Zero-result states |

### 4.3 Layout Components (`src/components/layout/`)

| Component | Description |
|-----------|-------------|
| `Sidebar` | Fixed left panel, "P" logo, SidebarMenu, version footer |
| `SidebarMenu` | 5 nav groups: Dashboard, Ads Manager, Commerce, Content, Account |
| `Header` | Fixed top bar, breadcrumb, search/bell icons, user avatar |
| `Footer` | Copyright bar |

---

## 5. Mock Data Files (`src/mock/`)

| File | Records | DTO Shape Source |
|------|---------|-----------------|
| `types.ts` | — | All TypeScript interfaces matching backend DTOs |
| `products.ts` | 12 products | `ProductCardDto` from `apps/api/src/products/dto/` |
| `sellpages.ts` | 12 sellpages | `SellpageCardDto` from `apps/api/src/sellpages/dto/` |
| `orders.ts` | 12 list items + 3 detail records | `OrderListItem` / `OrderDetail` from `orders.service.ts` |
| `assets.ts` | 12 assets | `AssetDto` — images, videos, SVGs with dimensions/tags |
| `creatives.ts` | 10 creatives | `CreativeDto` — IMAGE, VIDEO, CAROUSEL types |
| `campaigns.ts` | 10 campaigns | `CampaignDto` — Facebook, TikTok, Google platforms |
| `dashboard.ts` | KPIs + 7-day chart + top 5 + recent 5 | `DashboardKpi` + chart/table arrays |

---

## 6. Page-by-Page Feature Matrix

| Feature | Dashboard | Products | Sellpages | Orders | Assets | Creatives | Ads Mgr |
|---------|:---------:|:--------:|:---------:|:------:|:------:|:---------:|:-------:|
| Search bar | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Status filter | — | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Type filter | — | ✅ (label) | ✅ | — | ✅ | ✅ | ✅ (platform) |
| Card grid | — | ✅ | — | — | ✅ | ✅ | — |
| Dense table | — | — | ✅ | ✅ | ✅ (list) | — | ✅ |
| Sheet drawer | — | — | — | ✅ | — | ✅ | — |
| KPI cards | ✅ | — | — | — | — | — | ✅ |
| Stat chips | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grid/list toggle | — | — | — | — | ✅ | — | — |
| Revenue chart | ✅ | — | — | — | — | — | — |
| Status badges | — | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| URL copy/link | — | — | ✅ | — | — | — | — |
| Tracking link | — | — | — | ✅ | — | — | — |
| Activity timeline | — | — | — | ✅ | — | — | — |
| Ad copy preview | — | — | — | — | — | ✅ | — |
| ROAS coloring | — | — | — | — | — | — | ✅ |
| Platform badges | — | — | — | — | — | — | ✅ |

---

## 7. Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `clsx` | ^2.x | Conditional class joining |
| `tailwind-merge` | ^2.x | TW class conflict resolution |
| `class-variance-authority` | ^0.7 | Component variant system (CVA) |
| `lucide-react` | ^0.x | Icon library (tree-shakeable) |

Zero runtime dependencies on Radix UI, shadcn, or Metronic packages.

---

## 8. Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Stay on Next 14 / React 18 / TW3** | Metronic uses Next 16 / React 19 / TW4 — upgrading would break the existing monorepo |
| **Hand-write 15 components** | Simpler than porting Metronic's 72 Radix-based components for a preview |
| **Native `<select>` over Radix Select** | No floating UI dependency needed for mock preview |
| **Sheet uses plain DOM** | Body scroll lock + ESC handler instead of Radix Dialog |
| **CSS-only bar chart** | No charting library — pure divs with percentage heights for dashboard |
| **`placehold.co` images** | Deterministic colored placeholders, no local image files |
| **All pages statically generated** | Zero API calls, `'use client'` only for interactive filters |

---

## 9. File Tree

```
apps/web/src/
├── app/
│   ├── globals.css                    # Dark tokens + layout CSS
│   ├── layout.tsx                     # Root layout (<html class="dark">)
│   ├── page.tsx                       # Redirect → /login
│   ├── login/page.tsx                 # Login card form
│   └── (portal)/
│       ├── layout.tsx                 # Sidebar + Header + Footer shell
│       ├── dashboard/page.tsx         # KPIs + chart + tables
│       ├── products/page.tsx          # Product catalog grid
│       ├── sellpages/page.tsx         # Sellpages dense table
│       ├── orders/page.tsx            # Orders table + Sheet drawer
│       ├── assets/page.tsx            # Assets grid/list
│       ├── creatives/page.tsx         # Creatives grid + Sheet drawer
│       ├── ads-manager/page.tsx       # Campaign table
│       └── settings/page.tsx          # Skeleton placeholder
├── components/
│   ├── ui/                            # 11 primitives
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   ├── table.tsx
│   │   └── tabs.tsx
│   ├── shared/                        # 4 shared
│   │   ├── empty-state.tsx
│   │   ├── kpi-card.tsx
│   │   ├── page-header.tsx
│   │   └── status-badge.tsx
│   └── layout/                        # 4 layout
│       ├── footer.tsx
│       ├── header.tsx
│       ├── sidebar-menu.tsx
│       └── sidebar.tsx
├── hooks/
│   └── use-mobile.ts                  # Breakpoint detection (1024px)
├── lib/
│   ├── utils.ts                       # cn() utility
│   └── helpers.ts                     # formatCurrency, formatDate, timeAgo, etc.
└── mock/
    ├── types.ts                       # All DTO interfaces
    ├── products.ts                    # 12 products
    ├── sellpages.ts                   # 12 sellpages
    ├── orders.ts                      # 12 list + 3 detail
    ├── assets.ts                      # 12 assets
    ├── creatives.ts                   # 10 creatives
    ├── campaigns.ts                   # 10 campaigns
    └── dashboard.ts                   # KPIs + chart + tables
```

---

## 10. What's Next (Phase 2)

| Priority | Task | Effort |
|----------|------|--------|
| 🔴 High | Wire pages to real API (replace mock imports with `fetch` + SWR/React Query) | 3-4 days |
| 🔴 High | Auth flow — JWT token store, protected routes, session refresh | 2 days |
| 🟡 Medium | Sellpage builder (sections drag/drop, live preview) | 5-7 days |
| 🟡 Medium | Recharts or Tremor for real dashboard charts | 1 day |
| 🟡 Medium | Form validation (react-hook-form + zod) for create/edit modals | 2 days |
| 🟢 Low | Settings page (profile, domains, billing) | 2 days |
| 🟢 Low | Responsive sidebar collapse on mobile | 1 day |
| 🟢 Low | Toast notifications (sonner or custom) | 0.5 day |

---

*Generated by Claude Code — Feb 2025*
