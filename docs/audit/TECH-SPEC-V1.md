# PIXECOM v2 — TECHNICAL SPECIFICATION (V1)

> **Date:** 2026-02-20
> **Author:** CTO Audit Agent (Claude)
> **Audience:** Tech Lead Agent (Claude) — implementation executor
> **Cross-references:** `roadmap-review-notes.md`, `audit1-architecture.md`, `audit2-scale-stress.md`, `competitor-audit-ads-manager.md`, `competitor-audit-ad-creation.md`
> **Addendum:** [`../TECH-SPEC-V1-ADDENDUM-2.3.X.md`](../TECH-SPEC-V1-ADDENDUM-2.3.X.md) — Ads Manager Full Read Layer + Orders Upgrade
> **Metrics Contract:** [`../METRICS-CONTRACT.md`](../METRICS-CONTRACT.md) — Frozen metric definitions (supersedes CR formulas in Task 2.2)
> **Approved by:** CTO (Executive Summary v2)

---

## 0. PREAMBLE

### 0.1 Conventions

- All file paths are relative to monorepo root: `D:\Pixel Team\NEW-PixEcom\pixecom-v2`
- **"Create"** = new file. **"Modify"** = existing file
- Backend modules follow the pattern in `apps/api/src/fb-connections/` (controller + service + module + dto/)
- DTOs use `class-validator` decorators (`@IsString()`, `@IsOptional()`, `@IsUUID()`, etc.)
- Prisma select shapes defined as module-level `const` with `as const`
- Auth: `@UseGuards(JwtAuthGuard)` at controller class level, `@CurrentUser() user: AuthUser` for tenant context
- Tenant isolation: **always** pass `user.sellerId` to service — never from route params
- Soft deletes: `isActive = false` or `status = ARCHIVED` — no physical deletes

### 0.2 Architecture Snapshot (Current State)

```
pixecom-v2/                          Turborepo + pnpm workspaces
├── apps/
│   ├── api/                         NestJS 10 — 14 modules, 51 endpoints, 241 E2E tests
│   │   └── src/
│   │       ├── auth/                JWT + refresh rotation + bcrypt(12)
│   │       ├── seller/              Tenant CRUD
│   │       ├── products/            Product catalog
│   │       ├── assets/              Legacy read-only (3 endpoints)
│   │       ├── asset-registry/      New asset system (5 endpoints, R2)
│   │       ├── creatives/           Creative bundling (8 endpoints)
│   │       ├── sellpages/           Landing pages
│   │       ├── domains/             Domain verification (stub)
│   │       ├── fb-connections/      FB connection metadata (no OAuth yet)
│   │       ├── ad-strategies/       Strategy templates (5 endpoints)
│   │       ├── orders/              Orders read layer (keyset pagination)
│   │       ├── media/               R2 upload service
│   │       ├── prisma/              PrismaService (global)
│   │       └── health/              Health check
│   ├── web/                         Next.js 14 — 100% mock data, no auth flow
│   │   └── src/
│   │       ├── app/(portal)/        8 portal pages (all mock)
│   │       ├── app/login/           Demo login (router.push only)
│   │       ├── components/ui/       Shadcn-inspired (Button, Badge, Card, Table, Sheet...)
│   │       ├── components/shared/   PageHeader, KpiCard, StatusBadge, EmptyState
│   │       ├── mock/               types.ts + 7 mock data files
│   │       ├── hooks/              use-mobile.ts
│   │       ├── stores/             (empty — Zustand installed but unused)
│   │       └── lib/                utils.ts (cn), helpers.ts (formatCurrency...)
│   └── worker/                      BullMQ skeleton — placeholder processor
│       └── src/main.ts              35 lines, console.log only
├── packages/
│   ├── database/                    Prisma 5.20 + PostgreSQL 16 (888-line schema, 30 models)
│   ├── types/                       Nearly empty (PaginationMeta, ApiError, DateRange only)
│   └── config/                      Shared ESLint/TS configs
```

**What's implemented vs missing:**

| Layer | Implemented | Missing |
|-------|------------|---------|
| Auth + Tenant | ✅ JWT, refresh, bcrypt, sellerId isolation | — |
| Asset System | ✅ Dual system (legacy + new), R2 upload | Per-asset stats |
| Creative System | ✅ Full CRUD, validation, render | — |
| FbConnections | ✅ CRUD (metadata only) | OAuth token exchange |
| AdStrategies | ✅ CRUD | Config schema too simple |
| Campaign/Adset/Ad | ✅ Schema only | ❌ Zero implementation |
| Meta Marketing API | — | ❌ Zero implementation |
| Stats Pipeline | ✅ Schema (AdStatsRaw/Daily) | ❌ Worker is placeholder |
| Frontend Auth | — | ❌ No auth flow |
| Frontend API | — | ❌ 100% mock data |

### 0.3 Key Reference Files

| File | Pattern to follow | Lines |
|------|------------------|-------|
| `apps/api/src/fb-connections/fb-connections.service.ts` | Gold standard module: select shapes, mapToDto, tenant isolation, soft delete | ~180 |
| `apps/api/src/orders/orders.service.ts` | Keyset pagination: encodeCursor/decodeCursor, date helpers | ~250 |
| `apps/api/src/auth/strategies/jwt.strategy.ts` | `AuthUser` interface: `{ userId, sellerId, role, isSuperadmin }` | 51 |
| `apps/api/src/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` decorator | ~10 |
| `apps/api/src/creatives/creatives.service.ts` | Complex service: attachAsset, validateCreative, $transaction | 328 |
| `packages/database/prisma/schema.prisma` | All models (Campaign line 484, AdStatsRaw line 700, FbConnection line 425) | 888 |
| `apps/worker/src/main.ts` | Worker skeleton (BullMQ + IORedis) | 35 |
| `apps/web/src/app/(portal)/ads-manager/page.tsx` | Current mock Ads Manager (to refactor) | 320 |
| `apps/web/src/mock/types.ts` | Frontend types (to replace with @pixecom/types) | 214 |
| `apps/web/src/lib/helpers.ts` | formatCurrency, formatCompact, formatDate, timeAgo | ~60 |

### 0.4 AuthUser Interface (used throughout)

```typescript
// From apps/api/src/auth/strategies/jwt.strategy.ts
export interface AuthUser {
  userId: string;
  sellerId: string;
  role: string;
  isSuperadmin: boolean;
}
```

---

## PHASE 0 — PRODUCT FREEZE + INFRASTRUCTURE (Week 1)

**Objective:** Lock scope, separate infrastructure, establish shared types.
**Total effort:** ~2 days

---

### Task 0.1: Migrate PostgreSQL to Managed Database

**Effort:** 2-3 hours

**Files to modify:**
- `.env` / `.env.example` — update `DATABASE_URL`
- `docker-compose.yml` — keep postgres service for local dev, add comment for prod

**Implementation:**

1. Provision managed PostgreSQL 16 (DigitalOcean $15/month or equivalent)
2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://user:pass@managed-host:25060/pixecom?connection_limit=20&sslmode=require"
   ```
3. Run `pnpm --filter @pixecom/database db:migrate:deploy` to apply all migrations
4. Verify API starts and connects: `pnpm --filter api dev`
5. Keep `docker-compose.yml` postgres for local dev with `.env.local` override

**Dependencies:** None (first task)

**Acceptance criteria:**
- [ ] API connects to managed DB successfully
- [ ] All migrations applied cleanly (`prisma migrate status` = no pending)
- [ ] `connection_limit=20` present in connection string
- [ ] `docker-compose.yml` postgres still works for local dev

---

### Task 0.2: Migrate Redis to Managed Instance

**Effort:** 1 hour

**Files to modify:**
- `.env` / `.env.example` — update `REDIS_URL`
- `docker-compose.yml` — keep redis service for local dev

**Implementation:**

1. Provision managed Redis 7 (DigitalOcean $10/month or Upstash serverless)
2. Update `REDIS_URL` in `.env`:
   ```
   REDIS_URL="rediss://user:pass@managed-host:25061"
   ```
3. Verify worker connects: `pnpm --filter worker dev`
4. Verify BullMQ queue operations work (add + process a test job)

**Dependencies:** None (parallel with Task 0.1)

**Acceptance criteria:**
- [ ] Worker starts and connects to managed Redis
- [ ] BullMQ can add and process jobs without error

---

### Task 0.3: Populate `@pixecom/types` Package

**Effort:** 1 day

**Files to create:**
```
packages/types/src/
├── enums.ts          ← All Prisma enums as TypeScript string unions
├── campaigns.ts      ← Campaign, Adset, Ad response DTOs
├── stats.ts          ← Stats aggregates, derived metrics, summary row
├── ads-manager.ts    ← AdsManager query/response types
├── auth.ts           ← Login/refresh request/response, AuthContext
├── fb-connections.ts ← FbConnection response DTO
└── orders.ts         ← Order list/detail response DTOs
```

**Files to modify:**
- `packages/types/src/index.ts` — re-export all new modules
- `packages/types/src/api.ts` — add `ApiSuccessResponse<T>` wrapper

**Implementation:**

```typescript
// ─── packages/types/src/enums.ts ─────────────────────────────────────────────
// Extract from prisma/schema.prisma enums (lines 468-500, 692-698, etc.)

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
export type BudgetType = 'DAILY' | 'LIFETIME';
export type StatsEntityType = 'CAMPAIGN' | 'ADSET' | 'AD';
export type FbConnectionType = 'AD_ACCOUNT' | 'PAGE' | 'PIXEL' | 'CONVERSION';
export type PostSource = 'EXISTING' | 'CONTENT_SOURCE';
export type CreativeStatus = 'DRAFT' | 'READY' | 'ARCHIVED';
export type CreativeType = 'VIDEO_AD' | 'IMAGE_AD' | 'TEXT_ONLY' | 'UGC_BUNDLE';
export type CreativeAssetRole = 'PRIMARY_VIDEO' | 'THUMBNAIL' | 'PRIMARY_TEXT'
  | 'HEADLINE' | 'DESCRIPTION' | 'EXTRA';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED'
  | 'CANCELLED' | 'REFUNDED';
export type DeliveryStatus = 'ACTIVE' | 'INACTIVE' | 'LEARNING' | 'ERROR'
  | 'LIMITED' | 'NOT_DELIVERING' | 'PENDING_REVIEW' | 'UNKNOWN';
```

```typescript
// ─── packages/types/src/stats.ts ─────────────────────────────────────────────

export interface RawAggregates {
  spend: number;
  impressions: number;
  linkClicks: number;
  contentViews: number;
  addToCart: number;
  checkoutInitiated: number;
  purchases: number;
  purchaseValue: number;
}

export interface DerivedMetrics extends RawAggregates {
  cpm: number;             // spend / impressions * 1000
  ctr: number;             // linkClicks / impressions * 100
  cpc: number;             // spend / linkClicks
  cpv: number;             // spend / contentViews
  costPerAtc: number;      // spend / addToCart
  costPerCheckout: number; // spend / checkoutInitiated
  costPerPurchase: number; // spend / purchases
  roas: number;            // purchaseValue / spend
  results: number;         // = purchases (optimized conversion)
  costPerResult: number;   // spend / results
  cr: number;              // purchases / linkClicks * 100
  cr1: number;             // addToCart / contentViews * 100
  cr2: number;             // purchases / addToCart * 100
}
```

```typescript
// ─── packages/types/src/campaigns.ts ─────────────────────────────────────────

export interface CampaignCardDto {
  id: string;
  name: string;
  status: CampaignStatus;
  deliveryStatus: DeliveryStatus | null;
  budget: number;
  budgetType: BudgetType;
  startDate: string | null;
  endDate: string | null;
  sellpage: { id: string; name: string } | null;
  adAccount: { id: string; name: string; externalId: string } | null;
  createdAt: string;
}

export interface AdsManagerRow extends CampaignCardDto, DerivedMetrics {}
```

```typescript
// ─── packages/types/src/ads-manager.ts ───────────────────────────────────────

export interface AdsManagerQuery {
  level?: 'campaign' | 'adset' | 'ad';
  dateFrom: string;
  dateTo: string;
  sellpageId?: string;
  status?: CampaignStatus;
  deliveryStatus?: string;
  adAccountId?: string;
  campaignIds?: string;  // comma-separated
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface AdsManagerResponse {
  rows: AdsManagerRow[];
  summary: DerivedMetrics;
  meta: {
    dateFrom: string;
    dateTo: string;
    level: string;
    totalRows: number;
  };
}

export interface BulkStatusUpdateRequest {
  ids: string[];
  action: 'PAUSE' | 'ACTIVATE';
}

export interface BulkStatusUpdateResponse {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}
```

```typescript
// ─── packages/types/src/auth.ts ──────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; displayName: string };
  seller: { id: string; name: string; slug: string };
}

export interface AuthContextState {
  accessToken: string | null;
  user: LoginResponse['user'] | null;
  seller: LoginResponse['seller'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

```typescript
// ─── packages/types/src/index.ts ─────────────────────────────────────────────
export * from './common';
export * from './api';
export * from './enums';
export * from './campaigns';
export * from './stats';
export * from './ads-manager';
export * from './auth';
export * from './fb-connections';
export * from './orders';
```

**Dependencies:** None (parallel with Tasks 0.1-0.2)

**Acceptance criteria:**
- [ ] `pnpm build --filter @pixecom/types` succeeds
- [ ] `apps/api` can import: `import { CampaignStatus } from '@pixecom/types'`
- [ ] `apps/web` can import: `import { AdsManagerRow } from '@pixecom/types'`
- [ ] All Prisma enums have corresponding TypeScript unions
- [ ] All response DTOs defined for: Campaign, Adset, Ad, Stats, Auth, FbConnection

---

## PHASE 1 — META SYNC FOUNDATION (Weeks 2-5)

**Objective:** Real data flowing from Meta into PixEcom. Frontend can authenticate.
**Total effort:** ~15-16 days

---

### Task 1.1: Schema Verification

**Effort:** 0.5 days

**What to verify:**
The Prisma schema already has the fields we need (confirmed in exploration):

```
Campaign.deliveryStatus  → line 495 → String? @db.VarChar(50)
Adset.deliveryStatus     → line 520 → String? @db.VarChar(50)
Ad.deliveryStatus        → line 543 → String? @db.VarChar(50)
AdStatsRaw.purchaseValue → line 719 → Decimal @db.Decimal(10,2)
AdStatsDaily.purchaseValue→ line 749 → Decimal @db.Decimal(10,2)
AdStatsRaw.contentViews  → line 714 → Int @default(0)
AdStatsRaw.addToCart      → line 715 → Int @default(0)
AdStatsRaw.checkoutInitiated → line 716 → Int @default(0)
```

**Implementation:**
1. Run `npx prisma migrate status` — verify no drift
2. If drift exists, run `npx prisma migrate dev --name sync_schema`
3. Run `npx prisma generate` to ensure client is up-to-date

**Dependencies:** Task 0.1 (managed DB)

**Acceptance criteria:**
- [ ] `prisma migrate status` = "Database schema is up to date!"
- [ ] `prisma generate` succeeds

---

### Task 1.2: Meta Marketing API Client Module

**Effort:** 3 days

**Files to create:**
```
apps/api/src/meta/
├── meta.module.ts
├── meta-api.service.ts       ← Core HTTP client
├── meta-auth.service.ts      ← Token decrypt/cache
├── meta-rate-limiter.ts      ← Per-account rate limiting
├── meta.types.ts             ← Meta API response interfaces
├── meta.constants.ts         ← API version, base URL, field names
└── meta-error.mapper.ts      ← Meta error → NestJS exception
```

**Files to modify:**
- `apps/api/src/app.module.ts` — add `MetaModule` to imports array

**Implementation:**

#### meta.constants.ts
```typescript
export const META_API_VERSION = 'v21.0';
export const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const INSIGHTS_FIELDS = [
  'spend', 'impressions', 'cpm', 'ctr', 'cpc',
  'inline_link_clicks', 'actions', 'action_values',
  'cost_per_action_type',
].join(',');

// Action types to extract from Meta "actions" array
export const ACTION_TYPE_MAP = {
  'offsite_conversion.fb_pixel_purchase': 'purchases',
  'offsite_conversion.fb_pixel_add_to_cart': 'addToCart',
  'offsite_conversion.fb_pixel_initiate_checkout': 'checkoutInitiated',
  'offsite_conversion.fb_pixel_view_content': 'contentViews',
} as const;

// Same keys but for action_values (monetary)
export const ACTION_VALUE_MAP = {
  'offsite_conversion.fb_pixel_purchase': 'purchaseValue',
} as const;
```

#### meta-api.service.ts
```typescript
@Injectable()
export class MetaApiService {
  constructor(
    private readonly authService: MetaAuthService,
    private readonly rateLimiter: MetaRateLimiter,
    private readonly configService: ConfigService,
  ) {}

  // ─── INSIGHTS ─────────────────────────────────────────────────────
  async getInsights(
    adAccountExternalId: string,
    level: 'campaign' | 'adset' | 'ad',
    dateRange: { dateFrom: string; dateTo: string },
    accessToken: string,
  ): Promise<MetaInsightsRow[]> {
    await this.rateLimiter.acquire(adAccountExternalId);
    const url = `${META_API_BASE}/act_${adAccountExternalId}/insights`;
    const params = {
      access_token: accessToken,
      fields: INSIGHTS_FIELDS,
      level,
      time_range: JSON.stringify({
        since: dateRange.dateFrom,
        until: dateRange.dateTo,
      }),
      time_increment: 1,  // daily breakdown
      limit: 500,
    };
    return this.fetchWithPagination(url, params);
  }

  // ─── ENTITY STATUS ────────────────────────────────────────────────
  async getEntityStatus(
    entityType: 'campaign' | 'adset' | 'ad',
    externalId: string,
    accessToken: string,
  ): Promise<{ effectiveStatus: string }> {
    await this.rateLimiter.acquire('status-check');
    const url = `${META_API_BASE}/${externalId}`;
    const params = { access_token: accessToken, fields: 'effective_status' };
    // ... fetch and return
  }

  // ─── UPDATE STATUS (Phase 3) ─────────────────────────────────────
  async updateEntityStatus(
    externalId: string,
    status: 'ACTIVE' | 'PAUSED',
    accessToken: string,
  ): Promise<void> {
    await this.rateLimiter.acquire('status-update');
    const url = `${META_API_BASE}/${externalId}`;
    // POST with { status } body
  }

  // ─── PAGINATION HELPER ────────────────────────────────────────────
  private async fetchWithPagination(url, params): Promise<any[]> {
    // Follow Meta's cursor-based pagination via "paging.next"
    // Retry on 429 with exponential backoff (1s, 2s, 4s, max 3 retries)
  }
}
```

#### meta-auth.service.ts
```typescript
@Injectable()
export class MetaAuthService {
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(fbConnectionId: string, sellerId: string): Promise<string> {
    // 1. Check cache (5-min TTL)
    // 2. If miss: query FbConnection, decrypt accessTokenEnc
    // 3. Decrypt using AES-256-GCM with key from META_TOKEN_ENCRYPTION_KEY env
    // 4. Cache and return
  }

  encryptToken(plainToken: string): string {
    // AES-256-GCM encrypt for storing in DB
  }

  decryptToken(encrypted: string): string {
    // AES-256-GCM decrypt
  }
}
```

#### meta-rate-limiter.ts
```typescript
@Injectable()
export class MetaRateLimiter {
  // Per-ad-account: 200 calls / hour (Meta Business tier)
  // In-memory Map for single instance. Redis-backed for multi-instance (Phase 5)

  private buckets = new Map<string, { count: number; windowStart: number }>();
  private readonly MAX_CALLS_PER_HOUR = 200;

  async acquire(accountId: string): Promise<void> {
    // Token bucket algorithm
    // If exceeded: wait until window resets
    // Log warning at 80% capacity
  }
}
```

#### meta-error.mapper.ts
```typescript
export function mapMetaError(error: MetaApiError): HttpException {
  switch (error.code) {
    case 190: return new UnauthorizedException('Meta access token expired');
    case 17:  return new TooManyRequestsException('Meta rate limit exceeded');
    case 100: return new BadRequestException(`Meta: ${error.message}`);
    case 10:  return new ForbiddenException('Meta: insufficient permissions');
    default:  return new InternalServerErrorException(`Meta error ${error.code}`);
  }
}
```

#### meta.module.ts
```typescript
@Module({
  providers: [MetaApiService, MetaAuthService, MetaRateLimiter],
  exports: [MetaApiService, MetaAuthService],
})
export class MetaModule {}
```

**Dependencies:** Task 0.3 (shared types)

**Acceptance criteria:**
- [ ] MetaApiService can call Meta Graph API with valid token
- [ ] Rate limiter throttles at 200 calls/hour per account
- [ ] Error mapper converts all Meta error codes to NestJS exceptions
- [ ] Token encrypt/decrypt round-trips correctly
- [ ] Unit tests with mocked HTTP responses pass

---

### Task 1.3: Stats Sync Worker — 15-Minute Interval

**Effort:** 5 days

**Files to create:**
```
apps/worker/src/
├── processors/
│   ├── stats-sync.processor.ts
│   └── delivery-sync.processor.ts    ← (Task 1.4)
├── queues/
│   ├── queue-names.ts
│   └── scheduler.ts
└── lib/
    ├── prisma.ts                     ← Standalone PrismaClient
    ├── meta-client.ts                ← Lightweight Meta API wrapper (reuse logic)
    └── stats-mapper.ts               ← Meta response → DB row mapper
```

**Files to modify:**
- `apps/worker/src/main.ts` — replace placeholder with real setup

**Implementation:**

#### main.ts (replace entire file)
```typescript
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from './queues/queue-names';
import { setupScheduler } from './queues/scheduler';
import { processStatsSyncJob } from './processors/stats-sync.processor';
import { processDeliverySyncJob } from './processors/delivery-sync.processor';
import { prisma } from './lib/prisma';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function bootstrap() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  // ─── Setup repeatable job schedulers ──────────────────────────────
  await setupScheduler(connection);

  // ─── Stats Sync Worker (15-min interval) ──────────────────────────
  const statsWorker = new Worker(
    QUEUE_NAMES.STATS_SYNC,
    processStatsSyncJob,
    { connection: connection as any, concurrency: 1 },
  );

  // ─── Delivery Sync Worker (5-min interval) ────────────────────────
  const deliveryWorker = new Worker(
    QUEUE_NAMES.DELIVERY_SYNC,
    processDeliverySyncJob,
    { connection: connection as any, concurrency: 1 },
  );

  // ─── Event handlers ──────────────────────────────────────────────
  for (const [name, worker] of [
    ['stats-sync', statsWorker],
    ['delivery-sync', deliveryWorker],
  ] as const) {
    worker.on('completed', (job) => console.log(`[${name}] Job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`[${name}] Job ${job?.id} failed:`, err.message));
  }

  // ─── Graceful shutdown ────────────────────────────────────────────
  const shutdown = async () => {
    console.log('Shutting down workers...');
    await statsWorker.close();
    await deliveryWorker.close();
    await prisma.$disconnect();
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('PixEcom Worker started. Queues: stats-sync, delivery-sync');
}

bootstrap().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
```

#### queue-names.ts
```typescript
export const QUEUE_NAMES = {
  STATS_SYNC: 'stats-sync',
  DELIVERY_SYNC: 'delivery-sync',
} as const;
```

#### scheduler.ts
```typescript
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue-names';

export async function setupScheduler(connection: any) {
  const statsQueue = new Queue(QUEUE_NAMES.STATS_SYNC, { connection });
  const deliveryQueue = new Queue(QUEUE_NAMES.DELIVERY_SYNC, { connection });

  // Repeatable every 15 minutes
  await statsQueue.upsertJobScheduler('stats-sync-scheduler', {
    every: 15 * 60 * 1000,
  }, { name: 'sync-all-accounts' });

  // Repeatable every 5 minutes
  await deliveryQueue.upsertJobScheduler('delivery-sync-scheduler', {
    every: 5 * 60 * 1000,
  }, { name: 'sync-delivery-status' });

  console.log('Job schedulers registered');
}
```

#### stats-sync.processor.ts
```typescript
import { Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { MetaClient } from '../lib/meta-client';
import { mapInsightsToStats } from '../lib/stats-mapper';

export async function processStatsSyncJob(job: Job) {
  console.log(`[stats-sync] Starting job ${job.id}`);

  // 1. Get all active ad account connections
  const adAccounts = await prisma.fbConnection.findMany({
    where: { connectionType: 'AD_ACCOUNT', isActive: true },
    select: { id: true, sellerId: true, externalId: true, accessTokenEnc: true },
  });

  console.log(`[stats-sync] Found ${adAccounts.length} active ad accounts`);

  // 2. Date range: last 3 days (catch late-arriving data)
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

  // 3. Process each ad account
  for (const account of adAccounts) {
    try {
      const accessToken = MetaClient.decryptToken(account.accessTokenEnc);

      // Fetch campaign-level insights
      const insights = await MetaClient.getInsights(
        account.externalId, 'campaign', { dateFrom, dateTo }, accessToken
      );

      // Map and upsert
      for (const row of insights) {
        const stats = mapInsightsToStats(row, account.sellerId, 'CAMPAIGN');

        // Insert raw (append-only log)
        await prisma.adStatsRaw.create({ data: stats.raw });

        // Upsert daily (idempotent)
        await prisma.adStatsDaily.upsert({
          where: {
            sellerId_entityType_entityId_statDate: {
              sellerId: account.sellerId,
              entityType: 'CAMPAIGN',
              entityId: stats.entityId,
              statDate: stats.statDate,
            },
          },
          create: stats.daily,
          update: stats.daily,
        });
      }

      // Repeat for adset and ad levels
      // ... similar pattern with 'adset' and 'ad' levels

      console.log(`[stats-sync] Account ${account.externalId}: ${insights.length} rows synced`);
    } catch (err) {
      console.error(`[stats-sync] Account ${account.externalId} failed:`, err.message);
      // Continue to next account — don't let one failure stop all
    }
  }
}
```

#### stats-mapper.ts
```typescript
import { ACTION_TYPE_MAP, ACTION_VALUE_MAP } from './constants';

export function mapInsightsToStats(
  metaRow: MetaInsightsRow,
  sellerId: string,
  entityType: 'CAMPAIGN' | 'ADSET' | 'AD',
) {
  // Extract actions from Meta "actions" array
  const actions: Record<string, number> = {};
  for (const action of metaRow.actions || []) {
    const mapped = ACTION_TYPE_MAP[action.action_type];
    if (mapped) actions[mapped] = parseInt(action.value, 10);
  }

  // Extract action_values (monetary)
  const actionValues: Record<string, number> = {};
  for (const av of metaRow.action_values || []) {
    const mapped = ACTION_VALUE_MAP[av.action_type];
    if (mapped) actionValues[mapped] = parseFloat(av.value);
  }

  const base = {
    sellerId,
    entityType,
    entityId: /*resolve internal ID from externalId*/,
    externalEntityId: metaRow.campaign_id || metaRow.adset_id || metaRow.ad_id,
    dateStart: new Date(metaRow.date_start),
    dateStop: new Date(metaRow.date_stop),
    spend: parseFloat(metaRow.spend || '0'),
    impressions: parseInt(metaRow.impressions || '0', 10),
    cpm: parseFloat(metaRow.cpm || '0'),
    ctr: parseFloat(metaRow.ctr || '0'),
    cpc: parseFloat(metaRow.cpc || '0'),
    linkClicks: parseInt(metaRow.inline_link_clicks || '0', 10),
    contentViews: actions.contentViews || 0,
    addToCart: actions.addToCart || 0,
    checkoutInitiated: actions.checkoutInitiated || 0,
    purchases: actions.purchases || 0,
    purchaseValue: actionValues.purchaseValue || 0,
    costPerPurchase: 0, // computed: spend / purchases
    roas: 0,            // computed: purchaseValue / spend
  };

  // Compute derived
  if (base.purchases > 0) base.costPerPurchase = base.spend / base.purchases;
  if (base.spend > 0) base.roas = base.purchaseValue / base.spend;

  return {
    raw: { ...base, fetchedAt: new Date() },
    daily: { ...base, statDate: base.dateStart },
    entityId: base.entityId,
    statDate: base.dateStart,
  };
}
```

#### lib/prisma.ts
```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
```

**Dependencies:** Task 1.1 (schema verified), Task 1.2 (Meta API patterns)

**Acceptance criteria:**
- [ ] Worker starts and registers repeatable jobs for both queues
- [ ] Stats sync fetches from Meta → persists to AdStatsRaw + AdStatsDaily
- [ ] Duplicate runs for same date produce identical AdStatsDaily (idempotent upsert)
- [ ] Worker logs: job start, accounts processed, rows written, errors
- [ ] One account failure doesn't stop others
- [ ] Graceful shutdown on SIGINT/SIGTERM

---

### Task 1.4: Delivery Status Sync — 5-Minute Interval

**Effort:** 2 days

**Files to create:** `apps/worker/src/processors/delivery-sync.processor.ts` (listed in Task 1.3)

**Implementation:**

```typescript
export async function processDeliverySyncJob(job: Job) {
  // 1. Query all campaigns/adsets/ads with non-null externalId and status != DELETED
  const campaigns = await prisma.campaign.findMany({
    where: {
      externalCampaignId: { not: null },
      status: { not: 'DELETED' },
    },
    select: {
      id: true, sellerId: true, externalCampaignId: true,
      adAccount: { select: { id: true, accessTokenEnc: true, externalId: true } },
    },
  });

  // 2. For each: call Meta API for effective_status
  for (const campaign of campaigns) {
    try {
      const token = MetaClient.decryptToken(campaign.adAccount.accessTokenEnc);
      const { effectiveStatus } = await MetaClient.getEntityStatus(
        'campaign', campaign.externalCampaignId!, token
      );

      // 3. Map Meta effective_status → our DeliveryStatus
      const deliveryStatus = mapEffectiveStatus(effectiveStatus);

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { deliveryStatus },
      });
    } catch (err) {
      console.error(`[delivery-sync] Campaign ${campaign.id} failed:`, err.message);
    }
  }

  // 4. Repeat for adsets and ads (similar pattern)
}

function mapEffectiveStatus(metaStatus: string): string {
  const MAP: Record<string, string> = {
    'ACTIVE': 'ACTIVE',
    'PAUSED': 'INACTIVE',          // user-paused
    'CAMPAIGN_PAUSED': 'NOT_DELIVERING',
    'ADSET_PAUSED': 'NOT_DELIVERING',
    'IN_PROCESS': 'LEARNING',
    'WITH_ISSUES': 'ERROR',
    'PENDING_REVIEW': 'PENDING_REVIEW',
    'DISAPPROVED': 'ERROR',
    'ARCHIVED': 'INACTIVE',
  };
  return MAP[metaStatus] || 'UNKNOWN';
}
```

**Dependencies:** Task 1.2 (Meta API client), Task 1.1 (deliveryStatus field)

**Acceptance criteria:**
- [ ] Campaign/Adset/Ad `deliveryStatus` updates every 5 minutes
- [ ] Meta `effective_status` correctly mapped to our enum
- [ ] Entities without externalId are skipped (no error)
- [ ] One entity failure doesn't block others

---

### Task 1.5: Campaigns Module — CRUD + List Endpoint

**Effort:** 2 days

**Files to create:**
```
apps/api/src/campaigns/
├── campaigns.module.ts
├── campaigns.controller.ts
├── campaigns.service.ts
└── dto/
    ├── list-campaigns.dto.ts
    ├── create-campaign.dto.ts
    └── update-campaign.dto.ts
```

**Files to modify:**
- `apps/api/src/app.module.ts` — add `CampaignsModule` to imports

**Implementation:**

Follow `fb-connections` module pattern exactly.

#### campaigns.service.ts (key parts)
```typescript
// ─── Select shapes ──────────────────────────────────────────────────────────

const CAMPAIGN_CARD_SELECT = {
  id: true,
  name: true,
  status: true,
  deliveryStatus: true,
  budget: true,
  budgetType: true,
  startDate: true,
  endDate: true,
  externalCampaignId: true,
  createdAt: true,
  updatedAt: true,
  sellpage: { select: { id: true, name: true, slug: true } },
  adAccount: { select: { id: true, name: true, externalId: true } },
  adStrategy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(sellerId: string, query: ListCampaignsDto) {
    const limit = Math.min(query.limit || 20, 100);
    const where: any = { sellerId };

    // Filters
    if (query.status) where.status = query.status;
    if (query.deliveryStatus) where.deliveryStatus = query.deliveryStatus;
    if (query.sellpageId) where.sellpageId = query.sellpageId;
    if (query.adAccountId) where.adAccountId = query.adAccountId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    // Keyset cursor (follow orders pattern)
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        where.OR = [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { lt: decoded.id } },
        ];
      }
    }

    const rows = await this.prisma.campaign.findMany({
      where,
      select: CAMPAIGN_CARD_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
      : null;

    return { items: items.map(mapToDto), nextCursor };
  }

  async getCampaign(sellerId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, sellerId },
      select: CAMPAIGN_CARD_SELECT,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return mapToDto(campaign);
  }
}
```

#### list-campaigns.dto.ts
```typescript
import { IsOptional, IsString, IsUUID, IsIn, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListCampaignsDto {
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'])
  status?: string;

  @IsOptional() @IsString()
  deliveryStatus?: string;

  @IsOptional() @IsUUID()
  sellpageId?: string;

  @IsOptional() @IsUUID()
  adAccountId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  @IsOptional() @IsString() @Transform(({ value }) => value?.trim().slice(0, 100))
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  cursor?: string;
}
```

#### campaigns.controller.ts
```typescript
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCampaignsDto) {
    return this.service.listCampaigns(user.sellerId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCampaign(user.sellerId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.service.createCampaign(user.sellerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.updateCampaign(user.sellerId, id, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archiveCampaign(user.sellerId, id);
  }
}
```

**Dependencies:** Task 0.3 (types)

**Acceptance criteria:**
- [ ] All CRUD endpoints work with auth + tenant isolation
- [ ] List endpoint returns campaigns with related sellpage/adAccount names
- [ ] Keyset pagination functions correctly
- [ ] All 6 filters work (status, deliveryStatus, sellpageId, adAccountId, dateRange, search)
- [ ] E2E tests pass

---

### Task 1.6: Meta Sandbox Testing

**Effort:** 2-3 days

**No code files** — this is a validation task.

**Steps:**
1. Register PixEcom app on Meta for Developers portal
2. Apply for Marketing API Standard Access
3. Create test ad account with sandbox campaigns
4. Configure env vars: `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY`
5. Manually create FbConnection records with encrypted real tokens
6. Run stats sync worker → verify AdStatsDaily rows populated
7. Run delivery sync → verify deliveryStatus fields updated
8. Document any Meta API quirks in working log

**Dependencies:** Tasks 1.2, 1.3, 1.4

**Acceptance criteria:**
- [ ] Real Meta data flows into AdStatsRaw → AdStatsDaily
- [ ] Delivery statuses reflect sandbox campaign states
- [ ] All Meta error codes handled gracefully (log + continue)

---

### Task 1.7: Frontend Auth Wiring

**Effort:** 2-3 days

**Files to create:**
```
apps/web/src/
├── lib/
│   └── api-client.ts          ← Axios wrapper with interceptors
├── stores/
│   └── auth-store.ts          ← Zustand auth state
└── components/
    └── providers/
        └── auth-provider.tsx  ← Session hydration on app load
```

**Files to modify:**
- `apps/web/src/app/login/page.tsx` — real API call instead of `router.push`
- `apps/web/src/app/(portal)/layout.tsx` — wrap with AuthProvider
- `apps/web/src/app/layout.tsx` — add AuthProvider at root level

**Implementation:**

#### lib/api-client.ts
```typescript
import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,  // send cookies for refresh token
});

// ─── Request interceptor: attach Bearer token ──────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ─────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshed = await useAuthStore.getState().refreshToken();
      if (refreshed) {
        original.headers.Authorization =
          `Bearer ${useAuthStore.getState().accessToken}`;
        return apiClient(original);
      }
      // Refresh failed → redirect to login
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
```

#### stores/auth-store.ts
```typescript
import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import type { LoginResponse, AuthContextState } from '@pixecom/types';

interface AuthStore extends AuthContextState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  user: null,
  seller: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    set({
      accessToken: data.accessToken,
      user: data.user,
      seller: data.seller,
      isAuthenticated: true,
    });
  },

  logout: () => {
    apiClient.post('/auth/logout').catch(() => {});
    set({ accessToken: null, user: null, seller: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  refreshToken: async () => {
    try {
      const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh');
      set({ accessToken: data.accessToken });
      return true;
    } catch {
      return false;
    }
  },

  hydrate: async () => {
    set({ isLoading: true });
    try {
      const refreshed = await get().refreshToken();
      if (refreshed) {
        const { data } = await apiClient.get('/auth/me');
        set({ user: data.user, seller: data.seller, isAuthenticated: true });
      }
    } catch {
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

#### components/providers/auth-provider.tsx
```typescript
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { hydrate, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
```

#### Login page update (key changes only)
```typescript
// Replace: router.push('/dashboard')
// With:
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);
  try {
    await authStore.login(email, password);
    router.push('/dashboard');
  } catch (err) {
    setError('Invalid email or password');
  } finally {
    setLoading(false);
  }
};
```

**Dependencies:** Task 0.3 (auth types), backend auth endpoints (already exist)

**Acceptance criteria:**
- [ ] Login page calls `POST /api/auth/login` and receives JWT
- [ ] Token attached to all API requests via interceptor
- [ ] 401 triggers silent refresh via `POST /api/auth/refresh`
- [ ] Failed refresh redirects to `/login`
- [ ] Page reload preserves session (hydrate + refresh flow)
- [ ] Protected routes redirect to login if not authenticated

---

## PHASE 2 — FUNNEL & DECISION LAYER (Weeks 6-8)

**Objective:** Full metrics engine, summary row, wire frontend to real API.
**Total effort:** ~9 days

---

### Task 2.1: Extend Stats Sync with Full Funnel

**Effort:** 1 day

**Files to modify:**
- `apps/worker/src/lib/stats-mapper.ts` — ensure all action types extracted
- `apps/worker/src/processors/stats-sync.processor.ts` — add adset + ad level sync

**Implementation:**
1. Verify all fields from `ACTION_TYPE_MAP` are being extracted (contentViews, addToCart, checkoutInitiated, purchases)
2. Add adset-level and ad-level insights sync (same loop pattern as campaigns)
3. Resolve internal entity IDs from `externalAdsetId` / `externalAdId` before upserting
4. Handle missing entities gracefully (Meta may return ads not yet in our DB → log and skip)

**Dependencies:** Task 1.3 (stats sync running)

**Acceptance criteria:**
- [ ] AdStatsDaily rows have non-zero contentViews/addToCart/checkoutInitiated where Meta reports them
- [ ] All 3 entity types (campaign, adset, ad) produce AdStatsDaily rows
- [ ] purchaseValue correctly populated from action_values

---

### Task 2.2: Derived Metrics Engine

> **CORRECTION (2026-02-20):** CR formulas below are SUPERSEDED by [`METRICS-CONTRACT.md`](../METRICS-CONTRACT.md).
> - CR = `purchase / contentView` (NOT `purchases / linkClicks`)
> - CR1 = `checkout / contentView` (NOT `addToCart / contentViews`)
> - CR2 = `purchase / checkout` (NOT `purchases / addToCart`)
> - Implementation file moved to `apps/api/src/shared/utils/metrics.util.ts`
> - See [`TECH-SPEC-V1-ADDENDUM-2.3.X.md`](../TECH-SPEC-V1-ADDENDUM-2.3.X.md) for corrected code.

**Effort:** 1.5 days

**Files to create:**
- ~~`apps/api/src/campaigns/metrics.engine.ts`~~ → `apps/api/src/shared/utils/metrics.util.ts`

**Implementation:**

```typescript
import type { RawAggregates, DerivedMetrics } from '@pixecom/types';

// ─── Safe division helper ───────────────────────────────────────────────────
function safeDivide(numerator: number, denominator: number, scale = 2): number {
  if (denominator === 0) return 0;
  return parseFloat((numerator / denominator).toFixed(scale));
}

// ─── Compute derived metrics from raw aggregates ────────────────────────────
// ⚠️ OUTDATED — see METRICS-CONTRACT.md for corrected formulas
export function computeMetrics(raw: RawAggregates): DerivedMetrics {
  return {
    ...raw,
    cpm: safeDivide(raw.spend * 1000, raw.impressions, 2),
    ctr: safeDivide(raw.linkClicks * 100, raw.impressions, 4),
    cpc: safeDivide(raw.spend, raw.linkClicks, 2),
    cpv: safeDivide(raw.spend, raw.contentViews, 2),
    costPerAtc: safeDivide(raw.spend, raw.addToCart, 2),
    costPerCheckout: safeDivide(raw.spend, raw.checkoutInitiated, 2),
    costPerPurchase: safeDivide(raw.spend, raw.purchases, 2),
    roas: safeDivide(raw.purchaseValue, raw.spend, 2),
    results: raw.purchases,
    costPerResult: safeDivide(raw.spend, raw.purchases, 2),
    cr: safeDivide(raw.purchases * 100, raw.linkClicks, 2),
    cr1: safeDivide(raw.addToCart * 100, raw.contentViews, 2),
    cr2: safeDivide(raw.purchases * 100, raw.addToCart, 2),
  };
}

// ─── Compute summary row from array of derived metrics ──────────────────────
export function computeSummaryRow(rows: DerivedMetrics[]): DerivedMetrics {
  if (rows.length === 0) return computeMetrics(zeroAggregates());

  // SUM raw aggregates
  const sums: RawAggregates = rows.reduce((acc, row) => ({
    spend: acc.spend + row.spend,
    impressions: acc.impressions + row.impressions,
    linkClicks: acc.linkClicks + row.linkClicks,
    contentViews: acc.contentViews + row.contentViews,
    addToCart: acc.addToCart + row.addToCart,
    checkoutInitiated: acc.checkoutInitiated + row.checkoutInitiated,
    purchases: acc.purchases + row.purchases,
    purchaseValue: acc.purchaseValue + row.purchaseValue,
  }), zeroAggregates());

  // Recompute derived from aggregate sums (NOT average of averages)
  return computeMetrics(sums);
}

function zeroAggregates(): RawAggregates {
  return {
    spend: 0, impressions: 0, linkClicks: 0, contentViews: 0,
    addToCart: 0, checkoutInitiated: 0, purchases: 0, purchaseValue: 0,
  };
}
```

**Dependencies:** Task 0.3 (types)

**Acceptance criteria:**
- [ ] All 15 derived metrics compute correctly
- [ ] Zero-division returns 0 (not NaN or Infinity)
- [ ] Summary row uses aggregate sums, not average-of-averages
- [ ] Unit tests: zero data, single row, multiple rows, mixed zero/non-zero

---

### Task 2.3: Ads Manager API Endpoint

**Effort:** 2 days

**Files to create:**
- `apps/api/src/campaigns/dto/ads-manager-query.dto.ts`

**Files to modify:**
- `apps/api/src/campaigns/campaigns.controller.ts` — add `GET /api/campaigns/ads-manager`
- `apps/api/src/campaigns/campaigns.service.ts` — add `getAdsManagerData()` method

**Implementation:**

```typescript
// ─── Controller ─────────────────────────────────────────────────────────────
@Get('ads-manager')
getAdsManager(@CurrentUser() user: AuthUser, @Query() query: AdsManagerQueryDto) {
  return this.service.getAdsManagerData(user.sellerId, query);
}
```

```typescript
// ─── Service: getAdsManagerData ─────────────────────────────────────────────
async getAdsManagerData(sellerId: string, query: AdsManagerQueryDto) {
  const { level = 'campaign', dateFrom, dateTo } = query;

  // 1. Build entity WHERE clause
  const entityWhere: any = { sellerId };
  if (query.status) entityWhere.status = query.status;
  if (query.deliveryStatus) entityWhere.deliveryStatus = query.deliveryStatus;
  if (query.sellpageId) entityWhere.sellpageId = query.sellpageId;
  if (query.adAccountId) entityWhere.adAccountId = query.adAccountId;
  if (query.search) entityWhere.name = { contains: query.search, mode: 'insensitive' };

  // For drill-down levels
  if (level === 'adset' && query.campaignId) entityWhere.campaignId = query.campaignId;
  if (level === 'ad' && query.adsetId) entityWhere.adsetId = query.adsetId;

  // 2. Get entities
  const model = level === 'campaign' ? this.prisma.campaign
    : level === 'adset' ? this.prisma.adset
    : this.prisma.ad;

  const entities = await (model as any).findMany({
    where: entityWhere,
    select: level === 'campaign' ? CAMPAIGN_CARD_SELECT
      : level === 'adset' ? ADSET_CARD_SELECT
      : AD_CARD_SELECT,
  });

  // 3. Get aggregated stats for each entity in date range
  const entityIds = entities.map((e: any) => e.id);
  const statsRows = await this.prisma.adStatsDaily.groupBy({
    by: ['entityId'],
    where: {
      sellerId,
      entityType: level.toUpperCase() as any,
      entityId: { in: entityIds },
      statDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    },
    _sum: {
      spend: true, impressions: true, linkClicks: true,
      contentViews: true, addToCart: true, checkoutInitiated: true,
      purchases: true, purchaseValue: true,
    },
  });

  // 4. Merge entity + stats + compute derived metrics
  const statsMap = new Map(statsRows.map(s => [s.entityId, s._sum]));
  const rows = entities.map((entity: any) => {
    const raw = statsMap.get(entity.id) || zeroAggregates();
    return { ...mapToDto(entity), ...computeMetrics(toNumbers(raw)) };
  });

  // 5. Compute summary row
  const summary = computeSummaryRow(rows);

  return {
    rows,
    summary,
    meta: { dateFrom, dateTo, level, totalRows: rows.length },
  };
}
```

**Dependencies:** Task 2.2 (metrics engine), Task 1.5 (campaigns module)

**Acceptance criteria:**
- [ ] Endpoint returns campaigns with all 25+ metric columns
- [ ] Summary row matches manual calculation
- [ ] Date range filtering works correctly
- [ ] Drill-down: `level=adset&campaignId=X` returns adsets of campaign X
- [ ] Response time < 500ms for 100 campaigns × 30 days

---

### Task 2.4: Date Presets + Timezone Support

**Effort:** 1.5 days

**Files to create:**
```
apps/web/src/
├── lib/date-presets.ts
└── components/shared/date-range-picker.tsx
```

**Implementation:**

```typescript
// ─── lib/date-presets.ts ─────────────────────────────────────────────────────
export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last14'
  | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

export function getPresetRange(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case 'today': return { dateFrom: fmt(today), dateTo: fmt(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { dateFrom: fmt(y), dateTo: fmt(y) };
    }
    case 'last7': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }
    case 'last14': {
      const d = new Date(today); d.setDate(d.getDate() - 13);
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }
    case 'last30': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { dateFrom: fmt(d), dateTo: fmt(today) };
    }
    case 'thisMonth': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: fmt(first), dateTo: fmt(today) };
    }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { dateFrom: fmt(first), dateTo: fmt(last) };
    }
    default: return { dateFrom: fmt(today), dateTo: fmt(today) };
  }
}
```

```typescript
// ─── components/shared/date-range-picker.tsx ─────────────────────────────────
// Dropdown with preset buttons + custom date inputs
// Uses existing Input, Button, Badge components
// Emits { dateFrom, dateTo, preset } to parent via onChange callback
// Default preset: 'last7'
```

**Dependencies:** Task 2.3 (Ads Manager API accepts dateFrom/dateTo)

**Acceptance criteria:**
- [ ] All 8 date presets produce correct date ranges
- [ ] Custom date range allows manual input
- [ ] DateRangePicker component renders correctly in dark theme
- [ ] Default selection = Last 7 Days

---

### Task 2.5: Wire Frontend Ads Manager to Real API

**Effort:** 3 days

**Files to create:**
```
apps/web/src/
├── hooks/use-ads-manager.ts
└── components/ads-manager/
    ├── campaigns-table.tsx
    └── summary-row.tsx
```

**Files to modify:**
- `apps/web/src/app/(portal)/ads-manager/page.tsx` — full refactor

**Implementation:**

#### hooks/use-ads-manager.ts
```typescript
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { AdsManagerResponse, AdsManagerQuery } from '@pixecom/types';
import { getPresetRange } from '@/lib/date-presets';

export function useAdsManager() {
  const [data, setData] = useState<AdsManagerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdsManagerQuery>({
    level: 'campaign',
    ...getPresetRange('last7'),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<AdsManagerResponse>(
        '/campaigns/ads-manager',
        { params: filters },
      );
      setData(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, filters, setFilters, refetch: fetchData };
}
```

#### campaigns-table.tsx — 25+ columns
```typescript
// Column definitions (from competitor audit):
const COLUMNS = [
  { key: 'checkbox',           label: '',               width: 40 },
  { key: 'name',               label: 'Campaign',       width: 250 },
  { key: 'status',             label: 'Status',         width: 100 },
  { key: 'deliveryStatus',     label: 'Delivery',       width: 100 },
  { key: 'startDate',          label: 'Start Date',     width: 100 },
  { key: 'budget',             label: 'Budget/Day',     width: 90,  format: 'currency' },
  { key: 'spend',              label: 'Spent',          width: 90,  format: 'currency' },
  { key: 'roas',               label: 'ROAS',           width: 70,  format: 'decimal',  color: 'roas' },
  { key: 'results',            label: 'Results',        width: 80,  format: 'number' },
  { key: 'costPerResult',      label: 'CPR',            width: 80,  format: 'currency' },
  { key: 'cpm',                label: 'CPM',            width: 70,  format: 'currency' },
  { key: 'ctr',                label: 'CTR',            width: 60,  format: 'percent' },
  { key: 'linkClicks',         label: 'Clicks',         width: 80,  format: 'compact' },
  { key: 'cpc',                label: 'CPC',            width: 70,  format: 'currency' },
  { key: 'contentViews',       label: 'Views',          width: 80,  format: 'compact' },
  { key: 'cpv',                label: 'CPV',            width: 70,  format: 'currency' },
  { key: 'addToCart',           label: 'ATC',            width: 70,  format: 'compact' },
  { key: 'costPerAtc',         label: 'Cost/ATC',       width: 80,  format: 'currency' },
  { key: 'checkoutInitiated',  label: 'Checkouts',      width: 90,  format: 'compact' },
  { key: 'costPerCheckout',    label: 'Cost/CO',        width: 80,  format: 'currency' },
  { key: 'purchases',          label: 'Purchases',      width: 90,  format: 'compact' },
  { key: 'costPerPurchase',    label: 'CPP',            width: 80,  format: 'currency' },
  { key: 'purchaseValue',      label: 'Revenue',        width: 90,  format: 'currency' },
  { key: 'cr',                 label: 'CR',             width: 60,  format: 'percent' },
  { key: 'cr1',                label: 'CR1',            width: 60,  format: 'percent' },
  { key: 'cr2',                label: 'CR2',            width: 60,  format: 'percent' },
];
// Table uses horizontal scroll (overflow-x-auto) for wide content
// ROAS color coding: green >= 3, yellow >= 2, red < 2, grey = 0
```

#### summary-row.tsx
```typescript
// Renders at the bottom of the table
// Uses DerivedMetrics from API summary field
// Bold text, different background (bg-muted/50)
// First cell shows "N Campaigns" count
// Same column formatting as data rows
```

#### page.tsx refactor
```typescript
// REMOVE: import { mockCampaigns } from '@/mock/campaigns'
// REMOVE: import type { CampaignDto } from '@/mock/types'
// ADD:    import { useAdsManager } from '@/hooks/use-ads-manager'
// ADD:    import { CampaignsTable } from '@/components/ads-manager/campaigns-table'
// ADD:    import { SummaryRow } from '@/components/ads-manager/summary-row'
// ADD:    import { DateRangePicker } from '@/components/shared/date-range-picker'
// ADD:    import type { AdsManagerRow } from '@pixecom/types'

export default function AdsManagerPage() {
  const { data, loading, error, filters, setFilters, refetch } = useAdsManager();

  // Replace useMemo filtering with API-driven data
  // Keep KPI cards (compute from data.summary)
  // Add DateRangePicker to filter bar
  // Replace Table with CampaignsTable component
  // Add SummaryRow at bottom
}
```

**Dependencies:** Task 1.7 (auth wiring), Task 2.3 (API endpoint), Task 2.4 (DateRangePicker)

**Acceptance criteria:**
- [ ] Ads Manager loads real data from API (no mock imports)
- [ ] All 25+ columns render with correct formatting
- [ ] Summary row shows correct aggregates at table bottom
- [ ] ROAS color coding works (green/yellow/red)
- [ ] Loading spinner during data fetch
- [ ] Error state with retry button
- [ ] DateRangePicker preset changes trigger re-fetch

---

## PHASE 3 — CONTROL LAYER (Weeks 9-10)

**Objective:** Sellers can take action — pause/activate, drill down, filter.
**Total effort:** ~7.5 days

---

### Task 3.1: Bulk Status Update

**Effort:** 2.5 days

**Files to create:**
```
apps/api/src/campaigns/dto/bulk-update.dto.ts
apps/web/src/components/ads-manager/bulk-actions-bar.tsx
```

**Files to modify:**
- `apps/api/src/campaigns/campaigns.controller.ts` — add `PATCH /api/campaigns/bulk-status`
- `apps/api/src/campaigns/campaigns.service.ts` — add `bulkUpdateStatus()` method
- `apps/web/src/components/ads-manager/campaigns-table.tsx` — add checkbox column
- `apps/web/src/app/(portal)/ads-manager/page.tsx` — integrate bulk selection state

**Implementation:**

#### Backend

```typescript
// ─── DTO ─────────────────────────────────────────────────────────────────────
export class BulkUpdateDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsUUID('4', { each: true })
  ids: string[];

  @IsIn(['PAUSE', 'ACTIVATE'])
  action: 'PAUSE' | 'ACTIVATE';
}

// ─── Service ─────────────────────────────────────────────────────────────────
async bulkUpdateStatus(sellerId: string, dto: BulkUpdateDto) {
  // 1. Verify all IDs belong to this seller
  const campaigns = await this.prisma.campaign.findMany({
    where: { id: { in: dto.ids }, sellerId },
    select: {
      id: true, externalCampaignId: true,
      adAccount: { select: { id: true, accessTokenEnc: true } },
    },
  });

  if (campaigns.length !== dto.ids.length) {
    throw new NotFoundException('One or more campaigns not found');
  }

  // 2. Update each on Meta + local DB
  const metaStatus = dto.action === 'PAUSE' ? 'PAUSED' : 'ACTIVE';
  const results = await Promise.allSettled(
    campaigns.map(async (campaign) => {
      if (campaign.externalCampaignId) {
        const token = this.metaAuth.decryptToken(campaign.adAccount.accessTokenEnc);
        await this.metaApi.updateEntityStatus(
          campaign.externalCampaignId, metaStatus, token
        );
      }
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: metaStatus },
      });
      return campaign.id;
    }),
  );

  // 3. Categorize results
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') succeeded.push(r.value);
    else failed.push({ id: dto.ids[i], error: r.reason?.message || 'Unknown error' });
  });

  return { succeeded, failed };
}

// ─── Controller ──────────────────────────────────────────────────────────────
@Patch('bulk-status')
bulkUpdate(@CurrentUser() user: AuthUser, @Body() dto: BulkUpdateDto) {
  return this.service.bulkUpdateStatus(user.sellerId, dto);
}
```

#### Frontend

```typescript
// ─── bulk-actions-bar.tsx ────────────────────────────────────────────────────
// Floating bar appears when selectedIds.length > 0
// Shows: "{N} selected" + "Pause" button + "Activate" button
// On click: call PATCH /api/campaigns/bulk-status
// On success: show toast "N campaigns paused/activated"
// On partial failure: show toast "N succeeded, M failed"
// After action: clear selection + refetch table data
```

**Dependencies:** Task 1.2 (Meta API updateEntityStatus), Task 2.5 (wired table)

**Acceptance criteria:**
- [ ] Checkbox column in table (header = select all)
- [ ] Selecting campaigns shows floating action bar
- [ ] "Pause" sends bulk request → updates Meta + local DB
- [ ] "Activate" sends bulk request → updates Meta + local DB
- [ ] Toast shows success/failure count
- [ ] Failed individual updates don't block others (Promise.allSettled)
- [ ] Table refetches after action completes

---

### Task 3.2: Drill-Down Views (Campaign → Adset → Ad)

**Effort:** 3 days

**Files to create:**
```
apps/api/src/adsets/
├── adsets.module.ts
├── adsets.controller.ts
├── adsets.service.ts
└── dto/list-adsets.dto.ts

apps/api/src/ads/
├── ads.module.ts
├── ads.controller.ts
├── ads.service.ts
└── dto/list-ads.dto.ts

apps/web/src/components/ads-manager/level-tabs.tsx
```

**Files to modify:**
- `apps/api/src/app.module.ts` — add `AdsetsModule`, `AdsModule`
- `apps/web/src/app/(portal)/ads-manager/page.tsx` — add tab navigation + drill-down

**Implementation:**

#### Backend (Adsets module — follow identical pattern as Campaigns)
```typescript
// ─── Controller ──────────────────────────────────────────────────────────────
@Controller('adsets')
@UseGuards(JwtAuthGuard)
export class AdsetsController {
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdsetsDto,  // requires campaignId
  ) {
    return this.service.listAdsets(user.sellerId, query);
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────
// Select shape: id, name, status, deliveryStatus, optimizationGoal, targeting, createdAt
// Required filter: campaignId (IsUUID, not optional)
// Join stats from AdStatsDaily where entityType = 'ADSET'
// Compute derived metrics using computeMetrics()
// Return { rows, summary }
```

#### Backend (Ads module — same pattern)
```typescript
// Required filter: adsetId (IsUUID, not optional)
// Join stats from AdStatsDaily where entityType = 'AD'
```

#### Frontend drill-down
```typescript
// ─── level-tabs.tsx ──────────────────────────────────────────────────────────
// Three tabs: Campaigns | Ad Sets | Ads
// State: { level, parentId, breadcrumb[] }
// Breadcrumb: "All Campaigns" → "Campaign Name" → "Adset Name"

// ─── page.tsx integration ────────────────────────────────────────────────────
// Click campaign row → setLevel('adset'), setCampaignId(id)
// Click adset row → setLevel('ad'), setAdsetId(id)
// Breadcrumb click → go back to parent level
// Each level reuses same table component but with level-specific columns
// Summary row recomputes per level
```

**Dependencies:** Task 2.5 (wired Ads Manager), Task 2.3 (API supports level param)

**Acceptance criteria:**
- [ ] `GET /api/adsets?campaignId=X` returns adsets with stats
- [ ] `GET /api/ads?adsetId=X` returns ads with stats
- [ ] Clicking campaign row drills down to adsets
- [ ] Clicking adset row drills down to ads
- [ ] Breadcrumb navigation for going back
- [ ] Each level shows correct derived metrics + summary row

---

### Task 3.3: Filter System — 6 Filters

**Effort:** 2 days

**Files to create:**
```
apps/web/src/
├── components/ads-manager/filter-panel.tsx
└── hooks/use-ads-filters.ts
```

**Files to modify:**
- `apps/web/src/app/(portal)/ads-manager/page.tsx` — integrate filter panel

**Implementation:**

#### Filter definitions

| # | Filter | Component | API Param | Data Source |
|---|--------|-----------|-----------|-------------|
| 1 | Sellpage | Select dropdown | `sellpageId` | `GET /api/sellpages` (existing) |
| 2 | Campaign Status | Multi-select | `status` | Enum: ACTIVE, PAUSED, ARCHIVED |
| 3 | Delivery Status | Multi-select | `deliveryStatus` | Enum: ACTIVE, INACTIVE, LEARNING, ERROR, LIMITED |
| 4 | Date Range | DateRangePicker | `dateFrom`, `dateTo` | Task 2.4 component |
| 5 | Ad Account | Select dropdown | `adAccountId` | `GET /api/fb/connections?connectionType=AD_ACCOUNT` |
| 6 | Campaign Select | Multi-select | `campaignIds` | `GET /api/campaigns` (name + id list) |

#### use-ads-filters.ts
```typescript
// Manages all 6 filter states
// Syncs to URL query params (shareable/bookmarkable)
// Deserializes from URL on mount
// clearAll() resets to defaults (date = last7, rest = null)
// updateFilter(key, value) triggers re-render
// Serializes active filters for API request
```

#### filter-panel.tsx
```typescript
// Horizontal filter bar below page header
// Each filter: Select or multi-select dropdown using existing <Select> component
// "Clear All" button (visible when any filter active)
// Active filter count badge
// Filter options loaded on mount via API
// Compact layout: 6 filters in a flex row with wrap
```

**Dependencies:** Task 2.5 (wired Ads Manager), Task 2.4 (DateRangePicker)

**Acceptance criteria:**
- [ ] All 6 filters render and function
- [ ] Filter selection triggers API re-fetch
- [ ] Filters persist in URL (shareable)
- [ ] "Clear All" resets to defaults
- [ ] Filter combination = AND logic
- [ ] Filter options load dynamically from API (sellpages, ad accounts, campaigns)

---

## PHASE 4+ — CREATIVE INTELLIGENCE (Optional)

> **This phase is post-validation scope.** No implementation tasks defined.
> Implement only after Phase 3 is validated with real sellers.

**Prerequisites already in place from earlier phases:**
- Creative model + CRUD (8 endpoints — fully implemented)
- CampaignCreative join table (schema exists)
- Asset system (dual: legacy + new — fully implemented)
- Per-asset stats via AdStatsDaily (Phase 2)

**Potential Phase 4 features:**
- Filter by media/adtext/thumbnail version
- Creative performance ranking
- One Post ID logic (share post across campaigns)
- A/B test tracking
- Advanced strategy templates

---

## APPENDIX A: COMPLETE NEW FILE REGISTRY

### apps/api/src/ (NEW — 20 files)
```
meta/
├── meta.module.ts
├── meta-api.service.ts
├── meta-auth.service.ts
├── meta-rate-limiter.ts
├── meta.types.ts
├── meta.constants.ts
└── meta-error.mapper.ts

campaigns/
├── campaigns.module.ts
├── campaigns.controller.ts
├── campaigns.service.ts
├── metrics.engine.ts
└── dto/
    ├── list-campaigns.dto.ts
    ├── create-campaign.dto.ts
    ├── update-campaign.dto.ts
    ├── ads-manager-query.dto.ts
    └── bulk-update.dto.ts

adsets/
├── adsets.module.ts
├── adsets.controller.ts
├── adsets.service.ts
└── dto/list-adsets.dto.ts

ads/
├── ads.module.ts
├── ads.controller.ts
├── ads.service.ts
└── dto/list-ads.dto.ts
```

### apps/worker/src/ (NEW — 7 files)
```
processors/
├── stats-sync.processor.ts
└── delivery-sync.processor.ts

queues/
├── queue-names.ts
└── scheduler.ts

lib/
├── prisma.ts
├── meta-client.ts
└── stats-mapper.ts
```

### apps/web/src/ (NEW — 11 files)
```
lib/
├── api-client.ts
└── date-presets.ts

stores/
└── auth-store.ts

hooks/
├── use-ads-manager.ts
└── use-ads-filters.ts

components/
├── providers/
│   └── auth-provider.tsx
├── shared/
│   └── date-range-picker.tsx
└── ads-manager/
    ├── campaigns-table.tsx
    ├── summary-row.tsx
    ├── filter-panel.tsx
    ├── bulk-actions-bar.tsx
    └── level-tabs.tsx
```

### packages/types/src/ (NEW — 6 files)
```
enums.ts
campaigns.ts
stats.ts
ads-manager.ts
auth.ts
fb-connections.ts
```

**TOTAL: ~44 new files**

---

## APPENDIX B: MODIFIED FILES REGISTRY

| File | Phase | Task | Change |
|------|-------|------|--------|
| `.env` / `.env.example` | 0 | 0.1, 0.2 | Update DATABASE_URL, REDIS_URL |
| `packages/types/src/index.ts` | 0 | 0.3 | Re-export all new type modules |
| `packages/types/src/api.ts` | 0 | 0.3 | Add ApiSuccessResponse<T> |
| `apps/api/src/app.module.ts` | 1, 3 | 1.2, 1.5, 3.2 | Add MetaModule, CampaignsModule, AdsetsModule, AdsModule |
| `apps/worker/src/main.ts` | 1 | 1.3 | Replace placeholder with real queue setup |
| `apps/web/src/app/login/page.tsx` | 1 | 1.7 | Real API call instead of router.push |
| `apps/web/src/app/layout.tsx` | 1 | 1.7 | Add AuthProvider wrapper |
| `apps/web/src/app/(portal)/layout.tsx` | 1 | 1.7 | Add auth guard check |
| `apps/web/src/app/(portal)/ads-manager/page.tsx` | 2, 3 | 2.5, 3.1, 3.2, 3.3 | Full refactor: real API, 25+ cols, tabs, filters, bulk |

---

## APPENDIX C: NEW ENVIRONMENT VARIABLES

| Variable | App | Required | Example |
|----------|-----|----------|---------|
| `DATABASE_URL` | api, worker | ✅ | `postgresql://user:pass@host:25060/pixecom?connection_limit=20&sslmode=require` |
| `REDIS_URL` | worker | ✅ | `rediss://user:pass@host:25061` |
| `META_APP_ID` | api | Phase 1+ | `123456789` |
| `META_APP_SECRET` | api | Phase 1+ | `abcdef123456` |
| `META_TOKEN_ENCRYPTION_KEY` | api, worker | Phase 1+ | 32-byte hex string for AES-256-GCM |
| `NEXT_PUBLIC_API_URL` | web | ✅ | `http://localhost:3001` (dev) / `https://api.pixecom.io` (prod) |

---

## APPENDIX D: DEPENDENCY INSTALLATION

```bash
# apps/web — add axios for API client
pnpm --filter web add axios

# apps/api — no new deps needed (uses native fetch or existing http)
# If choosing axios over native fetch:
pnpm --filter api add axios

# apps/worker — no new deps (bullmq, ioredis already installed)
# packages/types — no deps needed (pure TypeScript interfaces)
```

---

## APPENDIX E: TASK DEPENDENCY GRAPH

```
Phase 0 (Week 1) ─ all parallel:
  Task 0.1 (DB)  ─────────────────────┐
  Task 0.2 (Redis) ───────────────────┤
  Task 0.3 (Types) ───────────────────┤
                                       ▼
Phase 1 (Weeks 2-5):
  Task 1.1 (Schema verify) ← 0.1     ─┐
  Task 1.2 (Meta API) ← 0.3          ─┤
  Task 1.5 (Campaigns CRUD) ← 0.3    ─┤
  Task 1.7 (Frontend auth) ← 0.3     ─┤── can run in parallel
                                       │
  Task 1.3 (Stats sync) ← 1.1 + 1.2  ─┤── needs Meta API + schema
  Task 1.4 (Delivery sync) ← 1.2     ─┤── needs Meta API
  Task 1.6 (Sandbox test) ← 1.3 + 1.4 ┘── needs workers running

Phase 2 (Weeks 6-8):
  Task 2.1 (Extend sync) ← 1.3       ─┐
  Task 2.2 (Metrics engine) ← 0.3    ─┤── can run in parallel
  Task 2.3 (Ads Manager API) ← 2.2, 1.5
  Task 2.4 (DatePicker) ← standalone  ─┤
  Task 2.5 (Wire frontend) ← 1.7, 2.3, 2.4 ── needs auth + API + DatePicker

Phase 3 (Weeks 9-10):
  Task 3.1 (Bulk update) ← 1.2, 2.5  ─┐
  Task 3.2 (Drill-down) ← 2.5       ─┤── can partially parallel
  Task 3.3 (Filters) ← 2.5, 2.4     ─┘
```

---

## APPENDIX F: EFFORT SUMMARY

| Phase | Tasks | Backend Days | Frontend Days | Total Days |
|-------|-------|:------------:|:-------------:|:----------:|
| Phase 0 | 0.1-0.3 | 0.5 | 0 | 1.5 (+1 types) |
| Phase 1 | 1.1-1.7 | 10.5 | 2.5 | 15.5 |
| Phase 2 | 2.1-2.5 | 4.5 | 4.5 | 9 |
| Phase 3 | 3.1-3.3 | 4.5 | 3 | 7.5 |
| **TOTAL** | **18 tasks** | **20** | **10** | **33.5 days** |

> With 1 dev working full-time: **~7 weeks** (matching 10-11 week timeline with buffer & testing).
> With 2 devs (1 backend + 1 frontend from Phase 2): **~5-6 weeks**.

---

*Technical Specification v1 — Generated 2026-02-20*
*PixEcom v2 CTO Audit Series — For Tech Lead Agent implementation*
