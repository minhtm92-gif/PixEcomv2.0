# Milestone 2.3.3 — Stats Worker + MockProvider

**Branch:** `feature/2.3.3-stats-worker`
**Based on:** `develop` @ `a0b7123` (v0.2.2)
**Status:** ✅ Complete
**Tests:** 18 new / 245 total passing

---

## Summary

Implemented the full stats sync pipeline: deterministic MockProvider → 3-tier DB write (raw → daily → sellpage). Added cron scheduler (5-min cadence) in the worker process and a manual-trigger API endpoint. No Meta API calls — mock-only phase.

---

## Architecture

```
┌────────────────────────────────────────────┐
│  apps/worker                               │
│                                            │
│  scheduler.ts    ──┐                       │
│  (node-cron       │   enqueue jobs         │
│   */5 * * * *)    │                        │
│                   ▼                        │
│  queue.ts  ───► BullMQ "stats-sync"        │
│                   │                        │
│  processor.ts ◄───┘  (concurrency=5)       │
│      │                                     │
│      ├─ MockProvider.fetchStats()          │
│      ├─ writeRaw()       → ad_stats_raw    │
│      ├─ aggregateDaily() → ad_stats_daily  │
│      └─ rollupSellpage() → sellpage_stats  │
│                                            │
│  health.ts  GET /health :3001              │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  apps/api                                  │
│                                            │
│  POST /api/ads-manager/sync                │
│      └─ AdsManagerService.enqueueSync()   │
│            └─ BullMQ Queue.add()           │
└────────────────────────────────────────────┘
```

---

## Files Created

### apps/worker/src/

| File | Description |
|------|-------------|
| `queue.ts` | Shared BullMQ Queue instance + `enqueueSellerSync()` + `makeJobId()` |
| `processor.ts` | Job processor: orchestrates full pipeline per seller/level |
| `scheduler.ts` | node-cron `*/5 * * * *` — queries eligible sellers, enqueues jobs |
| `health.ts` | Lightweight HTTP health server on port 3001 |
| `providers/stat-provider.interface.ts` | `StatProvider` interface + `RawStatRow` type |
| `providers/mock.provider.ts` | Deterministic seeded PRNG stats generator |
| `pipeline/fetch-entities.ts` | Query campaigns/adsets/ads for eligible sellers |
| `pipeline/write-raw.ts` | `createMany` to `ad_stats_raw` (append-only) |
| `pipeline/aggregate-daily.ts` | `groupBy` raw → `upsert` `ad_stats_daily` |
| `pipeline/rollup-sellpage.ts` | Campaign daily → `upsert` `sellpage_stats_daily` |

### apps/worker/src/ (modified)

| File | Change |
|------|--------|
| `main.ts` | Replaced placeholder with full bootstrap: worker + scheduler + health |

### apps/api/src/ads-manager/ (new module)

| File | Description |
|------|-------------|
| `ads-manager.module.ts` | NestJS module |
| `ads-manager.controller.ts` | `POST /api/ads-manager/sync` → 202 Accepted |
| `ads-manager.service.ts` | Enqueue via BullMQ Queue (init/destroy lifecycle) |
| `dto/sync-request.dto.ts` | Optional `date?: string` (YYYY-MM-DD) |

### apps/api/src/ (modified)

| File | Change |
|------|--------|
| `app.module.ts` | Added `AdsManagerModule` |

### Tests

| File | Tests |
|------|-------|
| `apps/api/test/stats-worker-233.e2e-spec.ts` | 18 integration + E2E tests |

### Docs

| File | Description |
|------|-------------|
| `docs/MILESTONE-2.3.3-SPEC.md` | Approved spec (Phase A) |
| `docs/MILESTONE-2.3.3-WORKING-LOG.md` | This file |

---

## Key Implementation Details

### MockProvider — Deterministic PRNG

Seed: `SHA256(sellerId + ':' + entityId + ':' + dateStr)` → first 4 bytes → `uint32` seed for mulberry32 PRNG.

Same inputs → same outputs every run. Spend = `budget × (0.85 + rng() × 0.30)` (±15% noise). Full funnel: CPM $8.50 → CTR 2% → views 70% → ATC 12% → checkout 50% → purchase 40% → AOV $35–150 (seeded).

### 3-Tier Pipeline

1. **`ad_stats_raw`** — append-only `createMany`. Each 5-min sync appends new rows.
2. **`ad_stats_daily`** — `groupBy` all raw for entity/date → `upsert` via `uq_ad_stats_daily`. Derived ratios (cpm, ctr, roas) re-computed from summed totals.
3. **`sellpage_stats_daily`** — joins campaign daily rows to `campaign.sellpageId` → `upsert` via `uq_sellpage_stats_daily`. Only triggered by CAMPAIGN-level jobs.

### BullMQ jobId Fix

BullMQ v5.69.3 **forbids `:` in custom jobIds** (throws `Custom Id cannot contain :`). Spec format `sync:sellerId:date:date:level` was adjusted to `sync__sellerId__date__date__level` using `__` separator.

### Schema Changes

**None** — all three stats tables already existed.

---

## Issues Encountered

### BullMQ v5.69.3: `:` not allowed in jobId
- Error: `Custom Id cannot contain :`
- Fix: replaced `:` separator with `__` in both `apps/worker/src/queue.ts` and `apps/api/src/ads-manager/ads-manager.service.ts`.
- Updated spec note: jobId format is `sync__${sellerId}__${date}__${date}__${level}`

---

## Test Coverage (18 tests)

| Group | Tests | Coverage |
|-------|-------|----------|
| Test 1 — MockProvider determinism | 2 | Same seed = same values; different entityId = different values |
| Test 2 — RawStatRow shape | 2 | All fields present; funnel monotonic; spend within ±15% of budget |
| Test 3 — writeRaw | 2 | Inserts rows; append-only (multiple rows per entity/date) |
| Test 4 — aggregateDaily | 2 | Creates daily row; upsert re-aggregates multiple raws |
| Test 5 — rollupSellpage | 2 | Creates sellpage row; adSpend = campaign daily spend |
| Test 6 — Idempotency | 1 | Two runs = 2 raw rows = daily spend doubles (by design) |
| Test 7 — fetchEligibleSellerIds | 2 | Includes seller with active conn+campaign; excludes empty sellers |
| Test 8 — POST /api/ads-manager/sync | 5 | 202 + jobIds; specific date; 401 no auth; 400 bad date; dedup |

---

## Dependencies Added

| Package | App | Version |
|---------|-----|---------|
| `node-cron` | `apps/worker` | ^4.2.1 |
| `@types/node-cron` | `apps/worker` (dev) | ^3.0.11 |

`bullmq` and `ioredis` were already available in the workspace for `apps/api`.

---

## Test Results

```
Test Suites: 10 passed, 10 total
Tests:       245 passed, 245 total  (227 pre-existing + 18 new)
Time:        23.361 s
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
| 2.3.1.1 | 227 |
| **2.3.3** | **245** |
