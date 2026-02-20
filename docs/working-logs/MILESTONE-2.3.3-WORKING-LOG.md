# Milestone 2.3.3 Working Log — Stats Worker (BullMQ + MockProvider)

**Branch:** `feature/2.3.3-stats-worker`
**Base:** `develop` @ `a0b7123`
**Commit:** `a80692c`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — 245 E2E tests pass

---

## Scope

Stats sync worker using BullMQ 5 + Redis 7. Implements a 3-tier pipeline to sync campaign stats on a 15-minute cadence. Phase 1 uses a `MockProvider` that generates deterministic synthetic data — no real Meta API calls.

---

## Architecture

### 3-Tier Pipeline

```
Tier 1 — SyncOrchestrator (BullMQ)
  Enqueues one job per active campaign per seller every 15 minutes.

Tier 2 — StatsWorker (BullMQ processor)
  For each campaign job:
    - Calls StatsProvider.fetchCampaignStats(campaignId, dateRange)
    - Upserts rows into ad_stats_daily (campaign + adset + ad level)
    - Emits adset-level and ad-level sub-jobs

Tier 3 — DeliveryWorker (BullMQ processor)
  Updates campaign delivery status (ACTIVE/PAUSED/LEARNING/etc.)
```

### StatsProvider Interface

```typescript
interface StatsProvider {
  fetchCampaignStats(campaignId: string, dateRange: DateRange): Promise<StatsPayload>;
}
```

**MockProvider** generates:
- Deterministic spend, impressions, link_clicks, content_views, checkout_initiated, purchases, purchase_value
- Seeded by `campaignId + date` — same inputs always produce same outputs
- Campaign, adset, and ad level rows generated in one call

### DB Table: `ad_stats_daily`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `sellerId` | UUID | Tenant scope |
| `entityType` | Enum | CAMPAIGN \| ADSET \| AD |
| `entityId` | UUID | References campaign/adset/ad |
| `statDate` | Date | UTC date of the stats row |
| `spend` | Decimal(10,2) | Ad spend |
| `impressions` | Int | Total impressions |
| `linkClicks` | Int | Meta `inline_link_clicks` |
| `contentViews` | Int | Pixel content view events |
| `checkoutInitiated` | Int | Pixel checkout events |
| `purchases` | Int | Pixel purchase events |
| `purchaseValue` | Decimal(10,2) | Pixel purchase value |
| `cpm` | Decimal(10,4) | Raw Meta CPM (reference only) |
| `ctr` | Decimal(8,4) | Raw Meta CTR (reference only) |
| `cpc` | Decimal(10,4) | Raw Meta CPC (reference only) |

**Upsert key:** `@@unique([entityType, entityId, statDate])` — idempotent re-syncs.

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/worker/src/stats/stats.worker.ts` | BullMQ processor — tier 2 |
| `apps/worker/src/stats/stats.orchestrator.ts` | BullMQ scheduler — tier 1 |
| `apps/worker/src/stats/delivery.worker.ts` | BullMQ processor — tier 3 |
| `apps/worker/src/stats/providers/mock.provider.ts` | MockProvider implementation |
| `apps/worker/src/stats/providers/stats-provider.interface.ts` | Provider interface |
| `apps/worker/src/stats/stats.module.ts` | Worker module |
| `apps/api/test/stats-worker.e2e-spec.ts` | E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | `AdStatsDaily` model + `EntityType` enum |
| `packages/database/prisma/migrations/20260219_stats_worker/migration.sql` | `ad_stats_daily` table + indexes |

---

## Key Design Decisions

- **Pluggable provider:** `StatsProvider` interface allows swapping `MockProvider` → `MetaProvider` in Phase 2 with zero code changes in the worker
- **Idempotent upserts:** `upsert({ where: { entityType_entityId_statDate }, ... })` — safe to re-run or re-queue
- **Raw values stored:** `cpm`, `ctr`, `cpc` from Meta stored for audit but never used in aggregation (re-derived from raw counts on read — per METRICS-CONTRACT)
- **5-minute cadence for delivery:** Delivery worker runs every 5 minutes (lighter-weight than stats sync)

---

## Test Summary

| Suite | Tests |
|-------|-------|
| All E2E (feature branch) | **245** |
