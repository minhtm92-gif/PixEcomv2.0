# Admin Frontend Test Report — TC-70 → TC-78

**Date**: 2026-02-22
**Branch**: `feature/2.4.2-alpha-ads-seed-v1`
**Tester**: Claude CTO Agent
**Build**: After C-FIX-4 (admin login skipRefresh fix)
**Environment**: localhost:3000 (web) + localhost:3001 (api)

## Summary

| Metric | Count |
|--------|-------|
| Total TCs | 9 |
| PASS | 9 |
| BUG | 0 |
| BLOCKED | 0 |

**Result: ALL PASS**

---

## Test Results

### TC-70: Admin login page load
**Status: PASS**
- Steps: Navigate to `/admin`
- Expected: Admin login form with amber theme, "PixEcom Admin" title
- Actual: Shows "PixEcom Admin" title, "Platform Administration" subtitle, amber/gold shield icon, email/password fields, "Sign in as Admin" button

### TC-71: Admin login success
**Status: PASS**
- Steps: Enter `admin@pixecom.com` / `admin123456` → click "Sign in as Admin"
- Expected: Redirect to `/admin/dashboard`
- Actual: Successfully logged in, redirected to `/admin/dashboard`

### TC-72: Admin login wrong password
**Status: PASS**
- Steps: Enter `admin@pixecom.com` / `wrongpassword` → click "Sign in as Admin"
- Expected: Error message, stay on `/admin`
- Actual: Shows "Invalid credentials" error inline, stays on `/admin`
- Note: Required `skipRefresh: true` fix in authStore (C-FIX-4). Without it, 401 triggered auto-refresh → force-logout → redirect to `/login`.

### TC-73: Admin login seller account rejected
**Status: PASS**
- Steps: Enter seller account `alpha1@pixecom.io` / `Alpha@123` → click "Sign in as Admin"
- Expected: Error message "Not an admin account"
- Actual: Shows "Not an admin account" error inline, stays on `/admin`

### TC-74: Admin dashboard load
**Status: PASS**
- Steps: Login as admin → verify dashboard content
- Expected: Dashboard page with KPI cards
- Actual: Shows 3 KPI cards (Total Sellers, Total Orders, Total Revenue) all displaying "Coming soon" placeholder values

### TC-75: Admin sidebar navigation
**Status: PASS**
- Steps: Verify sidebar items on admin dashboard
- Expected: Admin-specific nav items + branding
- Actual: "PixEcom Admin" branding, 5 nav items (Dashboard, Sellers, Products, Orders, Assets), Sign out button at bottom

### TC-76: Admin guard — seller rejected
**Status: PASS**
- Steps: Login as seller (`alpha1@pixecom.io`) → navigate to `/admin/dashboard`
- Expected: Redirect away from admin dashboard
- Actual: Redirected to `/admin` login page, shows "You are currently logged in as a seller (alpha1@pixecom.io). Please log out first to access admin login." with "Go to Seller Portal" button

### TC-77: Seller portal — admin rejected
**Status: PASS**
- Steps: Login as admin (`admin@pixecom.com`) → navigate to `/orders`
- Expected: Redirect back to admin area
- Actual: Redirected to `/admin/dashboard` (portal layout detects superadmin → redirects)

### TC-78: Admin logout
**Status: PASS**
- Steps: Click "Sign out" in admin sidebar
- Expected: Redirect to `/admin` login page
- Actual: Logged out, redirected to `/admin` login page

---

## Bug Found & Fixed During Testing

### BUG: Admin login 401 triggers force-logout redirect
- **Symptom**: Wrong password on `/admin` redirected user to `/login` instead of showing inline error
- **Root cause**: `adminLogin()` in authStore called `apiPost` with `{ noAuth: true }` but NOT `skipRefresh: true`. On 401, apiClient's interceptor attempted token refresh → refresh failed (no cookie) → `_onForceLogout` fired → redirect to `/login`
- **Fix**: Added `skipRefresh: true` to both `login` and `adminLogin` in `authStore.ts`
- **File**: `apps/web/src/stores/authStore.ts` lines 105, 124
- **Commit**: C-FIX-4

---

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/stores/authStore.ts` | Added `skipRefresh: true` to login + adminLogin apiPost calls |

## Test Accounts Used

| Account | Type | Password |
|---------|------|----------|
| `admin@pixecom.com` | Superadmin | `admin123456` |
| `alpha1@pixecom.io` | Seller | `Alpha@123` |
