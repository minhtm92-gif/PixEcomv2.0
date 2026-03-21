# TASK-B5: Sellpage Create + Edit + Publish UI

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-21                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `1878d66`                                     |
| **Build**   | GREEN (16 routes, 0 TS errors)                |

---

## Summary

Wired full sellpage CRUD UI: create via modal on the list page, inline edit on the detail page, and publish/unpublish state transitions. All three operations use existing backend endpoints with delta-only PATCH payloads and toast feedback.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `CreateSellpageDto` and `UpdateSellpageDto` interfaces matching backend POST/PATCH contracts |
| `apps/web/src/app/(portal)/sellpages/page.tsx` | **Modified** | Added "New Sellpage" button in PageShell actions slot; modal form with product dropdown (lazy-loaded from GET /products), slug, title/desc overrides; POST /sellpages on submit; redirect to detail on success |
| `apps/web/src/app/(portal)/sellpages/[id]/page.tsx` | **Modified** | Added inline edit mode (Edit/Cancel toggle), editable slug + title + description fields, PATCH /sellpages/:id save; Publish (green, DRAFT) / Unpublish (amber, PUBLISHED) buttons with POST /:id/publish and /:id/unpublish; re-fetches data after state transitions |

---

## Decisions & Technical Notes

### Create Modal (List Page)

- **Product dropdown**: Products are fetched lazily on first modal open (`GET /products?limit=100`), then cached in component state. Shows `name (code)` for each option.
- **Modal architecture**: Hand-built overlay (no Radix/Headless UI) with `fixed inset-0 z-[100]`, backdrop with `bg-black/60`, centered panel. Backdrop click closes unless a request is in flight.
- **Optional fields**: `titleOverride` and `descriptionOverride` are only included in the POST body if non-empty, keeping the payload minimal.
- **Success flow**: On successful POST, immediately navigates to `/sellpages/{id}` for the newly created sellpage.
- **Uses `PageShell.actions`**: The "New Sellpage" button uses the existing `actions` prop slot of the PageShell component (top-right corner).

### Inline Edit (Detail Page)

- **Toggle pattern**: Edit button shows form card with `border-primary/20` highlight; Cancel button hides it. Form state is populated from the current sellpage data when entering edit mode.
- **Delta-only PATCH**: Only changed fields are sent. If nothing changed, the PATCH still fires (backend handles no-op gracefully). Uses `UpdateSellpageDto` type.
- **Immediate state update**: On successful PATCH, the response is used to update the local `sp` state directly, avoiding an extra GET request.

### Publish / Unpublish (Detail Page)

- **Conditional rendering**: `isDraft` shows green "Publish" button, `isPublished` shows amber "Unpublish" button. Other statuses (ARCHIVED) show neither.
- **Re-fetch after action**: After POST /publish or /unpublish succeeds, `fetchSellpage()` is called to get the fresh status from the server (rather than optimistically setting it client-side).
- **Spinner**: Both buttons show `Loader2` spinner while the request is in flight.

### Status detection

Uses `.toUpperCase()` comparison for safety: `sp.status.toUpperCase() === 'DRAFT'`. This handles any case variations from the backend.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (15/15)
             16 routes, 0 errors
```

### Route Output (changed)
```
○ /sellpages                           3.94 kB    (MODIFIED — was 3.25 kB)
ƒ /sellpages/[id]                      8.02 kB    (MODIFIED — was 2.48 kB)
```

### Manual Verification Checklist
- [x] `api.ts` — `CreateSellpageDto` matches POST /sellpages body; `UpdateSellpageDto` matches PATCH body
- [x] List page — "New Sellpage" button in PageShell actions slot
- [x] Modal — product dropdown lazy-loads from GET /products, required fields validated
- [x] Modal — POST /sellpages on submit, redirect to detail on success
- [x] Modal — error display, loading spinner, backdrop click to close
- [x] Detail page — Edit button toggles inline form with slug/title/desc fields
- [x] Detail page — PATCH /sellpages/:id with delta-only payload
- [x] Detail page — Publish button (green, DRAFT only) → POST /:id/publish
- [x] Detail page — Unpublish button (amber, PUBLISHED only) → POST /:id/unpublish
- [x] Detail page — data re-fetched after publish/unpublish
- [x] Toast feedback for all create/edit/publish/unpublish actions
- [x] No changes to existing components, auth logic, or backend endpoints
