# Milestone 2.3.2 — Campaigns Module (Ad Wizard, Mock-only)

**Branch:** `feature/2.3.2-campaign-wizard`
**Based on:** `develop` @ `c45b521`
**Status:** ✅ Complete
**Tests:** 33 new / 212 total passing

---

## Summary

Implemented the full Campaigns module providing the campaign creation wizard and management API. Creates a complete Campaign → AdSet → Ad → AdPost hierarchy in a single DB transaction, with creative linking, budget resolution from ad strategy, and full tenant isolation.

No Meta API calls are made — all data is stored locally (mock-only phase).

---

## Endpoints Delivered

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/campaigns` | Create campaign + adset + ad + adpost in one transaction |
| `POST` | `/api/campaigns/preview` | Validate payload, return computed shape — no DB writes |
| `GET` | `/api/campaigns` | List seller campaigns (ACTIVE/PAUSED by default) |
| `GET` | `/api/campaigns/:id` | Nested detail (adsets → ads → adposts) |
| `PATCH` | `/api/campaigns/:id/status` | Toggle ACTIVE ↔ PAUSED |

---

## Files Created

| File | Description |
|------|-------------|
| `apps/api/src/campaigns/dto/create-campaign.dto.ts` | CreateCampaignDto with full validation |
| `apps/api/src/campaigns/dto/update-campaign-status.dto.ts` | Status toggle DTO (ACTIVE/PAUSED only) |
| `apps/api/src/campaigns/dto/list-campaigns.dto.ts` | List filters: status, sellpageId, includeArchived |
| `apps/api/src/campaigns/campaigns.service.ts` | Core service: create, preview, list, get, updateStatus |
| `apps/api/src/campaigns/campaigns.controller.ts` | REST controller with JWT guard |
| `apps/api/src/campaigns/campaigns.module.ts` | NestJS module registration |
| `apps/api/test/campaigns-232.e2e-spec.ts` | 33 E2E tests across 8 test groups |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `CampaignsModule` import |

---

## Key Implementation Details

### Transaction Design
`createCampaign()` runs a single `$transaction` that creates:
1. `Campaign` row (with sellerId, sellpageId, adAccountId, budget, status=ACTIVE)
2. `CampaignCreative` join rows (links creative IDs — `campaign_creatives` table already existed in schema)
3. `Adset` row (name defaults to `"${campaignName} — AdSet 1"`)
4. `Ad` row (name defaults to `"${campaignName} — Ad 1"`)
5. `AdPost` row (links pageConnectionId + ad, postSource=CONTENT_SOURCE)

### Budget Resolution
- Explicit `budgetAmount` always wins
- If only `adStrategyId` provided → reads `config.budget.amount` and `config.budget.budgetType` from strategy
- If neither provided → `400 Bad Request`

### validateAndResolve() Checks (in order)
1. **Sellpage** — must exist and belong to seller
2. **Ad Account** — must be `AD_ACCOUNT` type, belong to seller, `isActive=true`
3. **Page** — must be `PAGE` type, belong to seller, `isActive=true`
4. **Pixel** (optional) — must be `PIXEL` type, belong to seller, `isActive=true`
5. **Ad Strategy** (optional) — must belong to seller, `isActive=true`; budget pulled from config if no explicit amount
6. **Creatives** — each must belong to seller and have `status=READY`

### List Filtering
- Default: `status IN (ACTIVE, PAUSED)` — hides ARCHIVED and DELETED
- `?status=PAUSED` — exact status filter (overrides default)
- `?includeArchived=true` — shows all statuses
- `?sellpageId=<uuid>` — filter by sellpage

### Status Toggle Guard
- Only campaigns with `status=ACTIVE` or `status=PAUSED` can be toggled
- `ARCHIVED` or `DELETED` → `400 Bad Request` with message

### Preview (No DB Writes)
`previewCampaign()` runs full `validateAndResolve()` validation then returns a structured preview object — identical data to what `createCampaign()` would create, without persisting anything. Useful for the wizard UI confirmation step.

---

## Test Coverage (33 tests)

| Group | Tests | Coverage |
|-------|-------|----------|
| Test 1 — Happy path | 4 | Create full hierarchy; auto-names; strategy budget; 400 no budget |
| Test 2 — Preview | 2 | Returns preview shape; no DB records created |
| Test 3 — Seller isolation | 3 | 404 cross-tenant read/update; list scoped to seller |
| Test 4 — Inactive/wrong type | 4 | Inactive adAccount; inactive strategy; cross-tenant sellpage; wrong conn type |
| Test 5 — Non-READY creative | 3 | DRAFT creative; nonexistent UUID; cross-tenant creative |
| Test 6 — Status toggle | 5 | PAUSED; ACTIVE; ARCHIVED blocks; DELETED blocks; invalid value |
| Test 7 — List & detail | 6 | Scoped list; excludes ARCHIVED; includeArchived; status filter; nested detail; list shape |
| Test 8 — DTO validation | 6 | Empty name; bad UUID; budget < 100; invalid status; 401 GET; 401 POST |

---

## Issues Encountered

### TS compile error: `accessToken` vs `accessTokenEnc`
- `FbConnection.accessToken` → `accessTokenEnc` (schema uses encrypted field name)
- Fixed in test seeding: changed `accessToken: 'test-token'` → `accessTokenEnc: 'test-token-enc'`

### TS compile error: `Sellpage.title`
- Sellpage model has no `title` field — has `titleOverride` (optional) and requires `productId` (non-nullable)
- Fixed by: discovering seeded `MOUSE-001` product via `GET /api/products` and using it to create sellpage via `POST /api/sellpages` API instead of Prisma direct

---

## Test Results

```
PASS test/campaigns-232.e2e-spec.ts (15.071 s)

Test Suites: 8 passed, 8 total
Tests:       212 passed, 212 total  (179 pre-existing + 33 new)
Time:        22.813 s
```

---

## Cumulative Test Suite Growth

| Milestone | Tests |
|-----------|-------|
| 2.1.1 | 38 |
| 2.1.2 | 55 |
| 2.2.1 | 68 |
| 2.2.2 | 88 |
| 2.2.3 | 98 |
| 2.2.4 | 118 |
| 2.2.4.1 | 138 |
| 2.3.1 | 179 |
| **2.3.2** | **212** |
