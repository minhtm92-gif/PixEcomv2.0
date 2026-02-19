# Milestone 2.3.3 — Stats Worker + MockProvider — Spec

**Version:** 1.0 DRAFT
**Status:** Awaiting approval
**Phase:** Mock-only (no Meta API calls)
**Branch (to be created):** `feature/2.3.3-stats-worker`

---

## 1. Queue & Scheduler

### 1.1 Scheduler (Producer)

A BullMQ `QueueScheduler`-equivalent is implemented using `node-cron` inside the worker process:

- **Cron cadence:** `*/5 * * * *` (every 5 minutes)
- **What it does:** On each tick, queries the DB for all eligible sellers (see §2), then enqueues one `stats-sync` job per seller per level (CAMPAIGN, ADSET, AD) for today's date range.
- **Producer lives in:** `apps/worker/src/scheduler.ts`

The API endpoint (`POST /api/ads-manager/sync`) uses a shared `StatsQueue` (BullMQ Queue) to enqueue jobs on demand — same queue, same job shape, same dedup.

### 1.2 Queue Configuration

```
Queue name:  stats-sync
Queue lives: apps/worker/src/queue.ts   ← shared Queue instance imported by both scheduler and API
Redis conn:  IORedis(REDIS_URL, { maxRetriesPerRequest: null })
```

### 1.3 Job ID Deduplication

**Format:** `sync:${sellerId}:${dateFrom}:${dateTo}:${level}`

- `dateFrom` / `dateTo` format: `YYYY-MM-DD`
- `level`: `CAMPAIGN` | `ADSET` | `AD`
- BullMQ `jobId` option used → duplicate jobs for same key within window are silently skipped

**Example:**
```
sync:a1b2c3d4-...:2026-02-19:2026-02-19:CAMPAIGN
sync:a1b2c3d4-...:2026-02-19:2026-02-19:ADSET
sync:a1b2c3d4-...:2026-02-19:2026-02-19:AD
```

### 1.4 Retry & Backoff

```
attempts:  3  (initial + 2 retries)
backoff:   exponential, initial delay 60 000 ms
           → retry 1 at ~1m, retry 2 at ~5m, retry 3 at ~15m
removeOnComplete: 100  (keep last 100 completed jobs)
removeOnFail:     50   (keep last 50 failed for inspection)
```

After 3 failures the job lands in BullMQ's Dead Letter state (visible in Bull-board or via Redis directly). No external DLQ needed for MVP.

### 1.5 Worker Concurrency

```
concurrency: 5
```
Five jobs may run in parallel. Because each job is scoped to a single seller + single level, parallel execution across sellers is safe.

---

## 2. Inputs — Eligible Seller Selection

### 2.1 Eligibility Criteria

A seller is eligible for a stats sync if they have **at least one** of:
- An active `FbConnection` of type `AD_ACCOUNT` (`isActive = true`), **AND**
- At least one `Campaign` with `status IN (ACTIVE, PAUSED)` linked to that `AD_ACCOUNT` FbConnection

SQL equivalent:
```sql
SELECT DISTINCT c.seller_id
FROM campaigns c
INNER JOIN fb_connections f ON f.id = c.ad_account_id
WHERE f.connection_type = 'AD_ACCOUNT'
  AND f.is_active = true
  AND c.status IN ('ACTIVE', 'PAUSED')
```

Prisma query uses `prisma.campaign.findMany({ where: { status: { in: ['ACTIVE','PAUSED'] }, adAccount: { isActive: true } }, select: { sellerId: true } })` + dedup.

### 2.2 Date Range (MVP)

- **Today only:** `dateFrom = dateStop = today (UTC, YYYY-MM-DD)`
- The scheduler always syncs the current UTC date.
- The manual API endpoint accepts an optional `{ date?: string }` body; defaults to today.
- Multi-day backfill is **out of scope for 2.3.3**.

### 2.3 Entity Scope per Job

Each job payload carries:
```typescript
interface StatsSyncJobData {
  sellerId:  string;      // UUID
  dateFrom:  string;      // YYYY-MM-DD
  dateTo:    string;      // YYYY-MM-DD  (= dateFrom for MVP)
  level:     'CAMPAIGN' | 'ADSET' | 'AD';
}
```

The processor fetches all entities of that level belonging to that seller, generates mock stats for each, and writes to the pipeline.

---

## 3. MockProvider Contract

### 3.1 Interface

```typescript
interface StatProvider {
  fetchStats(
    sellerId: string,
    level: 'CAMPAIGN' | 'ADSET' | 'AD',
    entityIds: string[],   // internal UUIDs
    dateFrom: string,
    dateTo: string,
  ): Promise<RawStatRow[]>;
}
```

MockProvider implements `StatProvider` and is the only provider in Phase 1.

### 3.2 RawStatRow Shape

```typescript
interface RawStatRow {
  sellerId:         string;   // UUID
  entityType:       'CAMPAIGN' | 'ADSET' | 'AD';
  entityId:         string;   // internal UUID (maps to Campaign/Adset/Ad.id)
  externalEntityId: string;   // externalCampaignId / externalAdsetId / externalAdId
                               // Falls back to entityId if null (mock only)
  fetchedAt:        Date;
  dateStart:        Date;
  dateStop:         Date;

  // Spend & volume
  spend:            number;   // Decimal-safe; stored as Decimal(10,2)
  impressions:      number;   // integer
  linkClicks:       number;
  contentViews:     number;
  addToCart:        number;
  checkoutInitiated:number;
  purchases:        number;
  purchaseValue:    number;   // Decimal(10,2)

  // Derived — computed by MockProvider (not re-derived on write)
  cpm:              number;   // spend / impressions * 1000
  ctr:              number;   // linkClicks / impressions
  cpc:              number;   // spend / linkClicks  (or 0 if linkClicks=0)
  costPerPurchase:  number;   // spend / purchases   (or 0)
  roas:             number;   // purchaseValue / spend (or 0)
}
```

### 3.3 Deterministic Seed

MockProvider uses a **seeded PRNG** so the same inputs always produce the same output — critical for idempotent re-runs.

```
seed = SHA256( sellerId + ':' + entityId + ':' + dateStr )[0..7]  → uint32
```

Implementation: use a simple mulberry32 or xmur3 PRNG seeded from the hash, **not** `Math.random()`.

### 3.4 Spend Distribution

**Base spend** (per day):
- For `CAMPAIGN` level: `budget × dailyFraction`
  - `DAILY` budget → `dailyFraction = 1.0`
  - `LIFETIME` budget → `dailyFraction = budget / 30` (simplified; no flight dates considered)
- For `ADSET` level: inherits from parent campaign budget (passed in job context or queried)
- For `AD` level: adset budget / adCount (equal split)

**Noise:** `±15%` applied via seeded PRNG: `spend = basedSpend × (0.85 + seeded() × 0.30)`

**Rounding:** All money values rounded to 2 decimal places.

### 3.5 Time-of-Day Weights (intra-day distribution)

Not applicable for daily stats (dateFrom = dateStop = single day). No hourly breakdown in MVP.

### 3.6 Derived Metrics — Conversion Funnel

Apply the following funnel ratios (with ±10% PRNG noise per entity):

| Metric | Base Rate | Source |
|--------|-----------|--------|
| `impressions` | `spend / 8.50` (CPM of $8.50 per 1000) | spend-derived |
| `linkClicks` | `impressions × 0.020` (CTR 2%) | impressions-derived |
| `contentViews` | `linkClicks × 0.70` | clicks-derived |
| `addToCart` | `contentViews × 0.12` | views-derived |
| `checkoutInitiated` | `addToCart × 0.50` | atc-derived |
| `purchases` | `checkoutInitiated × 0.40` | checkout-derived |
| `purchaseValue` | `purchases × avgOrderValue` where `avgOrderValue = seeded PRNG ∈ [35, 150]` | purchases-derived |

All integer metrics are `Math.round()`ed after noise is applied. Metrics are always `≥ 0`.

### 3.7 externalEntityId Fallback

In mock mode, campaigns/adsets/ads may not have `externalCampaignId` / `externalAdsetId` / `externalAdId` set (they're optional in the schema). MockProvider falls back to the internal UUID (`entityId`) as the `externalEntityId` when the external ID is null.

---

## 4. Storage Rules

### 4.1 `ad_stats_raw` — Append-Only

- Every `fetchStats()` call writes one row per entity per day to `ad_stats_raw`.
- **No dedup check:** raw is truly append-only. Each 5-minute sync appends a new row for the same entity/date. This mirrors real Meta API behaviour (multiple fetches per day accumulate).
- The `fetchedAt` timestamp distinguishes rows.
- Unique index on `(sellerId, entityType, entityId, dateStart)` is **NOT** a unique constraint in the schema — it's a regular index. Raw rows are unrestricted.
- Write: `prisma.adStatsRaw.createMany({ data: rows, skipDuplicates: false })`

> **Note:** The daily aggregation pipeline (§5) will sum/average correctly across multiple raw rows for the same entity/date.

### 4.2 `ad_stats_daily` — Upsert

**Upsert key:** `(sellerId, entityType, entityId, statDate)`
**Prisma constraint name:** `uq_ad_stats_daily`

For each entity in the sync window, compute daily aggregates from **all** raw rows for that entity/date (not just the current batch), then upsert:

```
UPDATE: set all metric columns to the newly computed aggregates
ON CONFLICT: (sellerId, entityType, entityId, statDate)
```

- `spend`, `purchaseValue` → **SUM** of raw rows
- `impressions`, `linkClicks`, `contentViews`, `addToCart`, `checkoutInitiated`, `purchases` → **SUM**
- `cpm`, `ctr`, `cpc`, `costPerPurchase`, `roas` → **RE-DERIVED** from the summed totals (not averaged)

Re-derivation formulas:
```
cpm              = spend / impressions * 1000   (or 0)
ctr              = linkClicks / impressions      (or 0)
cpc              = spend / linkClicks            (or 0)
costPerPurchase  = spend / purchases             (or 0)
roas             = purchaseValue / spend         (or 0)
```

### 4.3 `sellpage_stats_daily` — Upsert

**Upsert key:** `(sellerId, sellpageId, statDate, adSource)`
**Prisma constraint name:** `uq_sellpage_stats_daily`
**`adSource` value:** always `'META'` in Phase 1 (no other sources)

Aggregation: join `ad_stats_daily` for level=CAMPAIGN → Campaign.sellpageId → `sellpage_stats_daily`.

```
adSpend  = SUM(campaign_daily.spend)      for all campaigns on sellpage/date
purchases = SUM(campaign_daily.purchases)
purchaseValue = SUM(campaign_daily.purchaseValue)
linkClicks = SUM(campaign_daily.linkClicks)
contentViews = SUM(campaign_daily.contentViews)
addToCart = SUM(campaign_daily.addToCart)
checkoutInitiated = SUM(campaign_daily.checkoutInitiated)
ordersCount = purchases  (1:1 for mock)
revenue = purchaseValue

cpm = adSpend / impressions * 1000       (or 0)
ctr = linkClicks / impressions            (or 0)
costPerPurchase = adSpend / purchases     (or 0)
roas = revenue / adSpend                  (or 0)

cr1 = linkClicks / impressions            (= ctr, top-of-funnel)
cr2 = purchases / linkClicks              (or 0)
cr3 = purchases / contentViews            (or 0)
```

---

## 5. Aggregation Pipeline

### 5.1 Execution Order per Job

Each `stats-sync` job for level=CAMPAIGN (the full pipeline trigger) runs in this order:

```
1. fetchStats(sellerId, 'CAMPAIGN', campaignIds, dateFrom, dateTo)
   → write to ad_stats_raw (createMany)
   → aggregate raw → upsert ad_stats_daily (CAMPAIGN rows)
   → aggregate campaign daily → upsert sellpage_stats_daily

2. fetchStats(sellerId, 'ADSET', adsetIds, dateFrom, dateTo)
   → write to ad_stats_raw (createMany)
   → aggregate raw → upsert ad_stats_daily (ADSET rows)

3. fetchStats(sellerId, 'AD', adIds, dateFrom, dateTo)
   → write to ad_stats_raw (createMany)
   → aggregate raw → upsert ad_stats_daily (AD rows)
```

Alternatively (spec-preferred for simplicity): each level is a separate job in the queue (CAMPAIGN/ADSET/AD enqueued separately). The `sellpage_stats_daily` rollup is triggered only by the CAMPAIGN-level job completion.

**Decision:** Separate jobs per level. CAMPAIGN job also triggers sellpage rollup at the end.

### 5.2 Raw → Daily Aggregation

Runs after `createMany` for each batch:

```sql
-- Conceptual (done via Prisma groupBy or raw SQL)
SELECT entity_id, entity_type, seller_id,
       SUM(spend), SUM(impressions), SUM(link_clicks), ...
FROM ad_stats_raw
WHERE seller_id = $sellerId
  AND entity_type = $level
  AND date_start = $date
GROUP BY entity_id, entity_type, seller_id
```

Then upsert each grouped row into `ad_stats_daily` using Prisma `upsert` with `update + create`.

### 5.3 Daily → Sellpage Rollup

Runs at end of CAMPAIGN job only:

```sql
-- Conceptual
SELECT c.sellpage_id, SUM(d.spend), SUM(d.purchases), ...
FROM ad_stats_daily d
INNER JOIN campaigns c ON c.id = d.entity_id
WHERE d.seller_id = $sellerId
  AND d.entity_type = 'CAMPAIGN'
  AND d.stat_date = $date
GROUP BY c.sellpage_id
```

Then upsert into `sellpage_stats_daily` with `adSource = 'META'`.

---

## 6. Failure Safety

### 6.1 Token Expiry

**Not applicable** — MockProvider requires no auth tokens. This section reserved for Phase 2 (MetaProvider).

### 6.2 Per-Seller Isolation

- One BullMQ job = one seller. If a seller's job throws, it is retried (see §1.4) independently.
- Other sellers' jobs continue unaffected.
- The scheduler enqueues all eligible sellers before any job starts executing — queue fanout, not sequential.

### 6.3 Job Idempotency

Because `ad_stats_raw` is append-only and `ad_stats_daily` / `sellpage_stats_daily` are upserted from the full raw set, re-running a job for the same seller/date is safe:
- Raw: adds new rows (expected — timestamped by `fetchedAt`)
- Daily: re-aggregates from all raw rows → same result if data unchanged

### 6.4 Partial Failure

If the `ad_stats_raw` write succeeds but the `ad_stats_daily` upsert fails: the next run will re-aggregate from raw correctly. **No rollback needed.**

If `createMany` for raw fails: job fails → retried → next run writes again. Acceptable.

### 6.5 Empty Entity List

If a seller has no campaigns/adsets/ads for a given level, the job completes successfully with zero rows written (no error).

---

## 7. Observability

### 7.1 Structured Log Output

Each job logs a single structured JSON line on completion:

```json
{
  "level": "info",
  "event": "stats-sync-complete",
  "jobId": "sync:abc123:2026-02-19:2026-02-19:CAMPAIGN",
  "sellerId": "a1b2c3d4-...",
  "statLevel": "CAMPAIGN",
  "date": "2026-02-19",
  "rawInserted": 12,
  "dailyUpserted": 12,
  "sellpageUpserted": 3,
  "durationMs": 245
}
```

On failure:
```json
{
  "level": "error",
  "event": "stats-sync-failed",
  "jobId": "sync:...",
  "sellerId": "a1b2c3d4-...",
  "attempt": 2,
  "error": "Connection timeout"
}
```

**No sensitive data logged** — no tokens, no access keys, no personal seller info beyond sellerId (UUID).

### 7.2 Worker Health Endpoint

The worker process exposes a minimal HTTP health server on port `3001` (configurable via `WORKER_PORT` env var):

```
GET /health → 200 { status: "ok", queue: "stats-sync", uptime: <seconds> }
```

Implementation: a lightweight `http.createServer` in `apps/worker/src/health.ts`. No NestJS overhead needed.

### 7.3 API-Side Manual Sync Endpoint

```
POST /api/ads-manager/sync
Authorization: Bearer <sellerJwt>
Body: { "date": "2026-02-19" }   ← optional; defaults to today UTC

Response 202: { "enqueued": 3, "jobIds": [...] }
```

Enqueues one job per level (CAMPAIGN/ADSET/AD) for the authenticated seller. Returns immediately (fire-and-forget). The seller can only enqueue for themselves (scoped by JWT).

---

## 8. File Map (Proposed)

```
apps/worker/
├── src/
│   ├── main.ts                        ← Bootstrap: start worker + scheduler + health server
│   ├── queue.ts                       ← Shared BullMQ Queue instance (imported by worker + API)
│   ├── scheduler.ts                   ← node-cron: every 5 min, enqueue eligible sellers
│   ├── processor.ts                   ← BullMQ Worker processor (dispatches to pipeline)
│   ├── health.ts                      ← HTTP /health endpoint
│   ├── providers/
│   │   ├── stat-provider.interface.ts ← StatProvider interface + RawStatRow type
│   │   └── mock.provider.ts           ← MockProvider implementation (seeded PRNG)
│   └── pipeline/
│       ├── fetch-entities.ts          ← Query campaigns/adsets/ads for seller
│       ├── write-raw.ts               ← createMany to ad_stats_raw
│       ├── aggregate-daily.ts         ← raw → ad_stats_daily upsert
│       └── rollup-sellpage.ts         ← campaign daily → sellpage_stats_daily upsert
│
apps/api/src/
└── ads-manager/
    ├── ads-manager.module.ts
    ├── ads-manager.controller.ts      ← POST /api/ads-manager/sync
    └── ads-manager.service.ts         ← Enqueue via BullMQ Queue
```

---

## 9. Schema Changes

**None required.** All three stats tables (`ad_stats_raw`, `ad_stats_daily`, `sellpage_stats_daily`) already exist in the schema with correct fields, constraints, and indexes. No migrations needed for 2.3.3.

---

## 10. Dependencies to Add

| Package | App | Purpose |
|---------|-----|---------|
| `node-cron` | `apps/worker` | Cron scheduler |
| `@types/node-cron` | `apps/worker` (dev) | Types |
| `bullmq` | `apps/api` | Queue producer (enqueue from API) |
| `ioredis` | `apps/api` | Redis connection for queue |

`bullmq` and `ioredis` already exist in `apps/worker`. They need to be added to `apps/api` for the manual sync endpoint.

---

## 11. Test Plan

### Integration Test (required)

**File:** `apps/api/test/stats-worker-233.e2e-spec.ts`

Minimum coverage:
1. Seed: create seller + campaign (ACTIVE) + adAccount FbConnection
2. Directly invoke `MockProvider.fetchStats()` → verify RawStatRow shape and determinism (same seed = same values)
3. Directly invoke pipeline: write raw → aggregate daily → assert `ad_stats_daily` row exists with expected values
4. Invoke `POST /api/ads-manager/sync` → assert 202 + jobIds returned
5. Seller isolation: Seller B cannot enqueue for Seller A's data

---

## 12. Open Questions / Decisions Needed

| # | Question | Default (if not specified) |
|---|----------|---------------------------|
| Q1 | Should `ad_stats_raw` rows older than 30 days be auto-pruned? | No pruning in 2.3.3 |
| Q2 | Should ADSET/AD jobs also trigger their own sellpage rollup, or only CAMPAIGN? | CAMPAIGN-level job only triggers sellpage rollup |
| Q3 | Should the manual sync API accept a `level` param to sync only one level? | No — always enqueues all 3 levels |
| Q4 | Is a Bull Board UI (web dashboard) in scope for 2.3.3? | No |
| Q5 | Should the scheduler skip sellers with no campaigns at enqueue time, or let the processor handle empty lists gracefully? | Filter at scheduler to avoid unnecessary jobs |

---

*Awaiting confirmation before Phase B implementation begins.*
