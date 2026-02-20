# PixEcom v2 — Full CTO Architecture Audit

---

## 1. EXECUTIVE SUMMARY (10 Bullets)

1. **Tenant isolation is excellent** — `sellerId` is embedded in JWT and used as the first parameter in every service method. Zero use of route-param-based seller IDs. Cross-tenant access is structurally impossible at the API layer.

2. **The backend (NestJS + Prisma) is production-grade for implemented features** — Auth, Orders, FbConnections, AdStrategies, AssetRegistry, and Creatives all follow consistent patterns with proper validation, scoping, and error handling.

3. **The frontend is a non-functional UI shell** — 100% mock data, zero API calls, no auth flow, no state management. It looks real in demos but has no backend connectivity whatsoever.

4. **Campaign CRUD does not exist** — Schema models for Campaign, Adset, Ad are defined, but there are no controllers, services, or DTOs. The core business logic of the ads platform is unimplemented.

5. **The stats pipeline is a skeleton** — The worker has a placeholder `console.log`. No aggregation logic exists for AdStatsRaw → AdStatsDaily → SellpageStatsDaily. Dashboard metrics will show zeros.

6. **No Meta API integration** — No Facebook Graph API client, no OAuth token exchange, no webhook handlers. The system cannot create, sync, or monitor real ad campaigns.

7. **Infrastructure is dev-only** — Single docker-compose for Postgres + Redis. No production Dockerfiles, no CI/CD, no health checks, no monitoring. Running on a 4GB VPS with no separation of concerns.

8. **Type sharing is broken** — `@pixecom/types` package is empty. Frontend defines its own duplicate types in `mock/types.ts`. Types will inevitably drift.

9. **Security fundamentals are solid** — bcrypt(12), JWT with short expiry (15m), HMAC-peppered refresh tokens with rotation, HttpOnly cookies, global validation pipe with whitelist mode, Prisma parameterized queries (zero raw SQL in application code).

10. **Technical debt is manageable today but compounding** — Two parallel asset systems (legacy AssetMedia vs new Asset/Creative), stub implementations for domain verification and sellpage stats, no tests, and the frontend-backend gap will become exponentially harder to close.

---

## 2. RED FLAGS (Must Fix Soon)

### RF-1: No CI/CD Pipeline
No GitHub Actions, no Dockerfile for the application, no automated testing. A single `git push` to production with no guardrails. **Risk**: broken deployments, untested code in production.

### RF-2: Seed User Has Known Password
`seed-seller@pixecom.io` with password `seedpassword123` (bcrypt hash hardcoded in `seed.ts`). No environment guard prevents seeding in production. **Risk**: unauthorized access if seed runs in prod.

### RF-3: No Rate Limiting
Auth endpoints (login, register, refresh) have no throttling. **Risk**: credential stuffing, brute force attacks.

### RF-4: Cookie `secure` Flag is ENV-Dependent
`COOKIE_SECURE` defaults to `"false"`. If the production `.env` isn't correctly set, refresh tokens transmit over HTTP. **Risk**: token interception on non-HTTPS connections.

### RF-5: Single VPS with No DB Separation
PostgreSQL, Redis, API, Worker, and (presumably) Nginx all on one 4GB droplet. **Risk**: a memory spike in the worker crashes the database; no failover; no backups apparent.

### RF-6: Domain Verification is a Stub
Sellers can "verify" any domain with `force: true`. No real DNS check. **Risk**: sellers can claim domains they don't own, potentially serving content on competitor domains.

### RF-7: No RBAC Enforcement
Roles (OWNER, ADMIN, EDITOR, VIEWER) exist in the schema and JWT but no `RolesGuard` is implemented. Every authenticated user can perform every action. **Risk**: viewers can mutate data.

---

## 3. YELLOW FLAGS (Monitor)

### YF-1: Two Parallel Asset Systems
Legacy (`AssetMedia`, `AssetThumbnail`, `AssetAdtext`) and new (`Asset` + `Creative` + `CreativeAsset`) coexist with no migration path documented. The legacy system is product-scoped; the new one is seller-scoped.

### YF-2: AdStatsRaw Has No Dedup Constraint
Multiple fetches from Meta API for the same date range will create duplicate rows. The `AdStatsDaily` table has a unique constraint (correct), but raw stats will bloat without bounds.

### YF-3: No Pagination on Several List Endpoints
AdStrategies, FbConnections list endpoints return all rows. With growth, these become performance bottlenecks and potential OOM risks.

### YF-4: Frontend-Backend Type Drift
10+ interfaces defined in `apps/web/src/mock/types.ts` that should live in `@pixecom/types`. When real API integration begins, type mismatches will cause runtime errors.

### YF-5: Worker Concurrency Without Distributed Locks
BullMQ concurrency is set to 5, but there's no Redis-based locking for aggregation jobs. Multiple worker instances could process the same aggregation simultaneously.

### YF-6: No Structured Logging
Worker uses `console.log`. API uses NestJS Logger but no correlation IDs, no structured JSON output, no log aggregation.

### YF-7: Missing `paymentStatus` Separation
`Order.status` conflates fulfillment status (SHIPPED, DELIVERED) with payment status (REFUNDED). A shipped-but-refunded order has no clean representation.

### YF-8: ROAS Calculation Placement
ROAS is stored as a pre-computed field in both `AdStatsDaily` and `SellpageStatsDaily`. If revenue data is corrected retroactively (refunds, chargebacks), all pre-computed ROAS values become stale without a re-aggregation trigger.

---

## 4. DETAILED AUDIT FINDINGS

### 4.1 Architecture Audit

**Tenant Isolation Model: SAFE (9/10)**
- `sellerId` from JWT, never from URL params
- All Prisma queries use `{ id, sellerId }` dual-key lookups
- 404 returned on cross-tenant attempts (no information leakage)
- Asset visibility: `ownerSellerId = sellerId OR ownerSellerId IS NULL`
- One gap: No row-level security at the database level (relies entirely on application layer)

**Prisma Schema: Well-Designed (8/10)**
- 30 models, 17 enums, proper indexes
- Partial unique indexes via raw SQL migrations (correct for PostgreSQL)
- JSON fields used appropriately (targeting, metadata, config)
- `Decimal(10,2)` for money — correct
- Missing: No `updatedAt` on `AdStatsRaw` (can't distinguish fresh vs stale data)

**Creative Architecture: Scalable but Dual-System (7/10)**
- New system (Asset → CreativeAsset → Creative) is well-designed
- Role-based slots with single-slot uniqueness via conditional index
- `CreativeType` drives validation requirements (VIDEO_AD needs PRIMARY_VIDEO + THUMBNAIL)
- Problem: Legacy AssetMedia still used by some endpoints, no migration plan

**Stats Pipeline Design: Correct but Unimplemented (5/10)**
- Three-tier design (Raw → Daily → SellpageDaily) is architecturally sound
- Unique constraints on daily tables enable idempotent upserts
- `SellpageStatsDaily` correctly includes `adSource` dimension
- Conversion funnels (cr1, cr2, cr3) are forward-thinking
- Problem: Zero implementation — no worker logic, no aggregation SQL, no ROAS calculation

### 4.2 Ads Layer Design

**Should Creative + AdText Be Separated?**
**YES.** The current `AssetAdtext` table is product-scoped but ad text is campaign-contextual. Different campaigns for the same product often need different headlines, CTAs, and primary text. The new `CreativeAsset` system with `PRIMARY_TEXT`, `HEADLINE`, `DESCRIPTION` roles partially addresses this, but ad text should be a first-class entity, not just an asset role. Recommendation: Create an `AdText` model with versioning, A/B test support, and campaign-level scoping.

**Is AdVariant Required?**
**Not yet.** The current `Creative` + `CreativeAsset` system handles variant-like behavior (different videos/thumbnails per creative). An explicit `AdVariant` model would be needed when you support Dynamic Creative Optimization (DCO) where Meta auto-combines assets. For now, CampaignCreative is sufficient.

**Is `campaign_creatives` Correct?**
**Yes.** Join table between Campaign and Creative for BI attribution is the right pattern. It correctly tracks which creatives were used in which campaigns without coupling the creative lifecycle to campaigns.

**UTM Matching Approach:**
**Missing entirely.** There is no UTM parameter tracking anywhere. Orders have `sellpageId` (nullable), but no attribution fields for `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`. Without UTM tracking, you cannot attribute revenue to specific ads or campaigns. This is a fundamental gap for an ads-driven platform.

**Will Current Design Survive Real Meta API Integration?**
**Partially.** The `externalCampaignId`, `externalAdsetId`, `externalAdId` fields are correct. The `FbConnection` hierarchy (AD_ACCOUNT → PAGE → PIXEL → CONVERSION) maps well to Meta's asset structure. However:
- No `externalCreativeId` on Creative model (needed for Meta creative sync)
- No webhook handler for ad status changes
- No error/retry handling for rate-limited API calls
- No campaign-level budget sync from Meta

### 4.3 Data & Analytics Layer

**Computed Metrics Placement:**
Pre-computing CPM, CTR, CPC, ROAS in daily tables is correct for read performance. However, these should be recomputed from source fields (spend, impressions, clicks, revenue) on aggregation, not averaged from raw stats.

**ROAS Inconsistency Risk: HIGH**
ROAS = revenue / adSpend. Revenue comes from Orders, adSpend from AdStatsDaily. These are in different tables, aggregated by different workers, at different times. If the order worker runs before the stats worker, ROAS will be wrong until both complete. Recommendation: Compute ROAS only in `SellpageStatsDaily` after both sources are available, not in `AdStatsDaily`.

**Materialized Views:**
Not needed yet at current scale. When daily query volume exceeds ~100K rows in stats tables, consider PostgreSQL materialized views with `REFRESH CONCURRENTLY` for dashboard queries. Prisma doesn't natively support materialized views, so this would require raw SQL.

**Worker Concurrency Safety: UNSAFE**
No distributed locks, no idempotency tracking, no job deduplication. BullMQ's `concurrency: 5` means 5 jobs process simultaneously, but nothing prevents the same aggregation from being queued twice.

**Data Drift Risk: MEDIUM**
Late-arriving Meta API data (common — stats can be updated up to 72 hours after the date) will require re-aggregation of past dates. No mechanism exists for this.

### 4.4 Orders & Finance

**Should `paymentStatus` Be Decoupled from `orderStatus`?**
**YES.** An order can be SHIPPED but payment FAILED. Or DELIVERED but REFUNDED. The current single `OrderStatus` enum cannot represent these composite states. Add a separate `paymentStatus` field: `PENDING | AUTHORIZED | CAPTURED | REFUNDED | CHARGEDBACK | FAILED`.

**Is `transactionId` Strategy Correct?**
The current `paymentId` field (VarChar 255) is a placeholder. For production: this should link to a `PaymentTransaction` model with amount, gateway, status, timestamps. A single order may have multiple transactions (partial refunds, retry payments).

**Should Refund & Chargeback Be Event-Sourced?**
**YES.** `OrderEvent` already exists with types including REFUNDED. But financial events need more rigor: amount, gateway reference, processor response, initiated_by. Recommendation: Either extend `OrderEvent.metadata` with a strict schema, or create a dedicated `FinancialEvent` model.

**Is 17Track Integration Design Sound?**
**Not designed yet.** The `trackingNumber` and `trackingUrl` fields exist on Order, but there's no tracking refresh job, no webhook endpoint for status updates, no tracking event model.

### 4.5 Infrastructure & DevOps

**Single 4GB VPS Sustainable?**
**For 1-5 internal sellers: YES. Beyond that: NO.** Breakdown:
- PostgreSQL: ~500MB baseline
- Redis: ~100MB
- NestJS API: ~200MB
- BullMQ Worker: ~150MB
- Next.js: ~300MB (if SSR)
- OS overhead: ~500MB
- Available: ~2.2GB for actual workload

When stats aggregation runs with real Meta data for 10+ campaigns, you'll hit memory limits. The worker and API competing for the same CPU will cause latency spikes.

**Should DB Be Separated?**
**YES, immediately.** Move PostgreSQL to a managed service (DigitalOcean Managed Database or Supabase). Benefits: automated backups, connection pooling, read replicas when needed, no risk of worker crashing the DB.

**Docker Setup: Dev-Only**
`docker-compose.yml` only runs Postgres and Redis. No application containers. No production compose file. No health checks. No resource limits.

**Migrations: SAFE**
6 migrations, all well-structured. Partial indexes correctly implemented via raw SQL. All use `IF NOT EXISTS` or `IF EXISTS` guards. One risk: Migration 2 adds a unique constraint on `hostname` — must verify no duplicates before running.

**CI/CD: NONEXISTENT**
No GitHub Actions, no deployment scripts, no automated tests, no staging environment.

**Security Gaps:**
- No rate limiting (already noted)
- No CORS origin validation in production (env-dependent)
- No request size limits (large JSON payloads could cause OOM)
- No Content Security Policy headers
- No HSTS headers (relies on Nginx/CDN configuration)
- FB access tokens encrypted (`accessTokenEnc`) — good, but encryption key rotation not implemented

---

## 5. TOP 10 ARCHITECTURAL RISKS

| # | Risk | Severity | Likelihood | Impact |
|---|------|----------|------------|--------|
| 1 | Frontend has zero API integration | Critical | Certain | Cannot ship to users |
| 2 | Campaign CRUD unimplemented | Critical | Certain | Core feature missing |
| 3 | Stats pipeline unimplemented | Critical | Certain | No metrics/ROAS |
| 4 | No Meta API integration | Critical | Certain | Cannot run real ads |
| 5 | No CI/CD or automated tests | High | Likely | Regression bugs in prod |
| 6 | Single VPS for everything | High | Likely | Downtime under load |
| 7 | No RBAC guard enforcement | High | Moderate | Privilege escalation |
| 8 | Dual asset system without migration | Medium | Likely | Data inconsistency |
| 9 | No UTM attribution tracking | Medium | Certain | Cannot attribute revenue |
| 10 | `paymentStatus` conflated with `orderStatus` | Medium | Likely | Incorrect financials |

## TOP 5 SCALING RISKS

| # | Risk | Trigger Point |
|---|------|---------------|
| 1 | 4GB VPS memory exhaustion | >10 active campaigns with stats sync |
| 2 | No connection pooling (Prisma default) | >50 concurrent API requests |
| 3 | Stats aggregation without locks | >1 worker instance |
| 4 | AdStatsRaw table bloat (no dedup) | >30 days of hourly Meta syncs |
| 5 | No CDN cache invalidation strategy | >100 media uploads/day |

## TOP 5 SECURITY RISKS

| # | Risk | Current Mitigation |
|---|------|-------------------|
| 1 | No rate limiting on auth endpoints | None |
| 2 | Seed user in production | None |
| 3 | Domain verification stub | Force flag bypass |
| 4 | Cookie `secure` flag env-dependent | Requires correct .env |
| 5 | No request body size limits | NestJS defaults (unbounded) |

## HIDDEN COUPLING AREAS

- `AdPost` couples Facebook Pages to Ads via `pageId` FK — will break for non-Meta platforms
- `Campaign.adAccountId` directly references `FbConnection` — assumes single ad platform
- `SellpageStatsDaily.adSource` is a free-text varchar, not an enum — inconsistency risk
- `PricingRule.productId` is nullable — global pricing rules affect all products without clear precedence

## FUTURE REWRITE TRIGGERS

1. **Multi-platform ads** (Google, TikTok): Campaign model is Meta-specific. Will need an `AdPlatform` abstraction layer.
2. **Multi-currency**: `currency` field exists per-order but stats are not currency-aware. Cross-currency ROAS is undefined.
3. **Real-time dashboards**: Current pull-based stats model won't support live metrics. Will need WebSocket + Redis pub/sub.
4. **Multi-region compliance**: EU sellers will need data residency. Single-database architecture won't support this.

---

## 6. STRATEGIC RECOMMENDATIONS

### What I Would Redesign (If Starting Today)

1. **Unified Asset System** — Collapse `AssetMedia`/`AssetThumbnail`/`AssetAdtext` into the new `Asset` + `Creative` system. One system, not two.
2. **Platform-Agnostic Campaign Model** — Add `adPlatform` enum (META, GOOGLE, TIKTOK) to Campaign. Abstract external IDs into a polymorphic structure.
3. **Event-Sourced Orders** — Make `OrderEvent` the source of truth. Derive `Order.status` from the latest event. Add financial events.
4. **UTM Attribution Table** — First-class `Attribution` model linking orders to ad clicks via UTM parameters.

### What I Would Freeze (Do Not Touch)

1. **Auth system** — It's solid. JWT + refresh rotation + bcrypt is production-ready. Don't refactor.
2. **Prisma schema structure** — The model design is sound. Add to it, don't restructure.
3. **Tenant isolation pattern** — The sellerId-from-JWT approach is correct. Do not introduce route-param sellers.
4. **Asset Registry ingestion layer** — The multi-source dedup with API key auth is well-built.

### What I Would Simplify

1. **Remove legacy asset tables** — Migrate data forward, drop `AssetMedia`/`AssetThumbnail`/`AssetAdtext`.
2. **Remove stub implementations** — Domain verification `force` flag and sellpage `STUB_STATS` — either implement or remove.
3. **Flatten the stats pipeline** — For MVP, compute stats directly from raw + orders into `SellpageStatsDaily`. Skip `AdStatsDaily` intermediate table until you need ad-level metrics.

### What I Would Delay

1. **Multi-platform ad support** — Stay Meta-only for now. Don't abstract prematurely.
2. **Real-time dashboards** — Daily/hourly aggregation is fine for v1. WebSockets can wait.
3. **Advanced RBAC** — OWNER-only for now. Team management can come after core ads flow works.
4. **17Track integration** — Focus on campaign lifecycle first. Tracking is a nice-to-have.

### What I Would Enforce Immediately

1. **Separate the database** — Move to managed PostgreSQL today. Non-negotiable for production.
2. **Add rate limiting** — `@nestjs/throttler` on auth endpoints. 30 minutes of work.
3. **Set up CI/CD** — GitHub Actions with lint + build + migrate. Must-have before any team scaling.
4. **Build the API client layer in frontend** — This unblocks all feature work. Without it, the frontend is a prototype.
5. **Implement auth flow in frontend** — JWT storage, auto-refresh, protected routes. Foundation for everything.

---

## 7. SCORES

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Architecture** | **7/10** | Sound multi-tenant design, clean separation of concerns, but dual asset systems and missing core modules (campaigns, stats) drag it down |
| **Scalability** | **4/10** | Single VPS, no connection pooling config, no caching layer, no horizontal scaling path, stats pipeline unimplemented |
| **Technical Debt Level** | **Medium-High** | The debt is not in what's built (which is clean), but in what's missing. The gap between the schema's promise and the implementation reality is significant. Mock-data frontend is the largest debt item. |

---

## 8. FINAL RECOMMENDATION

| Question | Answer |
|----------|--------|
| **Safe to continue building features?** | **YES** — the foundation (auth, isolation, schema) is solid. Continue building on it. |
| **Refactor before scaling?** | **YES** — separate the DB, add CI/CD, and build the API client layer before adding more features. Do not scale the current single-VPS setup. |
| **OK for internal sellers only?** | **YES, with caveats** — acceptable for 1-5 internal sellers who understand it's early-stage. The backend works. The frontend is a UI prototype. Stats will show zeros until the pipeline is built. |
| **Production-ready for external sellers?** | **NO** — missing campaign CRUD, Meta API integration, stats pipeline, RBAC, rate limiting, CI/CD, and frontend-backend integration. Estimate 8-12 weeks of focused development to reach external-seller readiness. |

---

**CTO Audit Complete.**
