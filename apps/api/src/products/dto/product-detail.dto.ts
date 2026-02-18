import { ProductCardDto } from './product-card.dto';

/**
 * Full product detail — returned by GET /api/products/:id
 *
 * Extends the catalog card with variants, full description,
 * shipping info, and tags.
 */
export interface ProductVariantDto {
  id: string;
  name: string;
  sku: string | null;
  /**
   * effectivePrice = priceOverride if set, else Product.basePrice.
   * This is the selling price for this variant.
   */
  effectivePrice: string;
  compareAtPrice: string | null;
  options: Record<string, unknown>;
  stockQuantity: number;
  isActive: boolean;
  position: number;
}

export interface ProductDetailDto extends ProductCardDto {
  productCode: string;
  description: string | null;
  descriptionBlocks: unknown[];
  shippingInfo: Record<string, unknown>;
  tags: string[];
  currency: string;
  status: string;
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}
