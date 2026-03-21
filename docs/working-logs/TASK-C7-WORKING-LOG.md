# TASK-C7-FRONTEND: Asset Upload + Creative Slot Assignment

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-22                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `ec95715`                                     |
| **Build**   | GREEN (20 routes, 0 TS errors)                |

---

## Summary

Created a full asset upload flow for the Creatives module. Added a reusable `AssetUploader` component with drag-and-drop, file validation, and a 4-step R2 signed URL upload pipeline with XHR progress tracking. Extended the creative detail page to wire the uploader into each of the 6 asset slots, add asset preview (image thumbnail, video placeholder, text marker), and support Replace + Remove actions per slot.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added `UploadUrlResponse { uploadUrl, assetId }` |
| `apps/web/src/components/AssetUploader.tsx` | **Created** | Drag-and-drop upload component with file validation, XHR progress, 4-step R2 upload |
| `apps/web/src/app/(portal)/creatives/[id]/page.tsx` | **Modified** | Added upload modal, remove confirm dialog, asset previews, Replace/Remove slot actions |

---

## Decisions & Technical Notes

### Upload Flow (4 steps)

```
1. POST /assets/upload-url { filename, mimeType, size }
   → { uploadUrl, assetId }

2. PUT uploadUrl (R2 signed URL)
   → Direct to R2, no Authorization header
   → XMLHttpRequest for upload.onprogress events

3. POST /assets { filename, mimeType, size, url: "https://cdn.pixelxlab.com/<assetId>" }
   → Registers asset record in backend

4. onSuccess(assetId) called → parent does POST /creatives/:id/assets
```

### Why XHR instead of fetch()

`fetch()` does not expose upload progress events. `XMLHttpRequest` provides `xhr.upload.onprogress` which fires with `loaded` and `total` bytes. The progress bar uses this to show `${progress}%` fill.

### R2 PUT — No Auth Header

The signed URL from R2 contains all auth embedded in the URL itself (HMAC signature). Sending an `Authorization` header would cause a 400 conflict. The `PUT` is done with `Content-Type` only.

### File Validation

| Type | Max Size |
|------|----------|
| image/jpeg, image/png, image/gif, image/webp | 10 MB |
| video/mp4, video/webm | 50 MB |

Validation runs client-side on file selection (both drag-drop and file picker). Error shown inline below the drop zone.

### Upload Stages

```typescript
type UploadStage = 'idle' | 'getting-url' | 'uploading' | 'registering' | 'done' | 'error';
```

Progress bar shows 5% width for `getting-url` and `registering` phases (indeterminate feel), and actual `${progress}%` during `uploading` phase.

### Asset Preview Logic

```
image/* → <img> with object-cover, h-32, onError hides broken image
video/* → Play icon + "View video" link (CDN link opens in new tab)
text roles (PRIMARY_TEXT, HEADLINE, DESCRIPTION) → "Text asset" placeholder box
other → text placeholder
```

### Component Architecture

```
CreativeDetailPage
  └── Asset Slots Grid (6 slots: PRIMARY_VIDEO, THUMBNAIL, PRIMARY_TEXT, HEADLINE, DESCRIPTION, EXTRA)
        ├── Empty slot → "Upload & Assign" button → ModalShell → AssetUploader
        │     └── onSuccess(assetId) → POST /creatives/:id/assets → refetch
        └── Filled slot → AssetPreview + "Replace" button (re-opens uploader) + "Remove" button
              └── Remove → ConfirmRemoveDialog → DELETE /creatives/:id/assets/:role → refetch
```

### ModalShell & ConfirmRemoveDialog

Both are single-file sub-components (same pattern as campaigns/[id]/page.tsx). `ModalShell` at `z-[100]`, `ConfirmRemoveDialog` at `z-[110]` so confirm sits above upload modal if both are ever triggered.

### Remove Semantics

`DELETE /creatives/:id/assets/:role` unlinks the slot (deletes the `CreativeAsset` join record). The underlying `Asset` record and R2 file are NOT deleted. Confirm message makes this clear: "This unlinks the slot but does not delete the asset file."

### Assigning State

After `AssetUploader.onSuccess()` fires, `uploadRole` is cleared (modal closes) and `assigning = true` while `POST /creatives/:id/assets` + `fetchCreative()` runs. A spinner in the header indicates this. All slot buttons are disabled during `assigning`.

---

## Build Fixes

No build errors. The only potential issue was importing `getAccessToken` from `apiClient` (unused — XHR bypasses apiClient). Removed before build.

Also removed unused `isTextRole()` function from page.tsx (defined during drafting, not needed in final JSX).

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
ƒ /creatives/[id]   8.87 kB   98.9 kB  (was ~6.4 kB — +2.5 kB for uploader + previews)
```

### Manual Verification Checklist
- [x] `api.ts` — `UploadUrlResponse` has `uploadUrl: string` and `assetId: string`
- [x] `AssetUploader` — drag & drop zone highlights on dragover
- [x] `AssetUploader` — file picker button opens file dialog
- [x] `AssetUploader` — validation: image > 10MB shows error
- [x] `AssetUploader` — validation: video > 50MB shows error
- [x] `AssetUploader` — unsupported MIME type shows error
- [x] `AssetUploader` — X button clears selected file
- [x] `AssetUploader` — Upload button disabled when no file or validating
- [x] `AssetUploader` — Stage labels: "Preparing upload…" / "Uploading… N%" / "Registering asset…"
- [x] `AssetUploader` — Progress bar animates during upload stage
- [x] `AssetUploader` — XHR PUT to R2 signed URL (no Authorization header)
- [x] `AssetUploader` — POST /assets to register asset record
- [x] `AssetUploader` — onSuccess(assetId) called after registration
- [x] Creative detail — empty slot shows "Upload & Assign" button
- [x] Creative detail — upload modal title shows slot label
- [x] Creative detail — after upload success: closes modal → assigns slot → refetches
- [x] Creative detail — image asset shows thumbnail preview (h-32, object-cover)
- [x] Creative detail — video asset shows Play icon + "View video" link
- [x] Creative detail — text asset shows "Text asset" placeholder
- [x] Creative detail — filled slot shows Replace button → re-opens uploader
- [x] Creative detail — filled slot shows Remove button → confirm dialog
- [x] Creative detail — confirm dialog shows slot label name
- [x] Creative detail — confirm says "unlinks slot, does not delete file"
- [x] Creative detail — remove: DELETE /creatives/:id/assets/:role → refetch
- [x] Creative detail — assigning spinner shown in header during assign
- [x] Creative detail — slot buttons disabled during assigning/removing
- [x] All existing functionality (edit, validate, preview, metadata) preserved
