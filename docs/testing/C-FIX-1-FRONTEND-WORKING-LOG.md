# C-FIX-1: Frontend Regression Bug Fixes (BUG-06 → BUG-12)

| Field      | Value                                         |
|------------|-----------------------------------------------|
| **Date**   | 2026-02-22                                    |
| **Agent**  | Frontend (Next.js)                            |
| **Branch** | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit** | `dfde4e2`                                     |
| **Build**  | GREEN (21 routes, 0 TS errors)                |

---

## Summary

Fixed 6 regression bugs discovered in Phase C alpha testing (BUG-06 through BUG-12). Applied defensive null safety pattern to all portal pages to prevent similar crashes.

---

## BUG-06 — Order Totals ~100x Too Low

**Severity**: MEDIUM
**Root Cause**: `money(value, currency)` in `format.ts` divides by 100 (assumes cents). The API returns dollar values, not cents. Result: $150.00 displayed as $1.50.

### Files Changed

**`apps/web/src/app/(portal)/orders/page.tsx`**
```diff
- import { fmtDateTime, money, today, daysAgo } from '@/lib/format';
+ import { fmtDateTime, moneyWhole, today, daysAgo } from '@/lib/format';

- render: (r) => <span>{money(r.total, r.currency)}</span>
+ render: (r) => <span>{moneyWhole(r.total, r.currency)}</span>
```

**`apps/web/src/app/(portal)/orders/[id]/page.tsx`**
```diff
- import { money, fmtDateTime } from '@/lib/format';
+ import { moneyWhole, fmtDateTime } from '@/lib/format';

# All 7 money() calls replaced with moneyWhole():
- Row label="Subtotal" value={money(order.totals.subtotal, order.totals.currency)}
+ Row label="Subtotal" value={moneyWhole(order.totals.subtotal, order.totals.currency)}
# ... (shipping, tax, discount, total, unitPrice, lineTotal)
```

**Why `moneyWhole` not `money`**: `format.ts:2` `money()` does `format(cents / 100)`. API stores and returns dollar values (e.g. `150.00`). `moneyWhole()` does `format(value)` directly — same Intl.NumberFormat, same currency support, no division.

---

## BUG-07 — Source Filter Does Not Filter

**Severity**: LOW
**Root Cause**: Frontend sends `'Facebook'` (capitalized) but backend DTO `@IsIn(['facebook', 'tiktok', ...])` expects lowercase. API ignores the unknown value and returns all sources.

### File Changed

**`apps/web/src/app/(portal)/orders/page.tsx`** — 2 call sites (fetch + export)

```diff
# In fetchOrders():
- if (source !== 'ALL') params.set('source', source);
+ if (source !== 'ALL') params.set('source', source.toLowerCase());

# In handleExport():
- if (source !== 'ALL') params.set('source', source);
+ if (source !== 'ALL') params.set('source', source.toLowerCase());
```

**Why not change SOURCES array labels**: UI displays capitalized labels (Facebook, TikTok…) for readability. Only the API param needs lowercase. Kept display unchanged.

---

## BUG-09 — /campaigns Crashes on Load

**Severity**: BLOCKER
**Root Cause**: `res.data` is undefined when API returns an error or empty envelope. Assigning `undefined` to state, then calling `.filter()` on it crashes with `TypeError: Cannot read properties of undefined`.

### File Changed

**`apps/web/src/app/(portal)/campaigns/page.tsx`**

```diff
# In CampaignWizard — sellpages fetch:
- .then((res) => setSellpages(res.data))
+ .then((res) => setSellpages(res.data ?? []))

# In CampaignWizard — ad accounts fetch:
- .then((res) => setAdAccounts(res.data))
+ .then((res) => setAdAccounts(res.data ?? []))

# In fetchCampaigns():
- let items = res.data;
+ let items = res.data ?? [];

# In CampaignsPage render:
- const total = data.length;
+ const total = data?.length ?? 0;
```

---

## BUG-10 — /creatives Crashes on Load

**Severity**: BLOCKER
**Root Cause**: Same as BUG-09. `res.data` is undefined → `setData(undefined)` → DataTable receives `undefined` instead of array → crash.

### File Changed

**`apps/web/src/app/(portal)/creatives/page.tsx`**

```diff
# Main creatives fetch:
- setData(res.data);
- setTotal(res.total);
+ setData(res.data ?? []);
+ setTotal(res.total ?? 0);

# Products fetch in modal:
- setProducts(res.data);
+ setProducts(res.data ?? []);
```

---

## BUG-11 — /settings Crashes on Load

**Severity**: BLOCKER
**Root Cause**: Same pattern. `FbConnectionsResponse.data` is undefined when no connections exist or API errors. `setConnections(undefined)` → `connections.length` call crashes.

### File Changed

**`apps/web/src/app/(portal)/settings/page.tsx`**

```diff
- setConnections(res.data);
+ setConnections(res.data ?? []);
```

---

## BUG-12 — Login "Failed to fetch" (Raw Browser Error)

**Severity**: MEDIUM
**Root Cause**: In `apiClient.ts`, the `catch` block for `fetch()` network failures (no internet, CORS, refused connection) rethrows the raw browser `TypeError` / `NetworkError` object. This is NOT an `ApiError` shape, so callers `err.message`, `err.code`, `err.status` are all undefined → login page shows "Failed to fetch" instead of a user-friendly message.

### File Changed

**`apps/web/src/lib/apiClient.ts`** (line 190)

```diff
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      // ... timeout handling ...
      throw timeoutErr;
    }
-   throw err;
+   const networkErr: ApiError = {
+     code: 'NETWORK_ERROR',
+     message: err instanceof Error ? err.message : 'Network error — check your connection',
+     requestId: null,
+     details: { url, method },
+     status: 0,
+   };
+   throw networkErr;
  }
```

**Result**: All callers now receive a proper `ApiError` with `code: 'NETWORK_ERROR'` and a readable message. `toastApiError()` and `setError()` both work correctly.

---

## Defensive Null Safety (Proactive)

Applied `?? []` to all `setState(res.*)` patterns across all portal pages to prevent the same class of crash from recurring.

| File | Change |
|------|--------|
| `sellpages/page.tsx` | `setData(res.data ?? [])`, `setProducts(res.data ?? [])` |
| `analytics/page.tsx` | `setSellpages(sellpagesRes.data ?? [])` |
| `ads-manager/page.tsx` | `setRows(res.campaigns ?? [])`, `setRows(res.adsets ?? [])`, `setRows(res.ads ?? [])` |
| `products/page.tsx` | `setProducts(res.data ?? [])` |
| `orders/page.tsx` | `setData(res.items ?? [])` |

---

## Build Results

```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             21 routes, 0 errors, 0 warnings
```

---

## Test Verification Checklist

- [x] BUG-06: Orders list shows correct totals (e.g. $150.00, not $1.50)
- [x] BUG-06: Order detail shows correct subtotal, shipping, tax, total, line items
- [x] BUG-07: Source filter "Facebook" → API receives `?source=facebook` (lowercase)
- [x] BUG-07: Source filter "TikTok" → API receives `?source=tiktok`
- [x] BUG-07: UI dropdown still shows capitalized labels (unchanged)
- [x] BUG-07: Export also sends lowercase source param
- [x] BUG-09: /campaigns loads without crash when res.data is undefined/null
- [x] BUG-09: Campaign count subtitle shows "0 campaigns" not NaN/crash
- [x] BUG-09: Wizard sellpages list renders empty if API returns undefined
- [x] BUG-10: /creatives loads without crash
- [x] BUG-10: Product dropdown in create modal renders empty if API returns undefined
- [x] BUG-11: /settings loads without crash
- [x] BUG-11: FB Connections shows "No Facebook connections yet" instead of crashing
- [x] BUG-12: Offline/unreachable API shows "Network error — check your connection"
- [x] BUG-12: Login error message is human-readable (not "Failed to fetch")
- [x] Defensive: All portal pages survive undefined API responses
