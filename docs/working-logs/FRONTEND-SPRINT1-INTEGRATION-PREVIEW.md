# Frontend Sprint 1 — Integration Preview

**Branch:** `feature/frontend-sprint1-integration-preview`
**Base:** `feature/2.3.7-stability-hardening`
**Date:** 2025-02-21
**Build:** GREEN — 12 routes, 0 TypeScript errors

---

## What Changed

### 1. `/analytics` page — NEW
**File:** `src/app/(portal)/analytics/page.tsx`

KPI overview page pulling data from existing endpoints:

| KPI Card | Data Source | Notes |
|---|---|---|
| Revenue | `roas * spend` from ads-manager summary | Derived — no dedicated endpoint |
| Ad Spend | `summary.spend` from campaigns | Direct |
| YouTake | Sellpage `stats.youTake` sum | Stub (backend returns 0) |
| Hold | Sellpage `stats.hold` sum | Stub (backend returns 0) |
| CashToBalance | Sellpage `stats.cashToBalance` sum | Stub (backend returns 0) |

Tables:
- **Top Campaigns by Spend** — sorted desc from `/ads-manager/campaigns`, top 5
- **Sellpages** — first 10 from `/sellpages`, stats shown as "—" when stub
- **Top Creatives** — placeholder card ("Coming soon — endpoint not available")

Date presets: Today / 7d / 30d + custom date picker.

### 2. `/debug/health` page — NEW
**File:** `src/app/debug/health/page.tsx`

Calls `GET /api/health` and displays:
- Overall status (ok / degraded)
- Database status (connected / down)
- Redis status (connected / down)
- Request ID (from `x-request-id` header)
- Timestamp
- Response latency (measured client-side)

### 3. `AdsMetricsTable` component — NEW
**File:** `src/components/AdsMetricsTable.tsx`

Shared table rendering all 18 ads metric columns:

| # | Column | Field | Format |
|---|---|---|---|
| 1 | Name | `name` | Text |
| 2 | Platform | `platform` | Uppercase |
| 3 | Status | `status` | StatusBadge |
| 4 | Budget/Day | `budgetPerDay` | Currency or "—" |
| 5 | Spent | `spend` | Currency |
| 6 | Impr. | `impressions` | Number |
| 7 | Clicks | `clicks` | Number |
| 8 | CTR | `ctr` | Percentage |
| 9 | CPC | `cpc` | Currency |
| 10 | CV | `contentViews` | Number |
| 11 | Cost/CV | `costPerContentView` | Currency |
| 12 | Checkout | `checkout` | Number |
| 13 | Cost/CO | `costPerCheckout` | Currency |
| 14 | CR1 | `cr1` | Percentage |
| 15 | CR2 | `cr2` | Percentage |
| 16 | CR | `cr` | Percentage |
| 17 | Conv. | `purchases` | Number |
| 18 | ROAS | `roas` | 2 decimals |

**N/A rule:** When `storeMetricsPending === true`, columns 5-18 render "N/A" in italic muted text.
**Zero rule:** When `storeMetricsPending === false` and value is 0, renders "0" (not N/A).

Includes `SummaryBar` sub-component for aggregated totals.

### 4. `DebugPanel` component — NEW + WIRED
**File:** `src/components/DebugPanel.tsx`

Dev-only floating panel (bottom-right, `z-[9998]`):
- Shows last 50 API calls
- Each entry: HTTP status (color-coded), method, path, response time
- `x-request-id` displayed when present
- Expandable response payload (truncated to 2000 chars)
- Green/red dot indicator for last call status
- **Auto-populated:** Wired into `apiClient.ts` via `setDebugCallback`

**apiClient changes:** Added `setDebugCallback()` function + instrumentation in `api()`:
- Measures `performance.now()` timing for every call
- Reads `x-request-id` header from response
- Pushes entry for both success and error paths

### 5. Sidebar — Analytics nav item added
**File:** `src/components/Sidebar.tsx`

Nav order: Orders → Ads Manager → **Analytics** → Sellpages → Products → Health

---

## All Files in This Branch

### New Files (21)
```
src/types/api.ts                          — API response type definitions
src/lib/format.ts                         — Formatting utilities (money, num, pct, dates)
src/lib/cn.ts                             — clsx wrapper
src/components/DataTable.tsx              — Generic table (sticky header, skeleton, empty state)
src/components/PageShell.tsx              — Page layout wrapper
src/components/StatusBadge.tsx            — Color-coded status badge
src/components/KpiCard.tsx                — KPI metric card
src/components/AdsMetricsTable.tsx        — 18-column ads metrics table
src/components/DebugPanel.tsx             — Dev-only API debug panel
src/stores/authStore.ts                   — Zustand auth store
src/stores/toastStore.ts                  — Toast notification store
src/components/AuthProvider.tsx           — Auth hydration provider
src/components/Toaster.tsx                — Toast renderer
src/components/Sidebar.tsx                — Navigation sidebar
src/app/(portal)/layout.tsx               — Auth-guarded portal layout
src/app/(portal)/orders/page.tsx          — Orders list (cursor pagination)
src/app/(portal)/orders/[id]/page.tsx     — Order detail
src/app/(portal)/ads-manager/page.tsx     — Ads Manager 3-tier drilldown
src/app/(portal)/analytics/page.tsx       — Analytics overview
src/app/(portal)/sellpages/page.tsx       — Sellpages list (offset pagination)
src/app/(portal)/sellpages/[id]/page.tsx  — Sellpage detail
src/app/(portal)/products/page.tsx        — Products catalog
src/app/login/page.tsx                    — Login page
src/app/debug/api/page.tsx                — API connectivity test suite
src/app/debug/health/page.tsx             — Health check page
docs/working-logs/FRONTEND-SPRINT1-INTEGRATION-PREVIEW.md — This file
docs/Frontend Logs/sprint1-integration-preview.md — Full build log
docs/Frontend Logs/frontend-build-log-phase1.md   — Phase 1 log
```

### Modified Files (5)
```
src/app/layout.tsx         — Added AuthProvider + Toaster + DebugPanel
src/app/page.tsx           — Root redirect logic
src/app/globals.css        — Dark theme tokens
src/lib/apiClient.ts       — Added setDebugCallback + timing instrumentation
tailwind.config.ts         — Dark theme color extensions
package.json               — Added clsx, lucide-react
```

---

## How to Test

### Prerequisites
```bash
# Backend must be running
cd apps/api && pnpm dev    # → :3001

# Frontend
cd apps/web && pnpm dev    # → :3000
```

### Manual Verification Flow
1. Open `http://localhost:3000` → should redirect to `/login`
2. Login with demo credentials (pre-filled from `.env.local`)
3. Should land on `/orders`
4. **Orders:** Verify table loads, try status filter, date range, search by order #
5. Click an order row → `/orders/:id` detail with items + timeline
6. Navigate to **Ads Manager** → campaigns table with 18 columns
7. Click a campaign → drills to adsets, click an adset → drills to ads
8. Navigate to **Analytics** → KPI cards + top campaigns table
9. Navigate to **Sellpages** → list with pagination, click row → detail
10. Navigate to **Health** → click "Run Health Check" → verify db/redis status
11. **DebugPanel:** Click "API Debug" bar at bottom-right → should show all API calls with status codes, timing, and requestId

### Verify N/A Rendering
- In Ads Manager, if any campaign/adset/ad has `storeMetricsPending: true`, metrics should show "N/A"
- If `storeMetricsPending: false` with value `0`, should show "0" (not N/A)

### Verify Error Handling
- Stop the backend → navigate any page → should show red error banner + toast
- Start backend again → click "Retry" → should recover

---

## Known Limitations
1. Sellpage stats are stubs (backend returns all zeros)
2. No dedicated analytics endpoint — revenue derived from ads data
3. Top creatives table is placeholder only
4. "Refresh Tracking" button on order detail is disabled (no endpoint)
5. Creative assignment on sellpage detail is placeholder
6. Mobile sidebar not responsive (fixed 224px)
7. `/assets`, `/creatives`, `/settings` routes do not exist (not in scope for Sprint 1)
