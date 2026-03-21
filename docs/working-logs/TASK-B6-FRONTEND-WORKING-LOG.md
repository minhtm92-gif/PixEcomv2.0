# TASK-B6: Sellpage Linked Ads Tree View

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `02c2498`                                     |
| **Build**   | GREEN (15 routes, 0 TS errors)                |

---

## Summary

Added a collapsible "Linked Ads" section to the sellpage detail page. Fetches the Campaign > Adset > Ad hierarchy from `GET /sellpages/:id/linked-ads` and renders it as a nested tree view with status badges and FB Post IDs. The section uses a `border-left` + `padding-left` nesting pattern and auto-collapses when there are more than 5 campaigns.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `LinkedAdPost`, `LinkedAd`, `LinkedAdset`, `LinkedCampaign`, and `LinkedAdsResponse` interfaces matching the backend `GET /sellpages/:id/linked-ads` response shape |
| `apps/web/src/app/(portal)/sellpages/[id]/page.tsx` | **Modified** | Added Linked Ads section with collapsible header (Megaphone icon + chevron toggle), nested tree view rendering, loading skeleton, empty state, and total ads count in header |

---

## Decisions & Technical Notes

### Collapsible Section

- **Toggle pattern**: Clickable header row with `ChevronRight` (collapsed) / `ChevronDown` (expanded) icon. Full-width button with `hover:bg-muted/30` for visual feedback.
- **Auto-collapse logic**: Uses `linkedAdsExpanded` state initialized to `null`. After fetch completes, if still `null`, sets to `true` if `campaigns.length <= 5`, otherwise `false`. Manual toggle overrides the auto behavior permanently.
- **Icon**: `Megaphone` from lucide-react, placed next to the chevron.

### Tree View Layout

- **Nesting**: Each level uses `ml-4 border-l-2 border-border pl-4` to create a visual tree line. Campaign level has no left border (root), adsets get one level of nesting, ads get two levels.
- **Status badges**: Reuses the existing `StatusBadge` component which already handles `ACTIVE` (green), `PAUSED` (yellow), `ARCHIVED` (gray).
- **FB Post ID**: Displayed as monospace text after the ad's status badge, prefixed with "FB Post:". Only shown when `ad.adPost` is non-null.
- **Row spacing**: Each row uses `py-1.5` for compact but readable spacing.

### Fetch Strategy

- **Parallel fetch**: `fetchSellpage()` and `fetchLinkedAds()` are called together in the same `useEffect`. Linked ads loading has its own `linkedAdsLoading` state independent from the main page loading.
- **Error handling**: Uses `toastApiError()` for toast notification on fetch failure. Does not block the rest of the page if linked-ads fetch fails — the section simply shows no data.
- **Loading skeleton**: Three progressively indented skeleton bars simulating the tree hierarchy.

### Total Ads Count

- **Calculation**: Computed via nested `.reduce()` over `campaigns > adsets > ads.length`. Displayed in the header as "Linked Ads ({count})".
- **Hidden during loading**: Count is only shown when `linkedAdsLoading` is false.

### Position in Page

- **After edit form, before info cards**: The Linked Ads section is placed between the edit form (or header when not editing) and the URL/Product info cards. This gives it high visibility as the primary data relationship section.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (15/15)
             15 routes, 0 errors
```

### Route Output (changed)
```
ƒ /sellpages/[id]                      8.68 kB    (was 8.02 kB, +Linked Ads tree)
```

### Manual Verification Checklist
- [x] `api.ts` — `LinkedAdPost` has externalPostId, pageId, createdAt
- [x] `api.ts` — `LinkedAd` has id, name, status, adPost (nullable)
- [x] `api.ts` — `LinkedAdset` has id, name, status, ads array
- [x] `api.ts` — `LinkedCampaign` has id, name, status, adsets array
- [x] `api.ts` — `LinkedAdsResponse` has campaigns array
- [x] Detail page — fetches GET /sellpages/:id/linked-ads on mount
- [x] Detail page — collapsible header with chevron + Megaphone icon
- [x] Detail page — total ads count in header "(N)"
- [x] Detail page — auto-collapse when > 5 campaigns
- [x] Detail page — nested tree with border-left + padding-left
- [x] Detail page — StatusBadge on each campaign, adset, ad
- [x] Detail page — FB Post ID shown for ads with adPost
- [x] Detail page — empty state: "No campaigns linked to this sellpage yet"
- [x] Detail page — loading skeleton (3 indented bars)
- [x] Detail page — toast error on fetch failure
- [x] No changes to existing components, auth logic, or backend endpoints
