import {
  IsString,
  IsOptional,
  MaxLength,
  IsUUID,
  IsIn,
} from 'class-validator';

const CREATIVE_TYPES = [
  'VIDEO_AD', 'IMAGE_AD', 'TEXT_ONLY', 'UGC_BUNDLE',
  'ADTEXT', 'VIDEO', 'THUMBNAIL', 'HEADLINE', 'DESCRIPTION',
] as const;

export class UpdateCreativeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** Change the creative type (also resets validation requirements). */
  @IsOptional()
  @IsIn(CREATIVE_TYPES)
  creativeType?: (typeof CREATIVE_TYPES)[number];

  @IsOptional()
  @IsUUID()
  productId?: string;

  /**
   * Status can be set to ARCHIVED to retire a creative.
   * Use POST /api/creatives/:id/validate to transition DRAFT → READY.
   */
  @IsOptional()
  @IsIn(['ARCHIVED'])
  status?: 'ARCHIVED';

  @IsOptional()
  metadata?: Record<string, unknown>;
}
