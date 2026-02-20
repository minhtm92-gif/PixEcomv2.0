# Frontend Build Log — Phase 1: Integration Hardening

**Branch:** `feature/2.3.7-stability-hardening`
**Date:** 2025-02-21
**Status:** COMPLETE — Build GREEN
**Stop condition met:** Debug page + Login + Products (first wired page) all green

---

## 1. Objective

Build a REAL connected frontend (not preview-only) for PixEcom v2 Seller Portal that connects
to the live NestJS backend API. Phase 1 focuses on integration hardening — ensuring the
apiClient, auth flow, token refresh, and error handling all work reliably before wiring up
any UI pages.

**Hard constraint:** Do not touch backend in this chat.

---

## 2. Starting State

Branch `feature/2.3.7-stability-hardening` had a clean `apps/web` with only 3 source files:

```
apps/web/src/app/layout.tsx      — bare root layout
apps/web/src/app/page.tsx        — "Coming Soon" placeholder
apps/web/src/app/globals.css     — empty Tailwind imports
```

**Dependencies available:** next 14.2, react 18.3, zustand 4.5
**Dependencies added:** clsx 2.1.1, lucide-react 0.575.0

---

## 3. Backend API Reference

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/health` | GET | None | Health check (outside /api prefix) |
| `/api/auth/login` | POST | None | Returns `{ accessToken, user, seller }` + sets httpOnly refresh_token cookie |
| `/api/auth/refresh` | POST | Cookie | Returns `{ accessToken }` — cookie path: `/api/auth/refresh` |
| `/api/auth/me` | GET | JWT | Returns `{ user, seller }` |
| `/api/auth/logout` | POST | JWT | Clears refresh cookie |
| `/api/products` | GET | JWT | `?page&limit&label&q` — platform-wide, offset pagination |
| `/api/sellpages` | GET | JWT | `?page&limit&status&q` — seller-scoped |
| `/api/orders` | GET | JWT | `?dateFrom&dateTo&sellpageId&status&search&limit&cursor` — keyset pagination |
| `/api/ads-manager/campaigns` | GET | JWT | `?dateFrom&dateTo&status` |

**Auth flow:**
- Access token: in-memory only (NEVER localStorage), 15m expiry
- Refresh token: httpOnly cookie, sameSite lax, 7 days, path `/api/auth/refresh`
- JWT payload: `{ sub, sellerId, role, isSuperadmin }`
- CORS: `credentials: true`, origin from CORS_ORIGIN env

---

## 4. Files Created/Modified

### 4.1 Infrastructure Layer

| # | File | Type | Purpose |
|---|---|---|---|
| 1 | `src/lib/apiClient.ts` | NEW | Core fetch wrapper with auto-refresh on 401 |
| 2 | `src/lib/cn.ts` | NEW | `cn()` utility (clsx wrapper) |
| 3 | `src/stores/authStore.ts` | NEW | Zustand auth store — login/logout/me/hydrate |
| 4 | `src/stores/toastStore.ts` | NEW | Toast notification store with auto-dismiss |
| 5 | `src/components/AuthProvider.tsx` | NEW | Hydrates auth on mount (cookie refresh) |
| 6 | `src/components/Toaster.tsx` | NEW | Toast renderer (bottom-right stack) |
| 7 | `src/components/Sidebar.tsx` | NEW | Navigation sidebar with lucide icons |
| 8 | `.env.local` | NEW | API base URL + demo credentials |

### 4.2 Config Updates

| # | File | Change |
|---|---|---|
| 9 | `src/app/globals.css` | Added dark theme CSS tokens, toast animation, scrollbar |
| 10 | `src/app/layout.tsx` | Added AuthProvider + Toaster wrappers, dark class |
| 11 | `tailwind.config.ts` | Extended colors with CSS variable references |
| 12 | `package.json` | Added clsx, lucide-react dependencies |

### 4.3 Pages

| # | File | Route | Purpose |
|---|---|---|---|
| 13 | `src/app/page.tsx` | `/` | Root redirect → /products or /login |
| 14 | `src/app/login/page.tsx` | `/login` | Login form wired to POST /auth/login |
| 15 | `src/app/debug/api/page.tsx` | `/debug/api` | 10-step API connectivity test suite |
| 16 | `src/app/(portal)/layout.tsx` | (group) | Auth-guarded layout with sidebar |
| 17 | `src/app/(portal)/products/page.tsx` | `/products` | Products table wired to GET /products |

**Total: 14 source files created, 3 config files modified**

---

## 5. Architecture Decisions

### 5.1 API Client (`apiClient.ts`)

- **In-memory token only** — `_accessToken` is a module-scoped variable, never touches localStorage
- **Auto-refresh on 401** — When any request gets 401:
  1. Calls `POST /auth/refresh` with cookie (credentials: include)
  2. If refresh succeeds → sets new token → retries original request once
  3. If refresh fails → calls force-logout callback → throws SESSION_EXPIRED
- **Refresh lock** — Uses `_refreshPromise` to deduplicate concurrent 401 retries
- **Normalised errors** — All errors thrown as `ApiError { code, message, requestId, details, status }`
- **Force logout callback** — Auth store registers a callback so apiClient can trigger logout without circular imports

### 5.2 Auth Store (`authStore.ts`)

- **Zustand 4.5** with flat state: `{ user, seller, loading, error, hydrated }`
- **hydrate()** — Called once on app mount by AuthProvider:
  1. POST /auth/refresh (cookie-based, no auth header)
  2. If new token → GET /auth/me → populate user/seller
  3. If fails → stay logged out (no error shown)
- **login()** — Calls apiPost, sets token + state, re-throws on error for caller to handle
- **logout()** — POST /auth/logout (best-effort), clears token + state

### 5.3 Toast System (`toastStore.ts` + `Toaster.tsx`)

- Simple Zustand store with `add(message, variant)` + auto-dismiss after 6s
- `toastApiError()` helper formats ApiError into readable toast
- Toaster renders fixed bottom-right stack with slide-in animation
- 4 variants: info (blue), success (green), error (red), warning (yellow)

### 5.4 Portal Layout (`(portal)/layout.tsx`)

- Next.js route group `(portal)` wraps all authenticated pages
- Checks auth state after hydration → redirects to /login if not authenticated
- Renders Sidebar + main content area

### 5.5 Dark Theme

- CSS custom properties in `:root` (globals.css)
- Tailwind config extends colors to reference CSS variables
- `html` has `className="dark"` — single-theme for now
- Color palette: deep navy background (#0c0c14), indigo primary (#6366f1)

---

## 6. Debug API Page — Test Suite

The `/debug/api` page runs 10 tests sequentially:

| # | Test | Endpoint | Depends On |
|---|---|---|---|
| 1 | Health check | GET /health | None |
| 2 | CORS preflight | OPTIONS /auth/login | None |
| 3 | Login | POST /auth/login | None (uses demo credentials) |
| 4 | Auth check | GET /auth/me | Login (#3) |
| 5 | Token refresh | POST /auth/refresh | Login (#3) |
| 6 | Products | GET /products?page=1&limit=5 | Login (#3) |
| 7 | Sellpages | GET /sellpages?page=1&limit=5 | Login (#3) |
| 8 | Orders | GET /orders?limit=5 | Login (#3) |
| 9 | Ads campaigns | GET /ads-manager/campaigns | Login (#3) |
| 10 | Logout | POST /auth/logout | Login (#3) |

**Behaviour:** If login (#3) fails, tests 4-10 are auto-skipped with "Skipped — login failed".

Each result shows: PASS/FAIL badge, response time (ms), HTTP status code, expandable JSON payload.

---

## 7. Products Page — First Wired Page

The `/products` page demonstrates the full data flow:

1. **Auth guard** — Portal layout redirects to /login if not authenticated
2. **API call** — `apiGet<ProductsResponse>('/products?page=1&limit=10')`
3. **Label filter** — Buttons: all / physical / digital / subscription / bundle
4. **Search** — Text input → appends `q=` param
5. **Pagination** — Prev/Next with page counter
6. **Loading state** — Skeleton rows while fetching
7. **Error state** — Red error banner with retry button
8. **Table columns** — Product (image+name+desc), Label, Price, Status, Created

---

## 8. Build Output

```
Next.js 14.2.35 — Build successful

Route (app)                    Size        First Load JS
/                              2.89 kB     90.1 kB
/_not-found                    872 B       88.1 kB
/debug/api                     4.9 kB      92.2 kB
/login                         3.85 kB     91.1 kB
/products                      5.25 kB     92.5 kB

First Load JS shared by all:   87.3 kB
```

**No TypeScript errors. No build warnings. All routes compiled.**

---

## 9. Environment Configuration

```env
# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NEXT_PUBLIC_DEMO_EMAIL=demo@pixecom.io
NEXT_PUBLIC_DEMO_PASS=Password123!
```

---

## 10. How to Run

```bash
# Terminal 1 — Backend (must be running first)
cd apps/api
pnpm dev          # starts on :3001

# Terminal 2 — Frontend
cd apps/web
pnpm dev          # starts on :3000

# Visit:
# http://localhost:3000/login        — Login page
# http://localhost:3000/products     — Products catalog
# http://localhost:3000/debug/api    — API connectivity test suite
```

---

## 11. Known Limitations / Next Steps (Phase 2)

These are NOT done yet — stopping per the stop condition:

- [ ] `/sellpages` — Wire to GET /sellpages (seller-scoped, offset pagination)
- [ ] `/orders` — Wire to GET /orders (keyset/cursor pagination)
- [ ] `/ads-manager` — Wire to GET /ads-manager/campaigns → adsets → ads (3-tier drill)
- [ ] `/dashboard` — KPI dashboard with summary stats
- [ ] Error boundary component (React error boundary wrapper)
- [ ] Loading skeletons as shared components
- [ ] Responsive sidebar (mobile collapse)

---

## 12. File Tree (Final State)

```
apps/web/
  .env.local
  package.json                          (modified — added clsx, lucide-react)
  tailwind.config.ts                    (modified — dark theme colors)
  src/
    lib/
      apiClient.ts                      (NEW — fetch wrapper + auto-refresh)
      cn.ts                             (NEW — className utility)
    stores/
      authStore.ts                      (NEW — Zustand auth store)
      toastStore.ts                     (NEW — toast notifications)
    components/
      AuthProvider.tsx                  (NEW — auth hydration on mount)
      Toaster.tsx                       (NEW — toast renderer)
      Sidebar.tsx                       (NEW — navigation sidebar)
    app/
      globals.css                       (modified — dark theme tokens)
      layout.tsx                        (modified — AuthProvider + Toaster)
      page.tsx                          (modified — redirect logic)
      login/
        page.tsx                        (NEW — login form)
      debug/
        api/
          page.tsx                      (NEW — 10-step API test suite)
      (portal)/
        layout.tsx                      (NEW — auth-guarded layout)
        products/
          page.tsx                      (NEW — products table)
```
