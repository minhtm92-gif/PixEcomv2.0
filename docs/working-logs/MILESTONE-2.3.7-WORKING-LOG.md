# Milestone 2.3.7 — Stability Hardening (Before Frontend Integration)

**Branch:** `feature/2.3.7-stability-hardening`
**Base:** `develop` @ `0def8ab`
**Date:** 2026-02-20
**Status:** ✅ Complete

---

## Scope

Stability pass before frontend integration. Five workstreams, no new product features.

| WS | Name | Goal |
|----|------|------|
| WS1 | Fix E2E Failures | 100% green test suite on develop |
| WS2 | Request ID + Structured Logging | Traceable correlation ID in every request/job log |
| WS3 | Global Exception Filter | Consistent error shape, no stack trace leakage |
| WS4 | Deep Health Endpoint | DB + Redis liveness reflected in `/api/health` |
| WS5 | Timing Interceptor | `X-Response-Time-Ms` header + slow-request WARN log |

---

## WS1 — Fix 5 Existing E2E Failures

### Root Cause Analysis

Both failing test suites depended on externally-seeded data (products and platform asset) that **was not guaranteed to be in the DB at E2E test time**.

| Test Suite | Failing Test | Root Cause |
|-----------|------|-----------|
| `products.e2e-spec.ts` | `MOUSE-001 card heroImageUrl` | DB seed not run → MOUSE-001 missing |
| `products.e2e-spec.ts` | `youTakeEstimate MOUSE-001 (catalog)` | Same |
| `products.e2e-spec.ts` | `youTakeEstimate DESKPAD-001 (catalog)` | Same |
| `products.e2e-spec.ts` | `youTakeEstimate STAND-001 (fixed)` | Same |
| `asset-registry.e2e-spec.ts` | `seller A can see platform assets` | Platform asset `00000000-0000-0000-0000-000000004001` not in DB |

### Secondary Root Cause (discovered during fix)

Even after self-contained seed, 4 of 5 tests still failed:
- Products list sorted by `createdAt DESC`; with 20+ existing products, seed products (created long ago via DB seed) fell below the default `limit=20` page.
- 4 product tests called `GET /api/products` without `?limit=100`, so they missed MOUSE-001 etc.
- Platform asset also fell beyond page 100 in a DB with 100+ assets from previous E2E runs → fixed by bumping `createdAt` to `NOW()` in the upsert update clause.

### Race Condition (discovered during full suite run)

Pagination overlap test (`page 2 with limit=2 returns different products than page 1`) failed intermittently when test suites ran in parallel against the shared DB (another suite was inserting products mid-test).

**Fix**: Added `"runInBand": true` to `test/jest-e2e.json` — all E2E suites now run sequentially, eliminating shared-DB race conditions.

### Fixes Applied

1. **`products.e2e-spec.ts`**:
   - Added `PrismaService` injection in `beforeAll`
   - Self-contained upsert of 3 products + variants + pricing rules + labels + assets
   - Changed 4 catalog-search tests to use `?limit=100`

2. **`asset-registry.e2e-spec.ts`**:
   - Added `PrismaService` injection in `beforeAll`
   - Self-contained upsert of platform asset (with `update: { createdAt: new Date() }` to ensure top-of-page ordering)

3. **`test/jest-e2e.json`**: Added `"runInBand": true`

---

## WS2 — Request ID + Structured Logging

### API

**`src/common/middleware/request-id.middleware.ts`** (NEW)
- Reads `X-Request-Id` header if present (caller correlation ID)
- Otherwise generates UUID v4 via `crypto.randomUUID()`
- Attaches to `req.requestId` and `X-Request-Id` response header
- Registered in `AppModule.configure()` for all routes

**`src/common/logger/app-logger.service.ts`** (NEW)
- Thin JSON wrapper around NestJS Logger
- Production: newline-delimited JSON (`{ ts, level, requestId?, sellerId?, route?, method?, statusCode?, durationMs?, msg }`)
- Development: human-readable format
- No secrets logged (no tokens, no fileUrl, no passwords)

### Worker

**`apps/worker/src/main.ts`** (MODIFIED)
- Replaced all `console.log/error` with structured JSON logger
- Log shape: `{ ts, level, queue, jobId, sellerId?, durationMs?, msg }`
- NEVER logs job payload (avoids leaking URLs, tokens)

---

## WS3 — Global Exception Filter + Safe Response Shape

**`src/common/filters/http-exception.filter.ts`** (NEW)

Catches ALL exceptions. Response shape:
```json
{ "error": { "code": "...", "message": "...", "requestId": "...", "details?": [...] } }
```

Prisma error mapping:
| Prisma Code | HTTP Status | Code |
|-------------|-------------|------|
| `P2002` | 409 | `CONFLICT` |
| `P2025` | 404 | `NOT_FOUND` |
| `P2016` | 404 | `NOT_FOUND` |
| `P2003` | 400 | `BAD_REQUEST` |
| `PrismaClientValidationError` | 400 | `BAD_REQUEST` |

NestJS HttpException handling:
- Reads `exception.getResponse()` for ValidationPipe array-message format
- Returns `details: string[]` for validation errors
- Maps status code to semantic `code` string

Stack traces: NEVER in response body. Only logged internally (non-prod: `details` message only).

Registered globally in `main.ts` via `app.useGlobalFilters(new HttpExceptionFilter())`.

---

## WS4 — Deep Health Endpoint

**`src/health/health.service.ts`** (NEW)
- `checkDb()`: `SELECT 1` with 2s timeout → `"connected"` or `"down"`
- `checkRedis()`: fresh `ioredis` client → `PING` with 2s timeout → `"connected"` or `"down"`
- Redis client always disconnected in `finally` (no connection leak)

**`src/health/health.controller.ts`** (MODIFIED)

Response shape:
```json
{
  "status": "ok",
  "service": "pixecom-api",
  "timestamp": "2026-02-20T14:00:00.000Z",
  "requestId": "uuid",
  "db": "connected",
  "redis": "connected"
}
```

- `status: "degraded"` when DB or Redis is down
- Always HTTP 200 (callers check `status` field; load balancers keep routing)

**`apps/api/package.json`**: added `ioredis` dependency

---

## WS5 — Timing Interceptor

**`src/common/interceptors/timing.interceptor.ts`** (NEW)
- Records `Date.now()` at request entry
- On response/error: computes `durationMs`
- Sets `X-Response-Time-Ms` response header
- Logs: `GET /api/orders 200 45ms` (with requestId)
- WARN log if `durationMs > SLOW_REQUEST_THRESHOLD_MS` (env, default `1000`)
- No request/response body logged — metadata only

Registered globally in `main.ts` via `app.useGlobalInterceptors(new TimingInterceptor())`.

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/common/middleware/request-id.middleware.ts` | WS2 — Request ID injection |
| `apps/api/src/common/logger/app-logger.service.ts` | WS2 — Structured JSON logger |
| `apps/api/src/common/filters/http-exception.filter.ts` | WS3 — Global exception filter |
| `apps/api/src/common/interceptors/timing.interceptor.ts` | WS5 — Timing interceptor |
| `apps/api/src/health/health.service.ts` | WS4 — DB + Redis health checks |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/health/health.controller.ts` | WS4 — injects HealthService, adds requestId |
| `apps/api/src/health/health.module.ts` | WS4 — adds HealthService provider |
| `apps/api/src/app.module.ts` | WS2 — registers RequestIdMiddleware; adds ScheduleModule |
| `apps/api/src/main.ts` | WS3+WS5 — registers global filter + interceptor |
| `apps/worker/src/main.ts` | WS2 — structured JSON logging |
| `apps/api/package.json` | WS4 — adds ioredis; WS2 — @nestjs/schedule, @nestjs/axios |
| `apps/api/test/products.e2e-spec.ts` | WS1 — self-contained seed, ?limit=100 |
| `apps/api/test/asset-registry.e2e-spec.ts` | WS1 — self-contained platform asset seed |
| `apps/api/test/jest-e2e.json` | WS1 — runInBand: true |

---

## Issues Encountered & Fixes

### Issue 1 — `@nestjs/schedule` not in `apps/api/package.json`
- Missing from package.json even though used on feature branches
- Fix: `pnpm --filter @pixecom/api add @nestjs/schedule @nestjs/axios axios`

### Issue 2 — Exception filter imported `@prisma/client` directly
- TS error: `Cannot find module '@prisma/client'` (not in API's `node_modules`)
- Fix: Changed to `import { Prisma } from '@pixecom/database'` (the workspace package that re-exports Prisma)

### Issue 3 — Pagination race condition in full parallel suite
- `products.e2e-spec.ts` pagination test intermittently failed when another suite inserted products mid-test
- Fix: `"runInBand": true` in `jest-e2e.json`

### Issue 4 — Platform asset below page limit due to `createdAt DESC` sort
- Even with `?limit=100`, if DB has 100+ assets, old seed asset was out of range
- Fix: `update: { createdAt: new Date() }` in upsert to bump to top of sort

---

## Test Results

```
Test Suites: 11 passed, 11 total
Tests:       257 passed, 0 failed, 257 total
Time:        ~20s (sequential)
```

**Before this milestone:** 252 passing, 5 failing → 257/257 ✅

No new tests added — existing tests fixed and infrastructure hardened.

---

## Deploy Notes

After merging to develop + tagging:

```bash
# On VPS
git checkout <tag>
pnpm install --frozen-lockfile
pnpm -r build
# No prisma migrate needed (no schema changes)
pm2 restart pixecom-api
pm2 restart pixecom-worker

# Verify
curl https://api.pixecom.io/api/health
# Expect: { status:"ok", db:"connected", redis:"connected", requestId:"...", ... }

# Verify headers
curl -I https://api.pixecom.io/api/health
# Expect headers: X-Request-Id: <uuid>, X-Response-Time-Ms: <ms>
```

---

## Key Constraints Upheld

- No new product features added
- No Prisma migrations (zero schema changes)
- No secrets logged (filter: no tokens, URLs, passwords)
- Stack traces never in response body (production safe)
- Health check always HTTP 200 (LB-friendly)
- E2E tests self-contained — no external `db:seed` required
