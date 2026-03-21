# TASK-B7: Creatives Module UI — List + Detail + Asset Slots

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `fde9e51`                                     |
| **Build**   | GREEN (18 routes, 0 TS errors)                |

---

## Summary

Built the full Creatives module UI: list page with DataTable, status/type filters, create modal; detail page with inline edit, 6-slot asset grid, Validate button (DRAFT→READY), and Preview button (GET /render). Added Creatives to sidebar navigation with Palette icon.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `CreativeType`, `AssetRole` type aliases; `CreativeAsset`, `CreativeListItem`, `CreativeDetail`, `CreativesListResponse`, `CreateCreativeDto`, `UpdateCreativeDto` interfaces |
| `apps/web/src/app/(portal)/creatives/page.tsx` | **Created** | Creatives list page with PageShell, DataTable, status/type filters, search, offset pagination, "New Creative" modal (name, type, optional product dropdown) |
| `apps/web/src/app/(portal)/creatives/[id]/page.tsx` | **Created** | Creative detail page with inline edit (name, type, product), 6-slot asset grid, Validate button (DRAFT only), Preview button, metadata display |
| `apps/web/src/components/Sidebar.tsx` | **Modified** | Added `Palette` import, inserted `{ label: 'Creatives', href: '/creatives', icon: Palette }` between Sellpages and Products |

---

## Decisions & Technical Notes

### Types (api.ts)

- **`CreativeType`**: Union type `'VIDEO_AD' | 'IMAGE_AD' | 'TEXT_ONLY' | 'UGC_BUNDLE'`.
- **`AssetRole`**: Union type `'PRIMARY_VIDEO' | 'THUMBNAIL' | 'PRIMARY_TEXT' | 'HEADLINE' | 'DESCRIPTION' | 'EXTRA'`.
- **`CreativeAsset`**: Contains `role`, `assetId`, and nested `asset` object with `filename`, `mimeType`, `url`.
- **`CreativeListItem`**: Flat shape for list view — includes `product: { id, name } | null` for the table column.
- **`CreativeDetail`**: Extends list item with `metadata` and `assets` array.

### Creatives List Page

- **Table columns**: Name (with type subtitle), Type, Status, Product, Created, action chevron.
- **Filters**: Status dropdown (ALL/DRAFT/READY/ARCHIVED), Type dropdown (ALL + 4 types). Both reset page to 1 on change.
- **Create modal**: Same architecture as Sellpages create modal — `fixed inset-0 z-[100]`, backdrop click closes. Products lazy-loaded on first modal open.
- **Type labels**: `TYPE_LABELS` map converts `VIDEO_AD` → "Video Ad" for display. Used in both list page and detail page.
- **Pagination**: Offset-based (page/limit) like Sellpages, not cursor-based like Orders.

### Creative Detail Page

- **Inline edit**: Same toggle pattern as Sellpages — Edit/Cancel button, `border-primary/20` highlighted form. Fields: name, type (select), product (optional select). Products lazy-loaded on first edit click via `loadProducts()`.
- **Delta-only PATCH**: Only changed fields sent. Product comparison handles `null` → `undefined` correctly.
- **Validate button**: Green, only visible when `status === 'DRAFT'`. Calls `POST /creatives/:id/validate`, then re-fetches to get updated status. Shows spinner while in flight.
- **Preview button**: Always visible. Calls `GET /creatives/:id/render`. Handles two response shapes: `{ url }` opens URL directly, `{ html }` creates blob URL and opens in new tab. Falls back to warning toast if neither field exists.

### Asset Slots Grid

- **6 slots**: PRIMARY_VIDEO (Film), THUMBNAIL (Image), PRIMARY_TEXT (Type), HEADLINE (FileText), DESCRIPTION (AlignLeft), EXTRA (Layers). Each has a dedicated lucide icon.
- **Grid layout**: 2 columns on md+, 1 column on mobile.
- **Assigned vs empty**: Assigned slots get `border-primary/30` (solid), empty slots get `border-border border-dashed`. Icon color changes from `text-muted-foreground` to `text-primary` when assigned.
- **Asset info**: Shows filename, mimeType, and "View asset" link opening the URL in a new tab.
- **Asset map**: `new Map(creative.assets.map(a => [a.role, a]))` for O(1) lookup by role.
- **Role code**: Shown as monospace text in top-right corner of each slot card for debugging reference.

### Metadata Display

- Only rendered if `metadata` is non-null and has keys.
- Displayed as JSON in a `<pre>` block with `font-mono bg-muted/50`.

### Sidebar Navigation

- Creatives placed between Sellpages and Products in the nav order — logical grouping with content-related items.
- Uses `Palette` icon from lucide-react.

### StatusBadge Compatibility

- `DRAFT` → gray (already in StatusBadge COLOR_MAP)
- `READY` → needs to map; StatusBadge falls back to gray for unknown statuses. READY will show as gray fallback which is acceptable, but for better UX the StatusBadge could be extended later to map READY → green.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (16/16)
             18 routes, 0 errors
```

### Route Output (new)
```
○ /creatives                           5.35 kB    (NEW — list + create modal)
ƒ /creatives/[id]                      8.51 kB    (NEW — detail + asset slots)
```

### Manual Verification Checklist
- [x] `api.ts` — `CreativeType` union with 4 values
- [x] `api.ts` — `AssetRole` union with 6 values
- [x] `api.ts` — `CreativeAsset` with nested asset object
- [x] `api.ts` — `CreativeListItem` with product nullable
- [x] `api.ts` — `CreativeDetail` extends list item with assets + metadata
- [x] `api.ts` — `CreateCreativeDto` with name (required), type (required), productId (optional)
- [x] `api.ts` — `UpdateCreativeDto` all fields optional
- [x] List page — DataTable with 6 columns
- [x] List page — Status filter (4 options)
- [x] List page — Type filter (5 options including ALL)
- [x] List page — Search with debounced submit
- [x] List page — Offset pagination
- [x] List page — "New Creative" button opens modal
- [x] Create modal — name, type select, optional product dropdown
- [x] Create modal — POST /creatives, redirect to detail on success
- [x] Create modal — error display, loading spinner, backdrop click close
- [x] Detail page — header with name, status badge, type label
- [x] Detail page — Edit/Cancel toggle with inline form
- [x] Detail page — PATCH with delta-only payload
- [x] Detail page — Validate button (green, DRAFT only) → POST /:id/validate
- [x] Detail page — Preview button → GET /:id/render (opens new tab)
- [x] Detail page — 6 asset slot cards in 2-column grid
- [x] Detail page — assigned slots: solid border, primary icon, file info + link
- [x] Detail page — empty slots: dashed border, muted icon, "Empty" text
- [x] Detail page — metadata JSON display (conditional)
- [x] Detail page — info cards (Details + Linked Product)
- [x] Sidebar — Creatives with Palette icon between Sellpages and Products
- [x] Toast feedback for all create/edit/validate/preview actions
- [x] No changes to existing components or backend endpoints
