# Milestone 2.3.1 — FB Connections + Ad Strategies (Mock-only)
**Branch:** `feature/2.3.1-fb-connections-ad-strategies`
**Status:** ✅ Complete
**Date:** 2026-02-19
**Tests:** 209 passed (179 existing + 30 new)

---

## Objective

Implement the FB Connections and Ad Strategies modules as mock-only metadata stores — no real OAuth flow, no token storage, no live Meta API calls. These serve as the data foundation for campaign management in later milestones (2.3.2+).

- **FB Connections**: Store metadata about connected Meta assets (Ad Accounts, Pages, Pixels, Conversions). Token field (`accessTokenEnc`) exists in DB but is never populated or returned via API.
- **Ad Strategies**: Reusable campaign strategy templates storing structured config JSON (budget, audience, placements). Used when creating campaigns in 2.3.2.

---

## DB Changes

No schema migration required. Both models were already added in an earlier schema migration:

| Model | Key Fields |
|-------|-----------|
| `FbConnection` | `sellerId, connectionType (enum), externalId, name, accessTokenEnc? (excluded from API), parentId?, isPrimary, isActive, metadata (Json)` |
| `AdStrategy` | `sellerId, name, config (Json), isActive` |
| `FbConnectionType` enum | `AD_ACCOUNT, PAGE, PIXEL, CONVERSION` |

**Unique constraint on FbConnection:** `@@unique([sellerId, connectionType, externalId])` — prevents duplicate registrations of the same external Meta asset per seller.

---

## New Modules

### FbConnectionsModule (`apps/api/src/fb-connections/`)
| File | Description |
|------|-------------|
| `dto/create-fb-connection.dto.ts` | `connectionType, externalId, name, parentId?, isPrimary?` |
| `dto/update-fb-connection.dto.ts` | `name?, isPrimary?, isActive?` (all optional) |
| `dto/list-fb-connections.dto.ts` | `connectionType?` filter |
| `fb-connections.service.ts` | CRUD — `accessTokenEnc` excluded from all selects/responses |
| `fb-connections.controller.ts` | `@Controller('fb/connections')`, JWT-guarded |
| `fb-connections.module.ts` | Module wiring, exports `FbConnectionsService` |

**Security note:** `FB_CONNECTION_SELECT` explicitly omits `accessTokenEnc`. The field is never read, stored (via API), or returned. `provider: 'META'` constant is added to all responses for future extensibility.

### AdStrategiesModule (`apps/api/src/ad-strategies/`)
| File | Description |
|------|-------------|
| `dto/create-ad-strategy.dto.ts` | Nested `budget` + `audience` DTOs + `placements` array |
| `dto/update-ad-strategy.dto.ts` | All fields optional, mirrors create |
| `ad-strategies.service.ts` | CRUD with selective config merge on PATCH |
| `ad-strategies.controller.ts` | `@Controller('fb/ad-strategies')`, JWT-guarded |
| `ad-strategies.module.ts` | Module wiring |

---

## API Endpoints

All routes require `Authorization: Bearer <access_token>`. `sellerId` is always sourced from the JWT payload — never from request body or path params.

### FB Connections
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `POST` | `/api/fb/connections` | 201 | Register a connection |
| `GET` | `/api/fb/connections` | 200 | List seller's connections (optional `?connectionType=` filter) |
| `GET` | `/api/fb/connections/:id` | 200 | Get single connection |
| `PATCH` | `/api/fb/connections/:id` | 200 | Update name/isPrimary/isActive |
| `DELETE` | `/api/fb/connections/:id` | 200 | Delete connection |

### Ad Strategies
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `POST` | `/api/fb/ad-strategies` | 201 | Create strategy |
| `GET` | `/api/fb/ad-strategies` | 200 | List seller's strategies |
| `GET` | `/api/fb/ad-strategies/:id` | 200 | Get single strategy |
| `PATCH` | `/api/fb/ad-strategies/:id` | 200 | Update (selective config merge) |
| `DELETE` | `/api/fb/ad-strategies/:id` | 200 | Delete strategy |

---

## Validation Rules

### CreateFbConnectionDto
- `connectionType`: must be `AD_ACCOUNT | PAGE | PIXEL | CONVERSION`
- `externalId`: non-empty string, max 255 chars
- `name`: non-empty string, max 255 chars
- `parentId`: optional UUID (e.g. ad account that owns a pixel)
- `isPrimary`: optional boolean

### CreateAdStrategyDto
- `name`: non-empty string, max 255 chars
- `budget.budgetType`: `DAILY | LIFETIME`
- `budget.amount`: integer, min 100 (cents), max 100,000,000 cents
- `audience.mode`: `ADVANTAGE_PLUS | MANUAL`
- `audience.attributionWindowDays`: optional, must be 1 | 7 | 28 (used for MANUAL mode)
- `placements`: array, each item must be one of 5 known placement strings
- `isActive`: optional boolean (defaults to `true` on create)

---

## Key Implementation Details

### Selective Config Merge (PATCH /ad-strategies)
PATCH only updates the fields that are supplied. Config sub-objects (`budget`, `audience`) are replaced atomically if present — there is no sub-field-level merge within the config JSON.

```typescript
const mergedConfig: StrategyConfig = {
  budget: dto.budget
    ? { budgetType: dto.budget.budgetType, amount: dto.budget.amount }
    : currentConfig.budget,
  audience: dto.audience ? { ... } : currentConfig.audience,
  placements: dto.placements ?? currentConfig.placements,
};
```

### Duplicate Connection Prevention
`createConnection` queries for an existing `(sellerId, connectionType, externalId)` triple before inserting. Returns `409 Conflict` if already registered.

### `@IsDefined()` on Nested DTOs
`@ValidateNested()` alone does not reject `undefined`. Without `@IsDefined()`, a missing `budget` field would pass validation and crash the service at `dto.budget.budgetType`. Fixed by decorating all required nested fields with `@IsDefined()`.

---

## Issues Encountered & Resolved

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | `StrategyConfig` interface not exported — TS4053 error in controller | Exported `interface StrategyConfig` from `ad-strategies.service.ts` |
| 2 | `Prisma JsonValue → StrategyConfig` cast error (TS2352) | Used double-cast: `existing.config as unknown as StrategyConfig` |
| 3 | Test 20 (`missing budget → 400`) returned 500 instead | Added `@IsDefined()` to `budget`, `audience`, `placements` in `CreateAdStrategyDto` |

---

## Test Coverage

**File:** `apps/api/test/fb-connections-ad-strategies.e2e-spec.ts`
**Total new tests:** 30

### FB Connections (17 tests)
1. Returns 401 without JWT
2. POST — creates AD_ACCOUNT connection (201)
3. POST — creates PAGE connection (201)
4. POST — creates PIXEL with parentId (201)
5. GET list — returns only seller's connections
6. GET list — isolation: seller B cannot see seller A's connections
7. GET list — `?connectionType=AD_ACCOUNT` filter
8. GET :id — returns correct connection
9. GET :id — 404 for another seller's connection (isolation)
10. GET :id — 404 for non-existent id
11. PATCH — updates name
12. PATCH — updates isPrimary + isActive
13. PATCH — 404 for another seller's connection
14. DELETE — removes connection
15. DELETE — 404 for another seller's connection
16. POST — 409 on duplicate (same connectionType + externalId)
17. GET list — `accessTokenEnc` never present in any response

### Ad Strategies (13 tests)
18. Returns 401 without JWT
19. POST — creates strategy with correct config shape (201)
20. POST — returns 400 when `budget` is missing
21. POST — returns 400 when `budget.amount` is below minimum (< 100)
22. POST — returns 400 when `placements` contains invalid value
23. GET list — returns only seller's strategies
24. GET list — isolation: seller B cannot see seller A's strategies
25. GET :id — returns correct strategy
26. GET :id — 404 for another seller's strategy (isolation)
27. PATCH — updates `name` only (config unchanged)
28. PATCH — updates `budget` sub-config (audience + placements unchanged)
29. PATCH — returns 400 when no fields are provided
30. DELETE — removes strategy

---

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `FbConnectionsModule` and `AdStrategiesModule` to imports |

## Files Created

| File | Description |
|------|-------------|
| `apps/api/src/fb-connections/dto/create-fb-connection.dto.ts` | Create DTO |
| `apps/api/src/fb-connections/dto/update-fb-connection.dto.ts` | Update DTO |
| `apps/api/src/fb-connections/dto/list-fb-connections.dto.ts` | List/filter DTO |
| `apps/api/src/fb-connections/fb-connections.service.ts` | Service (CRUD) |
| `apps/api/src/fb-connections/fb-connections.controller.ts` | Controller |
| `apps/api/src/fb-connections/fb-connections.module.ts` | Module |
| `apps/api/src/ad-strategies/dto/create-ad-strategy.dto.ts` | Create DTO (nested budget + audience) |
| `apps/api/src/ad-strategies/dto/update-ad-strategy.dto.ts` | Update DTO (all optional) |
| `apps/api/src/ad-strategies/ad-strategies.service.ts` | Service (CRUD + selective merge) |
| `apps/api/src/ad-strategies/ad-strategies.controller.ts` | Controller |
| `apps/api/src/ad-strategies/ad-strategies.module.ts` | Module |
| `apps/api/test/fb-connections-ad-strategies.e2e-spec.ts` | 30 E2E tests |

---

## Test Results

```
Test Suites: 8 passed, 8 total
Tests:       209 passed, 209 total  (179 existing + 30 new)
Time:        ~18s
```
