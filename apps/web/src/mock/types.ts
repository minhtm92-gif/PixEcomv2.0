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

/** Order status — mirrors backend enum */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

/** Order list item — matches OrderListItem from orders.service */
export interface OrderListItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  sellpage: { id: string; url: string } | null;
  customer: { email: string; name: string | null };
  total: number;
  currency: string;
  status: OrderStatus;
  itemsCount: number;
}

/** Order detail item — line item in order */
export interface OrderDetailItem {
  productTitle: string;
  variantTitle: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Order event — timeline entry */
export interface OrderEvent {
  type: string;
  at: string;
  note: string | null;
}

/** Order detail — full detail response */
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
  status: OrderStatus;
  items: OrderDetailItem[];
  events: OrderEvent[];
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  paymentMethod?: string | null;
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
