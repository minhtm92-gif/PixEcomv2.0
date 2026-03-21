# TASK-B1: Seller Settings Page + Sidebar Nav

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-21                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `69c4b43`                                     |
| **Build**   | GREEN (16 routes, 0 TS errors)                |

---

## Summary

Created a seller settings page at `/settings` with two form sections (Store Profile and Store Settings), connected to the existing backend endpoints. Added "Settings" nav item to the seller sidebar.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/types/api.ts` | **Modified** | Added 4 interfaces: `SellerProfile`, `SellerSettings`, `UpdateSellerDto`, `UpdateSellerSettingsDto` — matching backend GET/PATCH contracts |
| `apps/web/src/app/(portal)/settings/page.tsx` | **Created** | Full settings page with 2 form sections, loading skeletons, PATCH with delta-only payloads, toast feedback on save |
| `apps/web/src/components/Sidebar.tsx` | **Modified** | Added `Settings` nav item (lucide `Settings` icon) between Products and Health |

---

## Decisions & Technical Notes

### Page Architecture

Two independent forms, each with its own fetch/save lifecycle:

1. **Store Profile** — `GET /sellers/me` + `PATCH /sellers/me`
   - Fields: Store Name (text), Logo URL (text)
   - Shows read-only metadata: slug, isActive status

2. **Store Settings** — `GET /sellers/me/settings` + `PATCH /sellers/me/settings`
   - Fields: Brand Name, Currency (select), Timezone (select), Support Email, Meta Pixel ID, Google Analytics ID
   - Tracking fields grouped under a sub-header with divider

### Delta-Only PATCH

Both save handlers compute a delta object, only including fields that changed from the last-fetched value. This avoids sending unchanged fields and prevents unnecessary backend writes. Example:

```typescript
const body: UpdateSellerDto = {};
if (profileName !== profile?.name) body.name = profileName;
if (profileLogo !== (profile?.logoUrl ?? '')) body.logoUrl = profileLogo;
```

### Select Options

- **Currencies**: USD, VND, EUR — covers the primary markets
- **Timezones**: 12 common zones covering Asia, Americas, Europe, Oceania. Backend stores the IANA timezone string (e.g., `Asia/Ho_Chi_Minh`).

### Loading States

- Both sections show animated pulse skeletons while fetching
- Save buttons show `Loader2` spinner and are disabled during save
- Both fetches run in parallel on mount (independent `useCallback` + `useEffect`)

### Sidebar Placement

Settings added between Products and Health:
```
Orders → Ads Manager → Analytics → Sellpages → Products → Settings → Health
```

This groups operational pages (Orders through Products) together, with Settings as a configuration page, and Health as a debug/monitoring page at the end.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (15/15)
             16 routes, 0 errors
```

### Route Output (new)
```
○ /settings                            6.47 kB    (NEW)
```

### Manual Verification Checklist
- [x] `api.ts` — 4 new interfaces match backend contract exactly
- [x] Settings page — 2 independent forms with separate loading/saving states
- [x] Profile form — name + logoUrl fields, read-only slug + isActive
- [x] Settings form — 6 fields: brandName, currency, timezone, supportEmail, metaPixelId, gaId
- [x] Delta-only PATCH — only changed fields sent to backend
- [x] Toast feedback — success on save, error via `toastApiError`
- [x] Loading skeletons for both sections
- [x] Sidebar — Settings item with gear icon, positioned before Health
- [x] No changes to auth logic, existing pages, or backend
