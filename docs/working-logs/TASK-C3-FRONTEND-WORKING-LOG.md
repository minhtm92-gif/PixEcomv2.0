# TASK-C3-FRONTEND: Campaign Wizard + List + Detail + Actions

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `4cac85b`                                     |
| **Build**   | GREEN (20 routes, 0 TS errors)                |

---

## Summary

Created the full Campaigns module: types, 4-step creation wizard, list page with status filter tabs and keyset pagination, detail page with inline edit and contextual action buttons (Launch / Pause / Resume), and added "Campaigns" to the Sidebar navigation.

Key design decision: backend has no DRAFT status — pre-launch campaigns are `status=PAUSED` + `externalCampaignId=null`. A helper function `isDraftCampaign()` centralizes this logic.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `CampaignStatus`, `BudgetType`, `CampaignListItem`, `CampaignDetail`, `CampaignsListResponse`, `CreateCampaignDto`, `UpdateCampaignDto`, `isDraftCampaign()` helper |
| `apps/web/src/app/(portal)/campaigns/page.tsx` | **Created** | Campaigns list page + 4-step wizard modal |
| `apps/web/src/app/(portal)/campaigns/[id]/page.tsx` | **Created** | Campaign detail page with inline edit, action buttons, confirm dialog |
| `apps/web/src/components/Sidebar.tsx` | **Modified** | Added `Rocket` import and `{ label: 'Campaigns', href: '/campaigns', icon: Rocket }` after Ads Manager |

---

## Decisions & Technical Notes

### Status Mapping (CRITICAL)

Backend has no DRAFT in `CampaignStatus`. Mapping logic:

| Display Status | Condition | Badge Color |
|----------------|-----------|-------------|
| Draft | `status === 'PAUSED' && externalCampaignId === null` | Gray |
| Active | `status === 'ACTIVE'` | Green |
| Paused | `status === 'PAUSED' && externalCampaignId !== null` | Yellow |
| Archived | `status === 'ARCHIVED'` | Red |

`isDraftCampaign()` is exported from `api.ts` and used in both pages to avoid duplication.

### 4-Step Wizard Modal

- **Step 1 — Sellpage**: Dropdown from `GET /sellpages?limit=100`. Loads on wizard open.
- **Step 2 — Ad Account**: Card selector list from `GET /fb/connections?connectionType=AD_ACCOUNT`. Loads lazily when step 2 is reached. If no accounts, shows link to Settings.
- **Step 3 — Details**: Name (required), budget + budgetType (DAILY/LIFETIME) side-by-side, startDate/endDate (optional).
- **Step 4 — Review**: Read-only summary table. Shows selected sellpage URL, ad account name, budget, dates.
- **Step indicator**: Filled circles (done=primary bg), active circle (primary/10 bg + primary border), future circles (muted). Connecting lines fill when passed.
- **Navigation**: Prev/Back button on left, step counter in center, Next/Create button on right. "Back" on step 1 = Cancel.
- **Submit**: `POST /campaigns` → redirects to `/campaigns/:id` on success.
- **Error display**: API error shown inline in step 4.

### Campaigns List Page

- **Status filter**: Tab-style buttons for All/Draft/Active/Paused/Archived. Client-side filtering after fetch (since API may not support status enum exactly).
- **Search**: Form submission updates `search` state, which triggers `fetchCampaigns`.
- **Keyset pagination**: Uses `nextCursor` from response. "Load more" button appends to existing data.
- **Table columns**: Campaign name + sellpage URL (stacked), Status badge, Budget (value + type), Created date, Chevron.

### Campaign Detail Page

- **Action buttons by status**:
  - Draft → "Launch Campaign" (green, Rocket icon) → `POST /:id/launch`
  - Active → "Pause" (yellow, PauseCircle icon) → `PATCH /:id/pause`
  - Paused (launched) → "Resume" (green, PlayCircle icon) → `PATCH /:id/resume`
  - Archived → no action button
- **Confirmation dialog**: Shows before each action with specific message. Yellow alert triangle icon, Cancel + Confirm buttons with color matching action.
- **Inline edit**: Name, budget, budgetType, startDate, endDate. Delta-only PATCH — only changed fields sent.
- **Info cards**: Sellpage (URL + slug), Ad Account (name + platform + external ID), Budget (large number + type label), Schedule (start/end/created/updated).
- **Date handling**: Slices ISO date strings to `YYYY-MM-DD` for `<input type="date">` and comparison.

### Sidebar

- Added `Rocket` to lucide-react imports.
- Inserted `{ label: 'Campaigns', href: '/campaigns', icon: Rocket }` between Ads Manager and Analytics.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (18/18)
             20 routes, 0 errors
```

### Route Output (new)
```
○ /campaigns                           6.98 kB    97.3 kB   (NEW)
ƒ /campaigns/[id]                      8.33 kB    95.6 kB   (NEW)
```

### Manual Verification Checklist
- [x] `api.ts` — `CampaignListItem` has all required fields including `externalCampaignId`
- [x] `api.ts` — `isDraftCampaign()` returns true iff `status=PAUSED` + `externalCampaignId=null/undefined`
- [x] `api.ts` — `CreateCampaignDto` has name, sellpageId, adAccountId, budget, budgetType, optional dates
- [x] List page — fetches `GET /campaigns` with limit/cursor/q params
- [x] List page — status tab filter (All/Draft/Active/Paused/Archived)
- [x] List page — search form triggers refetch
- [x] List page — "Load more" appends data, shown only when nextCursor present
- [x] List page — "New Campaign" opens wizard
- [x] Wizard — step 1 loads sellpages from GET /sellpages?limit=100
- [x] Wizard — step 2 loads ad accounts from GET /fb/connections?connectionType=AD_ACCOUNT
- [x] Wizard — step 2 shows link to Settings when no ad accounts
- [x] Wizard — step 3 has name, budget, budgetType, start/end date
- [x] Wizard — step 4 shows review table with all selections
- [x] Wizard — Next disabled when required fields missing
- [x] Wizard — POST /campaigns on submit → redirect to /campaigns/:id
- [x] Detail page — fetches GET /campaigns/:id
- [x] Detail page — correct badge: Draft (gray), Active (green), Paused (yellow), Archived (red)
- [x] Detail page — Draft shows "Launch Campaign" button (green)
- [x] Detail page — Active shows "Pause" button (yellow)
- [x] Detail page — Paused (launched) shows "Resume" button (green)
- [x] Detail page — confirmation dialog before each action
- [x] Detail page — inline edit form for name/budget/budgetType/dates
- [x] Detail page — info cards: sellpage, ad account, budget, schedule
- [x] Sidebar — "Campaigns" with Rocket icon, after Ads Manager
- [x] No changes to existing pages, auth logic, or backend endpoints
