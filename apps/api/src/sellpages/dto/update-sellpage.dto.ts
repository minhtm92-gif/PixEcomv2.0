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
   * B.2 — Pixel assignment.
   * UUID of an active FbConnection (connectionType=PIXEL) owned by this seller.
   * Stored in headerConfig.pixelId.
   */
  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'pixelId must be a valid UUID' })
  pixelId?: string | null;
}
