import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateCreativeDto {
  /** Display name for this creative bundle */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

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
