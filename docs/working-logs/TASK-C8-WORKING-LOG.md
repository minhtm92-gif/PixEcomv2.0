# TASK-C8: Meta OAuth Connect + FB Connections Management

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `5a247ac`                                     |
| **Build**   | GREEN (17 routes, 0 TS errors)                |

---

## Summary

Added Facebook Connections management to the Settings page (Section 3) and created an OAuth callback page at `/auth/meta/callback`. Sellers can initiate Meta OAuth flow via "Connect Facebook" button, manage existing connections (toggle active/inactive, inline rename, delete), and view connection details (type, FB user, external ID, last sync).

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `FbConnection`, `FbConnectionsResponse`, `MetaAuthUrlResponse` interfaces for FB connection management |
| `apps/web/src/app/(portal)/settings/page.tsx` | **Modified** | Added Section 3: Facebook Connections with connection list, toggle, inline rename, delete, and OAuth connect button |
| `apps/web/src/app/auth/meta/callback/page.tsx` | **Created** | OAuth callback page — handles code exchange, success/error states, auto-redirect to /settings |

---

## Decisions & Technical Notes

### Facebook Connections Section (Settings Page)

- **Position**: Section 3, below Store Settings form. Standalone `<div>` (not a form) since actions are individual button clicks, not a unified save.
- **Connect button**: FB blue (#1877F2) background, calls `GET /meta/auth-url` to get the OAuth URL, then `window.location.href` to redirect. Button shows "Redirecting..." with spinner while loading.
- **Connection cards**: Each connection is a bordered card with:
  - **Toggle button**: `ToggleRight` (active, FB blue) / `ToggleLeft` (inactive, muted). Calls `PATCH /fb/connections/:id` with `{ isActive }`.
  - **Name**: Displayed prominently. Click pencil to enter inline edit mode with input + check/cancel buttons. Enter saves, Escape cancels.
  - **Type badge**: Monospace chip showing `Ad Account`, `Page`, or `Pixel` from `CONNECTION_TYPE_LABELS` map.
  - **Metadata**: FB user name and external ID shown in muted text.
  - **Status pill**: Green "Active" or gray "Inactive" rounded badge.
  - **Delete button**: Trash icon, turns red on hover. Calls `DELETE /fb/connections/:id` with optimistic removal from local state.
  - **Last sync**: Shown below the card when `lastSyncAt` is non-null.
- **Active card styling**: Active connections get `border-[#1877F2]/30 bg-[#1877F2]/5`, inactive get `border-border bg-muted/30`.
- **Empty state**: Facebook icon (muted), text "No Facebook connections yet" with helper text to click Connect.
- **Loading skeleton**: Two 16px-height skeleton bars.

### OAuth Callback Page

- **Route**: `/auth/meta/callback` — outside `(portal)` route group, no sidebar/auth wrapper.
- **Suspense boundary**: Required by Next.js 14 for `useSearchParams()`. Wrapped inner `MetaCallbackContent` in `<Suspense>` with spinner fallback.
- **Error handling**: Checks for `error` query param (FB denial), missing `code` param, and API errors. All three cases show error state with red XCircle icon and "Back to Settings" button.
- **Success flow**: Calls `GET /meta/callback?code=...&state=...` to exchange the code on the backend, shows green CheckCircle, then auto-redirects to `/settings` after 2 seconds.
- **States**: `processing` (spinner + FB blue), `success` (green check), `error` (red X + message + back button).

### API Integration

- **Imports**: Added `apiDelete` import to Settings page (already exported from `apiClient.ts`).
- **FB types**: `FbConnection` interface with `id`, `sellerId`, `fbUserId`, `fbUserName`, `name`, `connectionType` (AD_ACCOUNT | PAGE | PIXEL), `externalId`, `isActive`, `lastSyncAt`, `createdAt`, `updatedAt`.
- **Endpoints used**:
  - `GET /meta/auth-url` → `{ url }` for OAuth redirect
  - `GET /meta/callback?code=...&state=...` → code exchange
  - `GET /fb/connections` → list connections
  - `PATCH /fb/connections/:id` → update name or isActive
  - `DELETE /fb/connections/:id` → soft delete

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (17/17)
             17 routes, 0 errors
```

### Route Output (new/changed)
```
○ /auth/meta/callback                  4.78 kB    92 kB   (NEW)
○ /settings                            8.54 kB    95.8 kB (was ~5 kB, +FB Connections)
```

### Manual Verification Checklist
- [x] `api.ts` — `FbConnection` has all fields (id, sellerId, fbUserId, fbUserName, name, connectionType, externalId, isActive, lastSyncAt, createdAt, updatedAt)
- [x] `api.ts` — `FbConnectionsResponse` has `data: FbConnection[]`
- [x] `api.ts` — `MetaAuthUrlResponse` has `url: string`
- [x] Settings page — fetches GET /fb/connections on mount
- [x] Settings page — "Connect Facebook" button with FB blue (#1877F2)
- [x] Settings page — connection cards with toggle, name, type badge, external ID
- [x] Settings page — inline rename with Enter/Escape keyboard support
- [x] Settings page — delete with trash icon and loading spinner
- [x] Settings page — active/inactive styling (FB blue vs muted)
- [x] Settings page — empty state with Facebook icon
- [x] Settings page — loading skeleton
- [x] Callback page — Suspense boundary for useSearchParams
- [x] Callback page — handles FB error query param
- [x] Callback page — handles missing code
- [x] Callback page — exchanges code via GET /meta/callback
- [x] Callback page — auto-redirect to /settings after 2s on success
- [x] Callback page — error state with "Back to Settings" button
- [x] No changes to existing components, auth logic, or backend endpoints
