import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query parameters for GET /api/products
 *
 * All fields are optional — defaults are applied in the service.
 */
export class ListProductsDto {
  /**
   * Page number (1-based). Default: 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Items per page. Default: 20, max: 100
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  /**
   * Filter by label slug (e.g. "bestseller", "new-arrival")
   * Matches products that have this label attached.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  /**
   * Full-text search against product name and productCode.
   * Case-insensitive contains match.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
}
