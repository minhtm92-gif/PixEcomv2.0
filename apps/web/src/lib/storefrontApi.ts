/**
 * Storefront API Client — public endpoints (no auth required).
 * Uses plain fetch with the same API base URL.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function sfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}/storefront${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    let payload: any = {};
    try {
      payload = await res.json();
    } catch {}
    throw new Error(payload.message ?? `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StoreData {
  store: {
    name: string;
    slug: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    currency: string;
  };
  sellpages: Array<{
    slug: string;
    title: string;
    product: {
      name: string;
      basePrice: number;
      compareAtPrice: number | null;
      heroImage: string | null;
      rating: number;
      reviewCount: number;
    };
    category: string | null;
    badge: string | null;
  }>;
}

export interface SellpageVariant {
  id: string;
  name: string;
  sku: string | null;
  priceOverride: number | null;
  compareAtPrice: number | null;
  options: Record<string, unknown>;
  stockQuantity: number;
  isActive: boolean;
  image: string | null;
}

export interface SellpageDiscount {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  label: string;
}

export interface SellpageData {
  sellpage: {
    id: string;
    slug: string;
    title: string;
    description: string;
    seoTitle: string | null;
    seoDescription: string | null;
    seoOgImage: string | null;
    boostModules: unknown[];
    headerConfig: Record<string, unknown>;
    footerConfig: Record<string, unknown>;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    compareAtPrice: number | null;
    currency: string;
    description: string;
    descriptionBlocks: unknown[];
    shippingInfo: Record<string, unknown>;
    rating: number;
    reviewCount: number;
    allowOutOfStockPurchase: boolean;
    images: string[];
    thumbnails: string[];
    variants: SellpageVariant[];
  };
  store: {
    name: string;
    slug: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    currency: string;
  };
  discounts: SellpageDiscount[];
  reviews: SellpageReview[];
  socialProof: { viewers: number; purchased: number };
}

export interface SellpageReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  images: string[];
}

export interface CheckoutRequest {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  shippingMethod: 'standard' | 'express' | 'overnight';
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
  discountId?: string;
  paymentMethod: 'stripe' | 'paypal';
  sellpageSlug: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  total: number;
  payment:
    | { type: 'stripe'; clientSecret: string }
    | { type: 'paypal'; paypalOrderId: string; approvalUrl: string };
}

export interface OrderTrackingData {
  orderNumber: string;
  status: string;
  customerName: string | null;
  total: number;
  currency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAddress: Record<string, unknown>;
  createdAt: string;
  items: Array<{
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  timeline: Array<{
    type: string;
    description: string | null;
    at: string;
  }>;
}

// ─── API Functions ──────────────────────────────────────────────────────────

export async function fetchStore(sellerSlug: string): Promise<StoreData> {
  return sfFetch<StoreData>(`/${sellerSlug}`);
}

export async function fetchSellpage(
  sellerSlug: string,
  sellpageSlug: string,
): Promise<SellpageData> {
  return sfFetch<SellpageData>(`/${sellerSlug}/${sellpageSlug}`);
}

export async function submitCheckout(
  sellerSlug: string,
  data: CheckoutRequest,
): Promise<CheckoutResponse> {
  return sfFetch<CheckoutResponse>(`/${sellerSlug}/checkout`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function confirmPayment(
  sellerSlug: string,
  orderId: string,
  data: { paymentIntentId?: string; paypalOrderId?: string },
): Promise<{ success: boolean; orderNumber: string }> {
  return sfFetch(`/${sellerSlug}/checkout/${orderId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function trackOrder(
  sellerSlug: string,
  orderNumber: string,
  email: string,
): Promise<OrderTrackingData> {
  const params = new URLSearchParams({ orderNumber, email });
  return sfFetch<OrderTrackingData>(`/${sellerSlug}/track?${params}`);
}

export interface SubmitReviewRequest {
  authorName: string;
  authorEmail: string;
  rating: number;
  title: string;
  body: string;
  images?: string[];
  orderId?: string;
  productId: string;
}

export async function submitReview(
  sellerSlug: string,
  data: SubmitReviewRequest,
): Promise<{ id: string; status: string; isVerified: boolean }> {
  return sfFetch(`/${sellerSlug}/reviews`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
