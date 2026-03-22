export const CAMPAIGN_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
  'DRAFT',
  'COMPLETED',
] as const;

export type CampaignStatusFilter = (typeof CAMPAIGN_STATUSES)[number];

/** Platform is always META in Phase 1 */
export const DEFAULT_PLATFORM = 'META' as const;

/** N/A sentinel used in ad_source — must never be mixed with real UTM sources */
export const UTM_NA = 'N/A';

/**
 * Derive date range WHERE clause from optional YYYY-MM-DD strings.
 * Returns { gte, lte } using start-of-day / end-of-day UTC boundaries.
 *
 * Timezone coverage: Meta stores stats dates in the ad account's timezone
 * (e.g. America/Los_Angeles). A user in UTC+7 requesting "today" (March 22)
 * may need data from March 21 in the ad account's timezone. We expand the
 * `gte` boundary by 1 day to ensure no data is missed due to the timezone
 * offset between the user and the ad account. The extra day is harmless for
 * aggregate queries (getCampaigns/getAdsets/getAds) because the data simply
 * sums correctly, and getDailyStats handles per-day grouping separately.
 */
export function buildDateRange(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) {
    const d = new Date(`${dateFrom}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1); // Expand 1 day back for timezone coverage
    range.gte = d;
  }
  if (dateTo) {
    range.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  return range;
}

/**
 * Original date range without timezone expansion — used internally when
 * the caller needs the exact user-requested boundaries (e.g. getDailyStats
 * which handles timezone adjustment itself).
 */
export function buildExactDateRange(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) {
    range.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    range.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
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

export interface RawAdStats {
  spend: number;
  impressions: number;
  linkClicks: number;
  contentViews: number;
  addToCart: number;
  checkoutInitiated: number;
  purchases: number;
  purchaseValue: number;
}

export interface DerivedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;           // clicks / impressions * 100
  cpc: number;           // spend / clicks
  cpm: number;           // spend / impressions * 1000
  contentViews: number;
  costPerContentView: number; // spend / contentViews
  addToCart: number;
  costPerAddToCart: number;   // spend / addToCart
  checkout: number;
  costPerCheckout: number;    // spend / checkout
  purchases: number;
  roas: number;               // purchaseValue / spend
  cr: number;                 // purchases / contentViews * 100
  cr1: number;                // checkout / contentViews * 100
  cr2: number;                // purchases / checkout * 100
  /** true when no ad_stats_daily rows found for this entity in the date range */
  storeMetricsPending: boolean;
}

/**
 * Compute all derived metrics from raw summed aggregates.
 * Aggregation rule: always sum raw counts first, THEN derive ratios.
 */
export function computeMetrics(raw: RawAdStats): DerivedMetrics {
  const hasStat =
    raw.spend > 0 ||
    raw.impressions > 0 ||
    raw.linkClicks > 0 ||
    raw.contentViews > 0 ||
    raw.purchases > 0;

  return {
    spend: raw.spend,
    impressions: raw.impressions,
    clicks: raw.linkClicks,
    ctr: safeDivide(raw.linkClicks, raw.impressions) * 100,
    cpc: safeDivide(raw.spend, raw.linkClicks),
    cpm: safeDivide(raw.spend, raw.impressions) * 1000,
    contentViews: raw.contentViews,
    costPerContentView: safeDivide(raw.spend, raw.contentViews),
    addToCart: raw.addToCart,
    costPerAddToCart: safeDivide(raw.spend, raw.addToCart),
    checkout: raw.checkoutInitiated,
    costPerCheckout: safeDivide(raw.spend, raw.checkoutInitiated),
    purchases: raw.purchases,
    roas: safeDivide(raw.purchaseValue, raw.spend),
    cr: safeDivide(raw.purchases, raw.contentViews) * 100,
    cr1: safeDivide(raw.checkoutInitiated, raw.contentViews) * 100,
    cr2: safeDivide(raw.purchases, raw.checkoutInitiated) * 100,
    storeMetricsPending: !hasStat,
  };
}

/** Zero raw aggregates — used when no stats rows found */
export function zeroRaw(): RawAdStats {
  return {
    spend: 0,
    impressions: 0,
    linkClicks: 0,
    contentViews: 0,
    addToCart: 0,
    checkoutInitiated: 0,
    purchases: 0,
    purchaseValue: 0,
  };
}
