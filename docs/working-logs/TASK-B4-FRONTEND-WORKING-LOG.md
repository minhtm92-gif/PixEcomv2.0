# TASK-B4: Orders Export/Import UI + Source Badges + Detail Sections

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `c02c05b`                                     |
| **Build**   | GREEN (15 routes, 0 TS errors)                |

---

## Summary

Wired full orders export/import UI: CSV export with current filters, import tracking modal with CSV preview and result display, source filter dropdown with color-coded badges (Facebook=blue, TikTok=pink, Google=green, Email=yellow, Direct=gray, Other=purple), tracking number column with clickable links, and order detail sections for shipping address, payment info, and attribution with UTM params.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `OrderShippingAddress`, `OrderAttribution`, `ImportTrackingResult` interfaces; extended `OrderListItem` with `source`, `trackingNumber`, `trackingUrl`; extended `OrderDetail` with `trackingNumber`, `trackingUrl`, `shippingAddress`, `paymentMethod`, `paymentId`, `attribution` |
| `apps/web/src/app/(portal)/orders/page.tsx` | **Modified** | Added Export CSV button (GET /orders/export blob download), Import Tracking modal (multipart POST /orders/import-tracking with CSV preview + results), Source filter dropdown, `SourceBadge` component with 6-color scheme, Tracking column with clickable links |
| `apps/web/src/app/(portal)/orders/[id]/page.tsx` | **Modified** | Added Shipping Address card (MapPin icon), Payment card (CreditCard icon, method + transaction ID), Attribution section (BarChart3 icon, source badge + UTM params grid), Tracking card (Truck icon, number + external link) |
| `apps/web/package.json` | **Modified** | Added `clsx` and `lucide-react` to dependencies (were previously missing) |
| `pnpm-lock.yaml` | **Modified** | Lock file updated for new dependencies |

---

## Decisions & Technical Notes

### Export CSV (List Page)

- **Raw fetch**: Export uses `fetch()` directly instead of `apiClient.api()` because the response is `text/csv` (blob), not JSON. Uses `getApiBaseUrl()` and `getAccessToken()` for auth.
- **Blob download**: Creates an object URL from the blob, programmatically clicks an `<a>` element with `download` attribute, then cleans up.
- **Filename**: `orders_{dateFrom}_{dateTo}.csv` — includes the date range from filters.
- **Rate limit**: Handles 429 status explicitly with a toast message.
- **Current filters**: Passes all active filters (status, source, dateFrom, dateTo, search) to the export endpoint.

### Import Tracking Modal (List Page)

- **CSV preview**: Uses `FileReader.readAsText()` to parse the CSV client-side, showing header + first 5 data rows in a table. Simple comma-split with quote stripping.
- **Multipart upload**: Uses native `FormData` with `fetch()` — cannot use `apiClient.api()` because it forces `Content-Type: application/json`. No `Content-Type` header is set so the browser auto-generates the multipart boundary.
- **Result display**: Shows green checkmark with updated count and amber warning with failed count. Error details shown in a scrollable red-bordered list with row number, order number, and reason.
- **Modal architecture**: Same pattern as sellpages create modal — `fixed inset-0 z-[100]`, backdrop, centered panel. Backdrop click closes unless import is in flight.
- **Auto-refresh**: After successful import, calls `fetchOrders()` to refresh the list.

### Source Badges

- **Color mapping**: Case-insensitive lookup via `.toLowerCase()`. Unknown sources fall back to purple "Other" style.
- **Badge style**: Rounded-full pill with `border`, background at 15% opacity, text at full color.
- **Shared component**: `SourceBadge` is defined locally in both `page.tsx` and `[id]/page.tsx`. The list page version accepts `string | null` (shows "—" for null), the detail page version accepts `string` (only rendered when source exists).

### Source Filter (List Page)

- **Values**: ALL, Facebook, TikTok, Google, Email, Direct, Other. Passes `source` query param to the API when not "ALL".
- **Triggers re-fetch**: Source filter is included in the `fetchOrders` dependency array via `useCallback`.

### Tracking Column (List Page)

- **Clickable links**: If `trackingUrl` is present, renders as a primary-colored link that opens in a new tab. `onClick` uses `stopPropagation()` to prevent the row click handler from navigating to the detail page.
- **Fallback**: If only `trackingNumber` exists (no URL), shows it as plain monospace text.

### Order Detail — New Sections

- **Shipping Address**: Renders `name`, `line1`, `line2`, `city/state/postalCode`, `country`. Only shows the card if at least one address field is present.
- **Payment**: Shows payment method (capitalized) and transaction ID (monospace). Only shows if either field exists.
- **Attribution**: Shows source badge + UTM params in a responsive 2-3 column grid. Each UTM is a tag-style element (`bg-muted/50` bordered box). Only renders section if source or utmSource exists.
- **Tracking**: Shows tracking number (monospace) with external link if `trackingUrl` exists. Only renders if either field is present.
- **Layout order**: Customer + Totals → Shipping + Payment → Attribution → Tracking → Sellpage → Items → Refresh → Timeline.

### Missing Dependencies Fix

- `clsx` and `lucide-react` were being used across the codebase but not listed in `apps/web/package.json` dependencies. Added both to unblock the build.

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
○ /orders                              7.16 kB    (was ~5 kB, +Export/Import/Source/Tracking)
ƒ /orders/[id]                         8.13 kB    (was ~5 kB, +Shipping/Payment/Attribution/Tracking)
```

### Manual Verification Checklist
- [x] `api.ts` — `OrderShippingAddress` has 7 nullable string fields
- [x] `api.ts` — `OrderAttribution` has source + 5 UTM fields, all nullable
- [x] `api.ts` — `ImportTrackingResult` has updated/failed counts + errors array
- [x] `api.ts` — `OrderListItem` extended with source, trackingNumber, trackingUrl
- [x] `api.ts` — `OrderDetail` extended with 6 new fields
- [x] List page — Export CSV button with spinner, downloads blob as CSV file
- [x] List page — Import Tracking button opens modal
- [x] Import modal — CSV file picker, preview table (header + 5 rows)
- [x] Import modal — Import button with spinner, result display (updated/failed/errors)
- [x] List page — Source filter dropdown (7 options)
- [x] List page — SourceBadge with 6 color variants (blue/pink/green/yellow/gray/purple)
- [x] List page — Tracking column with clickable links (stopPropagation)
- [x] Detail page — Shipping Address card with MapPin icon
- [x] Detail page — Payment card with CreditCard icon
- [x] Detail page — Attribution section with SourceBadge + UTM grid
- [x] Detail page — Tracking card with Truck icon + external link
- [x] Detail page — All new sections conditionally rendered (null-safe)
- [x] No changes to existing components, auth logic, or backend endpoints
