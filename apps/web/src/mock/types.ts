// ───────────────────────────────────────────
// Shared mock types — mirrors backend DTOs
// ───────────────────────────────────────────

/** Product label / tag */
export interface ProductLabelDto {
  id: string;
  name: string;
  slug: string;
}

/** Product card — list endpoint shape */
export interface ProductCardDto {
  id: string;
  code: string;
  name: string;
  slug: string;
  heroImageUrl: string | null;
  suggestedRetailPrice: string;
  youTakeEstimate: string | null;
  labels: ProductLabelDto[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

/** Product variant */
export interface ProductVariantDto {
  id: string;
  name: string;
  sku: string | null;
  effectivePrice: string;
  compareAtPrice: string | null;
  options: Record<string, unknown>;
  stockQuantity: number;
  isActive: boolean;
  position: number;
}

/** Product detail — extends card */
export interface ProductDetailDto extends ProductCardDto {
  productCode: string;
  description: string | null;
  descriptionBlocks: unknown[];
  shippingInfo: Record<string, unknown>;
  tags: string[];
  currency: string;
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}

/** Sellpage stats stub */
export interface SellpageStats {
  revenue: number;
  cost: number;
  youTake: number;
  hold: number;
  cashToBalance: number;
}

/** Sellpage card — list endpoint shape */
export interface SellpageCardDto {
  id: string;
  sellerId: string;
  productId: string;
  domainId: string | null;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sellpageType: 'SINGLE' | 'MULTIPLE';
  titleOverride: string | null;
  descriptionOverride: string | null;
  urlPreview: string;
  stats: SellpageStats;
  createdAt: string;
  updatedAt: string;
  /** Joined from product for display */
  productName?: string;
}

/** Order item */
export interface OrderItemDto {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  heroImageUrl: string | null;
}

/** Order card — list endpoint shape */
export interface OrderCardDto {
  id: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED' | 'PARTIAL';
  totalAmount: string;
  currency: string;
  itemCount: number;
  items: OrderItemDto[];
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  sellpageSlug: string;
  createdAt: string;
  updatedAt: string;
}

/** Asset (media registry) */
export interface AssetDto {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  tags: string[];
  createdAt: string;
}

/** Creative (ad creative) */
export interface CreativeDto {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  status: 'DRAFT' | 'READY' | 'IN_USE' | 'ARCHIVED';
  primaryText: string;
  headline: string;
  callToAction: string;
  thumbnailUrl: string;
  assetIds: string[];
  productId: string | null;
  productName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Campaign (ads manager) */
export interface CampaignDto {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'COMPLETED' | 'ERROR';
  platform: 'FACEBOOK' | 'TIKTOK' | 'GOOGLE';
  objective: string;
  dailyBudget: string;
  totalSpent: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: string;
  cpc: string;
  roas: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Dashboard KPI */
export interface DashboardKpi {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  conversionRate: number;
  revenueDelta: number;
  ordersDelta: number;
  aovDelta: number;
  conversionDelta: number;
}
