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
  source: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
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

export interface OrderShippingAddress {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface OrderAttribution {
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
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
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAddress: OrderShippingAddress | null;
  paymentMethod: string | null;
  paymentId: string | null;
  attribution: OrderAttribution | null;
}

export interface ImportTrackingResult {
  updated: number;
  failed: number;
  errors: { row: number; orderNumber: string; reason: string }[];
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

export interface LinkedAdPost {
  externalPostId: string;
  pageId: string;
  createdAt: string;
}

export interface LinkedAd {
  id: string;
  name: string;
  status: string;
  adPost: LinkedAdPost | null;
}

export interface LinkedAdset {
  id: string;
  name: string;
  status: string;
  ads: LinkedAd[];
}

export interface LinkedCampaign {
  id: string;
  name: string;
  status: string;
  adsets: LinkedAdset[];
}

export interface LinkedAdsResponse {
  campaigns: LinkedCampaign[];
}

export interface CreateSellpageDto {
  productId: string;
  slug: string;
  domainId?: string;
  titleOverride?: string;
  descriptionOverride?: string;
}

export interface UpdateSellpageDto {
  slug?: string;
  domainId?: string;
  titleOverride?: string;
  descriptionOverride?: string;
}

// ── Products ──
export interface ProductLabel {
  id: string;
  name: string;
  slug: string;
}

export interface ProductCardItem {
  id: string;
  code: string;
  name: string;
  slug: string;
  heroImageUrl: string | null;
  /** Prisma Decimal serialized as string — use Number() */
  suggestedRetailPrice: string;
  /** Prisma Decimal serialized as string | null */
  youTakeEstimate: string | null;
  labels: ProductLabel[];
}

export interface ProductsListResponse {
  data: ProductCardItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  /** Prisma Decimal serialized as string */
  effectivePrice: string;
  /** Prisma Decimal serialized as string | null */
  compareAtPrice: string | null;
  options: Record<string, unknown>;
  stockQuantity: number;
  isActive: boolean;
  position: number;
}

export interface ProductDetail extends ProductCardItem {
  productCode: string;
  description: string | null;
  descriptionBlocks: unknown[];
  shippingInfo: Record<string, unknown>;
  tags: string[];
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}

// ── Seller Settings ──
export interface SellerProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
}

export interface SellerSettings {
  brandName: string;
  defaultCurrency: string;
  timezone: string;
  supportEmail: string;
  metaPixelId: string;
  googleAnalyticsId: string;
}

export interface UpdateSellerDto {
  name?: string;
  logoUrl?: string;
}

export interface UpdateSellerSettingsDto {
  brandName?: string;
  defaultCurrency?: string;
  timezone?: string;
  supportEmail?: string;
  metaPixelId?: string;
  googleAnalyticsId?: string;
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
