# TASK-C5 Working Log — Stats Sync Worker

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent (Worker scope)                   |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `5fcaa82`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Implemented the stats sync worker at `apps/worker/src/`. Refactored the skeleton `main.ts` into a fully functional BullMQ worker with a pluggable stats provider interface, real Meta Insights API fetcher, and a processor that writes `AdStatsRaw`, `AdStatsDaily`, and `SellpageStatsDaily`.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/worker/src/main.ts` | **Replaced** | BullMQ Worker + Queue + repeatable job + Prisma + graceful shutdown |
| `apps/worker/src/utils/field-mapper.ts` | **Created** | Meta → DB field mapping + safeDivide + aggregateStats |
| `apps/worker/src/utils/field-mapper.spec.ts` | **Created** | 31 unit tests |
| `apps/worker/src/providers/types.ts` | **Created** | `IStatsProvider` interface + entity types |
| `apps/worker/src/providers/meta-stats.provider.ts` | **Created** | Real Meta Graph API fetcher (pagination, error handling) |
| `apps/worker/src/processors/stats-sync.processor.ts` | **Created** | Main job handler (AdStatsRaw → AdStatsDaily → SellpageStatsDaily) |
| `apps/worker/jest.config.json` | **Created** | Jest config for worker unit tests |
| `apps/worker/package.json` | **Modified** | Added `test` script + jest devDependencies |

---

## Architecture

```
main.ts
  ├── BullMQ Queue: adds repeatable job every 15 min
  └── BullMQ Worker: concurrency=5
        └── statsSyncProcessor(job, prisma, statsProvider)
              ├── FbConnection.findMany(AD_ACCOUNT, isActive)
              ├── for each account:
              │     decryptToken() (inline AES-256-GCM)
              │     statsProvider.fetchForAccount(...)
              │     buildEntityLookup() (externalId → internalUUID)
              │     AdStatsRaw.create (one per entity-day)
              │     AdStatsDaily.upsert (on sellerId+entityType+entityId+statDate)
              │     aggregateSellpageStats()
              │           SellpageStatsDaily.upsert (on sellerId+sellpageId+statDate+adSource)
              └── per-account error isolation (catch + log + continue)
```

---

## Field Mapping (Critical)

⚠️ Uses DB field names — NOT metrics-contract names.

| Meta API field | DB field | Notes |
|----------------|----------|-------|
| `spend` | `spend` | Direct |
| `impressions` | `impressions` | Direct |
| `inline_link_clicks` | `linkClicks` | DB name != Meta name |
| `actions[content_view]` | `contentViews` | From actions array |
| `actions[initiate_checkout]` | `checkoutInitiated` | From actions array |
| `actions[purchase]` | `purchases` | Count from actions |
| `action_values[purchase]` | `purchaseValue` | Revenue from action_values |

**Derived ratios** (computed after raw values, never averaged):
```
cpm             = (spend / impressions) * 1000
ctr             = (linkClicks / impressions) * 100
cpc             = spend / linkClicks
costPerPurchase = spend / purchases
roas            = purchaseValue / spend
```

All divisions use `safeDivide()` → returns 0 when denominator = 0.

---

## MetaStatsProvider (API Call Pattern)

```
GET /act_{externalId}/insights
  ?fields=spend,impressions,inline_link_clicks,actions,action_values,campaign_id,adset_id,ad_id
  &level=campaign|adset|ad
  &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
  &time_increment=1
  &limit=500
  &access_token={token}
```

- Fetches 3 levels sequentially (campaign → adset → ad) per account
- Pagination: follows `response.paging.next` until null (MAX_PAGES=50 safety cap)
- Empty data: gracefully returns `[]`
- Per-level errors: caught and logged, don't abort account fetch

---

## Processor Key Decisions

### Token decryption (standalone)
The worker has no NestJS DI. Token decryption is done inline with the same AES-256-GCM algorithm as `MetaTokenService`. Key loaded from `META_TOKEN_ENCRYPTION_KEY` env var. In dev/test, falls back to null key (with warning — real tokens can't be decrypted without the correct key).

### Entity ID resolution
Meta returns external IDs (e.g. `campaign_id: "23850..." `). The processor builds an in-memory lookup map per seller (`externalId → internalUUID`) before processing entity rows. Entities not yet in our DB are skipped (not an error — new Meta entities seeded later).

### Date range: last 3 days
Meta's attribution window can attribute conversions up to 7 days after click. We use 3 days to catch common late conversions while keeping the sync window manageable. `upsert` on `AdStatsDaily` means re-running always overwrites with the latest Meta data.

### SellpageStatsDaily aggregation
After campaign-level `AdStatsDaily` are upserted, `aggregateSellpageStats()`:
1. Groups `AdStatsDaily CAMPAIGN` rows by `statDate`
2. Sums raw counters using `aggregateStats()`
3. Re-derives ratios from sums (never averages ratios)
4. Upserts with `adSource='facebook'`
5. Computes funnel CRs: `cr1 = contentViews/impressions`, `cr2 = checkout/contentViews`, `cr3 = purchases/checkout`

### Error isolation
Each ad account is wrapped in try/catch. One account failing (expired token, API error, network issue) logs the error and increments `skipped` counter but does NOT abort the run for other accounts.

---

## Repeatable Job Configuration

```typescript
// Added every 15 minutes
await queue.add('full-sync', { type: 'full-sync' }, {
  repeat: { every: 15 * 60 * 1000 },
});

// Immediate first run on worker startup
await queue.add('full-sync', { type: 'full-sync', immediate: true });
```

On each startup, stale repeatable jobs are removed and re-added to avoid duplicate schedule keys from previous deployments.

---

## IStatsProvider Interface (Pluggable)

```typescript
interface IStatsProvider {
  fetchForAccount(
    adAccountInternalId: string,
    adAccountExternalId: string,
    accessToken: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AdAccountFetchResult>;
}
```

Phase 1 can run with a `MockStatsProvider` (not yet implemented — processor accepts any `IStatsProvider` implementation). Phase 2 wires `MetaStatsProvider`.

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (worker) | ✅ Clean — zero errors |
| Unit tests (field-mapper.spec.ts) | ✅ **31/31 passing** |

### Unit test breakdown:
- `safeDivide` — 5 tests: normal, zero denominator, zero numerator, NaN, float
- `findActionValue` — 4 tests: found, missing, undefined, empty array
- `mapInsightRow` — 14 tests: all 7 raw fields, all 5 derived ratios, empty row, dates
- `aggregateStats` — 8 tests: sums, derived ratios from sums (not averages), empty array
