import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query params for GET /api/assets
 */
export class ListAssetsDto {
  /** Filter by media type */
  @IsOptional()
  @IsIn(['VIDEO', 'IMAGE', 'TEXT'])
  mediaType?: 'VIDEO' | 'IMAGE' | 'TEXT';

  /**
   * If true, return only platform assets (ownerSellerId IS NULL).
   * Defaults to false (return seller's own + platform assets).
   */
  @IsOptional()
  @IsIn(['true', 'false', true, false])
  platformOnly?: string | boolean;

  /** Page number (1-indexed). Default: 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Items per page. Default: 20, max: 100 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
