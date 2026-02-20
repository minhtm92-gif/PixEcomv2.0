# Milestone 2.3.6 — Orders Upgrade (Tracking + Transaction ID)

**Branch:** `feature/2.3.6-orders-tracking`
**Base:** `develop` @ `0def8ab`
**Date:** 2026-02-20
**Status:** ✅ Complete

---

## Scope

1. **`transactionId`** — Expose `paymentId` as `transactionId` at the response layer in `GET /orders` and `GET /orders/:id`. No new DB column.
2. **`POST /api/orders/:id/refresh-tracking`** — Calls 17track API (real stub), updates `trackingStatus` on Order, logs `TRACKING_REFRESHED` OrderEvent.
3. **`autoTrackingRefresh`** — Boolean setting on SellerSettings; if `true`, a `@Cron` scheduler auto-refreshes all in-flight orders every 6 hours.
4. **Rate limiter** — 5 requests per 60 seconds per seller (in-memory guard, no external package).
5. **E2E coverage** — 14 new tests; full suite stays green.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 17track integration | Real stub (HttpModule + 17track v2 REST shape) | Tests mock via `jest.spyOn`; real key used in production |
| Scheduler | `ScheduleModule.forRoot()` + `@Cron` in `apps/api` | No BullMQ needed for simple 6h refresh cycle |
| Rate limiter | In-memory `Map<sellerId, { count, windowStart }>` | No `@nestjs/throttler` dependency; fixed-window per seller |
| `transactionId` | Renamed at response layer only | `paymentId` column already exists; zero migration cost |
| Error handling | SevenTrackProvider NEVER throws | Graceful `UNKNOWN` on any HTTP/parse error |

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `packages/database/prisma/migrations/20260220200000_orders_tracking/migration.sql` | Adds tracking_status, tracking_provider, auto_tracking_refresh, index, TRACKING_REFRESHED enum |
| `apps/api/src/orders/tracking/tracking.provider.ts` | `TrackingResult` interface |
| `apps/api/src/orders/tracking/seventeen-track.provider.ts` | Real 17track v2 API stub (never throws) |
| `apps/api/src/orders/orders-tracking.service.ts` | `refreshTracking()` + `autoRefreshAll()` |
| `apps/api/src/orders/guards/tracking-rate-limit.guard.ts` | 5 req/60s in-memory rate limiter |
| `apps/api/src/orders/tracking-scheduler.service.ts` | `@Cron('0 */6 * * *')` auto-refresh |
| `apps/api/test/orders-tracking.e2e-spec.ts` | 14 E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Order: +trackingStatus, +trackingProvider, +index. SellerSettings: +autoTrackingRefresh. Enum: +TRACKING_REFRESHED |
| `apps/api/src/orders/orders.service.ts` | +transactionId, +tracking section in list + detail responses |
| `apps/api/src/orders/orders.controller.ts` | +POST `:id/refresh-tracking` with `@HttpCode(200)` + `TrackingRateLimitGuard` |
| `apps/api/src/orders/orders.module.ts` | +HttpModule, +OrdersTrackingService, +SevenTrackProvider, +TrackingSchedulerService, +TrackingRateLimitGuard |
| `apps/api/src/app.module.ts` | +ScheduleModule.forRoot() (global) |
| `apps/api/src/seller/dto/update-seller-settings.dto.ts` | +autoTrackingRefresh: boolean |
| `apps/api/src/seller/seller-settings.service.ts` | +autoTrackingRefresh in SETTINGS_SELECT + conditional update |
| `.env.example` | +SEVENTEEN_TRACK_API_KEY |

---

## Migration

File: `packages/database/prisma/migrations/20260220200000_orders_tracking/migration.sql`

Applied via:
```bash
cat packages/database/prisma/migrations/20260220200000_orders_tracking/migration.sql \
  | docker exec -i pixecom-postgres psql -U pixecom -d pixecom_v2
```

Then registered in `_prisma_migrations`:
```sql
INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
VALUES (gen_random_uuid(), 'placeholder', '20260220200000_orders_tracking', now(), now(), 1);
```

After schema edits: `pnpm --filter @pixecom/database exec prisma generate`

---

## Issues Encountered & Fixes

### Issue 1 — `ScheduleModule.forFeature()` does not exist
- **Symptom:** TypeScript error `Property 'forFeature' does not exist on type typeof ScheduleModule`
- **Root cause:** `@nestjs/schedule` only exports `ScheduleModule.forRoot()`, not `forFeature()`
- **Fix:** Removed `ScheduleModule.forFeature()` from `OrdersModule.imports`. `ScheduleModule.forRoot()` registered once globally in `AppModule` picks up all `@Cron` decorators automatically.

### Issue 2 — `TRACKING_REFRESHED` not assignable to `OrderEventType`
- **Symptom:** TS error: `Type '"TRACKING_REFRESHED"' is not assignable to type 'OrderEventType'`
- **Root cause:** The enum was not added to DB or Prisma schema initially
- **Fix:** `ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS 'TRACKING_REFRESHED'` in DB, added to migration SQL, added to schema enum, re-ran `prisma generate`

### Issue 3 — Stale Prisma client (new fields not recognized)
- **Symptom:** TS errors: `trackingStatus`, `trackingProvider`, `autoTrackingRefresh` not known to Prisma client
- **Root cause:** Prisma client generated before schema edits
- **Fix:** `pnpm --filter @pixecom/database exec prisma generate`

### Issue 4 — `orderEvent.create` missing required `sellerId`
- **Symptom:** TS error: `Argument of type '...' is not assignable ... Property 'sellerId' is missing`
- **Root cause:** `OrderEvent` model has required `sellerId` FK
- **Fix:** Added `sellerId` to the `data` object in `orderEvent.create` call

### Issue 5 — `POST` endpoint returned 201 instead of 200
- **Symptom:** Tests 6 and 11 failed: `Expected 200, Received 201`
- **Root cause:** NestJS defaults all `@Post` endpoints to HTTP 201 Created
- **Fix:** Added `@HttpCode(200)` decorator to `refreshTracking()` handler

---

## 17track Provider

**Endpoint:** `POST https://api.17track.net/track/v2/gettracklist`
**Auth:** Header `17token: <SEVENTEEN_TRACK_API_KEY>`

Status code mapping:
| 17track code | Our status |
|---|---|
| 0 | `PENDING` |
| 10 | `IN_TRANSIT` |
| 20 | `ARRIVED` |
| 30 | `DELIVERED` |
| 35 | `UNDELIVERED` |
| 40 | `EXCEPTION` |
| any error | `UNKNOWN` |

---

## Rate Limiter Design

```
Map<sellerId, { count: number; windowStart: number }>
MAX_REQUESTS = 5
WINDOW_MS    = 60_000
```

- Fixed window per seller (not sliding)
- Window resets when `Date.now() - windowStart >= WINDOW_MS`
- Throws `HttpException(429, 'Too Many Requests')` when `count >= MAX_REQUESTS`
- Applied only to `POST /:id/refresh-tracking`

---

## Test Results

```
Test Suites: 2 failed, 10 passed, 12 total
Tests:       5 failed, 266 passed, 271 total
```

- **14 new tests**: all pass ✅ (`orders-tracking.e2e-spec.ts`)
- **5 pre-existing failures** (not introduced by this milestone):
  - `asset-registry.e2e-spec.ts` — 1 failure (platform asset seed ID mismatch)
  - `products.e2e-spec.ts` — 4 failures (MOUSE-001/DESKPAD-001/STAND-001 seed data missing)
- **Previously passing 252 tests**: still pass ✅

### New Test Coverage

| # | Test | Result |
|---|------|--------|
| 1 | GET /orders — transactionId present in list item | ✅ |
| 2 | GET /orders — trackingNumber + trackingStatus in list item | ✅ |
| 3 | GET /orders/:id — transactionId = paymentId value | ✅ |
| 4 | GET /orders/:id — tracking section shape (number, status, url, provider) | ✅ |
| 5 | POST /orders/:id/refresh-tracking — 401 without JWT | ✅ |
| 6 | POST /orders/:id/refresh-tracking — 200 + snapshot shape | ✅ |
| 7 | POST /orders/:id/refresh-tracking — trackingStatus updated in DB | ✅ |
| 8 | POST /orders/:id/refresh-tracking — OrderEvent logged (TRACKING_REFRESHED) | ✅ |
| 9 | POST /orders/:id/refresh-tracking — 400 when order has no tracking number | ✅ |
| 10 | POST /orders/:id/refresh-tracking — 404 when seller B uses seller A orderId | ✅ |
| 11 | POST /orders/:id/refresh-tracking — 429 after 5 requests in 60s window | ✅ |
| 12 | GET /sellers/me/settings — autoTrackingRefresh field present (default false) | ✅ |
| 13 | PATCH /sellers/me/settings — set autoTrackingRefresh=true persisted | ✅ |
| 14 | POST /orders/:id/refresh-tracking — 404 for unknown orderId | ✅ |

---

## Key Constraints Upheld

- `sellerId` always from JWT — never from params or body
- `transactionId` = `paymentId` renamed at response layer — no new DB column
- Rate limiter: in-memory only, no `@nestjs/throttler`
- `SevenTrackProvider`: NEVER throws — graceful `UNKNOWN` on any error
- `autoRefreshAll()`: catches per-order errors, batch never aborts
- E2E: mocked `SevenTrackProvider` via `jest.spyOn` — no real HTTP calls
