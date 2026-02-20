# Sprint 1 — Frontend Integration Preview Build Log

**Branch:** `feature/2.3.7-stability-hardening`
**Date:** 2025-02-21
**Status:** BUILD GREEN — all 12 routes compiled, zero TypeScript errors
**Goal:** Build a stable, clickable integration preview that works end-to-end with real API calls

---

## 1. Final Route List

| Route | Type | Size | Description |
|---|---|---|---|
| `/` | Static | 2.97 kB | Root redirect → /orders or /login |
| `/login` | Static | 3.92 kB | Login form wired to POST /auth/login |
| `/orders` | Static | 3.07 kB | Orders list — cursor pagination, status/date/search filters |
| `/orders/[id]` | Dynamic | 2.56 kB | Order detail — customer, items, totals, events timeline |
| `/ads-manager` | Static | 3.78 kB | Ads Manager 3-tier — campaigns/adsets/ads via query params |
| `/analytics` | Static | 3.31 kB | Analytics overview — KPIs + top campaigns + sellpages |
| `/sellpages` | Static | 2.94 kB | Sellpages list — offset pagination, status/search filters |
| `/sellpages/[id]` | Dynamic | 2.15 kB | Sellpage detail — product, URL, stats, creative placeholder |
| `/products` | Static | 5.26 kB | Products catalog (from Phase 1) |
| `/debug/api` | Static | 4.95 kB | 10-step API connectivity test suite |
| `/debug/health` | Static | 2.02 kB | Health check — DB/Redis status + requestId |
| `/_not-found` | Static | 872 B | 404 page |

---

## 2. Contract Fixes Applied

### Critical: GET /auth/me response shape
- **Problem:** Auth store expected `{ user: {...}, seller: {...} }` (nested)
- **Reality:** Backend returns FLAT `{ id, email, displayName, avatarUrl, sellerId, role }`
- **Fix:** Added `MeResponse` interface, map flat fields to `AuthUser` shape in `me()` and `hydrate()`

### Orders pagination
- Uses **cursor-based keyset** pagination (not offset)
- Cursor stack maintained in component state for prev/next navigation
- `nextCursor` from response → passed as `cursor` query param

### Ads Manager metrics
- All metric fields match backend exactly: spend, impressions, clicks, ctr, cpc, contentViews, costPerContentView, checkout, costPerCheckout, purchases, roas, cr, cr1, cr2
- `storeMetricsPending` boolean → renders "N/A" when true, formatted value when false
- safeDivide in backend returns 0 → UI shows "0" (not N/A) unless storeMetricsPending is true

### Analytics — no dedicated endpoint
- No analytics/dashboard controller exists in backend
- Revenue derived from ads-manager summary: `purchaseValue = roas * spend`
- Sellpage stats are ALL stubs (return 0) → shown as "—" with italic note

---

## 3. Files Created (this sprint)

### Types
| File | Purpose |
|---|---|
| `src/types/api.ts` | All API response types — orders, ads-manager, sellpages, health |

### Shared Components
| File | Purpose |
|---|---|
| `src/components/DataTable.tsx` | Generic table — sticky header, loading skeleton, empty state, row click |
| `src/components/PageShell.tsx` | Page wrapper — title, subtitle, icon, actions |
| `src/components/StatusBadge.tsx` | Color-coded status badge (all order + ads statuses) |
| `src/components/KpiCard.tsx` | KPI metric card with loading state |
| `src/components/AdsMetricsTable.tsx` | Ads metrics table — all 18 columns exactly matching spec |
| `src/components/DebugPanel.tsx` | Dev-only API debug panel (bottom-right, shows last 50 calls) |

### Utilities
| File | Purpose |
|---|---|
| `src/lib/format.ts` | money, moneyWhole, num, pct, fmtDate, fmtDateTime, toApiDate, daysAgo, metricOrNA |

### Pages
| File | Route |
|---|---|
| `src/app/(portal)/orders/page.tsx` | `/orders` — list with cursor pagination |
| `src/app/(portal)/orders/[id]/page.tsx` | `/orders/:id` — detail with items + events timeline |
| `src/app/(portal)/ads-manager/page.tsx` | `/ads-manager` — 3-tier drilldown via query params |
| `src/app/(portal)/analytics/page.tsx` | `/analytics` — KPIs + top tables |
| `src/app/(portal)/sellpages/page.tsx` | `/sellpages` — list with offset pagination |
| `src/app/(portal)/sellpages/[id]/page.tsx` | `/sellpages/:id` — detail with product + stats |
| `src/app/debug/health/page.tsx` | `/debug/health` — health check |

### Modified Files
| File | Change |
|---|---|
| `src/stores/authStore.ts` | Fixed /auth/me contract (flat response mapping) |
| `src/components/Sidebar.tsx` | Updated nav: Orders first, added Analytics + Health |
| `src/app/layout.tsx` | Added DebugPanel |
| `src/app/login/page.tsx` | Redirect to /orders after login |
| `src/app/page.tsx` | Root redirect to /orders |

---

## 4. API Endpoints Used

| Page | Endpoint | Method | Auth | Pagination |
|---|---|---|---|---|
| Login | `/auth/login` | POST | None | — |
| Login | `/auth/refresh` | POST | Cookie | — |
| Sidebar | `/auth/me` | GET | JWT | — |
| Sidebar | `/auth/logout` | POST | JWT | — |
| Orders List | `/orders` | GET | JWT | Cursor (nextCursor) |
| Order Detail | `/orders/:id` | GET | JWT | — |
| Ads Manager | `/ads-manager/campaigns` | GET | JWT | — |
| Ads Manager | `/ads-manager/adsets` | GET | JWT | — |
| Ads Manager | `/ads-manager/ads` | GET | JWT | — |
| Analytics | `/ads-manager/campaigns` | GET | JWT | — |
| Analytics | `/sellpages` | GET | JWT | Offset |
| Sellpages List | `/sellpages` | GET | JWT | Offset (page/limit) |
| Sellpage Detail | `/sellpages/:id` | GET | JWT | — |
| Products | `/products` | GET | JWT | Offset (page/limit) |
| Health | `/health` | GET | None | — |
| Debug API | All above | Various | Various | — |

---

## 5. Navigation Flow (Stop Condition)

```
login → orders → order detail → [back] → ads manager →
  campaigns → adsets (drill) → ads (drill) → [back] →
  analytics → sellpages → sellpage detail → [back] →
  health check → [sidebar nav works throughout]
```

All pages load and navigate without crashes. Errors are caught with toast + inline display.

---

## 6. Ads Manager Column Spec

Exact columns rendered (left to right):
1. Name (Campaign/Adset/Ad)
2. Platform (META)
3. Status
4. Budget/Day
5. Spent
6. Impressions
7. Clicks
8. CTR
9. CPC
10. Contentview (CV)
11. Cost/Contentview
12. Checkout
13. Cost/Checkout
14. CR1
15. CR2
16. CR
17. Conv. (purchases)
18. ROAS

**N/A rendering:** If `storeMetricsPending === true`, metrics 5-18 show "N/A" in italic muted text.
**Zero rendering:** If `storeMetricsPending === false` and value is 0, shows "0" (not N/A).

Summary bar below table shows aggregated metrics.

---

## 7. Known Limitations

1. **Sellpage stats are stubs** — Backend returns `{ revenue: 0, cost: 0, youTake: 0, hold: 0, cashToBalance: 0 }` for all sellpages. UI shows "—" with note.
2. **No dedicated analytics endpoint** — Revenue KPI derived from `roas * spend` from ads-manager summary.
3. **Top creatives table** — Placeholder only ("Coming soon"). No creative-by-ROAS endpoint exists.
4. **Refresh Tracking button** — Disabled with "Coming soon" tooltip. No tracking refresh endpoint.
5. **Creative assignment** — Sellpage detail shows placeholder. No creative-sellpage link endpoint.
6. **Auth /me response** — Returns flat object. If backend later adds seller nesting, auth store needs update.
7. **Orders date range** — Backend defaults both dateFrom and dateTo to "today" if not provided. UI defaults to last 30 days.
8. **DebugPanel** — Renders only in `NODE_ENV === 'development'`. Shows last 50 API calls but requires manual integration with apiClient (not yet wired — uses separate pushDebugEntry function).
9. **Mobile responsive** — Sidebar is fixed 224px. No mobile hamburger yet.
10. **Platform filter** — Hardcoded "Meta only" label. Backend only supports Meta currently.

---

## 8. Build Output

```
Next.js 14.2.35 — Environments: .env.local
Compiled successfully
12 routes, 0 TypeScript errors

Route                    Size        First Load JS
/                        2.97 kB     90.2 kB
/ads-manager             3.78 kB     94.7 kB
/analytics               3.31 kB     94.2 kB
/debug/api               4.95 kB     92.2 kB
/debug/health            2.02 kB     89.3 kB
/login                   3.92 kB     91.2 kB
/orders                  3.07 kB     94.0 kB
/orders/[id]             2.56 kB     93.5 kB
/products                5.26 kB     92.5 kB
/sellpages               2.94 kB     93.8 kB
/sellpages/[id]          2.15 kB     93.1 kB

Shared JS: 87.3 kB
```

---

## 9. How to Run

```bash
# Terminal 1 — Backend
cd apps/api && pnpm dev    # starts on :3001

# Terminal 2 — Frontend
cd apps/web && pnpm dev    # starts on :3000

# Navigate to http://localhost:3000
# Will redirect to /login → enter demo creds → lands on /orders
```

---

## 10. Screenshot Checklist

When visually verifying, capture these screens:
1. `/login` — Login form with demo creds pre-filled
2. `/orders` — Orders table with filters (status, date range, search)
3. `/orders/:id` — Order detail with customer, items, totals, timeline
4. `/ads-manager` — Campaigns table with all 18 metric columns
5. `/ads-manager?campaignId=...` — Adsets drilldown view
6. `/ads-manager?...&adsetId=...` — Ads drilldown view
7. `/analytics` — KPI cards + top campaigns table
8. `/sellpages` — Sellpages list with pagination
9. `/sellpages/:id` — Sellpage detail with product info
10. `/debug/health` — Health check result
11. `/debug/api` — API test suite results (all 10 tests)
