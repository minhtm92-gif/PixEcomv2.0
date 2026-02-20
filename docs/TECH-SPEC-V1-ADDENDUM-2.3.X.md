# PIXECOM v2 — TECH SPEC ADDENDUM: Milestone 2.3.X

> **Date:** 2026-02-20
> **Author:** CTO
> **Base Document:** `docs/audit/TECH-SPEC-V1.md`
> **Cross-references:** `docs/METRICS-CONTRACT.md`, `docs/working-logs/WORKING-LOGS-INDEX.md`
> **Status:** APPROVED — Ready for implementation

---

## Milestone Name

**2.3.X — Ads Manager Full Read Layer + Store Funnel Join + Orders Tracking Upgrade**

---

## 0. Context & Motivation

The current codebase has:
- Campaign/Adset/Ad Prisma models (schema only, no ads-manager service)
- `ad_stats_daily` table with Meta ad metrics (ingested via Stats Worker)
- `sellpage_stats_daily` table with funnel metrics (cr1/cr2/cr3)
- Orders module (read-only, 2 endpoints, 241 E2E tests)
- Asset/Creative layer (complete)
- Metrics engine spec in TECH-SPEC-V1 Task 2.2 using `linkClicks` for CR (INCORRECT)

**Problems this milestone solves:**

1. **CR formula was wrong.** CR was defined as `purchases / linkClicks`. Corrected to `purchases / contentView` per METRICS-CONTRACT.md.
2. **No unified Ads Manager read layer.** Campaign/Adset/Ad stats, store funnel, and revenue live in separate tables with no join service.
3. **UTM attribution not standardized.** No enforced mapping from utm_campaign/utm_term/utm_content to campaignId/adsetId/adId.
4. **Orders lack transactionId exposure.** `paymentId` exists in schema but is excluded from API response.
5. **No tracking refresh mechanism.** Tracking status is static once set — no 17track integration.

---

## 1. PART 1 — Metrics Contract Freeze (CR Logic Correction)

**File created:** `docs/METRICS-CONTRACT.md`

**Key corrections from TECH-SPEC-V1 Task 2.2:**

| Metric | OLD Formula (TECH-SPEC-V1) | NEW Formula (METRICS-CONTRACT) |
|--------|---------------------------|-------------------------------|
| CR | `purchases / linkClicks * 100` | `purchases / contentView * 100` |
| CR1 | `addToCart / contentViews * 100` | `checkout / contentView * 100` |
| CR2 | `purchases / addToCart * 100` | `purchase / checkout * 100` |

**Rationale:** CR measures store funnel efficiency (content view to purchase), not ad-click-through to purchase. Using `linkClicks` conflated two different funnels.

**Impact on existing code:**

| File | Change Required |
|------|----------------|
| `packages/types/src/stats.ts` (not yet created) | Update `DerivedMetrics` interface — `cr` uses contentViews, not linkClicks |
| `apps/api/src/campaigns/metrics.engine.ts` (not yet created) | Update `computeMetrics()` — CR formulas per METRICS-CONTRACT |
| Frontend mock data | Update any hardcoded CR calculations |

**New file to create:**

```
apps/api/src/shared/utils/metrics.util.ts
```

```typescript
/**
 * Safe division. Returns 0 when denominator is 0 or falsy.
 * All metric derivation MUST use this function.
 * @see docs/METRICS-CONTRACT.md Section 4
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

/** Raw count aggregates — the building blocks for all derived metrics. */
export interface RawAggregates {
  spend: number;
  impressions: number;
  clicks: number;        // = link_clicks (Meta inline_link_clicks)
  contentView: number;
  checkout: number;      // = checkout_initiated
  purchase: number;      // = purchases
  revenue: number;       // = purchase_value
}

/** All derived metrics, computed from RawAggregates via computeMetrics(). */
export interface DerivedMetrics extends RawAggregates {
  ctr: number;              // clicks / impressions * 100
  cpc: number;              // spend / clicks
  cpm: number;              // spend / impressions * 1000
  costPerContentView: number; // spend / contentView
  costPerCheckout: number;  // spend / checkout
  costPerPurchase: number;  // spend / purchase
  cr1: number;              // checkout / contentView * 100
  cr2: number;              // purchase / checkout * 100
  cr: number;               // purchase / contentView * 100
  roas: number;             // revenue / spend
  conv: number;             // = purchase (alias)
}

/**
 * Compute all derived metrics from raw aggregates.
 * @see docs/METRICS-CONTRACT.md Section 3
 */
export function computeMetrics(raw: RawAggregates): DerivedMetrics {
  return {
    ...raw,
    ctr: safeDivide(raw.clicks, raw.impressions) * 100,
    cpc: safeDivide(raw.spend, raw.clicks),
    cpm: safeDivide(raw.spend, raw.impressions) * 1000,
    costPerContentView: safeDivide(raw.spend, raw.contentView),
    costPerCheckout: safeDivide(raw.spend, raw.checkout),
    costPerPurchase: safeDivide(raw.spend, raw.purchase),
    cr1: safeDivide(raw.checkout, raw.contentView) * 100,
    cr2: safeDivide(raw.purchase, raw.checkout) * 100,
    cr: safeDivide(raw.purchase, raw.contentView) * 100,
    roas: safeDivide(raw.revenue, raw.spend),
    conv: raw.purchase,
  };
}

/**
 * Compute summary row from array of DerivedMetrics.
 * Aggregates raw counts first, then derives — NEVER averages ratios.
 * @see docs/METRICS-CONTRACT.md Section 5
 */
export function computeSummaryRow(rows: DerivedMetrics[]): DerivedMetrics {
  if (rows.length === 0) return computeMetrics(zeroRaw());

  const sums: RawAggregates = rows.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      contentView: acc.contentView + row.contentView,
      checkout: acc.checkout + row.checkout,
      purchase: acc.purchase + row.purchase,
      revenue: acc.revenue + row.revenue,
    }),
    zeroRaw(),
  );

  return computeMetrics(sums);
}

export function zeroRaw(): RawAggregates {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    contentView: 0,
    checkout: 0,
    purchase: 0,
    revenue: 0,
  };
}
```

---

## 2. PART 2 — Ads Manager 3-Level Join Layer (AdsManagerReadService)

### 2.1 Architecture

```
                 ┌────────────────────┐
                 │  AdsManagerController  │
                 └──────────┬─────────┘
                            │ GET /api/ads-manager/campaigns
                            │ GET /api/ads-manager/adsets
                            │ GET /api/ads-manager/ads
                            ▼
                 ┌────────────────────┐
                 │ AdsManagerReadService │  ← ALL metric logic lives here
                 └──────────┬─────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ campaigns│      │ad_stats_ │      │  orders  │
   │ adsets   │      │  daily   │      │ (revenue)│
   │ ads      │      │          │      │          │
   └──────────┘      └──────────┘      └──────────┘
   Entity metadata   Ad platform       Store funnel
   + status          metrics           + revenue
```

### 2.2 Files to Create

```
apps/api/src/ads-manager/
├── ads-manager.module.ts
├── ads-manager.controller.ts
├── ads-manager.service.ts              ← AdsManagerReadService
└── dto/
    ├── ads-manager-query.dto.ts
    └── ads-manager-response.dto.ts
```

### 2.3 Module Registration

**File to modify:** `apps/api/src/app.module.ts`

Add `AdsManagerModule` to imports array.

### 2.4 DTOs

#### ads-manager-query.dto.ts

```typescript
import { IsOptional, IsString, IsUUID, IsIn, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class AdsManagerQueryDto {
  @IsOptional() @IsDateString()
  dateFrom?: string; // default: today

  @IsOptional() @IsDateString()
  dateTo?: string; // default: today

  @IsOptional() @IsUUID()
  sellpageId?: string;

  @IsOptional() @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'])
  status?: string;

  @IsOptional() @IsString()
  deliveryStatus?: string;

  @IsOptional() @IsUUID()
  adAccountId?: string;

  @IsOptional() @IsString() @Transform(({ value }) => value?.trim().slice(0, 100))
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  cursor?: string;
}

export class AdsManagerAdsetsQueryDto extends AdsManagerQueryDto {
  @IsUUID()
  campaignId: string; // required for adset drilldown
}

export class AdsManagerAdsQueryDto extends AdsManagerQueryDto {
  @IsUUID()
  adsetId: string; // required for ad drilldown
}
```

### 2.5 Controller

```typescript
@Controller('ads-manager')
@UseGuards(JwtAuthGuard)
export class AdsManagerController {
  constructor(private readonly service: AdsManagerReadService) {}

  @Get('campaigns')
  getCampaigns(@CurrentUser() user: AuthUser, @Query() query: AdsManagerQueryDto) {
    return this.service.getCampaigns(user.sellerId, query);
  }

  @Get('adsets')
  getAdsets(@CurrentUser() user: AuthUser, @Query() query: AdsManagerAdsetsQueryDto) {
    return this.service.getAdsets(user.sellerId, query);
  }

  @Get('ads')
  getAds(@CurrentUser() user: AuthUser, @Query() query: AdsManagerAdsQueryDto) {
    return this.service.getAds(user.sellerId, query);
  }
}
```

### 2.6 AdsManagerReadService — Core Logic

```typescript
@Injectable()
export class AdsManagerReadService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Campaign Level ─────────────────────────────────────────────────

  async getCampaigns(sellerId: string, query: AdsManagerQueryDto) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);

    // 1. Fetch campaign entities with metadata
    const where = this.buildCampaignWhere(sellerId, query);
    const campaigns = await this.prisma.campaign.findMany({
      where,
      select: CAMPAIGN_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    // 2. Aggregate ad_stats_daily by campaignId for date range
    const campaignIds = campaigns.map(c => c.id);
    const statsMap = await this.aggregateStats(
      sellerId, 'CAMPAIGN', campaignIds, dateFrom, dateTo,
    );

    // 3. Aggregate store revenue from orders (UTM-attributed)
    const revenueMap = await this.aggregateRevenue(
      sellerId, campaignIds, 'campaign', dateFrom, dateTo,
    );

    // 4. Merge + compute derived metrics
    const rows = campaigns.map(c => {
      const adStats = statsMap.get(c.id) ?? zeroRaw();
      const revenue = revenueMap.get(c.id) ?? { purchase: 0, revenue: 0 };

      // Merge: ad stats provide spend/impressions/clicks/contentView/checkout
      // Orders provide purchase count + revenue (overrides Meta pixel if available)
      const raw: RawAggregates = {
        spend: adStats.spend,
        impressions: adStats.impressions,
        clicks: adStats.clicks,
        contentView: adStats.contentView,
        checkout: adStats.checkout,
        purchase: revenue.purchase || adStats.purchase,
        revenue: revenue.revenue || adStats.revenue,
      };

      return {
        ...this.mapCampaignRow(c),
        ...computeMetrics(raw),
      };
    });

    // 5. Summary row
    const summary = computeSummaryRow(rows);

    return {
      rows,
      summary,
      meta: { dateFrom, dateTo, level: 'campaign', totalRows: rows.length },
    };
  }

  // ─── Adset Level ────────────────────────────────────────────────────

  async getAdsets(sellerId: string, query: AdsManagerAdsetsQueryDto) {
    // Same pattern as getCampaigns but:
    // - WHERE includes campaignId filter (required)
    // - entityType = 'ADSET'
    // - Select shape = ADSET_SELECT
    // - Revenue attribution via utm_term = as_<adsetId>
  }

  // ─── Ad Level ───────────────────────────────────────────────────────

  async getAds(sellerId: string, query: AdsManagerAdsQueryDto) {
    // Same pattern but:
    // - WHERE includes adsetId filter (required)
    // - entityType = 'AD'
    // - Select shape = AD_SELECT
    // - Revenue attribution via utm_content = a_<adId>
  }

  // ─── Private: Stats Aggregation ─────────────────────────────────────

  private async aggregateStats(
    sellerId: string,
    entityType: 'CAMPAIGN' | 'ADSET' | 'AD',
    entityIds: string[],
    dateFrom: string,
    dateTo: string,
  ): Promise<Map<string, RawAggregates>> {
    if (entityIds.length === 0) return new Map();

    const rows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: {
        sellerId,
        entityType,
        entityId: { in: entityIds },
        statDate: {
          gte: new Date(`${dateFrom}T00:00:00.000Z`),
          lte: new Date(`${dateTo}T23:59:59.999Z`),
        },
      },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
        contentViews: true,
        checkoutInitiated: true,
        purchases: true,
        purchaseValue: true,
      },
    });

    const map = new Map<string, RawAggregates>();
    for (const row of rows) {
      map.set(row.entityId, {
        spend: Number(row._sum.spend ?? 0),
        impressions: row._sum.impressions ?? 0,
        clicks: row._sum.linkClicks ?? 0,
        contentView: row._sum.contentViews ?? 0,
        checkout: row._sum.checkoutInitiated ?? 0,
        purchase: row._sum.purchases ?? 0,
        revenue: Number(row._sum.purchaseValue ?? 0),
      });
    }
    return map;
  }

  // ─── Private: Revenue Attribution via UTM ───────────────────────────

  private async aggregateRevenue(
    sellerId: string,
    entityIds: string[],
    level: 'campaign' | 'adset' | 'ad',
    dateFrom: string,
    dateTo: string,
  ): Promise<Map<string, { purchase: number; revenue: number }>> {
    // Query orders table WHERE:
    //   sellerId = sellerId
    //   createdAt BETWEEN dateFrom AND dateTo
    //   utmCampaign/utmTerm/utmContent matches entity IDs
    //
    // Group by the appropriate UTM field, SUM(total) as revenue, COUNT as purchase.
    //
    // UTM mapping:
    //   campaign level → utmCampaign = 'c_<campaignId>'
    //   adset level    → utmTerm     = 'as_<adsetId>'
    //   ad level       → utmContent  = 'a_<adId>'
    //
    // Returns Map<entityId, { purchase, revenue }>
    //
    // NOTE: This requires UTM fields on Order model. See Migration Plan (Part 5).
    // Until UTM fields exist, fall back to ad_stats_daily purchaseValue.

    return new Map(); // Stub — implemented in migration
  }

  // ─── Private: Helpers ───────────────────────────────────────────────

  private resolveDateRange(query: { dateFrom?: string; dateTo?: string }) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      dateFrom: query.dateFrom ?? today,
      dateTo: query.dateTo ?? today,
    };
  }

  private buildCampaignWhere(sellerId: string, query: AdsManagerQueryDto) {
    const where: Record<string, unknown> = { sellerId };
    if (query.status) where['status'] = query.status;
    if (query.deliveryStatus) where['deliveryStatus'] = query.deliveryStatus;
    if (query.sellpageId) where['sellpageId'] = query.sellpageId;
    if (query.adAccountId) where['adAccountId'] = query.adAccountId;
    if (query.search) where['name'] = { contains: query.search, mode: 'insensitive' };
    return where;
  }

  private mapCampaignRow(c: any) {
    return {
      id: c.id,
      name: c.name,
      platform: 'META',
      status: c.status,
      deliveryStatus: c.deliveryStatus,
      budgetPerDay: c.budgetType === 'DAILY' ? Number(c.budget) : null,
      sellpage: c.sellpage ? { id: c.sellpage.id, name: c.sellpage.titleOverride ?? c.sellpage.slug } : null,
      adAccount: c.adAccount ? { id: c.adAccount.id, name: c.adAccount.name } : null,
      createdAt: c.createdAt,
    };
  }
}
```

### 2.7 Select Shapes

```typescript
const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  status: true,
  deliveryStatus: true,
  budget: true,
  budgetType: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  sellpage: { select: { id: true, slug: true, titleOverride: true } },
  adAccount: { select: { id: true, name: true, externalId: true } },
} as const;

const ADSET_SELECT = {
  id: true,
  name: true,
  status: true,
  deliveryStatus: true,
  optimizationGoal: true,
  campaignId: true,
  createdAt: true,
  campaign: { select: { id: true, name: true, budget: true, budgetType: true } },
} as const;

const AD_SELECT = {
  id: true,
  name: true,
  status: true,
  deliveryStatus: true,
  adsetId: true,
  createdAt: true,
  adset: {
    select: {
      id: true,
      name: true,
      campaign: { select: { id: true, name: true } },
    },
  },
} as const;
```

### 2.8 Response Shape (per row)

Every row returned by any of the 3 endpoints contains:

```typescript
interface AdsManagerRow {
  // Identity
  id: string;
  name: string;
  platform: 'META';
  status: string;
  deliveryStatus: string | null;
  budgetPerDay: number | null;

  // Ad Metrics
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;              // %
  cpc: number;              // $
  cpm: number;              // $

  // Store Funnel
  contentView: number;
  costPerContentView: number;
  checkout: number;
  costPerCheckout: number;
  cr1: number;              // %
  cr2: number;              // %
  cr: number;               // %

  // Revenue
  purchase: number;         // count (= conv)
  revenue: number;
  roas: number;
  conv: number;             // alias for purchase
}
```

### 2.9 Unattributed Bucket

Orders/events without UTM or with `utm_campaign=N/A`:

- Grouped into a synthetic row with `id: 'unattributed'`, `name: 'Unattributed'`
- Included in summary row totals
- Has funnel + revenue metrics but NO ad metrics (spend/impressions/clicks = 0)

### 2.10 Acceptance Criteria

- [ ] `GET /api/ads-manager/campaigns` returns unified rows with all columns
- [ ] `GET /api/ads-manager/adsets?campaignId=X` returns adset-level drilldown
- [ ] `GET /api/ads-manager/ads?adsetId=X` returns ad-level drilldown
- [ ] All derived metrics computed via `computeMetrics()` from METRICS-CONTRACT
- [ ] Summary row uses `computeSummaryRow()` — never averages ratios
- [ ] Date range filtering via dateFrom/dateTo
- [ ] Tenant isolation enforced (sellerId from JWT)
- [ ] No metric logic in controller — all in service
- [ ] Response time < 500ms for 100 campaigns x 30 days
- [ ] E2E tests: 15+ tests covering all 3 levels, filters, summary, tenant isolation

### 2.11 Estimated Effort

| Sub-task | Effort |
|----------|--------|
| AdsManagerReadService (3 methods) | 2 days |
| DTOs + Controller | 0.5 days |
| metrics.util.ts + unit tests | 0.5 days |
| E2E tests (15+) | 1 day |
| **Total** | **4 days** |

---

## 3. PART 3 — UTM Mapping Standard

### 3.1 Standard

| UTM Parameter | Format | Entity |
|---------------|--------|--------|
| `utm_campaign` | `c_<campaignId>` | Campaign |
| `utm_term` | `as_<adsetId>` | Adset |
| `utm_content` | `a_<adId>` | Ad |
| `utm_source` | `meta` / `google` / `tiktok` | Platform |
| `utm_medium` | `cpc` / `cpm` | Ad type |

### 3.2 Parsing Logic

```typescript
/**
 * Extract entity ID from UTM parameter value.
 * Returns null if format doesn't match.
 */
export function parseUtmEntityId(utmValue: string | null, prefix: string): string | null {
  if (!utmValue) return null;
  if (!utmValue.startsWith(prefix)) return null;
  const id = utmValue.slice(prefix.length);
  // Validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID_RE.test(id) ? id : null;
}

// Usage:
// parseUtmEntityId('c_550e8400-e29b-41d4-a716-446655440000', 'c_')
// → '550e8400-e29b-41d4-a716-446655440000'
//
// parseUtmEntityId('N/A', 'c_') → null  (→ unattributed bucket)
```

### 3.3 Schema Impact

The `Order` model needs UTM fields to enable attribution:

```prisma
// Add to Order model:
utmSource    String?  @map("utm_source") @db.VarChar(50)
utmMedium    String?  @map("utm_medium") @db.VarChar(50)
utmCampaign  String?  @map("utm_campaign") @db.VarChar(255)
utmTerm      String?  @map("utm_term") @db.VarChar(255)
utmContent   String?  @map("utm_content") @db.VarChar(255)
```

See Migration Plan (Section 5) for details.

### 3.4 Enforcement

- Sellpage checkout form MUST capture UTM params from URL query string and include them in the order creation payload.
- Order creation endpoint MUST store UTM fields on the Order row.
- AdsManagerReadService queries orders by UTM fields to compute revenue attribution.
- Missing/malformed UTM → `null` → goes into Unattributed bucket.

---

## 4. PART 4 — Orders Module Upgrade

### 4.1 transactionId Exposure

**Current state:** `Order.paymentId` exists in schema (line 618) but is excluded from API response (`orders.service.ts` select shape).

**Change:** Expose `paymentId` as `transactionId` in the `OrderDetail` response.

**File to modify:** `apps/api/src/orders/orders.service.ts`

```typescript
// In getOrder() select shape, add:
paymentId: true,

// In OrderDetail interface, add:
transactionId: string | null;

// In response mapping:
transactionId: order.paymentId ?? null,
```

**Effort:** 0.25 days (including test update)

### 4.2 Tracking Refresh via 17track

#### 4.2.1 New Endpoint

```
POST /api/orders/:id/refresh-tracking
```

**Behavior:**
1. Fetch order by ID + sellerId (tenant isolation)
2. If no `trackingNumber` → return 400 "No tracking number to refresh"
3. Call 17track API with `trackingNumber`
4. Update `trackingStatus` + `trackingUpdatedAt` on order
5. Return updated tracking info

#### 4.2.2 Schema Changes

Add to `Order` model:

```prisma
trackingStatus    String?   @map("tracking_status") @db.VarChar(50)
trackingCarrier   String?   @map("tracking_carrier") @db.VarChar(100)
trackingUpdatedAt DateTime? @map("tracking_updated_at") @db.Timestamptz
```

**Important:** `trackingStatus` is SEPARATE from `status` (OrderStatus). Order status reflects the business workflow (PENDING → CONFIRMED → SHIPPED). Tracking status reflects the physical shipment state (InTransit, OutForDelivery, Delivered, Exception).

#### 4.2.3 17track Provider Interface

```typescript
// apps/api/src/orders/providers/tracking.provider.ts

export interface TrackingResult {
  status: string;          // e.g., 'InTransit', 'Delivered', 'Exception'
  carrier: string;         // e.g., 'UPS', 'USPS', 'FedEx'
  lastEvent: string | null;
  lastEventAt: Date | null;
  estimatedDelivery: Date | null;
}

export interface TrackingProvider {
  getTrackingStatus(trackingNumber: string): Promise<TrackingResult>;
}
```

```typescript
// apps/api/src/orders/providers/seventrack.provider.ts

@Injectable()
export class SevenTrackProvider implements TrackingProvider {
  // Stub implementation for now.
  // Real implementation will call 17track API:
  //   POST https://api.17track.net/track/v2.2/gettrackinfo
  //   Body: [{ "number": trackingNumber }]
  //   Headers: { "17token": process.env.SEVENTEEN_TRACK_API_KEY }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingResult> {
    // STUB: return mock data
    return {
      status: 'InTransit',
      carrier: 'Unknown',
      lastEvent: null,
      lastEventAt: null,
      estimatedDelivery: null,
    };
  }
}
```

#### 4.2.4 Auto-Refresh Setting

Add to `SellerSettings` model:

```prisma
autoTrackingRefresh Boolean @default(false) @map("auto_tracking_refresh")
```

When enabled, a cron job (or BullMQ repeatable) refreshes tracking for all SHIPPED orders of this seller every 6 hours.

#### 4.2.5 Files to Create

```
apps/api/src/orders/providers/
├── tracking.provider.ts        ← Interface
└── seventrack.provider.ts      ← Stub implementation

apps/api/src/orders/dto/
└── refresh-tracking.dto.ts     ← (minimal — just validates :id param)
```

#### 4.2.6 Files to Modify

```
apps/api/src/orders/orders.controller.ts  ← Add POST /:id/refresh-tracking
apps/api/src/orders/orders.service.ts     ← Add refreshTracking(), expose paymentId
apps/api/src/orders/orders.module.ts      ← Register TrackingProvider
packages/database/prisma/schema.prisma    ← Add fields to Order + SellerSettings
```

#### 4.2.7 Acceptance Criteria

- [ ] `GET /api/orders/:id` includes `transactionId` field
- [ ] `POST /api/orders/:id/refresh-tracking` calls tracking provider
- [ ] Tracking status stored separately from order status
- [ ] 400 returned if order has no tracking number
- [ ] 404 returned if order not found or wrong seller
- [ ] Tenant isolation enforced
- [ ] Stub provider returns valid TrackingResult shape
- [ ] Provider interface allows future 17track swap without service changes
- [ ] E2E tests: 5+ covering happy path, no tracking number, wrong seller, provider error

#### 4.2.8 Estimated Effort

| Sub-task | Effort |
|----------|--------|
| transactionId exposure | 0.25 days |
| Tracking provider interface + stub | 0.5 days |
| refresh-tracking endpoint | 0.5 days |
| Schema migration (UTM + tracking fields) | 0.5 days |
| Auto-refresh cron setup (stub) | 0.5 days |
| E2E tests | 0.5 days |
| **Total** | **2.75 days** |

---

## 5. Migration Plan

### 5.1 Migration: `20260220_ads_manager_orders_upgrade`

This is a SINGLE migration containing all schema changes for milestone 2.3.X.

#### SQL Changes

```sql
-- 1. UTM fields on orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_term" VARCHAR(255);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(255);

-- 2. Tracking fields on orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_status" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_carrier" VARCHAR(100);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_updated_at" TIMESTAMPTZ;

-- 3. Auto-refresh setting on seller_settings
ALTER TABLE "seller_settings" ADD COLUMN IF NOT EXISTS "auto_tracking_refresh" BOOLEAN DEFAULT false NOT NULL;

-- 4. Index for UTM-based revenue attribution
CREATE INDEX IF NOT EXISTS "orders_utm_campaign_idx"
  ON "orders" ("seller_id", "utm_campaign", "created_at");
CREATE INDEX IF NOT EXISTS "orders_utm_term_idx"
  ON "orders" ("seller_id", "utm_term", "created_at");
CREATE INDEX IF NOT EXISTS "orders_utm_content_idx"
  ON "orders" ("seller_id", "utm_content", "created_at");

-- 5. Index for tracking refresh (find SHIPPED orders for auto-refresh)
CREATE INDEX IF NOT EXISTS "orders_tracking_refresh_idx"
  ON "orders" ("seller_id", "status", "tracking_number")
  WHERE "tracking_number" IS NOT NULL;
```

### 5.2 Prisma Schema Changes

**File:** `packages/database/prisma/schema.prisma`

Add to `Order` model (after `trackingUrl`, line 621):

```prisma
trackingStatus    String?   @map("tracking_status") @db.VarChar(50)
trackingCarrier   String?   @map("tracking_carrier") @db.VarChar(100)
trackingUpdatedAt DateTime? @map("tracking_updated_at") @db.Timestamptz
utmSource         String?   @map("utm_source") @db.VarChar(50)
utmMedium         String?   @map("utm_medium") @db.VarChar(50)
utmCampaign       String?   @map("utm_campaign") @db.VarChar(255)
utmTerm           String?   @map("utm_term") @db.VarChar(255)
utmContent        String?   @map("utm_content") @db.VarChar(255)
```

Add to `SellerSettings` model (after `googleAnalyticsId`, line 109):

```prisma
autoTrackingRefresh Boolean @default(false) @map("auto_tracking_refresh")
```

### 5.3 Migration Execution

```bash
# Generate migration (do NOT push directly)
cd packages/database
npx prisma migrate dev --name ads_manager_orders_upgrade

# Verify
npx prisma migrate status
npx prisma generate
```

### 5.4 Rollback Strategy

All changes are additive (new columns, new indexes). Rollback = drop added columns:

```sql
ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_source";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_medium";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_campaign";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_term";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "utm_content";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_status";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_carrier";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_updated_at";
ALTER TABLE "seller_settings" DROP COLUMN IF EXISTS "auto_tracking_refresh";
DROP INDEX IF EXISTS "orders_utm_campaign_idx";
DROP INDEX IF EXISTS "orders_utm_term_idx";
DROP INDEX IF EXISTS "orders_utm_content_idx";
DROP INDEX IF EXISTS "orders_tracking_refresh_idx";
```

---

## 6. Test Coverage Requirements

| Module | Min New E2E Tests | Coverage Focus |
|--------|:-----------------:|----------------|
| AdsManagerReadService | 15 | 3 levels x (happy, empty, filters, summary, tenant isolation) |
| Orders Upgrade | 5 | transactionId, refresh-tracking (happy, no tracking, wrong seller, provider error) |
| Metrics Util | 8 unit tests | safeDivide, computeMetrics (zero, normal, edge), computeSummaryRow |
| **Total** | **28** | |

---

## 7. Complete Files Registry

### New Files (14)

```
apps/api/src/shared/utils/metrics.util.ts
apps/api/src/ads-manager/ads-manager.module.ts
apps/api/src/ads-manager/ads-manager.controller.ts
apps/api/src/ads-manager/ads-manager.service.ts
apps/api/src/ads-manager/dto/ads-manager-query.dto.ts
apps/api/src/ads-manager/dto/ads-manager-response.dto.ts
apps/api/src/orders/providers/tracking.provider.ts
apps/api/src/orders/providers/seventrack.provider.ts
docs/METRICS-CONTRACT.md
docs/TECH-SPEC-V1-ADDENDUM-2.3.X.md
```

### Modified Files (5)

```
packages/database/prisma/schema.prisma    ← UTM + tracking + autoRefresh fields
apps/api/src/app.module.ts               ← Add AdsManagerModule
apps/api/src/orders/orders.service.ts     ← Expose transactionId, add refreshTracking()
apps/api/src/orders/orders.controller.ts  ← Add POST refresh-tracking
apps/api/src/orders/orders.module.ts      ← Register TrackingProvider
```

### Migration Files (auto-generated)

```
packages/database/prisma/migrations/20260220XXXXXX_ads_manager_orders_upgrade/migration.sql
```

---

## 8. Environment Variables

| Variable | App | Required | Purpose |
|----------|-----|----------|---------|
| `SEVENTEEN_TRACK_API_KEY` | api | Phase 2.3.X+ | 17track API authentication |

> Not required for stub implementation. Add when real 17track client is implemented.

---

## 9. Constraints Checklist

- [x] No `db push` — uses Prisma migrations only
- [x] Seller isolation maintained — all queries scoped by `sellerId` from JWT
- [x] No breaking existing API contracts — all changes are additive
- [x] No frontend changes — backend spec only
- [x] All metric logic centralized in `metrics.util.ts` and `AdsManagerReadService`
- [x] No logic duplication in controllers
- [x] CR uses contentView, NOT linkClicks
- [x] safeDivide used for all divisions
- [x] Never average ratios — aggregate counts first

---

## 10. Effort Summary

| Part | Sub-task | Effort |
|------|----------|--------|
| Part 1 | Metrics contract + metrics.util.ts | 0.5 days |
| Part 2 | AdsManagerReadService (3 levels) | 4 days |
| Part 3 | UTM mapping standard | 0.25 days (doc only, code in Part 2+5) |
| Part 4 | Orders upgrade (transactionId + tracking) | 2.75 days |
| Part 5 | Migration + schema changes | 0.5 days |
| | E2E + unit tests | 2 days |
| **TOTAL** | | **10 days** |

---

*Tech Spec Addendum v1 — Generated 2026-02-20*
*PixEcom v2 — Milestone 2.3.X*
