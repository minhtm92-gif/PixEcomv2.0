# PixEcom Seller Portal — Frontend Architecture Plan

> Prepared: 2026-02-19 | Branch: `feature/2.3.4c-analytics-overview`
> Status: **Analysis complete — awaiting "Start Frontend" command**

---

## 1. Project Context

PixEcom v2 is a multi-tenant SaaS seller portal. Backend is mature (NestJS 10, Prisma 5, PostgreSQL 16, 12 API modules, 209 E2E tests). Frontend is empty shell (Next.js 14, bare root layout only).

**Goal**: Build the Seller Portal frontend using Metronic v9.4.2 theme as the component foundation, styled with a "Pixelxlab dark mode" aesthetic and "Selless-like clean operations portal" UX.

---

## 2. Metronic v9.4.2 — What We Have

| Variant | Stack | Use |
|---------|-------|-----|
| React Concepts (TS/Next.js) | React 19, Next.js 16, Tailwind 4, shadcn/ui | **PRIMARY — our base** |
| React Starter Kit | 39 layout variants, 80+ UI components | Component library |
| HTML Demos | Compiled HTML pages | Visual reference only |
| Figma file | `.fig` design system | Design reference |

**Key module**: `store-inventory` — 28 eCommerce pages (dashboard, products, orders, categories, stock, customers, shipping) with full data grids, filter bars, date pickers, sheets, and notifications.

---

## 3. Architecture Decision

### Chosen: Option B — Metronic React Concepts as base, adapt to Pixelxlab Dark

**Why**:
- Metronic Concepts already uses **shadcn/ui + Radix + Tailwind** (not proprietary)
- Store Inventory module is **80% match** to PixEcom needs
- 80+ production-ready UI components (data-grid, charts, file-upload, stepper, etc.)
- Dark mode already implemented — just need token overrides
- Includes `@tanstack/react-table`, `react-query`, `react-hook-form`, `zod`, `recharts`

**Trade-off**: Requires upgrading `apps/web` from Next 14 → 16, React 18 → 19, Tailwind 3 → 4 (acceptable since frontend is empty).

---

## 4. Page → Component Mapping

| PixEcom Page | Metronic Source | Reuse Level |
|-------------|-----------------|-------------|
| **Dashboard** | `store-inventory/dashboard/` (KPI cards, charts, tables) | ~90% direct |
| **Orders** | `store-inventory/order-list/` + `order-details-sheet` | ~95% direct |
| **Sellpages** | Adapted from `product-list/` + `category-form-sheet` | ~70% adapt |
| **Products (catalog)** | `store-inventory/product-list/` (read-only) | ~85% direct |
| **Campaigns (Ads)** | `data-grid` + `tabs` + `badge` + dashboard KPI cards | ~60% compose |
| **Assets/Creatives** | `file-upload` + `card` + `stepper` + `data-grid` | ~50% compose |
| **Settings** | `store-inventory/settings-modal/` + form components | ~75% adapt |
| **Auth (login/register)** | Metronic auth templates | ~80% adapt |

**Sidebar navigation** reuses `AccordionMenu` from store-inventory, reconfigured:
```
Dashboard → Ads Manager (Campaigns, Strategies, FB Connections)
→ Commerce (Sellpages, Orders) → Content (Products, Assets, Creatives)
→ Settings (Profile, Domains, Integrations)
```

---

## 5. Dark Mode Token Plan

Base: Metronic's zinc dark theme. Override for Pixelxlab brand:

| Token | Metronic Default | PixEcom Override | Purpose |
|-------|-----------------|------------------|---------|
| `--background` | zinc-950 | `#0c0c14` | Bluer-black base |
| `--card` | zinc-950 | `#12121e` | Elevated surface |
| `--border` | zinc-800 | `#1e1e2e` | Softer borders |
| `--muted` | zinc-900 | `#16162a` | Deep muted surface |
| `--muted-foreground` | zinc-500 | `#6b6b8a` | Lavender-gray secondary text |
| `--primary` | blue-600 | `#6366f1` | **Indigo — Pixelxlab signature** |
| `--destructive` | red-600 | `#ef4444` | Standard red |

**UI rules**: 14px body text, 20px page headings, 48px table rows, 280px/80px collapsible sidebar, 70px fixed header, 0.5rem border radius, thin 5px scrollbars.

---

## 6. Prototype Plan (1 Week, Mock JSON Only)

| Day | Deliverable |
|-----|-------------|
| 1 | Scaffold: copy Metronic components, upgrade deps, apply dark tokens, sidebar nav |
| 2 | Dashboard: 4 KPI cards + line chart + top sellpages + recent orders |
| 3 | Orders: list table + filters + date picker + detail sheet |
| 4 | Sellpages + Products catalog (read-only grid) |
| 5 | Ads Manager: campaign list + drilldown tabs (Overview/Adsets/Ads) |
| 6 | Assets gallery + Creative builder + Settings (tabs) |
| 7 | Auth pages (login/register), loading skeletons, empty states, QA pass |

All pages use **mock JSON matching exact backend response shapes** (10 mock shapes prepared). No API wiring yet.

---

## 7. Tech Stack Summary

| Layer | Current (`apps/web`) | After Upgrade |
|-------|---------------------|---------------|
| Framework | Next.js 14.2 | Next.js 16.1 |
| React | 18.3 | 19.2 |
| Styling | Tailwind 3.4 | Tailwind 4.1 |
| UI Components | (none) | Metronic/shadcn (80+) |
| State (client) | Zustand 4.5 | Zustand (keep) |
| State (server) | (none) | @tanstack/react-query 5 |
| Forms | (none) | react-hook-form + zod |
| Tables | (none) | @tanstack/react-table 8 |
| Charts | (none) | Recharts + ApexCharts |
| Icons | (none) | Lucide React |
| Animations | (none) | Motion (Framer) |
| Theme | (none) | next-themes (dark default) |

---

## 8. Open Questions (Need Answers Before Starting)

1. **Version upgrade** — Upgrade `apps/web` to Next 16 + React 19 + TW4 to match Metronic? (Recommended: yes, frontend is empty)
2. **Monorepo placement** — Components inside `apps/web/` or extract to `packages/ui`?
3. **Auth pages** — Use Metronic auth templates or custom Pixelxlab design?
4. **State management** — Keep Zustand + add React Query, or consolidate?
5. **URL scheme** — `/dashboard`, `/campaigns`, `/orders`, `/sellpages`, `/products`, `/assets`, `/creatives`, `/settings` — correct?
6. **Dark-only?** — Entire app dark mode only, or support light toggle?
7. **Separate analytics page?** — Dashboard KPIs sufficient, or need `/analytics` drilldown?
8. **Campaign creation wizard?** — Build create flow in prototype, or list+detail only?
9. **Figma exports** — Any Pixelxlab dark screenshots to match tokens more precisely?
10. **Deploy target** — Vercel, Cloudflare Pages, or local only for prototype?

---

## 9. Backend Endpoints (Already Built)

| Module | Endpoints | Status |
|--------|-----------|--------|
| Auth | 6 routes (register, login, refresh, logout, me, google-stub) | Done |
| Seller | 4 routes (profile + settings CRUD) | Done |
| Products | 3 routes (list, detail, variants) | Done |
| Assets (product) | 3 routes (media, thumbnails, adtexts) | Done |
| Asset Registry | 5 routes (signed-upload, ingest, register, list, get) | Done |
| Creatives | 8 routes (CRUD + attach/detach + validate + render) | Done |
| Sellpages | 6 routes (CRUD + publish/unpublish) | Done |
| Domains | 5 routes (CRUD + verify) | Done |
| FB Connections | 5 routes (CRUD + soft-delete) | Done |
| Ad Strategies | 5 routes (CRUD + soft-delete) | Done |
| Health | 1 route | Done |
| **Total** | **51 endpoints, 209 E2E tests** | **All passing** |

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Next 14→16 upgrade breaks monorepo | Medium | Frontend is empty, clean upgrade path |
| Metronic components too opinionated | Low | They're standard shadcn/ui underneath |
| Dark token tuning takes time | Low | Start with Metronic zinc dark, iterate |
| Mock→real API mismatch | Low | Mock shapes match exact backend DTOs |
| React 19 compatibility with Zustand | Low | Zustand supports React 19 |

---

*Prepared by: Frontend Architecture Analysis (Claude) for PixEcom v2 team*
*Next step: Answer open questions → "Start Frontend" → Day 1 scaffold*
