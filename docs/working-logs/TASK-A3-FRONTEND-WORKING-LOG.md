# TASK-A3: Admin Login + Route Guards + Admin Dashboard

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-21                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `3339cc5`                                     |
| **Build**   | GREEN (15 routes, 0 TS errors)                |

---

## Summary

Implemented admin login flow, admin route guards, and admin dashboard placeholder for the PixEcom v2 platform. Backend already has `POST /auth/admin-login` and `SuperadminGuard` — this task wires the frontend to those endpoints.

Key design: admin UI uses **amber/orange accent** to visually distinguish from the seller portal (indigo accent).

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/stores/authStore.ts` | **Modified** | Added `isSuperadmin: boolean` to `AuthUser` interface; added `isSuperadmin?` to `MeResponse`; added `adminLogin()` method (calls `POST /auth/admin-login`); updated `me()` and `ensureSession()` to extract `isSuperadmin`; force-logout redirect is now role-aware (admin to `/admin`, seller to `/login`) |
| `apps/web/src/app/admin/page.tsx` | **Created** | Admin login page — calls `POST /auth/admin-login`, amber accent theme, redirects to `/admin/dashboard` on success; shows seller conflict message if seller is already logged in |
| `apps/web/src/app/admin/(dashboard)/layout.tsx` | **Created** | Admin dashboard layout with `isSuperadmin` route guard; amber spinner skeleton; wraps children with `ErrorBoundary`; redirects non-admin users to `/admin` |
| `apps/web/src/app/admin/(dashboard)/dashboard/page.tsx` | **Created** | Admin dashboard placeholder with 3 KPI cards (Total Sellers, Total Orders, Total Revenue) showing "Coming soon" |
| `apps/web/src/components/AdminSidebar.tsx` | **Created** | Admin sidebar with amber accent, Shield icon brand, nav items: Dashboard, Sellers, Products, Orders, Assets; role label "Superadmin"; logout redirects to `/admin` |
| `apps/web/src/app/login/page.tsx` | **Modified** | Added admin conflict detection — if admin is logged in, shows "Go to Admin Portal" message instead of login form |
| `apps/web/src/app/(portal)/layout.tsx` | **Modified** | Added `isSuperadmin` check to route guard — admin users are redirected to `/admin/dashboard` instead of rendering seller portal |

---

## Decisions & Technical Notes

### Route Guard Matrix

| User State | `/login` | `/admin` | `(portal)/*` | `/admin/dashboard` |
|------------|----------|----------|--------------|---------------------|
| No session | Show login form | Show admin login form | Redirect to `/login` | Redirect to `/admin` |
| Seller logged in | Redirect to `/orders` | Show "logout first" message | Render portal | Redirect to `/admin` |
| Admin logged in | Show "go to /admin" message | Redirect to `/admin/dashboard` | Redirect to `/admin/dashboard` | Render admin dashboard |

### AuthStore Changes

- **`isSuperadmin`** is extracted from `GET /auth/me` response. Backend returns it as an optional boolean — we default to `false` when missing for backwards compatibility.
- **`adminLogin()`** calls `POST /auth/admin-login` and sets `isSuperadmin: true`. The seller field is set to `null` since admins don't have a seller profile.
- **Force-logout redirect** checks `wasAdmin` (captured before clearing state) to determine whether to redirect to `/admin` or `/login`.
- **No breaking changes** to the existing seller `login()` flow — it now also preserves `isSuperadmin` from the response (defaults to `false`).

### Admin Theme

- **Accent color**: `amber-400` / `amber-500` / `amber-600` (vs seller `primary` which is indigo)
- **Card border**: `border-amber-500/20` on login card for visual distinction
- **Brand**: Shield icon + "PixEcom Admin" in sidebar
- **Active nav**: `bg-amber-500/10 text-amber-400` (vs seller `bg-primary/10 text-primary`)

### Route Group Architecture

```
app/
  admin/
    page.tsx                        ← Admin login (public)
    (dashboard)/
      layout.tsx                    ← Admin route guard + AdminSidebar + ErrorBoundary
      dashboard/
        page.tsx                    ← Admin dashboard placeholder
  (portal)/
    layout.tsx                      ← Seller route guard + Sidebar + ErrorBoundary
    orders/page.tsx
    products/page.tsx
    ...
  login/page.tsx                    ← Seller login (public)
```

The `(dashboard)` route group wraps admin pages with the guard without affecting the URL. The admin login page at `/admin` sits outside this group so it is accessible without auth.

The dashboard page is at `admin/(dashboard)/dashboard/page.tsx` which maps to the URL `/admin/dashboard`. This is deliberate — it keeps the `(dashboard)` route group as a layout wrapper while providing a clean `/admin/dashboard` URL.

### ErrorBoundary Integration

Both `(portal)/layout.tsx` and `admin/(dashboard)/layout.tsx` wrap `{children}` with `<ErrorBoundary>` — the component created in TASK-A2. Sidebar stays functional if a page crashes.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (14/14)
             15 routes, 0 errors
```

### Route Output
```
○ /admin                               3.52 kB    (NEW)
○ /admin/dashboard                     1.93 kB    (NEW)
○ /ads-manager                         4.07 kB
○ /analytics                           3.65 kB
○ /debug/api                           3.71 kB
○ /debug/health                        2.03 kB
○ /login                               2.72 kB    (MODIFIED)
○ /orders                              3.36 kB
ƒ /orders/[id]                         2.87 kB
○ /products                            2.52 kB
ƒ /products/[id]                       2.63 kB
○ /sellpages                           3.25 kB
ƒ /sellpages/[id]                      2.48 kB
```

### Manual Verification Checklist
- [x] `authStore.ts` — `isSuperadmin` in AuthUser, MeResponse, login(), adminLogin(), me(), ensureSession()
- [x] `/admin` — admin login page with amber theme, POST /auth/admin-login
- [x] `/admin` — seller conflict message when seller is logged in
- [x] `/admin/dashboard` — isSuperadmin guard, AdminSidebar, ErrorBoundary
- [x] `/admin/dashboard` — placeholder KPI cards + coming soon message
- [x] `AdminSidebar` — 5 nav items (Dashboard, Sellers, Products, Orders, Assets)
- [x] `/login` — admin conflict message with "Go to Admin Portal" link
- [x] `(portal)/layout` — admin users redirected to `/admin/dashboard`
- [x] Force-logout — role-aware redirect (admin→/admin, seller→/login)
- [x] No changes to auth logic backend or API endpoints
