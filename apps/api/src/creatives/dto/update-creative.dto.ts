import {
  IsString,
  IsOptional,
  MaxLength,
  IsUUID,
  IsIn,
} from 'class-validator';

export class UpdateCreativeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

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
