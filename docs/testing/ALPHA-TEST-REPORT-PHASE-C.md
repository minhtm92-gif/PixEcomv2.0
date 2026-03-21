# PixEcom v2 — Alpha Test Report (Phase C Regression)

> **Version:** 2.0 | **Date:** 2026-02-22
> **Branch:** `feature/2.4.2-alpha-ads-seed-v1`
> **Environment:** Local (API `localhost:3001`, Web `localhost:3000`)
> **Account:** `alpha1@pixecom.io` (Alpha Store One)
> **Previous Report:** `ALPHA-TEST-REPORT.md` (2026-02-21, Staging)

---

## SUMMARY

| Metric           | Count |
|------------------|-------|
| **PASS**         | 33    |
| **BUG**          | 6     |
| **BLOCKED**      | 6     |
| **NOTE**         | 2     |
| **N/A**          | 1     |
| **Total**        | 48    |

**Conclusion:** Core portal pages (Orders, Sellpages, Ads Manager campaign-level, Analytics, Products) work correctly. **3 Phase C pages crash on load** (Campaigns, Creatives, Settings) — blocking 6 of 9 Phase C test cases. Ads Manager drilldown broken due to UUID validation. Order totals display ~100x too low.

---

## BUG LIST

| ID | Severity | Page | Description | Repro |
|----|----------|------|-------------|-------|
| **BUG-06** | **Medium** | Orders | Order Total prices display ~100x too low. API returns `total: 36.74` but UI shows `$0.37`. All money fields affected (Subtotal, Shipping, Tax, Total, Unit Price, Line Total). Likely frontend divides by 100 or Decimal serialization issue. | 100% reproducible |
| **BUG-07** | **Low** | Orders | Source filter dropdown selects value but does not filter results. Selecting "Facebook" still shows all 5 orders including "direct" and "tiktok" sources. | 100% reproducible |
| **BUG-08** | **High** | Ads Manager | Drilldown Campaign→Adsets fails. API returns `400: "Validation failed (uuid is expected)"` for all campaign IDs. Both seed-alpha UUIDs (`000a` prefix) and ads-seed UUIDs (`ad10` prefix) rejected. Breadcrumb shows correctly but table retains campaign-level data. | 100% reproducible |
| **BUG-09** | **Blocker** | Campaigns | `/campaigns` page crashes on load: `TypeError: Cannot read properties of undefined (reading 'length')` at `campaigns/page.tsx:1150`. ErrorBoundary catches and shows "Something went wrong". | 100% reproducible |
| **BUG-10** | **Blocker** | Creatives | `/creatives` page crashes on load with same error as BUG-09. Likely shared data dependency (FB connections or campaigns list returns undefined instead of array). | 100% reproducible |
| **BUG-11** | **Blocker** | Settings | `/settings` page crashes on load with same error as BUG-09. Same root cause — shared dependency returns undefined. | 100% reproducible |

### Fixed from Previous Alpha (2026-02-21)

| Previous ID | Page | Status | Notes |
|-------------|------|--------|-------|
| BUG-01 (503) | Orders | **N/A** | Localhost — no Railway cold start |
| BUG-02 (session) | Global | **N/A** | Localhost — no token expiry during test |
| BUG-03 ($NaN) | Products | **FIXED** | Prices now display correctly ($50.00, $49.99, etc.) |
| BUG-04 (Invalid Date) | Products | **N/A** | CREATED column removed from Products page |
| BUG-05 (0 total) | Products | **FIXED** | Now shows "49 total" correctly |

---

## REGRESSION TESTS (TC-01 to TC-39)

### 1. ORDERS (`/orders` + `/orders/[id]`)

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-01 | Page load (initial) | **PASS** | 5 orders loaded, "Page 1 · 5 rows" |
| TC-02 | Table columns | **PASS** | ORDER, DATE, STATUS, SOURCE, TOTAL, CUSTOMER, TRACKING, ITEMS — 8 columns |
| TC-03 | Status badges (colors) | **PASS** | PENDING (yellow), CANCELLED (red), SHIPPED (cyan), DELIVERED (green), CONFIRMED (blue) |
| TC-04 | Status filter dropdown | **PASS** | 8 options: All, PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED |
| TC-05 | Filter by SHIPPED | **PASS** | Only ALPHA-002 shown (Bob Tran, tiktok, SHIPPED) |
| TC-06 | Search "alice" | **PASS** | ALPHA-001 with Alice Nguyen — search by customer name works |
| TC-07 | Pagination | **PASS** | "Page 1 · 5 rows", Prev/Next buttons present |
| TC-08 | Date range filter | **PASS** | Default 23/01/2026 — 22/02/2026, date pickers functional |
| TC-09 | Order Detail — Header | **PASS** | ALPHA-001 + CONFIRMED badge + "Feb 16, 2026, 12:00 PM" |
| TC-10 | Order Detail — Customer | **PASS** | Alice Nguyen, alice.nguyen@gmail.com, +84901234567 |
| TC-11 | Order Detail — Totals | **BUG-06** | Subtotal $0.63, Shipping $0.05, Tax $0.03, Total $0.71 — all ~100x too low |
| TC-12 | Order Detail — Sellpage link | **PASS** | `<unassigned-domain>/alpha-mouse-deal` — clickable |
| TC-13 | Order Detail — Items table | **PASS** | 2 items: SlimPro Mouse (Black) + SlimPro Mouse (Rose Gold) with Product/Variant/Qty/UnitPrice/LineTotal |
| TC-14 | Order Detail — Timeline | **PASS** | 2 events: CREATED (Feb 16) → CONFIRMED (Feb 17) with descriptions |
| TC-15 | Order Detail — Refresh Tracking | **PASS** | "Coming soon" label |
| TC-16 | Source filter | **BUG-07** | Selecting "Facebook" doesn't filter — all 5 orders still shown |
| TC-17 | Session stability | **N/A** | Localhost — no cold start / token issues |

### 2. SELLPAGES (`/sellpages` + `/sellpages/[id]`)

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-18 | Page load | **PASS** | 7 sellpages, "7 sellpages" count correct |
| TC-19 | Table columns | **PASS** | SELLPAGE (title + slug), STATUS, DOMAIN/URL, TYPE, CREATED |
| TC-20 | Status badges | **PASS** | DRAFT (gray), PUBLISHED (green) |
| TC-21 | Data mix | **PASS** | 3 DRAFT + 4 PUBLISHED — matches seed data |
| TC-22 | Status filter | **PASS** | All statuses / DRAFT / PUBLISHED / ARCHIVED dropdown |
| TC-23 | Search box | **PASS** | "Search slug or title..." placeholder |
| TC-24 | Detail — URL/Domain | **PASS** | Slug, Type: SINGLE, live URL link clickable |
| TC-25 | Detail — Linked Product | **PASS** | SlimPro Wireless Mouse, base price $29.99 |
| TC-26 | Detail — Description Override | **PASS** | "Grab the best wireless mouse at an incredible price." |
| TC-27 | Detail — Stats (5 KPIs) | **PASS** | Revenue, Cost, YouTake, Hold, CashToBalance — stub "—" |
| TC-28 | Detail — Stub note | **PASS** | "Sellpage stats are stubs — not yet implemented in backend." |
| TC-29 | Detail — Assigned Creative | **PASS** | "Coming soon — creative assignment endpoint not yet available" |
| TC-30 | Detail — Linked Ads tree | **PASS** | "Linked Ads (3)" showing campaign→adset→ad hierarchy with status badges |
| TC-31 | Product image | **NOTE** | Alt text shown instead of image. CDN image not available locally. |

### 3. ADS MANAGER (`/ads-manager`)

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-32 | Campaign list load | **PASS** | 8 campaigns (6 from ads seed + 2 from alpha seed) |
| TC-33 | Status badges | **PASS** | ACTIVE (green) ×4, PAUSED (yellow) ×3, ARCHIVED (gray) ×1 |
| TC-34 | Metric columns | **PASS** | Campaign, Platform, Status, Budget/Day, Spent, Impr, Clicks, CTR, CPC, CV, Cost/CV, Checkout, Cost/CO, CR1, CR2, CR, Conv, ROAS — 18 columns |
| TC-35 | Metric formats | **PASS** | $ for money, % for rates, integers for counts |
| TC-36 | Date filters | **PASS** | Today / 7d / **30d** (default) / custom date range |
| TC-37 | Summary row | **PASS** | Spend: $6,638.25 · Impr: 813,710 · Clicks: 33,133 · CTR: 4.07% · CV: 23,707 · Checkout: 3,429 · Conv: 1,426 · ROAS: 7.64 |
| TC-38 | "Meta only" toggle | **PASS** | Visible at top-right area |
| TC-39 | Drilldown → Ad Sets | **BUG-08** | API rejects campaignId: "Validation failed (uuid is expected)". Breadcrumb shows but table retains campaign data. |

### 4. ANALYTICS (`/analytics`)

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-40 | Page load | **PASS** | "Performance overview" heading |
| TC-41 | KPI — REVENUE | **PASS** | $50,736.27 — label "purchaseValue from ads" |
| TC-42 | KPI — AD SPEND | **PASS** | $6,638.25 (matches Ads Manager summary) |
| TC-43 | KPI — YOUTAKE | **PASS** | Stub "—", label "Stub — not yet wired" |
| TC-44 | KPI — HOLD | **PASS** | Stub "—", label "Stub — not yet wired" |
| TC-45 | KPI — CASHTOBALANCE | **PASS** | Stub "—", label "Stub — not yet wired" |
| TC-46 | Date filters | **PASS** | Today / 7d / **30d** / custom |
| TC-47 | Top Campaigns by Spend | **PASS** | 5 campaigns sorted desc. Columns: Campaign, Status, Spend, ROAS, Conv, CTR |
| TC-48 | Sellpages section | **PASS** | 7 sellpages with Status, Revenue/YouTake stubs |
| TC-49 | Missing ROAS KPI card | **NOTE** | No ROAS in 5 KPI cards. Consider adding ROAS = Revenue / Ad Spend. |

### 5. PRODUCTS (`/products`)

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-50 | Page load | **PASS** | Products list loaded, "49 total" (includes test products) |
| TC-51 | Prices | **PASS** | $50.00, $49.99, $20.00 — no $NaN (BUG-03 FIXED) |
| TC-52 | Pagination | **PASS** | "Page 1 of 5", Prev/Next buttons |

### 6. NAVIGATION & GLOBAL

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-53 | Sidebar nav links | **PASS** | Orders, Ads Manager, Campaigns, Analytics, Sellpages, Creatives, Products, Settings, Health — 9 links (3 new in Phase C) |
| TC-54 | Active state highlight | **PASS** | Active link changes color |
| TC-55 | Seller info sidebar | **PASS** | "Alpha One" + "alpha1@pixecom.io" |
| TC-56 | Sign out button | **PASS** | Visible in sidebar |

---

## PHASE C TESTS (TC-57 to TC-65)

### 7. CAMPAIGNS (`/campaigns`) — Phase C

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-57 | Campaign list load | **BUG-09** | Page crashes: `TypeError: Cannot read properties of undefined (reading 'length')` at `campaigns/page.tsx:1150` |
| TC-58 | Campaign wizard (create) | **BLOCKED** | Cannot test — page crash (BUG-09) |
| TC-59 | Campaign lifecycle (launch/pause/resume) | **BLOCKED** | Cannot test — page crash (BUG-09) |
| TC-60 | Campaign detail tree | **BLOCKED** | Cannot test — page crash (BUG-09) |

### 8. CREATIVES (`/creatives`) — Phase C

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-61 | Creatives list load | **BUG-10** | Page crashes with same error as BUG-09. Likely shared dependency. |
| TC-62 | Asset upload + creative slot | **BLOCKED** | Cannot test — page crash (BUG-10) |

### 9. SETTINGS (`/settings`) — Phase C

| TC | Test Item | Result | Details |
|----|-----------|--------|---------|
| TC-63 | Settings page load | **BUG-11** | Page crashes with same error as BUG-09. Likely shared dependency. |
| TC-64 | Seller profile edit | **BLOCKED** | Cannot test — page crash (BUG-11) |
| TC-65 | FB connections management | **BLOCKED** | Cannot test — page crash (BUG-11) |

---

## ROOT CAUSE ANALYSIS

### BUG-09/10/11 (Page Crashes)

**Error:** `TypeError: Cannot read properties of undefined (reading 'length')`
**Source:** `campaigns/page.tsx:1150`
**Stack:** `CampaignsPage → renderWithHooks → updateFunctionComponent`

**Likely cause:** The `CampaignsPage` component accesses `.length` on an API response field (probably `fbConnections`, `campaigns`, or `sellpages` array) before checking if it's defined. The API endpoint returns the field as `undefined` instead of an empty array `[]`, or the response shape differs from what the frontend expects.

**Recommended fix:** Add null-safe access (`?.length` or `?? []`) at `campaigns/page.tsx:1150`, and verify the API response shape matches the frontend's expected structure.

### BUG-08 (UUID Validation)

**Error:** `400: "Validation failed (uuid is expected)"`
**Affected UUIDs:** `00000000-0000-0000-000a-000000000401` (seed-alpha), `00000000-ad10-0002-0001-000000000001` (ads-seed)

**Likely cause:** NestJS `ParseUUIDPipe` may be configured with `version: '4'`, which rejects UUIDs that don't conform to UUID v4 format (version byte must be `4xxx`, variant byte must be `8/9/a/b`). Our synthetic seed UUIDs don't conform.

**Recommended fix:** Either use `ParseUUIDPipe()` without version restriction, or generate RFC-4122 v4 compliant UUIDs in seed scripts.

### BUG-06 (Order Total ~100x Too Low)

**Evidence:** API returns `total: 36.74`, UI displays `$0.37` (36.74 / ~100).

**Likely cause:** Frontend may be dividing by 100 (assuming cents) when the API already returns dollars. Or Prisma `Decimal` type serialization causes floating-point precision loss during JSON parse.

**Recommended fix:** Check the order total formatting logic in the Orders detail page component. Verify whether the API returns dollars or cents and align the frontend formatter.

---

## RECOMMENDATIONS

### Priority: Blocker (Fix before Phase C can be tested)
1. **BUG-09/10/11**: Fix `.length` on undefined in `campaigns/page.tsx:1150`. Add `?.` optional chaining or default to `[]`. This single fix likely unblocks all 3 Phase C pages.

### Priority: High
2. **BUG-08**: Fix UUID validation in `ParseUUIDPipe` — either remove version restriction or change seed UUIDs to valid v4 format.

### Priority: Medium
3. **BUG-06**: Fix order total display — verify cents vs dollars assumption in frontend formatter.

### Priority: Low
4. **BUG-07**: Fix source filter — ensure `source` query param is sent to API and backend supports filtering.

---

## ALPHA EXIT CRITERIA (Phase C)

| Criteria | Status |
|----------|--------|
| 4 core pages load without error | **PASS** — Orders, Sellpages, Ads Manager, Analytics |
| Phase C pages load without error | **FAIL** — Campaigns, Creatives, Settings all crash |
| Data displays correctly | **Partial** — Order totals wrong (BUG-06) |
| Filters work | **Partial** — Source filter broken (BUG-07) |
| Drilldown 3 levels (Ads Manager) | **FAIL** — UUID validation blocks (BUG-08) |
| No Blocker bugs | **FAIL** — 3 Blockers (BUG-09/10/11) |
| Metrics consistent | **PASS** — Analytics Revenue/Spend matches Ads Manager |

**Phase C Exit: FAIL** — 3 Blocker bugs prevent testing of Campaigns, Creatives, Settings pages. Must fix BUG-09 first, then re-test TC-57 to TC-65.

---

_Report generated: 2026-02-22 by Claude Code Alpha Tester_
_Branch: `feature/2.4.2-alpha-ads-seed-v1`_
_Environment: localhost (API :3001, Web :3000)_
