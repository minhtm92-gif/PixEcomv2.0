import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

/** UUID shape — accepts v0-v8 and seed UUIDs */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DTO for PATCH /api/sellpages/:id
 *
 * All fields are optional — caller must supply at least one.
 * (Validated in the service to ensure the update is not a no-op.)
 *
 * Note: status transitions (publish / unpublish) have dedicated endpoints.
 * For DRAFT ↔ PUBLISHED use POST /:id/publish and POST /:id/unpublish.
 */
export class UpdateSellpageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsUUID()
  domainId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleOverride?: string;

  @IsOptional()
  @IsString()
  descriptionOverride?: string;

  /**
   * B.1 — Custom/subdomain assignment (DNS-safe string).
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i, {
    message: 'customDomain must be alphanumeric with optional hyphens',
  })
  customDomain?: string;

  /**
   * B.2 — Facebook Pixel ID (raw numeric string like "123456789012345").
   * Stored in headerConfig.pixelId.
   */
  @IsOptional()
  @IsString()
  pixelId?: string | null;

  /**
   * B.3 — Primary theme color for the sellpage storefront.
   * Accepts a preset name (e.g. "blue") or hex string (e.g. "#2563eb").
   * Stored in headerConfig.primaryColor.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string | null;

  /**
   * Guarantee badges configuration.
   * Stored in headerConfig.guarantees.
   */
  @IsOptional()
  guaranteeConfig?: Record<string, unknown>;

  /**
   * Boost & upsell modules array.
   * Stored directly in sellpages.boost_modules.
   */
  @IsOptional()
  boostModules?: Record<string, unknown>[];

  /**
   * Shipping configuration.
   * Stored in headerConfig.shipping.
   * Pass null to remove custom shipping and revert to default.
   */
  @IsOptional()
  shippingConfig?: Record<string, unknown> | null;

  /**
   * Checkout form configuration.
   * Stored in headerConfig.checkoutForm.
   * Controls payment methods available at checkout (PAYPAL_ONLY or PAYPAL_AND_CARD).
   */
  @IsOptional()
  @IsString()
  checkoutForm?: string;
}
