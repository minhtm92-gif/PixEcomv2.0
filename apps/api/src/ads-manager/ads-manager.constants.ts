// Actual CampaignStatus enum values from schema
export const CAMPAIGN_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
  'DELETED',
] as const;

export type CampaignStatusFilter = (typeof CAMPAIGN_STATUSES)[number];

/** Platform is always META in Phase 1 */
export const DEFAULT_PLATFORM = 'META' as const;

/**
 * Derive date range WHERE clause from optional YYYY-MM-DD strings.
 * Returns { gte, lte } using start-of-day / end-of-day UTC boundaries.
 */
export function buildDateRange(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) range.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  if (dateTo) range.lte = new Date(`${dateTo}T23:59:59.999Z`);
  return range;
}

/**
 * Safe division — returns 0 when denominator is 0 or falsy.
 * Per METRICS-CONTRACT.md (frozen).
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

// ── Ads-side raw (from ad_stats_daily) ──────────────────────────────────────

export interface RawAdStats {
  spend: number;
  impressions: number;
  linkClicks: number;
}

// ── Store-side raw (from store_entity_stats_daily) ───────────────────────────

export interface RawStoreStats {
  contentViews: number;
  checkouts: number;
  purchases: number;
  revenue: number;
}

export function zeroAdRaw(): RawAdStats {
  return { spend: 0, impressions: 0, linkClicks: 0 };
}

export function zeroStoreRaw(): RawStoreStats {
  return { contentViews: 0, checkouts: 0, purchases: 0, revenue: 0 };
}

// ── Derived metrics (contract shape returned by API) ─────────────────────────

export interface DerivedMetrics {
  // Ads-side
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;                 // clicks / impressions × 100
  cpc: number;                 // spend / clicks

  // Store-side
  contentViews: number;
  costPerContentView: number;  // spend / contentViews
  checkout: number;
  costPerCheckout: number;     // spend / checkouts
  purchases: number;
  roas: number;                // revenue / spend

  // Conversion rates (store-side, per METRICS-CONTRACT)
  cr: number;                  // purchases / contentViews × 100
  cr1: number;                 // checkouts / contentViews × 100
  cr2: number;                 // purchases / checkouts × 100

  /** true when NO store_entity_stats_daily rows exist for this entity in range */
  storeMetricsPending: boolean;
}

/**
 * Compute all derived metrics from raw summed aggregates.
 *
 * Rules (METRICS-CONTRACT.md — frozen):
 *  - Always aggregate raw counts first, THEN derive ratios
 *  - safeDivide returns 0, never null/NaN
 *  - CR metrics use store-side data (contentViews, checkouts, purchases, revenue)
 *  - CTR/CPC use ads-side data (linkClicks, impressions, spend)
 *  - ROAS = store revenue / ad spend (cross-source)
 */
export function computeMetrics(
  ad: RawAdStats,
  store: RawStoreStats,
): DerivedMetrics {
  const hasAdStat = ad.spend > 0 || ad.impressions > 0 || ad.linkClicks > 0;
  const hasStoreStat =
    store.contentViews > 0 ||
    store.checkouts > 0 ||
    store.purchases > 0 ||
    store.revenue > 0;

  return {
    // Ads-side
    spend: ad.spend,
    impressions: ad.impressions,
    clicks: ad.linkClicks,
    ctr: safeDivide(ad.linkClicks, ad.impressions) * 100,
    cpc: safeDivide(ad.spend, ad.linkClicks),

    // Store-side
    contentViews: store.contentViews,
    costPerContentView: safeDivide(ad.spend, store.contentViews),
    checkout: store.checkouts,
    costPerCheckout: safeDivide(ad.spend, store.checkouts),
    purchases: store.purchases,
    roas: safeDivide(store.revenue, ad.spend),

    // Conversion rates
    cr: safeDivide(store.purchases, store.contentViews) * 100,
    cr1: safeDivide(store.checkouts, store.contentViews) * 100,
    cr2: safeDivide(store.purchases, store.checkouts) * 100,

    storeMetricsPending: !hasAdStat && !hasStoreStat,
  };
}

/**
 * Aggregate all entries in an ad stats map into one summary RawAdStats.
 */
export function aggregateAdSummary(
  map: Record<string, RawAdStats>,
): RawAdStats {
  const total = zeroAdRaw();
  for (const raw of Object.values(map)) {
    total.spend += raw.spend;
    total.impressions += raw.impressions;
    total.linkClicks += raw.linkClicks;
  }
  return total;
}

/**
 * Aggregate all entries in a store stats map into one summary RawStoreStats.
 */
export function aggregateStoreSummary(
  map: Record<string, RawStoreStats>,
): RawStoreStats {
  const total = zeroStoreRaw();
  for (const raw of Object.values(map)) {
    total.contentViews += raw.contentViews;
    total.checkouts += raw.checkouts;
    total.purchases += raw.purchases;
    total.revenue += raw.revenue;
  }
  return total;
}
