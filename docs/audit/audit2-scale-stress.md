# PixEcom v2 — Hard Mode Scale Stress Audit

**Role:** Principal SaaS Architect + Scale Consultant
**Assumption:** This system will scale aggressively. No politeness. No optimism.

---

## 1. BOTTLENECK MAP

```
                    ┌──────────────────────────────────────────┐
                    │           4GB VPS (Single Point)          │
                    │                                          │
   Requests ──────>│  Nginx ─> NestJS API ─> PostgreSQL       │
                    │              │              ▲             │
                    │              ▼              │             │
                    │          Redis ◄──── BullMQ Worker       │
                    │                                          │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                              Cloudflare R2
```

### Bottleneck Priority (First to Break → Last)

| Priority | Bottleneck | Why | Breaks At |
|----------|-----------|-----|-----------|
| **B1** | PostgreSQL on shared VPS | CPU/RAM contention with API + Worker | ~50 concurrent users |
| **B2** | `ad_stats_raw` table | No partitioning, no dedup, append-only | ~5M rows (30 days) |
| **B3** | Prisma connection pool (default 10) | 10 connections shared between API + Worker | ~30 concurrent requests |
| **B4** | 7 unbounded `findMany()` queries | No `take` limit, full table scans on seller data | Seller with 500+ creatives/assets |
| **B5** | Worker single-process, 5 concurrency | Cannot parallelize across sellers | ~200 campaigns needing sync |
| **B6** | No Redis caching | Every API call hits PostgreSQL directly | ~100 req/sec |
| **B7** | In-memory rate limiting | Not distributed, resets on restart, per-instance only | Any horizontal scaling |
| **B8** | No CDN cache strategy for API responses | Static product catalog re-queried constantly | ~500 product page views/min |

---

## 2. SCALE SIMULATION RESULTS

### Scenario A: 100 Sellers / 500 Campaigns / 10k Orders per Day

**Database:**
- `ad_stats_raw`: ~150K rows/day (500 campaigns × 3 entities × ~100 raw fetches). **30-day table: ~4.5M rows.** Index scans will slow. No critical failure yet.
- `orders`: ~300K rows/month. Cursor pagination handles this. OK.
- `ad_stats_daily`: ~1,500 rows/day (500 campaigns × 3). Upsert on unique constraint is safe.
- Connection pool: 10 default connections. With 100 sellers, peak concurrency of 20-30 requests is plausible during business hours. **Pool exhaustion starts here.**

**Worker:**
- 500 campaigns need stats sync every 5 minutes. At 5 concurrency and ~200ms per job: `500 / 5 × 0.2s = 20 seconds`. Fits within 5-minute window. OK.
- But if Meta API latency is 1-2 seconds per call (realistic): `500 / 5 × 1.5s = 150 seconds` (2.5 min). **Tight but survivable.**

**Infrastructure:**
- Memory: PostgreSQL ~800MB + API ~300MB + Worker ~200MB + Redis ~150MB = **1.45GB active**. With OS and buffers: **~2.5GB used of 4GB.** Swap pressure begins.
- CPU: Worker stats sync + API requests + PostgreSQL query execution. **Single-core contention becomes noticeable.**

**Verdict: SURVIVABLE but stressed.** Latency spikes during worker runs. Occasional pool exhaustion errors.

---

### Scenario B: 1,000 Sellers / 10,000 Campaigns / 100k Orders per Day

**Database:**
- `ad_stats_raw`: **~3M rows/day** (10K campaigns × 3 entities × ~100 fetches). **30-day table: 90M rows.** Sequential scans become catastrophic. Index bloat. VACUUM cannot keep up on shared VPS. **TABLE EXPLODES.**
- `orders`: ~3M rows/month. Still manageable with proper indexes.
- `ad_stats_daily`: ~30K rows/day. Upsert contention on unique constraint with 5 concurrent workers. **Lock contention begins.**
- Connection pool: 10 connections for 1,000 sellers. **Immediate pool exhaustion.** API returns 503 errors.

**Worker:**
- 10K campaigns × 1.5s Meta API latency / 5 concurrency = **3,000 seconds (50 minutes)** per sync cycle. **5-minute window completely blown.** Jobs pile up. Queue grows unboundedly. **Redis OOM.**
- No distributed locks: duplicate aggregations run on overlapping windows. **Data corruption possible.**

**Infrastructure:**
- Memory: PostgreSQL buffer cache alone wants 2GB+ for 90M-row table. **4GB VPS is completely insufficient.** OOM killer starts.
- CPU: 100% sustained. Worker and API fight for cycles. **System becomes unresponsive.**

**Verdict: COMPLETE FAILURE.** System is non-functional at this scale on current architecture.

---

### Scenario C: Black Friday Stress Event (5× Normal Traffic)

Assuming Scenario A baseline (100 sellers) with 5× multiplier:

**Traffic:**
- API: ~500 req/sec (normal 100 × 5). No connection pool can handle this with 10 connections.
- Orders: 50K orders/day. Webhook ingestion: ~3,500 webhooks/hour. Order creation is read-only in seller portal, but the ingestion pipeline (assumed external) must keep up.

**Meta API:**
- Rate limiting kicks in at 200 calls/hour per ad account (Meta's standard limit). With 500 campaigns across ~100 ad accounts: **5 calls/account/cycle × 100 accounts = 500 calls per 5 min = 6,000 calls/hour.** Meta throttles at 200/account/hour → some accounts get delayed. Stats lag by 30-60 minutes.
- No retry/backoff logic in worker → failed calls are lost (no DLQ).

**Payment Webhooks:**
- Burst of payment confirmations. No webhook queue. No idempotency. **Duplicate payment events possible.**
- `paymentId` is a simple varchar with no unique constraint. Same payment could create multiple order updates.

**17Track:**
- Tracking API delays (common during peak). No circuit breaker. Worker hangs on HTTP timeouts. **Blocks other jobs in the queue.**

**Verdict: PARTIAL OUTAGE.** Stats lag. Some data loss. Payment inconsistency. API timeout errors for end users.

---

## 3. DATABASE STRESS ANALYSIS

### Will `ad_stats_raw` Explode?

**YES.** This is the single most dangerous table in the system.

**Growth Model:**
```
Per campaign per day:
  - 3 entity types (Campaign, Adset, Ad) × ~4 fetches/day = 12 rows minimum
  - With hourly fetches: 3 × 24 = 72 rows/campaign/day

At 500 campaigns: 36,000 rows/day → 1.08M rows/month
At 10K campaigns: 720,000 rows/day → 21.6M rows/month
At 100K ads (realistic for 10K campaigns): 7.2M rows/day → 216M rows/month
```

**No dedup constraint means:**
- Retry of a failed fetch creates duplicate rows
- Overlapping date ranges from Meta API create semantic duplicates
- Worker restart re-processes already-ingested data

**Recommendations:**
1. **Partition by month** (`PARTITION BY RANGE (date_start)`) — critical for query performance and data lifecycle
2. **Add composite unique constraint:** `(seller_id, entity_type, entity_id, date_start, date_stop, fetched_at)` — prevents exact duplicates
3. **Implement retention policy:** Drop partitions older than 90 days (raw data only needed for re-aggregation window)
4. **Add `updatedAt` column** — distinguish fresh from stale fetches

### Should Partitioning Be Used?

**YES, for these tables:**

| Table | Partition Key | Strategy | When |
|-------|-------------|----------|------|
| `ad_stats_raw` | `date_start` | Monthly range | Before 100 sellers |
| `ad_stats_daily` | `stat_date` | Monthly range | Before 1,000 sellers |
| `sellpage_stats_daily` | `stat_date` | Monthly range | Before 1,000 sellers |
| `orders` | `created_at` | Monthly range | Before 100K orders |
| `order_events` | `created_at` | Monthly range | Before 500K events |

**Prisma limitation:** Prisma does not natively support PostgreSQL partitioning. You'll need raw SQL migrations for `CREATE TABLE ... PARTITION BY RANGE` and partition management scripts.

### Are Current Indexes Sufficient?

**NO. Missing indexes for scale:**

| Table | Missing Index | Query Pattern |
|-------|--------------|---------------|
| `ad_stats_raw` | `(entity_type, entity_id, date_start, date_stop)` | Aggregation worker grouping |
| `ad_stats_raw` | `(fetched_at)` alone | Stale data cleanup |
| `orders` | `(sellpage_id, created_at)` without seller_id prefix | Cross-seller revenue aggregation |
| `campaigns` | `(sellpage_id)` alone | Revenue attribution join |
| `ad_posts` | `(page_id, seller_id)` | Page-level post listing |
| `creative_assets` | `(asset_id)` | Asset usage lookup |

**Existing good indexes:**
- `orders (seller_id, status)` — used for filtered lists
- `orders (seller_id, created_at)` — used for date-range pagination
- `ad_stats_daily (seller_id, stat_date)` — used for dashboard queries
- `ad_stats_raw (seller_id, entity_type, entity_id, date_start)` — used for aggregation

### Will Upsert Strategy Cause Lock Contention?

**YES, at scale.**

The `AdStatsDaily` upsert uses the unique constraint `(seller_id, entity_type, entity_id, stat_date)`. When the worker processes 5 concurrent jobs touching overlapping sellers/dates:

```
Worker Thread 1: UPSERT ad_stats_daily WHERE (seller_1, CAMPAIGN, camp_1, 2026-02-19)
Worker Thread 2: UPSERT ad_stats_daily WHERE (seller_1, CAMPAIGN, camp_1, 2026-02-19)
→ Row-level lock on the unique index entry
→ Thread 2 waits for Thread 1's transaction to commit
→ At 5 concurrency: lock chains form
```

**Mitigation:**
1. Partition worker jobs by seller_id — no two threads process the same seller simultaneously
2. Use `ON CONFLICT DO UPDATE` with `SET ... = EXCLUDED.*` (PostgreSQL native, not Prisma upsert)
3. Batch upserts in transactions of 100 rows (reduce commit overhead)

### Is Prisma Suitable at High Volume?

**For reads: YES (with caveats). For bulk writes: NO.**

**Prisma limitations at scale:**
- No native `INSERT ... ON CONFLICT` batch support — must loop individual upserts
- No streaming results — `findMany` loads all rows into memory
- No cursor-based streaming for large result sets
- Connection pool max is configurable but limited by underlying `@prisma/engine`
- No native support for read replicas (requires manual datasource switching)
- No support for `COPY` command (fastest bulk insert for PostgreSQL)

**Recommendation:** Use Prisma for the API layer (CRUD operations). Use raw SQL (`prisma.$queryRaw`) or a direct `pg` client for the stats aggregation worker. The worker's batch insert/upsert patterns are poorly served by Prisma's ORM abstraction.

---

## 4. WORKER & QUEUE STRESS ANALYSIS

### Is BullMQ Enough?

**For Scenario A: YES. For Scenario B: BARELY. For Scenario C: NO.**

BullMQ strengths:
- Redis-backed, persistent jobs
- Configurable concurrency
- Retry with backoff
- Job prioritization
- Delayed jobs

BullMQ weaknesses at scale:
- Single Redis instance is a bottleneck (no native sharding)
- No multi-queue orchestration (pipeline stages need manual coordination)
- Large queue sizes (>100K pending jobs) cause Redis memory pressure
- No built-in rate limiting per external API (Meta's 200 calls/hour/account)

### Is Single VPS Sustainable?

| Scenario | Worker Duration per Cycle | VPS Status |
|----------|--------------------------|------------|
| 100 sellers / 500 campaigns | ~20-150 seconds | Stressed but OK |
| 1,000 sellers / 10K campaigns | ~50 minutes | **Completely broken** |
| Black Friday (5× traffic) | >5 minutes (overlapping cycles) | **Queue overflow** |

**Single VPS is a blocker at Scenario B.** Worker and API must be on separate machines.

### Will Cron-Based Scheduling Scale?

**NO.** Fixed 5-minute intervals create these problems:
1. **Stampeding herd:** All sellers' jobs enqueue simultaneously at T+0, T+5, T+10...
2. **No adaptive scheduling:** Low-activity sellers don't need 5-minute sync
3. **No priority:** A seller spending $10K/day gets the same refresh rate as a seller spending $10/day
4. **Overlap:** If cycle N takes 6 minutes, cycle N+1 starts before N completes

**Better approach:**
- Priority queue based on seller tier / ad spend
- Adaptive intervals: high-spend sellers every 5 min, low-spend every 30 min
- Stagger job scheduling (spread across the 5-minute window)
- Circuit breaker: skip seller if previous job is still running

### Should We Shard Queues?

**At Scenario B: YES.**

Sharding strategy:
```
Queue: stats-sync-high    (sellers spending >$1K/day, 1-min interval)
Queue: stats-sync-medium  (sellers spending >$100/day, 5-min interval)
Queue: stats-sync-low     (sellers spending <$100/day, 30-min interval)
Queue: stats-aggregate    (daily rollup jobs, runs once per hour)
Queue: orders-sync        (webhook processing, real-time)
Queue: tracking-refresh   (17Track polling, every 6 hours)
```

### What Happens If a Job Runs Longer Than 5 Minutes?

**Currently: Nothing good.**
- BullMQ will start the next scheduled cycle
- Two instances of the same aggregation run simultaneously
- No distributed lock prevents duplicate processing
- No stale job detection or timeout
- Queue depth grows without bound

**Must implement:**
- `jobOptions.timeout`: Kill jobs after 4 minutes
- `removeOnComplete: { age: 3600 }`: Clean completed jobs
- `removeOnFail: { count: 1000 }`: Limit failed job history
- Job deduplication: Skip if job with same key is already `active`

---

## 5. TENANT ISOLATION AT SCALE

### Any Risk of seller_id Leak?

**Application layer: NO.** The audit confirmed all queries use `sellerId` from JWT. However:

**Database layer: YES, theoretically.**
- No Row-Level Security (RLS) policies in PostgreSQL
- A raw SQL bug, Prisma bypass, or admin tool could expose cross-tenant data
- At scale, debugging tools (Prisma Studio, pgAdmin) accessed by multiple developers increase risk

**Recommendation at 100+ sellers:**
- Enable PostgreSQL RLS on all seller-scoped tables
- Set `current_setting('app.current_seller_id')` per connection
- Prisma middleware to inject seller_id into every query as a safety net

### Any Missing Composite Indexes?

**YES. Critical for scale:**

```sql
-- Orders: Revenue attribution by sellpage (used in stats rollup)
CREATE INDEX idx_orders_sellpage_date ON orders (sellpage_id, created_at) WHERE status IN ('CONFIRMED', 'DELIVERED');

-- Campaigns: Find campaigns for a sellpage (used in stats rollup)
CREATE INDEX idx_campaigns_sellpage ON campaigns (sellpage_id, seller_id);

-- AdStatsRaw: Aggregation query pattern
CREATE INDEX idx_stats_raw_agg ON ad_stats_raw (seller_id, entity_type, date_start, date_stop);

-- Creatives: Seller's active creatives for campaign builder
CREATE INDEX idx_creatives_seller_status ON creatives (seller_id, status) WHERE status != 'ARCHIVED';
```

### Could a Bad Query Lock Full Table?

**YES, in two scenarios:**

1. **Worker aggregation without WHERE clause:**
   If a bug in the stats worker runs `UPDATE ad_stats_daily SET ...` without a `WHERE seller_id = X` clause, it locks all rows in the table. At 30K rows/day, this becomes a table-level lock that blocks all other sellers' queries.

2. **Schema migration on hot table:**
   `ALTER TABLE ad_stats_raw ADD COLUMN ...` takes an `ACCESS EXCLUSIVE` lock on the entire table. With 90M rows, this blocks all reads/writes for minutes.

**Mitigation:**
- Use `pg_stat_activity` monitoring for long-running queries
- Set `statement_timeout` to 30 seconds for API connections
- Set `lock_timeout` to 5 seconds for API connections
- Use `CREATE INDEX CONCURRENTLY` for index additions
- Use `ALTER TABLE ... ADD COLUMN ... DEFAULT` (PostgreSQL 11+ makes this non-blocking for non-volatile defaults)

### Are Queries N+1 Prone?

**Currently: NO.** The codebase uses proper Prisma `include` and `select` patterns. However:

**Future risk:** When the stats pipeline is implemented, joining `orders` + `ad_stats_daily` + `campaigns` + `sellpages` for the dashboard will require careful query design. A naive approach like:

```typescript
for (const sellpage of sellpages) {
  const stats = await prisma.sellpageStatsDaily.findMany({ where: { sellpageId: sellpage.id } });
  const orders = await prisma.order.count({ where: { sellpageId: sellpage.id } });
}
```

...would be catastrophic at 100+ sellpages per seller.

---

## 6. ANALYTICS ACCURACY

### Risk of Double Counting?

**HIGH.** Three specific scenarios:

1. **Meta API overlapping date ranges:** A single fetch may return stats for `date_start: 2026-02-15, date_stop: 2026-02-20`. A subsequent fetch returns `date_start: 2026-02-18, date_stop: 2026-02-20`. If both rows aggregate into `AdStatsDaily`, dates 18-20 are double-counted.

2. **Worker retry without idempotency:** If a job fails after partially writing to `AdStatsDaily` and retries from scratch, completed rows get re-processed. The `upsert` unique constraint saves you here (last write wins), BUT if the retry processes stale data while new data arrived, the upsert overwrites newer data with older data.

3. **Order attribution:** An order with `sellpageId = NULL` (organic traffic) gets excluded from `SellpageStatsDaily`. If `sellpageId` is later populated (delayed attribution), the stats for the original day are wrong and never corrected.

### Race Condition: Raw Insert vs Daily Upsert

```
T=0:00  Worker fetches Meta stats for 2026-02-19 → inserts into ad_stats_raw
T=0:01  Aggregation job reads ad_stats_raw for 2026-02-19 → writes ad_stats_daily
T=0:02  Meta API returns updated stats for 2026-02-19 (late data) → inserts into ad_stats_raw
T=0:03  ad_stats_daily for 2026-02-19 is now STALE (doesn't include T=0:02 data)
```

**Fix:** Re-aggregate the last 3 days on every cycle (Meta data stabilizes after ~72 hours).

### Is Pipeline Idempotent Enough?

**`AdStatsDaily`: YES** — unique constraint ensures upsert overwrites.
**`SellpageStatsDaily`: YES** — unique constraint ensures upsert overwrites.
**`AdStatsRaw`: NO** — no dedup constraint. Retries create duplicates.

### ROAS Inconsistency Scenarios

| Scenario | ROAS Impact |
|----------|-------------|
| Order refunded after stats computed | ROAS inflated (revenue includes refunded amount) |
| Meta reports delayed conversions | ROAS understated until next aggregation |
| Worker processes orders before ad stats | ROAS = revenue/0 = infinity (division by zero) |
| Multi-currency orders | ROAS mixing USD and EUR (undefined) |
| Campaign budget change mid-day | Daily spend doesn't match actual spend |

---

## 7. FINANCIAL INTEGRITY

### What Happens During Webhook Burst?

**Current architecture has no webhook handler.** Orders are presumably created via direct API calls or seed data. When real payment webhooks arrive:

- No queue to buffer webhook requests (Stripe/PayPal send bursts during peak)
- No idempotency key checking (same webhook delivered twice creates duplicate state changes)
- No signature verification on webhook payloads
- `paymentId` has no unique constraint — same payment could be recorded multiple times

**Required before production:**
```sql
ALTER TABLE orders ADD CONSTRAINT uq_payment_id UNIQUE (payment_id) WHERE payment_id IS NOT NULL;
```

### Should Payment Events Be Event-Sourced?

**YES.** The current `OrderEvent` model is a start, but financial events need:

```prisma
model PaymentEvent {
  id              String   @id @default(uuid())
  orderId         String
  eventType       PaymentEventType  // AUTHORIZED, CAPTURED, REFUNDED, CHARGEBACK, FAILED
  amount          Decimal  @db.Decimal(10, 2)
  currency        String   @db.VarChar(3)
  gatewayRef      String   // Stripe/PayPal transaction ID
  gatewayResponse Json     // Raw webhook payload (audit trail)
  processedAt     DateTime
  createdAt       DateTime @default(now())

  @@index([orderId, createdAt])
  @@unique([gatewayRef])  // Prevents duplicate processing
}
```

### Should Financial Tables Be Append-Only?

**YES.** Critical for audit compliance:
- `PaymentEvent`: append-only (never UPDATE or DELETE)
- `OrderEvent`: append-only
- `Order.total`, `Order.subtotal`: should be derived from latest `PaymentEvent` aggregate, not directly mutated
- `PricingRule`: already append-only by design (effectiveFrom/effectiveUntil)

---

## 8. INFRASTRUCTURE THRESHOLDS

### When Must DB Be Separated?

**Before 50 concurrent users or 10M total rows — whichever comes first.**

On a 4GB VPS with shared resources:
- PostgreSQL buffer cache competes with application memory
- VACUUM operations cause I/O spikes that slow API responses
- Backup operations (pg_dump) consume CPU/memory
- Index rebuilds after bulk inserts block queries

**Immediate action:** Move to DigitalOcean Managed Database ($15/month for 1GB RAM, 10GB storage) or Supabase free tier for development.

### When Must Redis Be Separated?

**Before the worker processes more than 1,000 jobs/hour.**

Redis on shared VPS risks:
- BullMQ job data consumes memory (each job ~1-5KB × thousands of pending jobs)
- Redis persistence (RDB/AOF) causes I/O spikes
- Memory pressure triggers Redis eviction, losing job data

**Immediate action:** Move to DigitalOcean Managed Redis ($10/month) or Upstash (serverless, pay-per-use).

### When Must Horizontal Scaling Be Introduced?

| Component | Scale Trigger | Action |
|-----------|--------------|--------|
| API | >100 concurrent connections | Deploy 2+ API instances behind load balancer |
| Worker | Job cycle exceeds 5 minutes | Deploy dedicated worker machine |
| PostgreSQL | >50M rows in any table | Managed DB with connection pooling (PgBouncer) |
| Redis | >1GB memory usage | Managed Redis or Redis Cluster |

### Is Docker Single-Node a Blocker?

**YES, at Scenario B.** You can't horizontally scale containers on a single VPS. Options:
- Docker Swarm (simple, limited)
- Kubernetes on managed cluster (DigitalOcean DOKS)
- Separate VPS per service (simplest for small team)

**Recommended path:** Keep Docker Compose for local dev. Deploy services directly (PM2 for Node.js processes) or use DigitalOcean App Platform for managed containers.

### Is Current Reverse Proxy Safe?

**Unknown — no Nginx config in repository.** Assumed to be on the VPS. Risks:
- No request size limits → large payload attacks
- No rate limiting at proxy level → application layer is the only defense
- No WebSocket support configured → future real-time features blocked
- No TLS termination config visible → assumes Cloudflare handles SSL

---

## 9. SECURITY UNDER GROWTH

### API Key Rotation Safety

**Implemented correctly.** The asset registry guard supports dual-key rotation:
```typescript
INGEST_API_KEY_CURRENT  // Active key
INGEST_API_KEY_NEXT     // Next key (accepted during rotation window)
```

However, **no rotation schedule or automation exists.** Manual rotation is error-prone.

### Rate Limiting Sufficient?

**NO.**
- Auth endpoints: No rate limiting at all
- Asset registry: In-memory rate limiting (60/min/IP), not distributed
- No IP-based throttling for API endpoints
- No per-seller request quotas

**At 100 sellers:** A single compromised seller account could DOS the entire platform.

### Risk of Brute-Force Auth?

**HIGH.** Login endpoint has:
- No rate limiting
- No account lockout after failed attempts
- No CAPTCHA integration
- No geographic anomaly detection
- Bcrypt cost factor 12 provides ~250ms per attempt → an attacker can try ~240 passwords/minute from a single IP

### Secrets Handling

| Secret | Storage | Rotation | Rating |
|--------|---------|----------|--------|
| JWT_SECRET | .env file | Manual | ⚠️ No rotation plan |
| REFRESH_TOKEN_PEPPER | .env file | Manual | ⚠️ Changing invalidates all tokens |
| ENCRYPTION_KEY (FB tokens) | .env file | Manual | ⚠️ Changing requires re-encryption |
| R2_SECRET_ACCESS_KEY | .env file | Manual | ⚠️ No rotation plan |
| INGEST_API_KEY | .env file | Dual-key | ✅ Rotation supported |

**No secrets management service** (no Vault, no AWS Secrets Manager, no DigitalOcean Secrets).

### Are R2 Signed URLs Protected?

**YES, partially:**
- Upload URLs expire after 300 seconds (5 min)
- URLs are seller-scoped by key prefix (`sellers/{sellerId}/`)
- No public bucket access (requires signed URL)

**BUT:**
- No file size limit in presigned URL configuration
- No content-type validation post-upload
- A malicious seller could upload a 10GB file via the presigned URL
- No virus scanning on uploaded files

---

## 10. SCALE BREAKING POINTS

| Metric | Current Capacity | Breaking Point | When (Estimated) |
|--------|-----------------|----------------|------------------|
| Concurrent API users | ~30 | 50+ | 50 active sellers |
| `ad_stats_raw` rows | 0 | 5M+ (query degradation) | 30 days × 100 sellers |
| Worker cycle time | <5 min | >5 min (overlap) | 200+ campaigns |
| PostgreSQL memory | 500MB | 1.5GB (swap starts) | 50 active sellers |
| Redis memory | 100MB | 500MB (eviction starts) | 10K pending jobs |
| Prisma connections | 10 | 10 (hard limit) | 30 concurrent requests |
| Orders/day | 0 | 50K+ (without partitioning) | 100 sellers at full load |

---

## 11. MUST-FIX BEFORE 100 SELLERS

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | **Separate PostgreSQL to managed service** | 2 hours | Eliminates B1 bottleneck, adds backups |
| 2 | **Add `connection_limit=20` to DATABASE_URL** | 5 minutes | Prevents pool exhaustion |
| 3 | **Add `take` limits to all 7 unbounded queries** | 1 hour | Prevents OOM on large seller data |
| 4 | **Add `@nestjs/throttler` rate limiting** | 2 hours | Blocks brute force, prevents DOS |
| 5 | **Implement stats worker (even basic)** | 1 week | Core feature, dashboard shows real data |
| 6 | **Add distributed locks to worker** | 4 hours | Prevents duplicate aggregation |
| 7 | **Set `statement_timeout` and `lock_timeout`** | 30 minutes | Prevents runaway queries |
| 8 | **Add unique constraint on `payment_id`** | 5 minutes | Prevents duplicate payments |
| 9 | **Remove seed user or add env guard** | 30 minutes | Closes known-password vulnerability |
| 10 | **Set up CI/CD (basic GitHub Actions)** | 4 hours | Prevents broken production deployments |

---

## 12. MUST-FIX BEFORE 1,000 SELLERS

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | **Partition `ad_stats_raw` by month** | 1 day | Table stays queryable at 100M+ rows |
| 2 | **Separate Worker to dedicated machine** | 4 hours | Worker doesn't compete with API for resources |
| 3 | **Implement Redis caching layer for API** | 1 week | 10× reduction in DB load for read-heavy endpoints |
| 4 | **Add PgBouncer for connection pooling** | 4 hours | Supports 100+ concurrent connections |
| 5 | **Shard BullMQ queues by seller tier** | 2 days | Priority-based scheduling, no stampeding herd |
| 6 | **Use raw SQL for stats aggregation worker** | 3 days | 100× faster than Prisma ORM for bulk operations |
| 7 | **Add PostgreSQL RLS policies** | 2 days | Database-level tenant isolation safety net |
| 8 | **Implement read replicas** | 1 day (managed DB) | Separate read and write load |
| 9 | **Add request body size limits (Nginx + NestJS)** | 1 hour | Prevents large payload attacks |
| 10 | **Implement `PaymentEvent` model (event-sourced)** | 3 days | Financial audit trail, refund handling |
| 11 | **Deploy horizontal API scaling (2+ instances)** | 1 day | Handle concurrent load |
| 12 | **Migrate rate limiting to Redis-backed** | 4 hours | Works across multiple API instances |

---

## 13. ARCHITECTURE UPGRADE PATH (v3 Vision)

### Phase 1: Stabilize (0-3 months, 10-100 sellers)
```
                     ┌─────────────┐
   Users ──CDN──────>│  Next.js    │
                     │ (Vercel)    │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐     ┌──────────────┐
                     │  NestJS API │────>│  Managed     │
                     │  (VPS/App   │     │  PostgreSQL  │
                     │   Platform) │     └──────────────┘
                     └──────┬──────┘            │
                            │            ┌──────▼──────┐
                     ┌──────▼──────┐     │  Read       │
                     │  BullMQ     │     │  Replica    │
                     │  Worker     │     └─────────────┘
                     │  (Separate) │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Managed    │
                     │  Redis      │
                     └─────────────┘
```

### Phase 2: Scale (3-12 months, 100-1,000 sellers)
```
                     ┌─────────────┐
   Users ──CDN──────>│  Next.js    │
                     │ (Vercel)    │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Load       │
                     │  Balancer   │
                     └──┬───┬───┬──┘
                        │   │   │
                     ┌──▼─┐ │ ┌─▼──┐     ┌──────────────┐
                     │API1│ │ │API3│────>│  PostgreSQL   │
                     └────┘ │ └────┘     │  + PgBouncer  │
                         ┌──▼──┐         │  + Read       │
                         │API2 │         │    Replicas   │
                         └─────┘         └──────────────┘
                                                │
                     ┌─────────────┐     ┌──────▼──────┐
                     │  Worker     │────>│  Redis      │
                     │  Cluster    │     │  Cluster    │
                     │  (Sharded   │     └─────────────┘
                     │   Queues)   │
                     └─────────────┘
```

### Phase 3: Enterprise (12+ months, 1,000+ sellers)
```
   Consider:
   - Event-driven architecture (Kafka/NATS for cross-service communication)
   - Service decomposition (Auth, Campaigns, Analytics as separate services)
   - TimescaleDB or ClickHouse for analytics (replace ad_stats_raw)
   - CDC (Change Data Capture) for real-time analytics
   - Multi-region deployment for global sellers
   - Dedicated analytics database (OLAP) separated from transactional (OLTP)
```

---

## 14. WHAT TO REDESIGN NOW VS LATER

### Redesign NOW (Before 100 Sellers)

| Item | Why Now |
|------|---------|
| Separate database | Single biggest risk. Trivial to do early, painful later. |
| Stats worker implementation | Core feature. Without it, the product doesn't work. |
| Frontend API integration | Without it, you don't have a product. |
| Rate limiting + auth hardening | Security debt that compounds with each new user. |

### Redesign at 100 Sellers

| Item | Why Wait |
|------|----------|
| Table partitioning | No benefit until tables have millions of rows |
| Read replicas | Premature until read load actually becomes a problem |
| Queue sharding | Current single queue is fine for <500 campaigns |
| RLS policies | Application-layer isolation is sufficient for now |

### Redesign at 1,000 Sellers

| Item | Why Wait |
|------|----------|
| Service decomposition | Monolith is fine until team grows to 5+ developers |
| Dedicated analytics DB | PostgreSQL handles analytics workload until 100M+ rows |
| Event-driven architecture | Request/response is simpler and sufficient for now |
| Multi-region | Not needed until international sellers demand it |

### NEVER Redesign (Freeze These)

| Item | Why |
|------|-----|
| Tenant isolation pattern (JWT-based sellerId) | It's correct. Don't touch it. |
| Prisma for API CRUD | Right tool for the job. Only bypass for bulk operations. |
| Auth token rotation | Production-grade. No changes needed. |
| Asset registry dedup logic | Well-designed. Battle-tested pattern. |

---

## 15. OVERALL SCALE READINESS SCORE

| Dimension | Score | Notes |
|-----------|-------|-------|
| Database Design | 6/10 | Good schema, missing partitioning and some indexes |
| Worker Architecture | 2/10 | Placeholder only, no real implementation |
| API Scalability | 4/10 | Solid code but no caching, no pooling, unbounded queries |
| Tenant Isolation | 9/10 | Excellent at application layer |
| Financial Integrity | 3/10 | No payment event sourcing, no webhook handling |
| Infrastructure | 2/10 | Single VPS, no CI/CD, no monitoring |
| Security | 5/10 | Good crypto, no rate limiting, no request limits |

### **OVERALL SCALE READINESS: 3/10**

---

## 16. BRUTAL TRUTH

This system is a well-architected prototype running on infrastructure that would embarrass a college side project. The Prisma schema is thoughtfully designed. The tenant isolation is genuinely excellent. The auth system is production-grade. But none of that matters when everything runs on a single 4GB VPS with no CI/CD, no monitoring, no rate limiting, no caching, a worker that literally does nothing, a frontend that's 100% fake data, and zero connection to the Meta API that is supposedly the core of the business. You have a beautiful blueprint pinned to the wall of a construction site where no building has been erected. The foundation is poured correctly — that's genuinely good — but there is no structure on top of it. If you tried to onboard 100 real sellers today, the system would fall over within hours: the database would choke on its own connection pool, the worker would stack up jobs it can't process, and sellers would stare at a dashboard full of zeros wondering what they're paying for. The gap between what the schema promises and what the system delivers is the single largest risk. Stop adding more models and start making the ones you have actually work.

---

**Hard Mode CTO Audit Complete.**
