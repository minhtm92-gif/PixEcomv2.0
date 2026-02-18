import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

/**
 * DTO for PATCH /api/sellpages/:id
 *
 * All fields are optional — caller must supply at least one.
 * (Validated in the service to ensure the update is not a no-op.)
 *
 * Note: status transitions (publish / unpublish) have dedicated endpoints.
 * The only status value allowed here is ARCHIVED (soft-archive a sellpage).
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
}
