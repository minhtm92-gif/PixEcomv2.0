/**
 * field-mapper.ts
 *
 * Maps raw Meta Insights API response fields → PixEcom DB field names.
 *
 * ⚠️  CRITICAL: Use DB column names (linkClicks, contentViews, etc.),
 * NOT the metrics-contract names (clicks, contentView, etc.).
 *
 * Rule: NEVER average ratios. SUM raw counters first, then derive.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single action item from Meta's "actions" or "action_values" array */
export interface MetaActionItem {
  action_type: string;
  value: string; // Meta returns numbers as strings
}

/** Raw row returned by Meta Insights API for one entity (campaign/adset/ad) */
export interface MetaInsightRow {
  /** Internal ID used to match the entity in our DB */
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;

  /** Always present */
  date_start: string;
  date_stop: string;

  spend?: string;
  impressions?: string;

  /** inline_link_clicks → linkClicks */
  inline_link_clicks?: string;

  /** Complex action arrays */
  actions?: MetaActionItem[];
  action_values?: MetaActionItem[];
}

/** Fully mapped, numeric DB-field record */
export interface MappedStats {
  dateStart: string;   // YYYY-MM-DD
  dateStop: string;    // YYYY-MM-DD
  spend: number;
  impressions: number;
  linkClicks: number;
  contentViews: number;
  checkoutInitiated: number;
  purchases: number;
  purchaseValue: number;
  // Derived ratios (computed here for convenience — caller may re-derive after aggregation)
  cpm: number;
  ctr: number;
  cpc: number;
  costPerPurchase: number;
  roas: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely divide — returns 0 when denominator is 0 or NaN */
export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || !isFinite(denominator) || !isFinite(numerator)) return 0;
  return numerator / denominator;
}

/** Parse Meta string number → JS number, defaulting to 0 */
function num(val: string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Find the value for a specific action_type inside a Meta actions array.
 * Returns 0 if not found.
 */
export function findActionValue(
  actions: MetaActionItem[] | undefined,
  type: string,
): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === type);
  return match ? num(match.value) : 0;
}

// ─── Core mapper ─────────────────────────────────────────────────────────────

/**
 * Map one Meta Insights API row to DB-ready numeric fields.
 *
 * Meta action_type constants:
 *   content_view         → contentViews
 *   initiate_checkout    → checkoutInitiated
 *   purchase             → purchases (count)
 *   purchase (in action_values) → purchaseValue (revenue)
 */
export function mapInsightRow(row: MetaInsightRow): MappedStats {
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const linkClicks = num(row.inline_link_clicks);
  const contentViews = findActionValue(row.actions, 'content_view');
  const checkoutInitiated = findActionValue(row.actions, 'initiate_checkout');
  const purchases = findActionValue(row.actions, 'purchase');
  const purchaseValue = findActionValue(row.action_values, 'purchase');

  // Derive ratios after raw values are known (never average ratios)
  const cpm = safeDivide(spend, impressions) * 1000;
  const ctr = safeDivide(linkClicks, impressions) * 100;
  const cpc = safeDivide(spend, linkClicks);
  const costPerPurchase = safeDivide(spend, purchases);
  const roas = safeDivide(purchaseValue, spend);

  return {
    dateStart: row.date_start,
    dateStop: row.date_stop,
    spend,
    impressions,
    linkClicks,
    contentViews,
    checkoutInitiated,
    purchases,
    purchaseValue,
    cpm,
    ctr,
    cpc,
    costPerPurchase,
    roas,
  };
}

/**
 * Aggregate multiple MappedStats rows into one.
 * Sums all raw counters, then re-derives ratios from the sums.
 * This is the ONLY correct way to combine stats rows.
 */
export function aggregateStats(rows: MappedStats[]): Omit<MappedStats, 'dateStart' | 'dateStop'> {
  let spend = 0;
  let impressions = 0;
  let linkClicks = 0;
  let contentViews = 0;
  let checkoutInitiated = 0;
  let purchases = 0;
  let purchaseValue = 0;

  for (const r of rows) {
    spend += r.spend;
    impressions += r.impressions;
    linkClicks += r.linkClicks;
    contentViews += r.contentViews;
    checkoutInitiated += r.checkoutInitiated;
    purchases += r.purchases;
    purchaseValue += r.purchaseValue;
  }

  // Re-derive after summing (never average ratios)
  const cpm = safeDivide(spend, impressions) * 1000;
  const ctr = safeDivide(linkClicks, impressions) * 100;
  const cpc = safeDivide(spend, linkClicks);
  const costPerPurchase = safeDivide(spend, purchases);
  const roas = safeDivide(purchaseValue, spend);

  return {
    spend,
    impressions,
    linkClicks,
    contentViews,
    checkoutInitiated,
    purchases,
    purchaseValue,
    cpm,
    ctr,
    cpc,
    costPerPurchase,
    roas,
  };
}
