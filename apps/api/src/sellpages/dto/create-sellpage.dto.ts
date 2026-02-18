import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * DTO for POST /api/sellpages
 *
 * Required:
 *   productId — must reference an existing (ACTIVE) product
 *   slug      — unique within this seller's sellpages (enforced by DB unique constraint)
 *
 * Optional:
 *   domainId        — must belong to the authenticated seller (validated in service)
 *   titleOverride   — overrides product name on the sellpage
 *   descriptionOverride — overrides product description
 */
export class CreateSellpageDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsUUID()
  domainId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleOverride?: string;

  @IsOptional()
  @IsString()
  descriptionOverride?: string;
}
