/* ─────────────────────────────────────────────
 *  API response types — matches backend contracts exactly
 * ───────────────────────────────────────────── */

// ── Orders ──
export interface OrderListItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  sellpage: { id: string; url: string } | null;
  customer: { email: string; name: string | null };
  total: number;
  currency: string;
  status: string;
  itemsCount: number;
}

export interface OrderListResponse {
  items: OrderListItem[];
  nextCursor: string | null;
}

export interface OrderDetailItem {
  productTitle: string;
  variantTitle: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderEvent {
  type: string;
  at: string;
  note: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  createdAt: string;
  sellpage: { id: string; url: string } | null;
  customer: { email: string; name: string | null; phone: string | null };
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    currency: string;
  };
  status: string;
  items: OrderDetailItem[];
  events: OrderEvent[];
}

// ── Ads Manager metrics shape (shared by campaign/adset/ad) ──
export interface AdsMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  contentViews: number;
  costPerContentView: number;
  checkout: number;
  costPerCheckout: number;
  purchases: number;
  roas: number;
  cr: number;
  cr1: number;
  cr2: number;
  storeMetricsPending: boolean;
}

export interface Campaign extends AdsMetrics {
  id: string;
  name: string;
  platform: string;
  status: string;
  deliveryStatus: string | null;
  budgetPerDay: number | null;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
  summary: AdsMetrics;
}

export interface Adset extends AdsMetrics {
  id: string;
  campaignId: string;
  name: string;
  platform: string;
  status: string;
  deliveryStatus: string | null;
  optimizationGoal: string | null;
  budgetPerDay: number | null;
}

export interface AdsetsResponse {
  adsets: Adset[];
  summary: AdsMetrics;
}

export interface Ad extends AdsMetrics {
  id: string;
  adsetId: string;
  campaignId: string;
  name: string;
  platform: string;
  status: string;
  deliveryStatus: string | null;
  budgetPerDay: number | null;
}

export interface AdsResponse {
  ads: Ad[];
  summary: AdsMetrics;
}

export interface AdsFiltersResponse {
  campaigns: { id: string; name: string; status: string }[];
  adsets: { id: string; name: string; status: string; campaignId: string }[];
  ads: { id: string; name: string; status: string; adsetId: string }[];
  statusEnums: string[];
}

// ── Sellpages ──
export interface SellpageListItem {
  id: string;
  sellerId: string;
  productId: string;
  domainId: string | null;
  slug: string;
  status: string;
  sellpageType: string;
  titleOverride: string | null;
  descriptionOverride: string | null;
  urlPreview: string;
  stats: {
    revenue: number;
    cost: number;
    youTake: number;
    hold: number;
    cashToBalance: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SellpagesListResponse {
  data: SellpageListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SellpageDetail extends SellpageListItem {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: string;
    heroImageUrl: string | null;
  };
}

// ── Health ──
export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  requestId: string;
  db: string;
  redis: string;
}
