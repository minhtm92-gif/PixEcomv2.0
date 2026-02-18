import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsIn,
} from 'class-validator';

const CREATIVE_TYPES = ['VIDEO_AD', 'IMAGE_AD', 'TEXT_ONLY', 'UGC_BUNDLE'] as const;
export type CreativeTypeValue = (typeof CREATIVE_TYPES)[number];

export class CreateCreativeDto {
  /** Display name for this creative bundle */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /**
   * Creative type — drives which asset slots are required for READY validation.
   * Defaults to VIDEO_AD.
   */
  @IsOptional()
  @IsIn(CREATIVE_TYPES)
  creativeType?: CreativeTypeValue;

  /**
   * Product this creative is intended to promote (optional, for BI context).
   * Must be an existing product ID (no seller ownership check — products are platform-owned).
   */
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Arbitrary metadata blob */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
