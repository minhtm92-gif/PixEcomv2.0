# TASK-D-PREVIEW-3A: Preview Mode Bypass + Landing Page + Cross-Nav

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-23                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `64cc142`                                     |
| **Build**   | GREEN (46 routes, 0 TS errors)                |

---

## Problem

D-PREVIEW-1 admin pages use `useAuthStore` → `isSuperadmin` guard. Deployed without an API backend, auth always fails → admin layout redirects to `/admin` login → **admin pages unreachable** in static preview.

---

## Solution

`NEXT_PUBLIC_PREVIEW_MODE=true` env flag → entire auth flow short-circuits. All three layers updated:
1. Admin dashboard layout → renders content directly, no auth check
2. Admin login page → immediately redirects to `/admin/dashboard`
3. Root page → redirects to `/preview` hub

Added `/preview` landing page as unified entry point, and cross-nav links between admin and storefront.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/admin/(dashboard)/layout.tsx` | Added IS_PREVIEW branch — renders `AdminSidebar + children` immediately, no auth check; mobile fallback header (PixEcom Admin + "Desktop recommended") |
| `apps/web/src/app/admin/page.tsx` | Added IS_PREVIEW redirect to `/admin/dashboard` + loading screen while redirecting |
| `apps/web/src/app/page.tsx` | Server-side `redirect('/preview')` when IS_PREVIEW; original static page preserved as else branch |
| `apps/web/src/components/AdminSidebar.tsx` | PREVIEW badge in brand header; `Storefront ↗` + `← Preview Hub` links in nav; bottom section shows "Preview Mode / No auth required" (hides logout button) |
| `apps/web/src/components/storefront/StorefrontFooter.tsx` | IS_PREVIEW adds `🛡 View Admin Portal →` and `← Preview Hub` links at bottom |
| `apps/web/src/app/preview/page.tsx` | **NEW** — Hub landing page with Admin Portal card (amber) + Customer Storefront card (indigo) + disabled Seller Portal card |
| `apps/web/.env.local` | Added `NEXT_PUBLIC_PREVIEW_MODE=true` (gitignored — not committed) |

---

## Implementation Details

### IS_PREVIEW Pattern (module-level const)

```typescript
const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
```

Used in: admin layout, admin login page, AdminSidebar, root page, StorefrontFooter.

For `NEXT_PUBLIC_*` env vars: evaluated at build time in both Server and Client components, so the `IS_PREVIEW` path is statically optimized (dead code elimination removes auth logic when false, and removes preview logic when true).

### Admin Layout — Preview Branch

```typescript
// Preview: render immediately, skip all auth
if (IS_PREVIEW) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      {/* Mobile header fallback */}
      <div className="lg:hidden fixed top-0 ... h-14 ...">
        <Shield /><span>PixEcom Admin</span>
        <span className="ml-auto">Desktop recommended</span>
      </div>
      <main className="flex-1 lg:ml-56 mt-14 lg:mt-0">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
```

`mt-14 lg:mt-0` — compensates for mobile fixed header (56px = h-14) which hides on lg.

### Admin Login — Preview Redirect

```typescript
// useEffect with empty deps — runs once on mount
useEffect(() => {
  if (IS_PREVIEW) {
    router.replace('/admin/dashboard');
  }
}, []);

if (IS_PREVIEW) {
  return <p>Loading preview...</p>;
}
```

`// eslint-disable-line react-hooks/exhaustive-deps` added since the dependency array is intentionally empty (run-once on mount).

### Root Page — Server-Side Redirect

```typescript
import { redirect } from 'next/navigation';
const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export default function Home() {
  if (IS_PREVIEW) redirect('/preview');
  // ... original content
}
```

Server Component `redirect()` sends HTTP 307 → no client-side flash. Cleaner than `useRouter` + client component.

### AdminSidebar — Preview Badge + Cross-Links

```tsx
{/* Brand */}
<Link href="/admin/dashboard" ...>
  <Shield /> PixEcom Admin
  {IS_PREVIEW && (
    <span className="... bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase">
      Preview
    </span>
  )}
</Link>

{/* After nav items */}
{IS_PREVIEW && (
  <>
    <div className="h-px bg-border my-2" />
    <a href="/demo-store">Storefront ↗</a>
    <a href="/preview">← Preview Hub</a>
  </>
)}

{/* Bottom section */}
{IS_PREVIEW ? (
  <div>Preview Mode / No auth required</div>
) : (
  user && <div>{user.displayName} / Superadmin</div>
)}
{!IS_PREVIEW && <button onClick={handleLogout}>Sign out</button>}
```

### StorefrontFooter — Admin Cross-Link

```tsx
{IS_PREVIEW && (
  <div className="border-t border-gray-700 mt-6 pt-4 text-center">
    <a href="/admin/dashboard" className="text-amber-400 ...">🛡 View Admin Portal →</a>
    <span className="mx-3 text-gray-600">|</span>
    <a href="/preview" className="text-gray-400 ...">← Preview Hub</a>
  </div>
)}
```

Placed inside the existing dark footer (`bg-gray-900`) above the `</footer>` closing tag.

### .env.local (gitignored)

```env
# Preview mode — set true to bypass auth + enable preview nav (DO NOT commit)
NEXT_PUBLIC_PREVIEW_MODE=true
```

Deploy instructions (Vercel / Railway / etc.):
- Set `NEXT_PUBLIC_PREVIEW_MODE=true` in environment variables for the preview deployment
- Remove or set `false` for production deployment

---

## Navigation Map (Preview Mode ON)

```
/                      → 307 redirect → /preview
/preview               → Hub landing page
  → /admin/dashboard   → Admin Portal (all 20 pages, no auth)
  → /demo-store        → Customer Storefront

/admin                 → "Loading preview..." → 307 redirect → /admin/dashboard
/admin/dashboard       → Renders immediately (no auth wait)
/admin/*               → All 20 pages accessible

/admin sidebar         → "PREVIEW" badge visible
                       → "Storefront ↗" → /demo-store
                       → "← Preview Hub" → /preview

/demo-store footer     → "🛡 View Admin Portal →" → /admin/dashboard
                       → "← Preview Hub" → /preview
```

---

## Build Results

```
next build (with .env.local NEXT_PUBLIC_PREVIEW_MODE=true)
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (36/36)
46 routes total, 0 errors

New route: ○ /preview   1.34 kB   97.9 kB
```

---

## Verification Checklist

- [x] `/ → /preview` redirect (server-side, no flash)
- [x] `/preview` renders hub with 2 active cards + 1 disabled
- [x] `/admin` shows "Loading preview..." → redirects to `/admin/dashboard`
- [x] `/admin/dashboard` loads without login (no spinning, no redirect to /admin)
- [x] `/admin/sellers` loads without login
- [x] `/admin/analytics` loads without login
- [x] Admin sidebar shows "PREVIEW" badge in amber
- [x] Admin sidebar bottom shows "Preview Mode / No auth required"
- [x] Admin sidebar has "Storefront ↗" link → `/demo-store`
- [x] Admin sidebar has "← Preview Hub" link → `/preview`
- [x] Logout button hidden in preview mode
- [x] `/demo-store` loads normally (light theme, no auth required)
- [x] Storefront footer shows "🛡 View Admin Portal →" link
- [x] Storefront footer shows "← Preview Hub" link
- [x] Preview mode flag is NOT committed (only in .env.local)
- [x] Non-preview paths (login, auth flow) unchanged and still functional
