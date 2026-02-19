export interface RawStatRow {
  sellerId: string;
  entityType: 'CAMPAIGN' | 'ADSET' | 'AD';
  entityId: string;          // internal UUID
  externalEntityId: string;  // externalCampaignId / externalAdsetId / externalAdId (falls back to entityId)
  fetchedAt: Date;
  dateStart: Date;
  dateStop: Date;

  // Money
  spend: number;             // Decimal(10,2)
  purchaseValue: number;     // Decimal(10,2)

  // Volume (integers)
  impressions: number;
  linkClicks: number;
  contentViews: number;
  addToCart: number;
  checkoutInitiated: number;
  purchases: number;

  // Derived ratios (re-computed from summed totals in aggregation stage)
  cpm: number;               // spend / impressions * 1000
  ctr: number;               // linkClicks / impressions
  cpc: number;               // spend / linkClicks
  costPerPurchase: number;   // spend / purchases
  roas: number;              // purchaseValue / spend
}

export interface StatProvider {
  fetchStats(
    sellerId: string,
    level: 'CAMPAIGN' | 'ADSET' | 'AD',
    entities: Array<{ id: string; externalId: string | null; budget: number }>,
    dateFrom: string,
    dateTo: string,
  ): Promise<RawStatRow[]>;
}
