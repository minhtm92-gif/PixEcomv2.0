# TASK-C6-FRONTEND: Campaign Adset/Ad Management + Ad-Post Linking

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `abe9fc8`                                     |
| **Build**   | GREEN (20 routes, 0 TS errors)                |

---

## Summary

Extended `/campaigns/[id]` with a full nested Adsets → Ads → AdPost management tree. The Adsets section is collapsible with an "Add Adset" modal (name, optimization goal, JSON targeting). Each adset is an expandable card that lazy-loads its ads. Each ad row expands to show its ad-post info (or a "Link Post" button to open the ad-post modal). Status badges use `isDraftAdUnit()` for consistent Draft/Active/Paused/Archived mapping.

**Key fix**: `Adset`, `Ad`, `AdDetail` names already existed in `api.ts` for the analytics/ads-manager module. Renamed new ad-unit management types to `AdsetUnit`, `AdUnit`, `AdUnitDetail`, etc. to avoid TypeScript declaration merging conflicts.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `AdUnitStatus`, `OptimizationGoal`, `AdsetUnit`, `AdsetUnitDetail`, `AdsetUnitsListResponse`, `AdUnit`, `AdPostItem`, `AdUnitDetail`, `AdUnitsListResponse`, `CreateAdsetDto`, `CreateAdDto`, `CreateAdPostDto`, `isDraftAdUnit()` |
| `apps/web/src/app/(portal)/campaigns/[id]/page.tsx` | **Modified** | Full rewrite adding `AdsetsSection`, `AdsetCard`, `AdRow`, `ModalShell` components; all existing campaign functionality preserved |

---

## Decisions & Technical Notes

### Type Naming Conflict Resolution

The existing `api.ts` had `Adset`, `Ad`, `Campaign` interfaces for the analytics module (extends `AdsMetrics`, `status: string`). New ad-unit management types use:
- `AdsetUnit` instead of `Adset`
- `AdUnit` instead of `Ad`
- `AdUnitDetail` instead of `AdDetail`
- `AdsetUnitsListResponse` / `AdUnitsListResponse`

TypeScript cast `as AdUnitStatus` needed at call sites because prop-passing widens the type in strict mode.

### Component Architecture

All sub-components live in the same file (single-file pattern, same as other detail pages):

```
CampaignDetailPage
  └── AdsetsSection (fetches on mount)
        └── AdsetCard (expandable, lazy-loads ads)
              └── AdRow (expandable, lazy-loads AdDetail)
                    └── Link Post Modal
        └── Add Adset Modal
```

Shared: `ModalShell`, `ConfirmDialog`, `StatusBadge`, `inputCls`/`selectCls`

### AdsetsSection

- Fetches `GET /campaigns/:id/adsets?limit=50` on mount.
- Collapsible via chevron in section header. Starts expanded.
- Count badge shows after first fetch.
- "Add Adset" button in header (stopPropagation to avoid collapse toggle).
- Empty state with "Create First Adset" CTA.

### Add Adset Modal Fields

- **Name** (required): text input
- **Optimization Goal** (optional): select from CONVERSIONS, LINK_CLICKS, IMPRESSIONS, REACH
- **Targeting** (optional): textarea with JSON validation before submit. Error shown inline. Empty = null sent to API.

### AdsetCard

- Header: Layers icon, name, optimization goal subtitle, status badge, ad count (after fetch), "+ Ad" quick button, chevron.
- Lazy fetch: `GET /adsets/:id/ads?limit=50` triggered on first expand.
- Ads list nested with `ml-4 border-l-2 border-border` tree indentation pattern.
- Empty ads state with "Add First Ad" CTA.

### AdRow

- Header: Film icon, ad name, status badge, loading spinner, chevron.
- Expand triggers `GET /ads/:id` for ad detail (with `adPosts` array).
- Ad-post display: page name, external post ID, link date, "Change" button.
- No post yet: "Link Post" button → Link Post Modal.
- Ad-post allowed to be re-linked (Change button shows even when post exists).

### Link Post Modal

- Loads `GET /fb/connections?connectionType=PAGE` lazily when modal opens.
- Select: page dropdown (required).
- Text: External Post ID (optional, trimmed before send).
- Submits `POST /ads/:id/ad-post` → updates local `adDetail` state.

### Status Helper

```typescript
isDraftAdUnit(c): boolean
  → c.status === 'PAUSED' && !(externalAdsetId || externalAdId)
```

Used in both `AdsetCard` and `AdRow` for Draft/Active/Paused/Archived badge determination.

---

## Build Fixes

1. **TS conflict**: `Adset` / `Ad` already declared as analytics types → renamed to `AdsetUnit` / `AdUnit` etc.
2. **Type widening**: `ad.status` inferred as `string` in strict mode → added `as AdUnitStatus` cast.
3. Both fixes required, build was RED → GREEN after both applied.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (18/18)
             20 routes, 0 errors
```

### Route Output (changed)
```
ƒ /campaigns/[id]   11.4 kB   98.6 kB  (was 8.33 kB — +3 kB for adset/ad tree)
```

### Manual Verification Checklist
- [x] `api.ts` — `AdsetUnit` has status as `AdUnitStatus`, externalAdsetId, optimizationGoal, targeting
- [x] `api.ts` — `AdUnit` has externalAdId
- [x] `api.ts` — `AdUnitDetail` extends AdUnit with adPosts array
- [x] `api.ts` — `AdPostItem` has pageId, pageName, externalPostId
- [x] `api.ts` — `isDraftAdUnit()` checks PAUSED + no externalId
- [x] `api.ts` — `CreateAdsetDto` has name, optional optimizationGoal, optional targeting
- [x] `api.ts` — No type name conflicts with existing analytics types
- [x] Campaign detail — `AdsetsSection` fetches on mount
- [x] Adsets section — collapsible, count badge, "Add Adset" button
- [x] Add Adset modal — name required, optional goal + JSON targeting
- [x] Add Adset modal — JSON validation with inline error
- [x] Adset card — expandable, lazy-loads ads
- [x] Adset card — status badge correct (Draft/Active/Paused/Archived)
- [x] Adset card — "+ Ad" quick button in header
- [x] Ads list — border-l-2 tree nesting pattern
- [x] Ad row — expandable, lazy-loads GET /ads/:id
- [x] Ad row — shows linked post (page name + post ID)
- [x] Ad row — "Link Post" button when no post linked
- [x] Ad row — "Change" button to re-link post
- [x] Link Post modal — loads FB Page connections
- [x] Link Post modal — page required, external post ID optional
- [x] All existing campaign functionality (edit, launch/pause/resume, info cards) preserved
