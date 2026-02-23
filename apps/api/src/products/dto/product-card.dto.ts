/**
 * Product card — returned in the catalog list (GET /api/products).
 *
 * youTakeEstimate pricing logic:
 *   1. Find the currently-active PricingRule for this product
 *      (isActive=true, effectiveFrom <= now, effectiveUntil is null OR > now)
 *      If multiple, pick the one with the latest effectiveFrom.
 *   2. If sellerTakeFixed is set  → youTakeEstimate = sellerTakeFixed
 *   3. Else                       → youTakeEstimate = suggestedRetail * (sellerTakePercent / 100)
 *   4. If no active rule          → youTakeEstimate = null
 *
 * All monetary values are strings (Decimal serialisation from Prisma).
 * Callers should parse as float for display.
 */
export interface ProductStatsDto {
  /** Number of distinct orders that contain this product (scoped to seller). */
  ordersCount: number;
  /** Total revenue = SUM(OrderItem.lineTotal) for seller's orders. */
  revenue: number;
  /** Total ad spend linked to this product. Phase 1: always 0. */
  spend: number;
  /** Revenue / spend. Phase 1: always 0 (spend=0 → safeDivide returns 0). */
  roas: number;
}

export interface ProductCardDto {
  id: string;
  code: string;
  name: string;
  slug: string;

  /** The primary thumbnail URL for the card hero image (first isCurrent thumbnail). */
  heroImageUrl: string | null;

  /**
   * suggestedRetailPrice — sourced from the active PricingRule.suggestedRetail.
   * Falls back to Product.basePrice if no pricing rule exists.
   */
  suggestedRetailPrice: string;

  /**
   * youTakeEstimate — see class doc above for computation logic.
   * null if no active pricing rule is found.
   */
  youTakeEstimate: string | null;

  labels: ProductLabelDto[];

  /**
   * Performance stats (seller-scoped). Present in list response; absent in detail.
   * Phase 1: spend/roas are always 0 (no Product→Campaign→AdStatsDaily link yet).
   */
  stats?: ProductStatsDto;
}

export interface ProductLabelDto {
  id: string;
  name: string;
  slug: string;
}
