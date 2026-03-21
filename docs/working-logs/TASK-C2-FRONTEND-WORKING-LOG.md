# TASK-C2 Frontend: Ads Manager Actions + Sellpage Enhancements + Orders Status + C2-FIX

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commits** | `0e27205` (C2 frontend), `0c874de` (C2-FIX)  |
| **Build**   | GREEN (34 routes, 0 TS errors)                |

---

## Summary

Three sub-tasks delivered:

**TASK A — Ads Manager Inline Actions + Bulk + Sync**
Added per-row Pause/Play buttons, bulk action bar (pause/resume/delete selected rows), and a sync button with 60-second cooldown in the Ads Manager page. Refactored `AdsMetricsTable` into a reusable component supporting checkbox selection, inline budget edit (campaigns tier), and tier-aware action routes.

**TASK B — Sellpage Enhancements**
Extended the Sellpage detail page with: custom domain configuration (check availability → connect → verify), Facebook Pixel integration (attach/detach pixelId), and a redesigned Linked Ads table showing per-ad metrics (spend, impressions, clicks, purchases, ROAS).

**TASK C — Orders Status Change UI**
Added status transition UI to the Order detail page — available next-status buttons, a confirm dialog, and an enhanced timeline showing all status history entries with actor labels and timestamps.

**C2-FIX — 3 Regression Bugs**
Fixed three bugs discovered during alpha regression testing after the C2 backend commit.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `BulkActionResult`, `SyncResult`, `OrderTransitionsResponse`, `SellpageDomainCheckResponse`, `SellpageDomainVerifyResponse`, `SellpagePixelResponse`; updated `LinkedAdPost`, `LinkedAd`, `SellpageDetail`; fixed `CampaignsListResponse.data` → `.items` (BUG-C2-01) |
| `apps/web/src/components/DataTable.tsx` | **Modified** | Changed `Column.label: string` → `ReactNode` to support checkbox as header |
| `apps/web/src/components/AdsMetricsTable.tsx` | **Created** | Reusable metrics table with checkbox select, Pause/Play actions, inline budget edit, summary bar |
| `apps/web/src/app/(portal)/ads-manager/page.tsx` | **Modified** | Added sync button + 60s cooldown, bulk action floating bar, confirm dialog; fixed `entityType` plural→singular (BUG-C2-03) |
| `apps/web/src/app/(portal)/campaigns/page.tsx` | **Modified** | Fixed `res.data` → `res.items` (BUG-C2-01) |
| `apps/web/src/app/(portal)/sellpages/[id]/page.tsx` | **Modified** | Added custom domain section, pixel section, linked ads metrics table |
| `apps/web/src/app/(portal)/orders/[id]/page.tsx` | **Modified** | Added status transitions, confirm dialog, enhanced timeline |

---

## Decisions & Technical Notes

### AdsMetricsTable Architecture

The component is shared across campaigns, adsets, and ads views via the `tier` prop:

```typescript
type Tier = 'campaigns' | 'adsets' | 'ads';

interface AdsMetricsTableProps {
  data: any[];
  loading: boolean;
  tier?: Tier;           // enables checkboxes + action buttons + inline budget edit
  onAction?: () => void; // triggers parent refetch after pause/resume/budget
  onSelectionChange?: (ids: string[]) => void;
}
```

When `tier` is set, three extra columns are added:
- **Checkbox column** — ReactNode header with select-all, per-row toggle
- **Actions column** — Pause (ACTIVE rows) or Play (PAUSED rows) button; Loader2 while in-flight
- **Inline budget edit** — campaigns tier only; click Budget/Day cell → input with Enter/Escape handlers

### Inline Pause/Resume Route (BUG-C2-02 Fix)

The original implementation used `apiPost` with a `/ads-manager/` prefix. Both were wrong:

```typescript
// WRONG (original)
await apiPost(`/ads-manager/${path}/${row.id}/${action}`);

// CORRECT (fixed)
await apiPatch(`/${path}/${row.id}/${action}`);
// → PATCH /campaigns/:id/pause  or  PATCH /campaigns/:id/resume
// → PATCH /adsets/:id/pause     or  PATCH /adsets/:id/resume
// → PATCH /ads/:id/pause        or  PATCH /ads/:id/resume
```

### Bulk Action entityType (BUG-C2-03 Fix)

The backend `BulkActionDto` uses `@IsIn(['campaign', 'adset', 'ad'])` (singular), but `tier` is always plural. Fixed with a ternary:

```typescript
entityType: tier === 'campaigns' ? 'campaign' : tier === 'adsets' ? 'adset' : 'ad'
```

### CampaignsListResponse Field (BUG-C2-01 Fix)

The backend `GET /campaigns` returns `{ items: CampaignListItem[], total, page, limit }`. The type was wrongly typed as `data`:

```typescript
// api.ts: data → items
export interface CampaignsListResponse {
  items: CampaignListItem[];  // was: data
  total: number;
  page: number;
  limit: number;
}

// campaigns/page.tsx: res.data → res.items
let items = res.items ?? [];  // was: res.data
```

### Sync Button — 60s Cooldown

Sync fires `POST /ads-manager/sync` and locks the button for 60 seconds with a countdown timer. State:

```typescript
const [syncing, setSyncing] = useState(false);
const [syncCooldown, setSyncCooldown] = useState(0);

// after success: count down from 60
let remaining = 60;
const interval = setInterval(() => {
  remaining -= 1;
  setSyncCooldown(remaining);
  if (remaining <= 0) clearInterval(interval);
}, 1000);
```

### Bulk Action Confirm Dialog

A floating bar appears when `selectedIds.length > 0`. Actions: Pause All, Resume All, Delete All. Each requires a confirm modal before firing `POST /ads-manager/bulk-action`. The bar clears selection on success.

### Custom Domain Flow (Sellpage)

Three-state domain UI:

```
1. No domain → input + "Check Availability" button
   → POST /sellpages/:id/domain/check { domain }
   → { available: true/false, message }

2. Available → "Connect Domain" button (disabled if unavailable)
   → POST /sellpages/:id/domain { domain }
   → domain saved, status = PENDING

3. Connected (PENDING/ACTIVE) → domain shown + "Verify DNS" button
   → POST /sellpages/:id/domain/verify
   → status updated
```

### Pixel Integration

Simple attach/detach. Input for `pixelId` string → `POST /sellpages/:id/pixel { pixelId }`. Detach fires `DELETE /sellpages/:id/pixel`.

### Linked Ads Table

`LinkedAd.metrics` is `{ spend, impressions, clicks, purchases, roas } | null`. When null (metrics not yet synced), cells show `—`. The table replaces the previous card list with a compact `DataTable`-style layout.

### Order Status Transitions

```typescript
// GET /orders/:id/transitions → { transitions: OrderTransition[] }
interface OrderTransition {
  status: string;      // target status
  label: string;       // human label ("Mark Shipped")
  requiresNote: boolean;
}
```

Each available transition renders as a button in a card. On click: if `requiresNote`, a textarea dialog opens; otherwise direct confirm → `POST /orders/:id/status { status, note? }`.

---

## Bug Fixes Summary

| Bug ID | Symptom | Root Cause | Fix |
|--------|---------|------------|-----|
| BUG-C2-01 | Campaigns page shows 0 items | `CampaignsListResponse.data` — backend returns `items` | `api.ts` + `campaigns/page.tsx`: `data` → `items` |
| BUG-C2-02 | Inline pause/resume returns 404 | Wrong HTTP method (`apiPost`) + wrong path prefix (`/ads-manager/`) | `AdsMetricsTable.tsx`: `apiPatch(\`/${path}/${id}/${action}\`)` |
| BUG-C2-03 | Bulk action returns 400 validation error | `entityType` sent as plural (`campaigns`) but backend expects singular (`campaign`) | `ads-manager/page.tsx`: ternary to convert `tier` → singular |

---

## Build Results

```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (34/34)
             34 routes total, 0 errors
```

### Route Changes (affected routes)
```
○ /ads-manager       7.87 kB   98.5 kB  (+2.1 kB — sync btn, bulk bar)
ƒ /sellpages/[id]   12.5  kB   99.8 kB  (+3.2 kB — domain, pixel, linked ads)
ƒ /orders/[id]      10.0  kB   97.3 kB  (+1.8 kB — transitions, confirm dialog)
```

---

## Manual Verification Checklist

### TASK A — Ads Manager
- [x] Checkbox column appears when `tier` is set
- [x] Select-all header checkbox toggles all rows
- [x] Per-row checkbox toggles individual selection
- [x] `onSelectionChange` fires with selected IDs
- [x] ACTIVE row shows Pause button; PAUSED row shows Play button
- [x] Pause/Resume fires `PATCH /{path}/:id/{action}` (correct route)
- [x] Loading spinner appears while action in-flight
- [x] `onAction()` called after success → parent refetches
- [x] Campaign tier: clicking Budget/Day cell opens inline input
- [x] Budget input: Enter saves, Escape cancels
- [x] Budget save fires `PATCH /ads-manager/campaigns/:id/budget { budget }`
- [x] Sync button fires `POST /ads-manager/sync`
- [x] Sync button shows 60s countdown after success
- [x] Bulk bar appears when ≥1 row selected
- [x] Bulk Pause All → confirm → `POST /ads-manager/bulk-action`
- [x] `entityType` sent as singular (campaign/adset/ad)
- [x] Selection cleared after successful bulk action

### TASK B — Sellpage Enhancements
- [x] Custom domain section renders when `customDomain` field exists
- [x] Check Availability fires domain check API
- [x] Available domain shows green tick; unavailable shows red
- [x] Connect Domain fires domain connect API
- [x] Verify DNS fires domain verify API
- [x] Pixel section shows attach form when no pixelId
- [x] Pixel attach fires POST /sellpages/:id/pixel
- [x] Pixel detach fires DELETE /sellpages/:id/pixel
- [x] Linked Ads table shows per-ad metrics
- [x] Metrics null → shows "—" not NaN

### TASK C — Orders Status
- [x] Transitions card shows available next statuses
- [x] requiresNote=false → direct confirm dialog
- [x] requiresNote=true → textarea dialog
- [x] Status change fires `POST /orders/:id/status { status, note? }`
- [x] Timeline shows all history entries with actor + timestamp

### C2-FIX
- [x] Campaigns page lists items (not empty)
- [x] Pause/Resume buttons work (204 no error)
- [x] Bulk action: no 400 validation error
