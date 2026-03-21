# C-FIX Re-Test Report

**Date:** 2026-02-22
**Tester:** CTO Agent (Claude)
**Branch:** `feature/2.4.2-alpha-ads-seed-v1`
**Environment:** localhost (API :3001, Web :3000)
**Account:** alpha1@pixecom.io (Alpha Store One)

## Context

Phase C regression found 6 BUGs (BUG-06 to BUG-12) and 6 BLOCKED items.
Two fix commits were applied:

| Commit | Scope | Description |
|--------|-------|-------------|
| `dfde4e2` (C-FIX-1) | Frontend | BUG-06 money format, BUG-07 source filter, BUG-09/10/11 page crashes, BUG-12 login error |
| `528ab12` (C-FIX-2) | Backend | BUG-08 `@IsUUID()` → `@IsUUID('all')` in ads-manager DTOs |

## Re-Test Results

### BUG-06: Order totals ~100x too low (C-FIX-1)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| TC-11 | Order detail totals | **PASS** | Subtotal $62.98, Shipping $5.00, Tax $3.00, Total $70.98 |
| TC-13 | Order items table | **PASS** | Unit prices $29.99, $32.99 (correct dollars, not cents) |

### BUG-07: Source filter shows all orders (C-FIX-1)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| TC-16 | Filter by "Facebook" | **PASS** | Shows 2 orders (ALPHA-001, ALPHA-003), "Page 1 - 2 rows" |

### BUG-08: UUID validation blocks drilldown (C-FIX-2 + C-FIX-3)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| TC-39 | Campaign → Adsets drilldown | **PASS** | 3 ad sets displayed with full metrics |
| TC-39+ | Adsets → Ads drilldown | **PASS** | 4 ads displayed under "A1 Broad US 25-54" |

**Root cause analysis:** C-FIX-2 (`@IsUUID('all')`) was insufficient. `class-validator`'s `isUUID('all')` validates against UUID versions 1-5 only. Our synthetic seed UUIDs (e.g., `00000000-ad10-0002-0001-000000000001`) have version=0, which is rejected by ALL UUID version checks.

**C-FIX-3 applied:** Replaced `@IsUUID('all')` with `@Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)` in 3 DTO files:
- `apps/api/src/ads-manager/dto/adsets-query.dto.ts`
- `apps/api/src/ads-manager/dto/ads-query.dto.ts`
- `apps/api/src/ads-manager/dto/filters-query.dto.ts`

### BUG-09: Campaigns page crash (C-FIX-1)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| TC-57 | Page loads without crash | **PASS** | Shows "0 campaigns", table with headers |
| TC-58 | Filter tabs work | **PASS** | All/Draft/Active/Paused/Archived tabs visible |
| TC-60 | New Campaign button | **PASS** | Button visible and clickable |

### BUG-10: Creatives page crash (C-FIX-1)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| TC-61 | Page loads without crash | **PASS** | Shows "0 creatives", table headers |
| TC-62 | Filters and New Creative button | **PASS** | Status/Type dropdowns, search, button all visible |

### BUG-11: Settings page crash (C-FIX-1)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| TC-63 | Page loads without crash | **PASS** | Store Profile + Store Settings sections |
| TC-64 | Store Profile data | **PASS** | Name "Alpha Store One", Slug "alpha-store-one", Status "Active" |
| TC-65 | Store Settings data | **PASS** | Currency USD, Timezone Asia/Ho Chi Minh, Meta Pixel ID populated |

### BUG-12: Login shows raw "Failed to fetch" (C-FIX-1 + C-FIX-3)

| TC | Description | Result | Evidence |
|----|-------------|--------|----------|
| BUG-12 | Error with API down | **PASS** | Shows "Network error — check your connection or the server may be down" |

**Root cause analysis:** C-FIX-1 didn't fully fix this. `apiClient.ts` was using `err.message` (raw browser "Failed to fetch") when the error was an `Error` instance. C-FIX-3 changed it to always use the human-friendly message, storing the raw error in `details.originalError`.

## Summary

| Metric | Count |
|--------|-------|
| TCs Retested | 14 |
| PASS | **14** |
| FAIL | **0** |
| Additional fixes applied (C-FIX-3) | 2 |

## Files Modified (C-FIX-3)

| File | Change |
|------|--------|
| `apps/api/src/ads-manager/dto/adsets-query.dto.ts` | `@IsUUID('all')` → `@Matches(UUID_SHAPE)` |
| `apps/api/src/ads-manager/dto/ads-query.dto.ts` | `@IsUUID('all')` → `@Matches(UUID_SHAPE)` |
| `apps/api/src/ads-manager/dto/filters-query.dto.ts` | `@IsUUID('all')` → `@Matches(UUID_SHAPE)` |
| `apps/web/src/lib/apiClient.ts` | Network error message: raw → human-friendly |

## Verdict

**ALL 14 TCs PASS.** Phase C regression bugs BUG-06 through BUG-12 are fully resolved.
C-FIX-3 was required on top of C-FIX-1 + C-FIX-2 to complete the fixes.
